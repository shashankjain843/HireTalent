import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.session import init_db
from app.db.seed import seed_database
from app.core.storage import STORAGE_ROOT

from app.routers import (
    auth,
    candidates,
    jobs,
    matches,
    interviews,
    notifications,
    analytics,
    company_admin,
    superadmin,
    chat,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & Seed demo data on startup
    init_db()
    seed_database()
    yield

app = FastAPI(
    title="HireTalentIQ — Multi-Tenant AI Talent Platform API",
    version="2.0.0",
    description="Production-grade multi-tenant AI talent acquisition platform with niche-aware matching and explainability.",
    lifespan=lifespan,
)

# 🌐 CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 📁 Mount storage for uploaded resumes & chat attachments
if os.path.exists(STORAGE_ROOT):
    app.mount("/storage", StaticFiles(directory=STORAGE_ROOT), name="storage")

# 🔗 Mount Main Routers (both direct and with /api prefix for Next.js proxy support)
api_routers = [
    (auth.router, ""),
    (candidates.router, ""),
    (jobs.router, ""),
    (matches.router, ""),
    (interviews.router, ""),
    (notifications.router, ""),
    (analytics.router, ""),
    (company_admin.router, ""),
    (superadmin.router, ""),
    (chat.router, ""),
]

for router, _ in api_routers:
    app.include_router(router, prefix="/api")
    app.include_router(router)  # Also include root for direct backend port calls

@app.get("/")
def root_health():
    return {
        "status": "HireTalentIQ API is running 🚀",
        "version": "2.0.0",
        "multi_tenant": True,
        "matching_engine": "niche_aware_explainable_v2",
        "niches_supported": ["tech", "sales"]
    }

# Backward-compatibility alias for simple lead checks
@app.get("/leads")
def get_leads_alias():
    return {"leads": []}

@app.get("/projects")
def get_projects_alias():
    return {"projects": []}
