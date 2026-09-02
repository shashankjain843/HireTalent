import json
import os
from datetime import datetime

# Path is the same in both app/ and sandbox/ configs
LEADS_FILE = "data/leads.json"


def save_lead(name, email, query, source="Chatbot"):
    """Saves lead information with duplicate protection."""

    lead_data = {
        "timestamp": datetime.now().isoformat(),
        "name": name.strip(),
        "email": email.strip().lower(),
        "query": query,
        "source": source
    }

    os.makedirs(os.path.dirname(LEADS_FILE), exist_ok=True)

    # 🔥 Prevent duplicate leads
    if os.path.exists(LEADS_FILE):
        with open(LEADS_FILE, "r") as f:
            for line in f:
                if line.strip():
                    existing = json.loads(line)
                    if existing["email"] == lead_data["email"]:
                        return "⚠️ Lead already exists"

    # Save lead
    with open(LEADS_FILE, "a") as f:
        f.write(json.dumps(lead_data) + "\n")

    return "✅ Lead saved"
