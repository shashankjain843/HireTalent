import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # 🔐 API Keys
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

    # 🤖 Model Config
    EMBEDDING_MODEL = "models/gemini-embedding-exp-03-07"

    PRIMARY_MODEL = "models/gemini-2.5-flash"          # WORKS - Primary
    FALLBACK_MODEL = "models/gemini-2.0-flash"         # Fallback
    LITE_MODEL = "models/gemini-2.0-flash-lite"        # Last resort

    # 🔥 Temperature
    TEMPERATURE = 0.6

    # 📁 Paths
    VECTORSTORE_PATH = "vectorstore/"
    LEADS_FILE = "data/leads.json"
    LOGS_FILE = "logs.txt"
    PROJECTS_FILE = "data/projects.json"
    CONSULTATIONS_FILE = "data/consultations.json"

    # 📊 RAG Config
    CHUNK_SIZE = 800
    CHUNK_OVERLAP = 100
    RAG_TOP_K = 4

    # 📊 Project Constants
    DEV_LEVELS = ["Junior", "Mid", "Senior"]
    BUDGET_RANGES = ["< $5k", "$5k - $15k", "$15k - $50k", "$50k+"]

    # 🤖 Consultant Persona
    CONSULTANT_NAME = "Aria"
    COMPANY_NAME = "Appic Software"
    COMPANY_TAGLINE = "400+ projects | AI, Mobile & Web experts"

# ensure folders exist
os.makedirs("data", exist_ok=True)
os.makedirs("vectorstore", exist_ok=True)