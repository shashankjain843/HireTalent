from langchain_core.tools import tool
from shared.leads import save_lead
from .config import Config
import json
import os


# 🔥 LEAD CAPTURE TOOL
@tool
def capture_lead_tool(name: str, email: str, phone: str = "N/A", call_requested: bool = False) -> str:
    """
    Capture user lead after collecting name & email.
    Use ONLY after confirmation.
    """
    try:
        query = f"Call Requested: {call_requested}, Phone: {phone}"

        save_lead(name, email, query)

        return f"""
✅ Lead saved successfully!

👤 Name: {name}
📩 Email: {email}
📞 Phone: {phone}

Our team will reach out shortly 🚀
"""
    except Exception as e:
        return f"Error capturing lead: {str(e)}"


# 🔥 PROJECT QUALIFICATION TOOL
@tool
def qualify_project_tool(project_description: str, budget: str, dev_level: str) -> str:
    """
    Save project details after user provides info.
    """
    try:
        project_data = {
            "description": project_description,
            "budget": budget,
            "dev_level": dev_level
        }

        os.makedirs("data", exist_ok=True)

        with open("data/projects.json", "a") as f:
            f.write(json.dumps(project_data) + "\n")

        return f"""
📌 Project Details Saved!

💰 Budget: {budget}
👨‍💻 Developer Level: {dev_level}

Nice — this helps us plan better 👍
"""
    except Exception as e:
        return f"Error qualifying project: {str(e)}"


# 🔥 STRATEGY GENERATOR (UPGRADED)
@tool
def generate_strategy_tool(project_name: str, overview: str, tech_stack: str, timeline: str, budget_context: str = "TBD") -> str:
    """
    Generate clean, premium project strategy.
    """

    return f"""
📊 Here's what we recommend for your project:

🚀 Tech Stack:
- {tech_stack}

⏳ Timeline:
{timeline}

💰 Budget:
{budget_context}

🧠 Approach:
- Start with MVP
- Focus on scalability
- Optimize for performance

🎯 Next Step:
We can start with a quick prototype this week 🚀
"""


# 🔥 COMPANY SUMMARY TOOL
@tool
def get_company_portfolio_summary(input: str = "") -> str:
    """Get high-level company success metrics."""
    return (
        "Appic Softwares: 400+ projects, 200+ clients. "
        "Expertise: AI, Mobile (Flutter/React Native), Web. "
        "Top Industries: Health, Finance, E-comm."
    )