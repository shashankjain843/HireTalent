import os
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, init_db, Base, engine
from app.db.seed import seed_database
from app.db.models import User, Tenant, Candidate, Job, Match, Interview

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database()

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["multi_tenant"] is True
    assert "tech" in data["niches_supported"]
    assert "sales" in data["niches_supported"]

def test_superadmin_and_company_auth(client):
    # 1. Superadmin Login
    super_res = client.post("/api/superadmin/auth/login", json={
        "email": "superadmin@platform.com",
        "password": "SuperAdmin123!"
    })
    assert super_res.status_code == 200
    super_data = super_res.json()
    assert "access_token" in super_data
    assert super_data["user"]["role"] == "superadmin"

    # 2. Company Admin Login (TechCorp)
    comp_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert "access_token" in comp_data
    assert comp_data["user"]["role"] == "admin"
    assert comp_data["user"]["tenant_id"] is not None

def test_niche_aware_matching_and_explainability(client):
    # Log in as TechCorp admin
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get swipe deck
    deck_res = client.get("/api/matches/deck", headers=headers)
    assert deck_res.status_code == 200
    matches = deck_res.json()
    assert len(matches) > 0

    # Verify each match record has mandatory human-readable explanation and structured breakdown
    for m in matches:
        assert m["explanation"] is not None and len(m["explanation"]) > 10
        assert isinstance(m["matched_skills"], list)
        assert isinstance(m["missing_skills"], list)
        assert m["ai_score"] >= 0.0

    # Verify candidate with missing must-have failed hard filter
    hard_failed = [m for m in matches if m["hard_filter_passed"] is False]
    for hf in hard_failed:
        assert len(hf["missing_skills"]) > 0
        assert "missing" in hf["explanation"].lower() or "gap" in hf["explanation"].lower()

def test_swipe_actions_and_notifications(client):
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get first match
    deck_res = client.get("/api/matches/deck", headers=headers)
    match_id = deck_res.json()[0]["id"]

    # 1. Swipe Right (Shortlist)
    swipe_res = client.post("/api/matches/swipe", json={
        "match_id": match_id,
        "direction": "right"
    }, headers=headers)
    assert swipe_res.status_code == 200
    assert swipe_res.json()["status"] == "shortlisted"

    # Verify notification generated
    notif_res = client.get("/api/notifications", headers=headers)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert len(notifs) > 0

    # 2. Swipe Left (Reject)
    reject_res = client.post("/api/matches/swipe", json={
        "match_id": match_id,
        "direction": "left",
        "reason": "Not enough cloud experience"
    }, headers=headers)
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"

    # 3. Undo
    undo_res = client.post("/api/matches/swipe", json={
        "match_id": match_id,
        "direction": "undo"
    }, headers=headers)
    assert undo_res.status_code == 200
    assert undo_res.json()["status"] == "pending"

def test_bulk_resume_upload_and_intake(client):
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sample_resume_content = b"""
    Jordan Hayes
    jordan.hayes@example.com | +1 (555) 888-9999
    Senior Full-Stack Engineer with 5 years experience in React, TypeScript, Python, and Docker.
    Skills: React, TypeScript, Python, Docker, PostgreSQL, AWS
    """
    
    file_tuple = ("files", ("jordan_hayes_resume.txt", sample_resume_content, "text/plain"))
    upload_res = client.post("/api/candidates/bulk-upload", files=[file_tuple], headers=headers)
    assert upload_res.status_code == 200
    uploaded_cands = upload_res.json()
    assert len(uploaded_cands) == 1
    assert uploaded_cands[0]["source"] == "bulk_upload"
    assert uploaded_cands[0]["parsing_confidence"] > 0.5

def test_conversational_chat_intake(client):
    # Candidate starts conversation
    sess_id = "test_screening_session"
    res1 = client.post("/api/chat", json={
        "question": "Hi, I am Taylor Reed and I'm a Senior Frontend Engineer looking for new roles.",
        "session_id": sess_id
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert "message" in data1
    assert len(data1["options"]) > 0

    # Provide tech stack
    res2 = client.post("/api/chat", json={
        "question": "React, TypeScript, Next.js, GraphQL, TailwindCSS",
        "session_id": sess_id
    })
    assert res2.status_code == 200

    # Provide experience
    res3 = client.post("/api/chat", json={
        "question": "5 years of experience based in Austin, TX remote",
        "session_id": sess_id
    })
    assert res3.status_code == 200

    # Provide email to complete profile creation
    res4 = client.post("/api/chat", json={
        "question": "taylor.reed@candidate-test.com",
        "session_id": sess_id
    })
    assert res4.status_code == 200
    data4 = res4.json()
    assert "verified" in data4["message"].lower() or "thank you" in data4["message"].lower()

def test_analytics_funnel(client):
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    funnel_res = client.get("/api/analytics/hiring-funnel", headers=headers)
    assert funnel_res.status_code == 200
    funnel_data = funnel_res.json()
    assert funnel_data["total_candidates"] >= 3
    assert len(funnel_data["funnel"]) == 5
    assert "tech" in funnel_data["niche_breakdown"]

def test_candidate_search_filter_and_consent(client):
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Search by skill
    res_skill = client.get("/api/candidates?skill=React", headers=headers)
    assert res_skill.status_code == 200
    cands_skill = res_skill.json()
    assert len(cands_skill) > 0
    # Verify consent field is present
    assert all(c["consent_granted"] is True for c in cands_skill)

    # 2. Filter by experience
    res_exp = client.get("/api/candidates?min_experience=4.0", headers=headers)
    assert res_exp.status_code == 200
    cands_exp = res_exp.json()
    assert all(c["years_of_experience"] >= 4.0 for c in cands_exp)

    # 3. Filter by score
    res_score = client.get("/api/candidates?min_score=80", headers=headers)
    assert res_score.status_code == 200

def test_recruiter_candidate_messaging_thread(client):
    login_res = client.post("/api/company/auth/login", json={
        "email": "admin@techcorp.com",
        "password": "TechAdmin123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get a match
    deck_res = client.get("/api/matches/deck", headers=headers)
    match_id = deck_res.json()[0]["id"]

    # Post message in thread
    msg_res = client.post(f"/api/matches/{match_id}/messages", json={
        "body": "Hi, we would love to invite you for an initial technical conversation!",
        "sender_role": "recruiter"
    }, headers=headers)
    assert msg_res.status_code == 200
    msg_data = msg_res.json()
    assert msg_data["body"] == "Hi, we would love to invite you for an initial technical conversation!"
    assert msg_data["match_id"] == match_id

    # Retrieve thread
    get_msgs = client.get(f"/api/matches/{match_id}/messages", headers=headers)
    assert get_msgs.status_code == 200
    thread = get_msgs.json()
    assert len(thread) >= 1
    assert any(m["id"] == msg_data["id"] for m in thread)
