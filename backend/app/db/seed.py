from app.db.session import SessionLocal, init_db, Base, engine
from app.db.models import (
    Tenant, User, Candidate, Job, Match, Interview, Notification, AuditLog,
    Action, Playbook, Category, KnowledgeSource, KnowledgeChunk,
    SkillTemplate, SkillConfig, PolicyRule, WidgetConfig, Message
)
from app.core.security import get_password_hash
from app.services.matching_engine import MatchingEngine

def seed_database(force: bool = False):
    if force:
        Base.metadata.drop_all(bind=engine)
    init_db()
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        if not force and db.query(Tenant).first():
            print("Database already contains data. Skipping seed.")
            return

        print(">> Seeding HireTalentIQ multi-tenant PostgreSQL database...")

        # ── 1. Tenants ──────────────────────────────────────────────────────────
        tenant_tech = Tenant(
            name="TechCorp Solutions",
            slug="techcorp",
            logo_url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop",
            plan="enterprise",
            status="active"
        )
        tenant_sales = Tenant(
            name="SalesFlow Global",
            slug="salesflow",
            logo_url="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=100&h=100&fit=crop",
            plan="growth",
            status="active"
        )
        db.add_all([tenant_tech, tenant_sales])
        db.commit()
        db.refresh(tenant_tech)
        db.refresh(tenant_sales)

        # ── 2. Users (Superadmin, Company Admins) ────────────────────────────────
        superadmin = User(
            email="superadmin@platform.com",
            hashed_password=get_password_hash("SuperAdmin123!"),
            name="Demo Superadmin",
            role="superadmin",
            tenant_id=None,
            is_active=True
        )
        admin_tech = User(
            email="admin@techcorp.com",
            hashed_password=get_password_hash("TechAdmin123!"),
            name="Sarah Jenkins (TechCorp Recruiter)",
            role="admin",
            tenant_id=tenant_tech.id,
            is_active=True
        )
        admin_sales = User(
            email="admin@salesflow.com",
            hashed_password=get_password_hash("SalesAdmin123!"),
            name="David Miller (SalesFlow Lead)",
            role="admin",
            tenant_id=tenant_sales.id,
            is_active=True
        )
        db.add_all([superadmin, admin_tech, admin_sales])
        db.commit()

        # ── 3. Jobs (Tech and Sales Niches) ─────────────────────────────────────
        job_tech_1 = Job(
            tenant_id=tenant_tech.id,
            owner_id=admin_tech.id,
            title="Senior Full-Stack React & Python Engineer",
            description="Leading development of our core cloud analytics interface and high-performance microservices.",
            niche="tech",
            must_have_skills=["React", "TypeScript", "Python"],
            nice_to_have_skills=["FastAPI", "Docker", "AWS", "PostgreSQL"],
            experience_min_years=3.0,
            experience_max_years=7.0,
            budget_min=130000.0,
            budget_max=175000.0,
            location_preference="San Francisco, CA (Remote)",
            remote_ok=True,
            creation_source="manual",
            status="published",
            niche_criteria={"tech_stack_families": ["Frontend", "Backend"]}
        )
        job_tech_2 = Job(
            tenant_id=tenant_tech.id,
            owner_id=admin_tech.id,
            title="Cloud Infrastructure & DevOps Engineer",
            description="Architecting Kubernetes clusters, Terraform infrastructure, and zero-downtime CI/CD pipelines.",
            niche="tech",
            must_have_skills=["Kubernetes", "AWS", "Docker"],
            nice_to_have_skills=["Terraform", "CI/CD", "Linux"],
            experience_min_years=4.0,
            experience_max_years=8.0,
            budget_min=140000.0,
            budget_max=185000.0,
            location_preference="Remote",
            remote_ok=True,
            creation_source="ai_extracted",
            status="published",
            niche_criteria={"tech_stack_families": ["Cloud/DevOps"]}
        )

        job_sales_1 = Job(
            tenant_id=tenant_sales.id,
            owner_id=admin_sales.id,
            title="Senior Enterprise Account Executive (B2B SaaS)",
            description="Driving new revenue for enterprise analytics suite, managing complex 6-figure sales cycles.",
            niche="sales",
            must_have_skills=["Enterprise Sales", "B2B SaaS", "Contract Negotiation"],
            nice_to_have_skills=["Salesforce", "Outbound Prospecting", "Discovery Calls"],
            experience_min_years=3.0,
            experience_max_years=8.0,
            budget_min=110000.0,
            budget_max=190000.0,
            location_preference="New York, NY (Hybrid)",
            remote_ok=True,
            creation_source="manual",
            status="published",
            niche_criteria={
                "target_verticals": ["SaaS", "Enterprise"],
                "min_quota_attainment": 100.0,
                "deal_size_tier": "Mid-Market to Enterprise"
            }
        )
        db.add_all([job_tech_1, job_tech_2, job_sales_1])
        db.commit()

        # ── 4. Candidates (Dual-path: Chat Intake & Bulk Upload) ─────────────────
        cand_alex = Candidate(
            tenant_id=tenant_tech.id,
            name="Alex Rivera",
            email="alex.rivera@example.com",
            phone="+1 (555) 234-5678",
            title="Senior React & TypeScript Developer",
            department="Engineering",
            bio="Full-Stack engineer with 5+ years specializing in React, Next.js, and Python API services.",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop",
            current_location="Austin, TX (Remote)",
            availability="Immediate",
            years_of_experience=5.5,
            hourly_rate=85.0,
            skills=[
                {"name": "React", "level": "Senior", "category": "Frontend"},
                {"name": "TypeScript", "level": "Senior", "category": "Frontend"},
                {"name": "Python", "level": "Mid", "category": "Backend"},
                {"name": "Next.js", "level": "Senior", "category": "Frontend"},
                {"name": "Docker", "level": "Mid", "category": "Cloud/DevOps"},
            ],
            source="chat",
            parsing_confidence=0.96,
            niche_data={"github_url": "https://github.com/alexrivera-dev", "portfolio_url": "https://alexrivera.io"},
            lifecycle_status="Internal Candidate",
            talent_pool="Full-Stack",
            is_internal_candidate=True
        )

        cand_devon = Candidate(
            tenant_id=tenant_tech.id,
            name="Devon Vance",
            email="devon.vance@example.com",
            phone="+1 (555) 345-6789",
            title="Backend Python & Cloud Specialist",
            department="Engineering",
            bio="Backend software engineer with 4 years building scalable FastAPI microservices and Docker containers.",
            avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
            current_location="Seattle, WA (Remote)",
            availability="2 Weeks",
            years_of_experience=4.0,
            hourly_rate=80.0,
            skills=[
                {"name": "Python", "level": "Senior", "category": "Backend"},
                {"name": "FastAPI", "level": "Senior", "category": "Backend"},
                {"name": "PostgreSQL", "level": "Senior", "category": "Backend"},
                {"name": "Docker", "level": "Mid", "category": "Cloud/DevOps"},
                {"name": "AWS", "level": "Mid", "category": "Cloud/DevOps"},
            ],
            source="bulk_upload",
            resume_file_ref="/storage/resumes/devon_vance_resume.pdf",
            parsing_confidence=0.88,
            niche_data={"github_url": "https://github.com/devonvance", "portfolio_url": "https://devon.codes"},
            lifecycle_status="Internal Candidate",
            talent_pool="Full-Stack",
            is_internal_candidate=True
        )

        cand_sam = Candidate(
            tenant_id=tenant_tech.id,
            name="Sam Lee",
            email="sam.lee@example.com",
            phone="+1 (555) 456-7890",
            title="Junior Frontend Developer",
            department="Engineering",
            bio="Junior web developer proficient in HTML, CSS, JavaScript, with strong enthusiasm for learning React.",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
            current_location="Denver, CO",
            availability="Immediate",
            years_of_experience=1.5,
            hourly_rate=45.0,
            skills=[
                {"name": "JavaScript", "level": "Junior", "category": "Frontend"},
                {"name": "HTML", "level": "Mid", "category": "Frontend"},
                {"name": "CSS", "level": "Mid", "category": "Frontend"},
            ],
            source="chat",
            parsing_confidence=0.90,
            niche_data={"github_url": "https://github.com/samlee"},
            lifecycle_status="Internal Candidate",
            talent_pool="Full-Stack",
            is_internal_candidate=True
        )

        cand_marcus = Candidate(
            tenant_id=tenant_sales.id,
            name="Marcus Sterling",
            email="marcus.sterling@example.com",
            phone="+1 (555) 567-8901",
            title="Senior Enterprise Account Executive",
            department="Sales",
            bio="Top-performing B2B SaaS AE with 6 years experience closing 6-figure contracts in high-growth startups.",
            avatar_url="https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&h=120&fit=crop",
            current_location="New York, NY",
            availability="Immediate",
            years_of_experience=6.0,
            hourly_rate=95.0,
            skills=[
                {"name": "Enterprise Sales", "level": "Senior", "category": "Sales"},
                {"name": "B2B SaaS", "level": "Senior", "category": "Sales"},
                {"name": "Contract Negotiation", "level": "Senior", "category": "Sales"},
                {"name": "Salesforce", "level": "Senior", "category": "Sales"},
                {"name": "Discovery Calls", "level": "Senior", "category": "Sales"},
            ],
            source="chat",
            parsing_confidence=0.95,
            niche_data={
                "quota_attainment": 125.0,
                "deal_size_range": "$50k - $250k",
                "sales_cycle_months": 3.5,
                "verticals": ["SaaS", "Enterprise"],
                "communication_score": 94.0
            },
            lifecycle_status="Internal Candidate",
            talent_pool="Sales",
            is_internal_candidate=True
        )

        cand_elena = Candidate(
            tenant_id=tenant_sales.id,
            name="Elena Rostova",
            email="elena.rostova@example.com",
            phone="+1 (555) 678-9012",
            title="Strategic Account Executive",
            department="Sales",
            bio="Strategic sales leader with 5 years closing enterprise SaaS deals and expanding key client accounts.",
            avatar_url="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop",
            current_location="Boston, MA (Remote)",
            availability="2 Weeks",
            years_of_experience=5.0,
            hourly_rate=90.0,
            skills=[
                {"name": "Enterprise Sales", "level": "Senior", "category": "Sales"},
                {"name": "B2B SaaS", "level": "Senior", "category": "Sales"},
                {"name": "Contract Negotiation", "level": "Senior", "category": "Sales"},
                {"name": "Pipeline Management", "level": "Senior", "category": "Sales"},
            ],
            source="bulk_upload",
            resume_file_ref="/storage/resumes/elena_rostova_resume.pdf",
            parsing_confidence=0.92,
            niche_data={
                "quota_attainment": 115.0,
                "deal_size_range": "$40k - $180k",
                "sales_cycle_months": 3.0,
                "verticals": ["SaaS", "FinTech"],
                "communication_score": 90.0
            },
            lifecycle_status="Internal Candidate",
            talent_pool="Sales",
            is_internal_candidate=True
        )

        db.add_all([cand_alex, cand_devon, cand_sam, cand_marcus, cand_elena])
        db.commit()

        # ── 5. Generate AI Matches with Mandatory Explainability ─────────────────
        all_cands = [cand_alex, cand_devon, cand_sam, cand_marcus, cand_elena]
        for c in all_cands:
            MatchingEngine.sync_candidate_matches(c, db)

        # Mark Alex as shortlisted for TechCorp job and seed sample recruiter-candidate message thread
        top_match = db.query(Match).filter(Match.candidate_id == cand_alex.id, Match.job_id == job_tech_1.id).first()
        if top_match:
            top_match.status = "shortlisted"
            db.commit()

            msg1 = Message(
                tenant_id=tenant_tech.id,
                match_id=top_match.id,
                sender_id=admin_tech.id,
                sender_role="recruiter",
                body="Hi Alex, your React and TypeScript background is an exceptional fit for our Senior Frontend position! Are you open to a 30-minute introductory call this week?"
            )
            msg2 = Message(
                tenant_id=tenant_tech.id,
                match_id=top_match.id,
                sender_id=None,
                sender_role="candidate",
                body="Hello Sarah! Thank you for reaching out. Yes, I would be delighted to speak about the Senior Frontend Engineer role. Thursday afternoon works best for me."
            )
            db.add_all([msg1, msg2])
            db.commit()

        # ── 6. Starter Actions, Categories, Policies for Company Admin ───────────
        action1 = Action(
            tenant_id=tenant_tech.id,
            title="Screen Full-Stack React Candidates",
            description="Filters candidates by React, TypeScript, and architectural experience.",
            prompt_template="Show me candidates with strong React and API design skills.",
            icon="⚡",
            is_pinned=True,
            sort_order=1
        )
        action2 = Action(
            tenant_id=tenant_tech.id,
            title="Evaluate DevOps & Kubernetes Skills",
            description="Shortlists candidates with AWS, Kubernetes, and Terraform expertise.",
            prompt_template="Shortlist candidates with cloud infrastructure and CI/CD background.",
            icon="☁️",
            is_pinned=True,
            sort_order=2
        )
        action3 = Action(
            tenant_id=tenant_sales.id,
            title="Top Quota Attainment Sales Candidates",
            description="Finds account executives who exceeded 100% quota in B2B SaaS.",
            prompt_template="Show me sales candidates with 110%+ quota attainment in enterprise SaaS.",
            icon="🎯",
            is_pinned=True,
            sort_order=1
        )
        db.add_all([action1, action2, action3])

        cat1 = Category(
            tenant_id=tenant_tech.id,
            name="Engineering & Tech",
            slug="engineering",
            department="Engineering",
            description="Full-stack, frontend, backend, and DevOps talent pools."
        )
        cat2 = Category(
            tenant_id=tenant_sales.id,
            name="Sales & Go-To-Market",
            slug="sales",
            department="Sales",
            description="Account executives, sales directors, and SDR talent pools."
        )
        db.add_all([cat1, cat2])

        widget1 = WidgetConfig(
            tenant_id=tenant_tech.id,
            name="TechCorp Career Bot",
            welcome_text="Welcome to TechCorp! Looking for your next engineering role? Chat with me to explore open opportunities.",
            primary_color="#4f46e5"
        )
        widget2 = WidgetConfig(
            tenant_id=tenant_sales.id,
            name="SalesFlow Career Bot",
            welcome_text="Welcome to SalesFlow! Ready to accelerate your sales career? Let's discuss your background.",
            primary_color="#059669"
        )
        db.add_all([widget1, widget2])

        policy1 = PolicyRule(
            tenant_id=tenant_tech.id,
            name="Hard Skill Requirement Verification",
            rule_type="hard_filter_enforcement",
            config={"strict_exclusion": True},
            is_required=True,
            is_active=True
        )
        policy2 = PolicyRule(
            tenant_id=tenant_tech.id,
            name="Candidate PII Masking & Data Protection",
            rule_type="pii_masking",
            config={"mask_phone_in_unverified_views": False},
            is_required=True,
            is_active=True
        )
        db.add_all([policy1, policy2])

        db.commit()
        print("[SUCCESS] PostgreSQL database seeding successfully completed with realistic multi-tenant data!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database seed error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
