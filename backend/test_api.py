"""
Automated Integration and CRUD Verification Test Suite for FlowPilot API (Phase 1)
"""
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, init_db

client = TestClient(app)


def test_suite():
    init_db()
    print("==================================================")
    print("Running FlowPilot Phase 1 API Verification Tests")
    print("==================================================")

    # 1. Test Health Check
    print("\n[1/6] Testing Health Check Endpoints...")
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    health_data = res.json()
    assert health_data["status"] == "healthy"
    print(f"  PASS: /health returned: {health_data}")

    res_api = client.get("/api/health")
    assert res_api.status_code == 200
    print("  PASS: /api/health returned 200 OK")

    # 2. Test Workflow Creation
    print("\n[2/6] Testing Workflow Creation (POST /api/workflows)...")
    payload = {
        "title": "Customer Review Sanitizer",
        "description": "Trims whitespace, converts to uppercase, and counts characters",
        "original_prompt": "Clean customer reviews and count characters",
        "steps": [
            {
                "step_order": 1,
                "step_name": "Trim Whitespace",
                "action_type": "TRANSFORM_TEXT",
                "parameters": {"operation": "trim"}
            },
            {
                "step_order": 2,
                "step_name": "Convert to Uppercase",
                "action_type": "TRANSFORM_TEXT",
                "parameters": {"operation": "uppercase"}
            },
            {
                "step_order": 3,
                "step_name": "Count Total Characters",
                "action_type": "CALCULATE_METRIC",
                "parameters": {"metric": "char_count"}
            }
        ]
    }
    create_res = client.post("/api/workflows", json=payload)
    assert create_res.status_code == 201, f"Expected 201, got {create_res.status_code}: {create_res.text}"
    created_wf = create_res.json()
    wf_id = created_wf["id"]
    assert created_wf["title"] == payload["title"]
    assert len(created_wf["steps"]) == 3
    assert created_wf["last_run_at"] is None
    print(f"  PASS: Created Workflow ID {wf_id} with 3 steps.")

    # 3. Test Workflow Listing
    print("\n[3/7] Testing Workflow Listing (GET /api/workflows)...")
    list_res = client.get("/api/workflows")
    assert list_res.status_code == 200
    workflows_list = list_res.json()
    assert len(workflows_list) >= 1
    target = next((w for w in workflows_list if w["id"] == wf_id), None)
    assert target is not None, "Created workflow not found in list"
    assert target["step_count"] == 3
    assert "last_run_at" in target, "Missing last_run_at field in listing response"
    assert "last_run_status" in target, "Missing last_run_status field in listing response"
    print(f"  PASS: Workflow found in list with step_count={target['step_count']}, last_run_at={target['last_run_at']}")

    # 4. Verify Execution Model & Failure Recording
    print("\n[4/7] Testing Execution Logging & Failure Record Persistence...")
    from app.core.database import SessionLocal
    from app.models.models import WorkflowExecution, StepExecution
    db = SessionLocal()
    failed_exec = WorkflowExecution(
        workflow_id=wf_id,
        status="FAILED",
        input_text="Sample input that causes failure",
        error_message="Action failed: invalid parameters provided"
    )
    db.add(failed_exec)
    db.flush()

    failed_step = StepExecution(
        execution_id=failed_exec.id,
        step_id=created_wf["steps"][0]["id"],
        step_order=1,
        action_type="TRANSFORM_TEXT",
        status="FAILED",
        error_message="Invalid string operation requested",
        duration_ms=4
    )
    db.add(failed_step)
    db.commit()

    # Re-fetch workflow listing to verify last_run_at and last_run_status are updated
    list_res_updated = client.get("/api/workflows")
    updated_target = next((w for w in list_res_updated.json() if w["id"] == wf_id), None)
    assert updated_target["last_run_at"] is not None
    assert updated_target["last_run_status"] == "FAILED"
    print(f"  PASS: Workflow listing correctly reflects last_run_at={updated_target['last_run_at']} and status={updated_target['last_run_status']}")

    # Verify failure record details
    saved_step_exec = db.query(StepExecution).filter(StepExecution.execution_id == failed_exec.id).first()
    assert saved_step_exec.status == "FAILED"
    assert saved_step_exec.error_message == "Invalid string operation requested"
    print(f"  PASS: Failed step details and error_message correctly persisted: '{saved_step_exec.error_message}'")
    db.close()

    # 4. Test Get Workflow By ID
    print(f"\n[4/6] Testing Get Workflow by ID (GET /api/workflows/{wf_id})...")
    get_res = client.get(f"/api/workflows/{wf_id}")
    assert get_res.status_code == 200
    wf_data = get_res.json()
    assert wf_data["id"] == wf_id
    assert wf_data["steps"][0]["step_name"] == "Trim Whitespace"
    assert wf_data["steps"][1]["action_type"] == "TRANSFORM_TEXT"
    print(f"  PASS: Retrieved Workflow ID {wf_id} successfully.")

    # 5. Test Update Workflow
    print(f"\n[5/6] Testing Update Workflow (PUT /api/workflows/{wf_id})...")
    update_payload = {
        "title": "Customer Review Sanitizer (Updated)",
        "description": "Updated description with modified steps",
        "steps": [
            {
                "step_order": 1,
                "step_name": "Convert to Lowercase",
                "action_type": "TRANSFORM_TEXT",
                "parameters": {"operation": "lowercase"}
            },
            {
                "step_order": 2,
                "step_name": "Count Words",
                "action_type": "CALCULATE_METRIC",
                "parameters": {"metric": "word_count"}
            }
        ]
    }
    update_res = client.put(f"/api/workflows/{wf_id}", json=update_payload)
    assert update_res.status_code == 200
    updated_wf = update_res.json()
    assert updated_wf["title"] == "Customer Review Sanitizer (Updated)"
    assert len(updated_wf["steps"]) == 2
    assert updated_wf["steps"][0]["step_name"] == "Convert to Lowercase"
    print(f"  PASS: Workflow ID {wf_id} successfully updated (new title and 2 steps).")

    # 6. Test Delete Workflow
    print(f"\n[6/6] Testing Delete Workflow (DELETE /api/workflows/{wf_id})...")
    del_res = client.delete(f"/api/workflows/{wf_id}")
    assert del_res.status_code == 204
    print(f"  PASS: Workflow ID {wf_id} deleted (204 No Content).")

    # Confirm 404 after deletion
    verify_res = client.get(f"/api/workflows/{wf_id}")
    assert verify_res.status_code == 404
    print(f"  PASS: Confirmed 404 Not Found for deleted Workflow ID {wf_id}.")

    print("\n==================================================")
    print(" ALL 6 VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("==================================================")


if __name__ == "__main__":
    test_suite()
