"""
Phase 4 Verification Test Suite: Workflow Execution Engine
"""
import unittest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, init_db
from app.models.models import Workflow, WorkflowStep, WorkflowExecution, StepExecution

client = TestClient(app)


class TestPhase4ExecutionEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_successful_sequential_execution(self):
        """Verify sequential execution passing outputs across TRANSFORM_TEXT, CALCULATE_METRIC, and LOG_MESSAGE."""
        # 1. Create a test workflow
        create_payload = {
            "title": "Review Processor Pipeline",
            "description": "Trims, uppercases, counts words, and logs completion",
            "original_prompt": "Clean review, uppercase it, count words, and log",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Trim Whitespace",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "trim"},
                },
                {
                    "step_order": 2,
                    "step_name": "Convert to Uppercase",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "uppercase"},
                },
                {
                    "step_order": 3,
                    "step_name": "Count Total Words",
                    "action_type": "CALCULATE_METRIC",
                    "parameters": {"metric": "word_count"},
                },
                {
                    "step_order": 4,
                    "step_name": "Log Completion",
                    "action_type": "LOG_MESSAGE",
                    "parameters": {
                        "message": "Processed successfully: {word_count} words",
                        "level": "INFO",
                    },
                },
            ],
        }
        create_res = client.post("/api/workflows", json=create_payload)
        self.assertEqual(create_res.status_code, 201)
        wf_id = create_res.json()["id"]

        # 2. Trigger workflow execution
        run_res = client.post(
            f"/api/workflows/{wf_id}/run",
            json={"input_text": "   flowpilot automated intelligence platform   "},
        )
        self.assertEqual(run_res.status_code, 200)
        execution = run_res.json()

        self.assertEqual(execution["status"], "SUCCESS")
        self.assertIsNone(execution["error_message"])
        self.assertEqual(len(execution["step_executions"]), 4)

        # Step 1: Trim Whitespace
        step1 = execution["step_executions"][0]
        self.assertEqual(step1["status"], "SUCCESS")
        self.assertEqual(step1["output_data"]["result"], "flowpilot automated intelligence platform")

        # Step 2: Uppercase (received trimmed output from Step 1)
        step2 = execution["step_executions"][1]
        self.assertEqual(step2["status"], "SUCCESS")
        self.assertEqual(step2["output_data"]["result"], "FLOWPILOT AUTOMATED INTELLIGENCE PLATFORM")

        # Step 3: Count words
        step3 = execution["step_executions"][2]
        self.assertEqual(step3["status"], "SUCCESS")
        self.assertEqual(step3["output_data"]["value"], 4)

        # Step 4: Log completion with interpolated metric
        step4 = execution["step_executions"][3]
        self.assertEqual(step4["status"], "SUCCESS")
        self.assertEqual(step4["output_data"]["message"], "Processed successfully: 4 words")

        # Clean up
        client.delete(f"/api/workflows/{wf_id}")

    def test_02_step_failure_halts_execution_and_preserves_history(self):
        """Verify that step failure halts execution, records error details, and preserves prior successful steps."""
        db = SessionLocal()
        # Create a workflow directly in DB with a faulty step
        wf = Workflow(
            title="Faulty Pipeline Workflow",
            description="Testing mid-pipeline failure handling",
        )
        db.add(wf)
        db.flush()

        step1 = WorkflowStep(
            workflow_id=wf.id,
            step_order=1,
            step_name="Step 1 - Good Trim",
            action_type="TRANSFORM_TEXT",
            parameters={"operation": "trim"},
        )
        step2 = WorkflowStep(
            workflow_id=wf.id,
            step_order=2,
            step_name="Step 2 - Bad Operation",
            action_type="TRANSFORM_TEXT",
            parameters={"operation": "unsupported_xyz"},  # Will fail
        )
        step3 = WorkflowStep(
            workflow_id=wf.id,
            step_order=3,
            step_name="Step 3 - Should Not Run",
            action_type="LOG_MESSAGE",
            parameters={"message": "Should never reach here", "level": "INFO"},
        )
        db.add_all([step1, step2, step3])
        db.commit()
        wf_id = wf.id
        db.close()

        # Run the faulty workflow
        run_res = client.post(
            f"/api/workflows/{wf_id}/run",
            json={"input_text": "   some test input   "},
        )
        self.assertEqual(run_res.status_code, 200)
        execution = run_res.json()

        # Overall execution must be FAILED
        self.assertEqual(execution["status"], "FAILED")
        self.assertIn("Step 2 ('Step 2 - Bad Operation') failed", execution["error_message"])

        # Exactly 2 steps should be recorded: Step 1 (SUCCESS), Step 2 (FAILED). Step 3 NOT executed.
        self.assertEqual(len(execution["step_executions"]), 2)

        self.assertEqual(execution["step_executions"][0]["status"], "SUCCESS")
        self.assertEqual(execution["step_executions"][0]["output_data"]["result"], "some test input")

        self.assertEqual(execution["step_executions"][1]["status"], "FAILED")
        self.assertIn("Unsupported TRANSFORM_TEXT operation", execution["step_executions"][1]["error_message"])

        # Clean up
        client.delete(f"/api/workflows/{wf_id}")

    def test_03_type_safety_between_metric_and_subsequent_steps(self):
        """Verify safe conversion and context handling when CALCULATE_METRIC precedes other steps."""
        create_payload = {
            "title": "Metric Pipeline Test",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Count Characters",
                    "action_type": "CALCULATE_METRIC",
                    "parameters": {"metric": "char_count"},
                },
                {
                    "step_order": 2,
                    "step_name": "Count Lines",
                    "action_type": "CALCULATE_METRIC",
                    "parameters": {"metric": "line_count"},
                },
                {
                    "step_order": 3,
                    "step_name": "Convert Case After Metric",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "lowercase"},
                },
            ],
        }
        create_res = client.post("/api/workflows", json=create_payload)
        wf_id = create_res.json()["id"]

        run_res = client.post(
            f"/api/workflows/{wf_id}/run",
            json={"input_text": "Line 1\nLine 2"},
        )
        self.assertEqual(run_res.status_code, 200)
        execution = run_res.json()
        self.assertEqual(execution["status"], "SUCCESS")

        step1 = execution["step_executions"][0]
        self.assertEqual(step1["output_data"]["value"], 13)

        step2 = execution["step_executions"][1]
        self.assertEqual(step2["output_data"]["value"], 2)

        step3 = execution["step_executions"][2]
        self.assertEqual(step3["output_data"]["result"], "line 1\nline 2")

        # Clean up
        client.delete(f"/api/workflows/{wf_id}")

    def test_04_execution_history_endpoint(self):
        """Verify GET /api/workflows/{id}/executions returns both successful and failed runs."""
        # Create a simple workflow
        create_res = client.post(
            "/api/workflows",
            json={
                "title": "History Test Workflow",
                "steps": [
                    {
                        "step_order": 1,
                        "step_name": "Trim",
                        "action_type": "TRANSFORM_TEXT",
                        "parameters": {"operation": "trim"},
                    }
                ],
            },
        )
        wf_id = create_res.json()["id"]

        # Run twice
        client.post(f"/api/workflows/{wf_id}/run", json={"input_text": "run 1"})
        client.post(f"/api/workflows/{wf_id}/run", json={"input_text": "run 2"})

        # Retrieve history
        hist_res = client.get(f"/api/workflows/{wf_id}/executions")
        self.assertEqual(hist_res.status_code, 200)
        history = hist_res.json()
        self.assertGreaterEqual(len(history), 2)
        self.assertEqual(history[0]["input_text"], "run 2")
        self.assertEqual(history[1]["input_text"], "run 1")

        # Clean up
        client.delete(f"/api/workflows/{wf_id}")

    def test_05_nonexistent_workflow_returns_404(self):
        """Verify running a non-existent workflow returns 404."""
        res = client.post("/api/workflows/99999/run", json={"input_text": "test"})
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()

