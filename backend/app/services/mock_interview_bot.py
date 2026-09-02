import os
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.db.models import Candidate, Job, InterviewPracticeSession, AuditLog

class MockInterviewBot:
    """
    AI-powered Mock Interview Practice engine.
    Job-aware, niche-aware questioning, adaptive follow-up probing,
    and structured explainable scorecard generation.
    """

    @staticmethod
    def generate_questions(job: Optional[Job] = None, niche: str = "tech") -> List[Dict[str, Any]]:
        niche = (job.niche if job and job.niche else niche).lower()
        title = job.title if job and job.title else ("Software Engineer" if niche == "tech" else "Account Executive")
        
        must_skills = job.must_have_skills if job and job.must_have_skills else []
        skills_str = ", ".join(must_skills[:3]) if must_skills else ("modern system design & cloud tools" if niche == "tech" else "enterprise prospecting & CRM")

        if niche == "sales":
            return [
                {
                    "id": "q1",
                    "category": "Discovery & Qualification",
                    "question": f"For the {title} role, could you walk me through your typical discovery call process? How do you identify the prospect's budget, decision-maker, and core pain points?",
                    "probe_triggers": ["quick call", "ask questions", "pitch directly", "email them"]
                },
                {
                    "id": "q2",
                    "category": "Objection Handling & Closing",
                    "question": "Tell me about a specific deal where a high-value prospect pushed back hard on pricing or preferred a competitor. How did you navigate that objection?",
                    "probe_triggers": ["discounted", "gave discount", "convinced them", "not sure"]
                },
                {
                    "id": "q3",
                    "category": "Pipeline & Quota Strategy",
                    "question": f"How do you organize your outbound outreach and manage pipeline cadence to consistently meet or exceed your revenue quota using {skills_str}?",
                    "probe_triggers": ["cold calling", "standard cadence", "work hard", "send emails"]
                }
            ]
        else:
            return [
                {
                    "id": "q1",
                    "category": "Architecture & Core Competency",
                    "question": f"For this {title} position, could you describe a recent project where you heavily worked with {skills_str}? What architectural trade-offs did you make?",
                    "probe_triggers": ["used it for everything", "simple project", "built features", "just code"]
                },
                {
                    "id": "q2",
                    "category": "Debugging & Reliability",
                    "question": "Walk me through a difficult production incident or performance bottleneck you diagnosed. What was the root cause and how did you resolve it under pressure?",
                    "probe_triggers": ["restarted server", "fixed the bug", "looked at logs", "team handled it"]
                },
                {
                    "id": "q3",
                    "category": "Scalability & Best Practices",
                    "question": "How do you ensure code maintainability, testing rigor, and scalability when designing asynchronous or high-throughput services?",
                    "probe_triggers": ["write clean code", "use tests", "docker", "no issues"]
                }
            ]

    @staticmethod
    def evaluate_response(
        question_item: Dict[str, Any],
        user_answer: str,
        turn_count_for_question: int
    ) -> Dict[str, Any]:
        text = user_answer.strip()
        word_count = len(text.split())
        lower_text = text.lower()

        # Check for brevity or vague answers
        is_short = word_count < 12
        is_vague = any(trigger in lower_text for trigger in question_item.get("probe_triggers", []))

        if (is_short or is_vague) and turn_count_for_question < 1:
            # Generate a natural follow-up probing question
            category = question_item.get("category", "this topic")
            if is_short:
                probe_text = f"That's a helpful overview. Could you dive a level deeper with a concrete example or specific tools you utilized regarding {category}?"
            else:
                probe_text = f"Interesting point. Could you elaborate on what specific outcome or metric resulted from that approach?"
            
            return {
                "needs_follow_up": True,
                "follow_up_question": probe_text
            }

        return {
            "needs_follow_up": False,
            "follow_up_question": None
        }

    @staticmethod
    def grade_session(
        transcript: List[Dict[str, Any]],
        job: Optional[Job] = None,
        niche: str = "tech"
    ) -> Dict[str, Any]:
        """
        Grades the completed mock interview into structured explainability fields.
        """
        cand_answers = [t.get("content", "") for t in transcript if t.get("role") == "candidate"]
        total_words = sum(len(a.split()) for a in cand_answers)
        turn_count = len(cand_answers)

        niche = (job.niche if job and job.niche else niche).lower()
        title = job.title if job and job.title else ("Technical Role" if niche == "tech" else "Sales Role")

        # Base scoring rubric
        base_score = 70.0
        
        # Word richness and thoroughness
        if total_words > 180:
            base_score += 15.0
        elif total_words > 90:
            base_score += 8.0
        else:
            base_score -= 10.0

        # Technical/Sales keywords coverage
        combined_text = " ".join(cand_answers).lower()
        strong_areas = []
        weak_areas = []
        suggestions = []

        if niche == "sales":
            if any(k in combined_text for k in ["prospect", "pain point", "budget", "decision maker", "discovery", "meddic"]):
                strong_areas.append("Demonstrated structured methodology in prospect qualification and discovery.")
                base_score += 5.0
            else:
                weak_areas.append("Could emphasize discovery frameworks (e.g. BANT/MEDDIC) more explicitly.")
                suggestions.append("Clarify how you qualify prospect decision-makers and timeline early in discovery.")

            if any(k in combined_text for k in ["objection", "roi", "value", "negotiation", "competitor", "closed"]):
                strong_areas.append("Effectively framed value propositions rather than defaulting to discounts on pricing pushback.")
                base_score += 5.0
            else:
                weak_areas.append("Pricing objection handling could emphasize business ROI more concretely.")
                suggestions.append("Prepare a story demonstrating how you preserved deal margin against a cheaper competitor.")

            suggestions.append("Structure answers using concrete quotas and deal metrics (e.g., Average Contract Value, % quota attained).")

        else:
            # Tech niche
            if any(k in combined_text for k in ["architecture", "scale", "latency", "database", "async", "trade-off", "performance", "api"]):
                strong_areas.append("Clear articulation of architectural trade-offs and engineering design principles.")
                base_score += 5.0
            else:
                weak_areas.append("Technical trade-off rationale could include more depth on scaling or storage constraints.")
                suggestions.append("When discussing design choices, explicitly compare option A vs option B.")

            if any(k in combined_text for k in ["debug", "incident", "logs", "root cause", "monitoring", "metrics", "test", "ci/cd"]):
                strong_areas.append("Sound incident response methodology and root-cause debugging focus.")
                base_score += 5.0
            else:
                weak_areas.append("Incident breakdown was somewhat high-level without concrete monitoring tools.")
                suggestions.append("Mention specific diagnostic tools (e.g. APM, distributed tracing, metrics) in debugging scenarios.")

            suggestions.append("Use the STAR format (Situation, Task, Action, Result) to concisely highlight technical impact.")

        final_score = max(45.0, min(96.0, round(base_score, 1)))

        if not strong_areas:
            strong_areas.append("Responsive and engaged conversational flow across all core questions.")

        return {
            "overall_score": final_score,
            "strong_areas": strong_areas,
            "weak_areas": weak_areas,
            "suggestions": suggestions
        }
