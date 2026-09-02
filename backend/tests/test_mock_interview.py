import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.db.models import Candidate, Job, InterviewPracticeSession, Tenant
from app.services.mock_interview_bot import MockInterviewBot
from app.services.matching_engine import MatchingEngine

client = TestClient(app)

def test_question_generation_tech_and_sales():
    tech_questions = MockInterviewBot.generate_questions(job=None, niche="tech")
    assert len(tech_questions) >= 3
    assert any("architecture" in q["question"].lower() or "incident" in q["question"].lower() for q in tech_questions)

    sales_questions = MockInterviewBot.generate_questions(job=None, niche="sales")
    assert len(sales_questions) >= 3
    assert any("discovery" in q["question"].lower() or "objection" in q["question"].lower() for q in sales_questions)

def test_adaptive_probing_logic():
    q_item = {
        "id": "q1",
        "category": "Architecture",
        "probe_triggers": ["simple project", "used it for everything", "built features"]
    }
    
    # Brief/vague answer should trigger a follow-up probe
    brief_answer = "It was a simple project."
    eval_brief = MockInterviewBot.evaluate_response(q_item, brief_answer, turn_count_for_question=0)
    assert eval_brief["needs_follow_up"] is True
    assert eval_brief["follow_up_question"] is not None

    # Thorough answer should NOT trigger a follow-up
    thorough_answer = "In this project, we designed an asynchronous event pipeline utilizing PostgreSQL and Redis. We reduced latency by 35% through query optimization and batch processing."
    eval_thorough = MockInterviewBot.evaluate_response(q_item, thorough_answer, turn_count_for_question=0)
    assert eval_thorough["needs_follow_up"] is False

def test_structured_grading_shape():
    sample_transcript = [
        {"role": "ai", "content": "Tell me about your architecture trade-offs."},
        {"role": "candidate", "content": "We evaluated REST vs gRPC for internal service latency and chose gRPC for low-latency serialization. We also configured connection pooling for our PostgreSQL database."},
        {"role": "ai", "content": "How did you handle incidents?"},
        {"role": "candidate", "content": "During a high-concurrency event, we diagnosed a thread pool exhaustion issue using distributed tracing logs and scaled our workers dynamically."}
    ]

    scorecard = MockInterviewBot.grade_session(sample_transcript, job=None, niche="tech")
    assert 0 <= scorecard["overall_score"] <= 100
    assert isinstance(scorecard["strong_areas"], list)
    assert isinstance(scorecard["weak_areas"], list)
    assert isinstance(scorecard["suggestions"], list)
    assert len(scorecard["suggestions"]) > 0

def test_mock_interview_api_flow_and_privacy():
    db = SessionLocal()
    cand = db.query(Candidate).first()
    job = db.query(Job).first()
    assert cand is not None, "Need at least one seeded candidate"
    cand_id = cand.id
    job_id = job.id if job else None

    # 1. Start Practice Session
    start_res = client.post("/api/candidates/practice/start", json={
        "candidate_id": cand_id,
        "job_id": job_id,
        "niche": "tech"
    })
    assert start_res.status_code == 200
    data = start_res.json()
    session_id = data["session_id"]
    assert len(data["questions"]) >= 3

    # 2. Answer with brief text (triggers probing follow-up)
    turn1_res = client.post(f"/api/candidates/practice/{session_id}/message", json={
        "message": "I built backend APIs."
    })
    assert turn1_res.status_code == 200
    turn1_data = turn1_res.json()
    assert turn1_data["is_complete"] is False
    # Check that AI followed up
    last_msg = turn1_data["transcript"][-1]
    assert last_msg["role"] == "ai"

    # 3. Complete the session
    finish_res = client.post(f"/api/candidates/practice/{session_id}/finish")
    assert finish_res.status_code == 200
    finish_data = finish_res.json()
    assert finish_data["overall_score"] is not None
    assert isinstance(finish_data["strong_areas"], list)
    assert finish_data["shared_with_company"] is False

    # 4. PRIVACY CHECK: Company admin should NOT see unshared session
    admin_view_unshared = client.get(f"/api/company/candidates/{cand_id}/practice-results")
    assert admin_view_unshared.status_code == 200
    unshared_sessions = [s for s in admin_view_unshared.json() if s["id"] == session_id]
    assert len(unshared_sessions) == 0, "Unshared session MUST NOT be visible to company admin"

    # 5. Candidate explicitly opts-in to share session
    share_res = client.post(f"/api/candidates/practice/{session_id}/share", json={"share": True})
    assert share_res.status_code == 200
    assert share_res.json()["shared_with_company"] is True

    # 6. PRIVACY CHECK: Company admin CAN now view the shared report
    admin_view_shared = client.get(f"/api/company/candidates/{cand_id}/practice-results")
    assert admin_view_shared.status_code == 200
    shared_sessions = [s for s in admin_view_shared.json() if s["id"] == session_id]
    assert len(shared_sessions) == 1, "Shared session must be visible to company admin"
    assert shared_sessions[0]["overall_score"] == finish_data["overall_score"]

    db.close()

def test_skill_readiness_calculation():
    db = SessionLocal()
    cand = db.query(Candidate).first()
    assert cand is not None
    
    # Test Readiness API
    res = client.get(f"/api/candidates/readiness?candidate_id={cand.id}&niche=tech")
    assert res.status_code == 200
    data = res.json()
    
    assert "readiness_percent" in data
    assert 0 <= data["readiness_percent"] <= 100
    assert isinstance(data["matched_skills"], list)
    assert isinstance(data["missing_skills"], list)
    assert "practice_cta" in data
    
    db.close()
