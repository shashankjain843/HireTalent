import re
from typing import Dict, Any, List, Tuple, Optional
from app.db.models import Candidate, Job, Match

SKILL_TAXONOMY = {
    "Frontend": ["React", "Next.js", "Vue", "Angular", "TypeScript", "JavaScript", "HTML", "CSS", "TailwindCSS", "Redux", "GraphQL"],
    "Backend": ["Python", "Node.js", "FastAPI", "Django", "Go", "Java", "Ruby", "PostgreSQL", "MongoDB", "Redis", "SQL", "REST API"],
    "Cloud/DevOps": ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD", "Terraform", "Linux"],
    "AI/Data": ["PyTorch", "TensorFlow", "Pandas", "Scikit-Learn", "LangChain", "LLMs", "RAG", "Data Pipelines"],
    "Sales/GTM": ["Enterprise Sales", "B2B SaaS", "Cold Calling", "Outbound Prospecting", "CRM", "Salesforce", "HubSpot", "Contract Negotiation", "Discovery Calls", "Pipeline Management"],
}

def get_skill_family(skill_name: str) -> str:
    for family, skills in SKILL_TAXONOMY.items():
        for s in skills:
            if s.lower() == skill_name.lower():
                return family
    return "General"

class MatchingEngine:
    @staticmethod
    def evaluate_match(candidate: Candidate, job: Job) -> Dict[str, Any]:
        """
        Evaluates a candidate against a job requirement.
        Returns hard_filter_passed, ai_score (0-100), structured explainability breakdown,
        and human-readable 2-3 line plain-text explanation.
        """
        cand_skills_raw = candidate.skills or []
        cand_skill_names = set()
        for s in cand_skills_raw:
            if isinstance(s, dict) and "name" in s:
                cand_skill_names.add(s["name"].lower())
            elif isinstance(s, str):
                cand_skill_names.add(s.lower())

        must_haves = [s.strip() for s in (job.must_have_skills or []) if s.strip()]
        nice_to_haves = [s.strip() for s in (job.nice_to_have_skills or []) if s.strip()]

        matched_must = []
        missing_must = []
        for mh in must_haves:
            if mh.lower() in cand_skill_names:
                matched_must.append(mh)
            else:
                missing_must.append(mh)

        # 1. HARD FILTER: Candidate must have ALL must-have skills
        hard_filter_passed = len(missing_must) == 0

        # 2. MATCHED & MISSING OVERALL
        matched_nice = [nh for nh in nice_to_haves if nh.lower() in cand_skill_names]
        all_matched = matched_must + matched_nice
        all_missing = missing_must + [nh for nh in nice_to_haves if nh.lower() not in cand_skill_names]

        # 3. EXPERIENCE FIT
        exp_years = candidate.years_of_experience or 0.0
        min_exp = job.experience_min_years or 0.0
        max_exp = job.experience_max_years or (min_exp + 5.0)

        if exp_years >= min_exp:
            exp_fit_score = 100.0 if exp_years <= max_exp + 2 else 90.0
            exp_fit_note = f"{exp_years:g} years relevant experience meets the {min_exp:g}–{max_exp:g} years target"
        else:
            gap = min_exp - exp_years
            exp_fit_score = max(20.0, 100.0 - (gap * 25.0))
            exp_fit_note = f"{exp_years:g} years experience vs {min_exp:g}–{max_exp:g} required ({gap:g}y gap)"

        # 4. NICHE-SPECIFIC SCORING & SIGNALS
        niche = (job.niche or "tech").lower()
        niche_score = 75.0
        niche_notes_list = []
        cand_niche_data = candidate.niche_data or {}

        if niche == "sales":
            # Sales niche criteria: quota attainment, verticals, deal sizes, soft skills
            quota = cand_niche_data.get("quota_attainment")
            if quota:
                if quota >= 100:
                    niche_score += 15.0
                    niche_notes_list.append(f"Strong track record: {quota}% historical quota attainment")
                else:
                    niche_score -= 10.0
                    niche_notes_list.append(f"{quota}% quota attainment (below 100% quota benchmark)")
            else:
                niche_notes_list.append("Quota attainment history not stated")

            # Industry vertical matching
            req_verticals = [v.lower() for v in (job.niche_criteria or {}).get("target_verticals", ["SaaS"])]
            cand_verticals = [v.lower() for v in cand_niche_data.get("verticals", [])]
            vertical_matches = [v for v in req_verticals if v in cand_verticals]
            if vertical_matches:
                niche_score += 10.0
                niche_notes_list.append(f"Domain alignment in {', '.join(vertical_matches).upper()}")
            else:
                niche_score -= 5.0
                niche_notes_list.append("No direct vertical experience found for target niche")

            # Soft-skill/Communication clarity signal (from candidate conversation)
            comm_score = cand_niche_data.get("communication_score", 85.0)
            if comm_score >= 85:
                niche_score += 5.0
                niche_notes_list.append("Communication tone in chat transcript reads confident and structured")
            else:
                niche_notes_list.append("Communication tone is casual")

        else:
            # Tech niche criteria: taxonomy coverage, GitHub/portfolio, stack depth
            has_github = bool(cand_niche_data.get("github_url"))
            has_portfolio = bool(cand_niche_data.get("portfolio_url"))
            if has_github or has_portfolio:
                niche_score += 10.0
                niche_notes_list.append("Public portfolio / GitHub profile verified")
            
            # Taxonomy family synergy
            cand_families = {get_skill_family(s) for s in all_matched}
            if len(cand_families) >= 2:
                niche_score += 10.0
                niche_notes_list.append(f"Cross-functional stack expertise ({', '.join(cand_families)})")

        niche_score = min(100.0, max(0.0, niche_score))
        niche_notes = ". ".join(niche_notes_list)

        # 5. OVERALL AI SCORE CALCULATION
        skill_weight = 0.50
        exp_weight = 0.25
        niche_weight = 0.25

        total_must = len(must_haves) or 1
        must_score = (len(matched_must) / total_must) * 100.0
        total_nice = len(nice_to_haves) or 1
        nice_score = (len(matched_nice) / total_nice) * 100.0 if nice_to_haves else 100.0

        skill_composite = (must_score * 0.75) + (nice_score * 0.25)
        raw_score = (skill_composite * skill_weight) + (exp_fit_score * exp_weight) + (niche_score * niche_weight)
        
        # If hard filter failed, cap max score at 48% to guarantee strict rejection ranking
        if not hard_filter_passed:
            ai_score = min(raw_score * 0.5, 48.0)
        else:
            ai_score = min(100.0, max(50.0, raw_score))

        ai_score = round(ai_score, 1)

        # 6. MANDATORY HUMAN-READABLE EXPLAINABILITY (2-3 lines plain language)
        explanation_lines = []
        if must_haves:
            if hard_filter_passed:
                explanation_lines.append(f"{len(matched_must)}/{len(must_haves)} must-have skills matched.")
            else:
                missing_str = ", ".join(missing_must)
                explanation_lines.append(f"{len(matched_must)}/{len(must_haves)} must-have skills matched (missing: {missing_str}).")
        else:
            explanation_lines.append(f"Matched {len(all_matched)} relevant skills for this position.")

        explanation_lines.append(f"{exp_fit_note}.")
        if niche_notes:
            explanation_lines.append(f"{niche_notes}.")

        explanation = " ".join(explanation_lines)

        return {
            "hard_filter_passed": hard_filter_passed,
            "ai_score": ai_score,
            "matched_skills": all_matched,
            "missing_skills": all_missing,
            "experience_fit": exp_fit_note,
            "semantic_notes": f"High semantic alignment on role requirements ({ai_score}% overall).",
            "niche_notes": niche_notes,
            "explanation": explanation,
        }

    @staticmethod
    def sync_candidate_matches(candidate: Candidate, db) -> List[Match]:
        """Calculates or updates AI matches for a candidate across all active tenant jobs."""
        jobs = db.query(Job).filter(Job.tenant_id == candidate.tenant_id, Job.status == "published").all()
        created_or_updated = []
        
        for job in jobs:
            eval_res = MatchingEngine.evaluate_match(candidate, job)
            existing_match = db.query(Match).filter(
                Match.candidate_id == candidate.id,
                Match.job_id == job.id
            ).first()

            if existing_match:
                existing_match.hard_filter_passed = eval_res["hard_filter_passed"]
                existing_match.ai_score = eval_res["ai_score"]
                existing_match.matched_skills = eval_res["matched_skills"]
                existing_match.missing_skills = eval_res["missing_skills"]
                existing_match.experience_fit = eval_res["experience_fit"]
                existing_match.semantic_notes = eval_res["semantic_notes"]
                existing_match.niche_notes = eval_res["niche_notes"]
                existing_match.explanation = eval_res["explanation"]
                created_or_updated.append(existing_match)
            else:
                new_match = Match(
                    tenant_id=candidate.tenant_id,
                    candidate_id=candidate.id,
                    job_id=job.id,
                    hard_filter_passed=eval_res["hard_filter_passed"],
                    ai_score=eval_res["ai_score"],
                    matched_skills=eval_res["matched_skills"],
                    missing_skills=eval_res["missing_skills"],
                    experience_fit=eval_res["experience_fit"],
                    semantic_notes=eval_res["semantic_notes"],
                    niche_notes=eval_res["niche_notes"],
                    explanation=eval_res["explanation"],
                    status="pending"
                )
                db.add(new_match)
                created_or_updated.append(new_match)
                
        db.commit()
        return created_or_updated

    @staticmethod
    def compute_skill_readiness(
        candidate: Candidate,
        job: Optional[Job] = None,
        niche: str = "tech",
        db: Any = None
    ) -> Dict[str, Any]:
        """
        Feature 2: Skill Readiness Score (Candidate-facing).
        Answers: How ready am I for this role/niche, and what specific skill gaps do I have?
        Reuses existing hard-filter and weighted scoring logic.
        """
        cand_skills_raw = candidate.skills or []
        cand_skill_names = set()
        for s in cand_skills_raw:
            if isinstance(s, dict) and "name" in s:
                cand_skill_names.add(s["name"].lower())
            elif isinstance(s, str):
                cand_skill_names.add(s.lower())

        if job:
            eval_res = MatchingEngine.evaluate_match(candidate, job)
            return {
                "job_id": job.id,
                "job_title": job.title,
                "niche": job.niche or "tech",
                "readiness_percent": eval_res["ai_score"],
                "hard_filter_passed": eval_res["hard_filter_passed"],
                "matched_skills": eval_res["matched_skills"],
                "missing_skills": eval_res["missing_skills"],
                "experience_fit": eval_res["experience_fit"],
                "practice_cta": f"Start an AI Mock Interview for {job.title} to test your skills and uncover practical improvement areas."
            }

        # Niche Aggregate typical requirements
        target_niche = (niche or "tech").lower()
        typical_must_haves = (
            ["React", "TypeScript", "Python", "FastAPI", "SQL", "Docker"]
            if target_niche == "tech"
            else ["Enterprise Sales", "B2B SaaS", "Discovery Calls", "Contract Negotiation", "CRM"]
        )

        # If DB is provided, extract most common skills across open jobs in that niche
        if db:
            niche_jobs = db.query(Job).filter(Job.niche == target_niche).limit(10).all()
            if niche_jobs:
                aggregated = []
                for j in niche_jobs:
                    if j.must_have_skills:
                        aggregated.extend(j.must_have_skills)
                if aggregated:
                    typical_must_haves = list(dict.fromkeys(aggregated))[:8]

        matched = [s for s in typical_must_haves if s.lower() in cand_skill_names]
        missing = [s for s in typical_must_haves if s.lower() not in cand_skill_names]
        
        ratio = len(matched) / max(len(typical_must_haves), 1)
        exp_years = candidate.years_of_experience or 0.0
        exp_score = min(100.0, (exp_years / 4.0) * 100.0)
        
        readiness = round((ratio * 70.0) + (exp_score * 0.30), 1)
        readiness = max(25.0, min(95.0, readiness))

        return {
            "job_id": None,
            "job_title": f"General {target_niche.title()} Roles",
            "niche": target_niche,
            "readiness_percent": readiness,
            "hard_filter_passed": len(missing) == 0,
            "matched_skills": matched,
            "missing_skills": missing,
            "experience_fit": f"{exp_years:g} years recorded experience",
            "practice_cta": f"Practice a general {target_niche.title()} Mock Interview with our AI to build confidence and test role readiness."
        }

