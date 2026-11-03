"""
Phase 3 Verification Test Suite: Groq AI Integration (openai/gpt-oss-20b) & Strict Schema Validation
"""
import os
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.core.database import SessionLocal, init_db
from app.models.models import Workflow
from app.schemas.schemas import (
    GeneratedWorkflowStep,
    WorkflowGenerateRequest,
    WorkflowGenerateResponse,
)
from app.services.groq_service import (
    generate_workflow_draft,
    GroqConfigError,
    GroqValidationError,
    GroqExecutionError,
    GROQ_MODEL,
)

client = TestClient(app)


class TestPhase3GroqIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_strict_pydantic_action_type_validation(self):
        """Verify only TRANSFORM_TEXT, CALCULATE_METRIC, and LOG_MESSAGE are allowed."""
        # Unsupported action type
        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=1,
                step_name="Send Notification",
                action_type="SEND_EMAIL",  # unsupported
                parameters={"to": "test@example.com"},
            )

        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=1,
                step_name="HTTP Call",
                action_type="EXECUTE_HTTP",  # unsupported
                parameters={"url": "https://example.com"},
            )

    def test_02_strict_pydantic_parameter_validation(self):
        """Verify parameter constraints for each supported action type."""
        # 1. TRANSFORM_TEXT allows only trim, uppercase, lowercase
        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=1,
                step_name="Invalid Transform",
                action_type="TRANSFORM_TEXT",
                parameters={"operation": "reverse"},
            )

        valid_step = GeneratedWorkflowStep(
            step_order=1,
            step_name="Trim Text",
            action_type="TRANSFORM_TEXT",
            parameters={"operation": "trim"},
        )
        self.assertEqual(valid_step.parameters["operation"], "trim")

        # 2. CALCULATE_METRIC allows only word_count, char_count, line_count
        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=2,
                step_name="Invalid Metric",
                action_type="CALCULATE_METRIC",
                parameters={"metric": "sentiment_score"},
            )

        valid_metric = GeneratedWorkflowStep(
            step_order=2,
            step_name="Word Counter",
            action_type="CALCULATE_METRIC",
            parameters={"metric": "word_count"},
        )
        self.assertEqual(valid_metric.parameters["metric"], "word_count")

        # 3. LOG_MESSAGE allows only INFO and WARNING with non-empty message
        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=3,
                step_name="Empty Log",
                action_type="LOG_MESSAGE",
                parameters={"message": ""},
            )

        with self.assertRaises(ValidationError):
            GeneratedWorkflowStep(
                step_order=3,
                step_name="Invalid Level",
                action_type="LOG_MESSAGE",
                parameters={"message": "System check", "level": "DEBUG"},
            )

        for level in ["INFO", "WARNING"]:
            log_step = GeneratedWorkflowStep(
                step_order=3,
                step_name="Valid Log",
                action_type="LOG_MESSAGE",
                parameters={"message": f"Log with {level}", "level": level},
            )
            self.assertEqual(log_step.parameters["level"], level)

    def test_03_missing_api_key_handling(self):
        """Verify endpoint returns HTTP 503 when GROQ_API_KEY is not configured."""
        with patch("app.core.config.settings.GROQ_API_KEY", ""), patch.dict(os.environ, {"GROQ_API_KEY": ""}):
            res = client.post("/api/workflows/generate", json={"prompt": "Clean text and count words"})
            self.assertEqual(res.status_code, 503)
            data = res.json()
            self.assertIn("GROQ_API_KEY is not configured", data["detail"])

    def test_04_invalid_request_payloads(self):
        """Verify validation errors for empty or too-short prompts."""
        # Too short prompt
        res = client.post("/api/workflows/generate", json={"prompt": "hi"})
        self.assertEqual(res.status_code, 422)

        # Missing prompt
        res2 = client.post("/api/workflows/generate", json={})
        self.assertEqual(res2.status_code, 422)

    def test_05_mock_groq_generation_flow(self):
        """Verify successful generation draft format using mocked Groq response."""
        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = '''
        {
            "title": "Customer Feedback Sanitizer",
            "description": "Trims text, counts words, and logs completion status",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Clean Input",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "trim"}
                },
                {
                    "step_order": 2,
                    "step_name": "Count Total Words",
                    "action_type": "CALCULATE_METRIC",
                    "parameters": {"metric": "word_count"}
                },
                {
                    "step_order": 3,
                    "step_name": "Log Completion",
                    "action_type": "LOG_MESSAGE",
                    "parameters": {"message": "Processing finished", "level": "INFO"}
                }
            ]
        }
        '''
        mock_completion.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion

        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            prompt_text = "Clean customer review, count words and log done"
            res = client.post("/api/workflows/generate", json={"prompt": prompt_text})
            self.assertEqual(res.status_code, 200, f"Error: {res.text}")
            draft = res.json()

            self.assertEqual(draft["title"], "Customer Feedback Sanitizer")
            self.assertEqual(draft["original_prompt"], prompt_text)
            self.assertEqual(len(draft["steps"]), 3)
            self.assertEqual(draft["steps"][0]["action_type"], "TRANSFORM_TEXT")
            self.assertEqual(draft["steps"][1]["action_type"], "CALCULATE_METRIC")
            self.assertEqual(draft["steps"][2]["action_type"], "LOG_MESSAGE")
            self.assertEqual(draft["steps"][2]["parameters"]["level"], "INFO")

    def test_06_verify_not_automatically_saved_to_db(self):
        """Verify that generated draft is NOT saved to the database automatically."""
        db = SessionLocal()
        initial_count = db.query(Workflow).count()
        db.close()

        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = '''
        {
            "title": "Unsaved Draft Workflow",
            "description": "This draft should not touch DB",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Trim",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "trim"}
                }
            ]
        }
        '''
        mock_completion.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion

        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            res = client.post("/api/workflows/generate", json={"prompt": "Draft workflow test"})
            self.assertEqual(res.status_code, 200)

        db = SessionLocal()
        new_count = db.query(Workflow).count()
        db.close()
        self.assertEqual(initial_count, new_count, "Database workflow count should NOT change during generation!")

    def test_07_groq_unsupported_action_rejection(self):
        """Verify that if Groq hallucinates an unsupported action, endpoint rejects it."""
        mock_completion = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = '''
        {
            "title": "Hallucinated Workflow",
            "description": "Contains unsupported action",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Call External Webhook",
                    "action_type": "SEND_WEBHOOK",
                    "parameters": {"url": "https://api.com"}
                }
            ]
        }
        '''
        mock_completion.choices = [mock_choice]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_completion

        with patch("app.services.groq_service.get_groq_client", return_value=mock_client):
            res = client.post("/api/workflows/generate", json={"prompt": "Send webhook on user signup"})
            self.assertEqual(res.status_code, 422)
            self.assertIn("validation failed", res.json()["detail"])

    def test_08_existing_crud_endpoints_remain_intact(self):
        """Verify Phase 1 and Phase 2 endpoints work without regression."""
        # 1. Health check
        res = client.get("/health")
        self.assertEqual(res.status_code, 200)

        # 2. List workflows
        list_res = client.get("/api/workflows")
        self.assertEqual(list_res.status_code, 200)

        # 3. Create workflow explicitly
        create_payload = {
            "title": "Phase 3 Explicit Save Test",
            "description": "Testing explicit user save of a workflow",
            "original_prompt": "Clean text and log",
            "steps": [
                {
                    "step_order": 1,
                    "step_name": "Trim Whitespace",
                    "action_type": "TRANSFORM_TEXT",
                    "parameters": {"operation": "trim"}
                }
            ]
        }
        create_res = client.post("/api/workflows", json=create_payload)
        self.assertEqual(create_res.status_code, 201)
        wf_id = create_res.json()["id"]

        # 4. Get by ID
        get_res = client.get(f"/api/workflows/{wf_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["id"], wf_id)

        # 5. Delete workflow
        del_res = client.delete(f"/api/workflows/{wf_id}")
        self.assertEqual(del_res.status_code, 204)

        # 6. Verify 404
        v_res = client.get(f"/api/workflows/{wf_id}")
        self.assertEqual(v_res.status_code, 404)

    def test_09_real_groq_generation_when_key_configured(self):
        """Verify live Groq API generation with openai/gpt-oss-20b when API key is provided."""
        from app.core.config import settings
        api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
        if not api_key or not api_key.startswith("gsk_"):
            self.skipTest("GROQ_API_KEY is not configured or not valid; skipping live test.")

        prompt_text = "Clean the input text, count the words, and log that processing is complete."
        res = client.post("/api/workflows/generate", json={"prompt": prompt_text})
        self.assertEqual(res.status_code, 200, f"Live generation failed: {res.text}")
        data = res.json()

        self.assertIn("title", data)
        self.assertIn("steps", data)
        self.assertGreaterEqual(len(data["steps"]), 1)
        self.assertEqual(data["original_prompt"], prompt_text)
        for step in data["steps"]:
            self.assertIn(step["action_type"], {"TRANSFORM_TEXT", "CALCULATE_METRIC", "LOG_MESSAGE"})


if __name__ == "__main__":
    unittest.main()
