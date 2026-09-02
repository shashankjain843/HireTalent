import os
import re
import json
from typing import Dict, Any, List

class JobExtractorService:
    @staticmethod
    def extract_job_from_jd(jd_text: str) -> Dict[str, Any]:
        """
        Extracts structured job requirement fields from raw Job Description text.
        Supports both Tech and Sales niches.
        """
        if not jd_text or not jd_text.strip():
            return {
                "title": "Senior Engineer",
                "niche": "tech",
                "must_have_skills": ["React", "TypeScript"],
                "nice_to_have_skills": ["Next.js"],
                "experience_min_years": 3.0,
                "experience_max_years": 6.0,
                "budget_min": 120000.0,
                "budget_max": 160000.0,
                "location_preference": "Remote",
                "remote_ok": True,
                "description": "",
                "niche_criteria": {}
            }

        # 1. Try Gemini LLM extraction if key available
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key and not api_key.startswith("your_"):
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                prompt = f"""
You are an AI Job Requirement Extractor. Extract structured hiring requirements from this Job Description into strict JSON format:
{{
  "title": "Exact Role Title",
  "niche": "tech" or "sales",
  "must_have_skills": ["Skill 1", "Skill 2"],
  "nice_to_have_skills": ["Skill 3", "Skill 4"],
  "experience_min_years": 3.0,
  "experience_max_years": 6.0,
  "budget_min": 120000.0,
  "budget_max": 160000.0,
  "location_preference": "City or Remote",
  "remote_ok": true,
  "description": "2-3 sentence overview of responsibilities and scope",
  "niche_criteria": {{
     "target_verticals": ["SaaS", "Enterprise"] (if sales),
     "min_quota_attainment": 100 (if sales),
     "tech_stack_families": ["Frontend", "Cloud"] (if tech)
  }}
}}

Job Description:
{jd_text[:4000]}
"""
                response = model.generate_content(prompt)
                clean_json = response.text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_json)
                if parsed.get("title"):
                    return parsed
            except Exception as e:
                print(f"Gemini JD extraction fallback to heuristics: {e}")

        # 2. Heuristic extraction fallback
        return JobExtractorService._heuristic_extract(jd_text)

    @staticmethod
    def _heuristic_extract(text: str) -> Dict[str, Any]:
        lower_text = text.lower()
        
        # Check niche
        is_sales = any(k in lower_text for k in ["account executive", "sales", "sdr", "bdr", "closing", "quota", "quota attainment"])
        niche = "sales" if is_sales else "tech"

        # Title detection
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        title = lines[0] if lines and len(lines[0]) < 60 else ("Senior Account Executive" if is_sales else "Senior Full-Stack Engineer")

        # Experience years
        exp_min = 3.0
        exp_max = 6.0
        exp_match = re.search(r'(\d+)(?:\s*-\s*(\d+))?\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience', text, re.IGNORECASE)
        if exp_match:
            exp_min = float(exp_match.group(1))
            if exp_match.group(2):
                exp_max = float(exp_match.group(2))
            else:
                exp_max = exp_min + 3.0

        # Skills extraction
        known_tech = ["React", "TypeScript", "JavaScript", "Python", "FastAPI", "Node.js", "PostgreSQL", "Docker", "Kubernetes", "AWS", "Next.js", "GraphQL", "TailwindCSS"]
        known_sales = ["Enterprise Sales", "B2B SaaS", "Contract Negotiation", "Salesforce", "HubSpot", "Outbound Prospecting", "Pipeline Management", "Discovery Calls"]

        pool = known_sales if is_sales else known_tech
        found = []
        for sk in pool:
            if re.search(r'\b' + re.escape(sk) + r'\b', text, re.IGNORECASE):
                found.append(sk)

        if not found:
            found = ["Enterprise Sales", "B2B SaaS"] if is_sales else ["React", "TypeScript", "Node.js"]

        must_haves = found[:3]
        nice_to_haves = found[3:6]

        niche_criteria = {}
        if is_sales:
            niche_criteria = {
                "target_verticals": ["SaaS", "Enterprise"],
                "min_quota_attainment": 100.0,
                "deal_size_tier": "Mid-Market to Enterprise"
            }
        else:
            niche_criteria = {
                "tech_stack_families": ["Frontend", "Backend"],
                "require_portfolio": False
            }

        return {
            "title": title,
            "niche": niche,
            "must_have_skills": must_haves,
            "nice_to_have_skills": nice_to_haves,
            "experience_min_years": exp_min,
            "experience_max_years": exp_max,
            "budget_min": 110000.0 if not is_sales else 90000.0,
            "budget_max": 160000.0 if not is_sales else 180000.0,
            "location_preference": "Remote (US/Global)",
            "remote_ok": True,
            "description": f"We are seeking an experienced {title} to join our high-growth team.",
            "niche_criteria": niche_criteria
        }
