import json
import logging
import os
from typing import Optional
from groq import Groq, APIError
from pydantic import ValidationError

from app.core.config import settings
from app.schemas.schemas import WorkflowGenerateResponse

logger = logging.getLogger(__name__)

# Official Groq model as requested
GROQ_MODEL = "openai/gpt-oss-20b"

SYSTEM_INSTRUCTION = """You are FlowPilot's AI Workflow Architect.
Your task is to analyze natural language descriptions and translate them into a structured automation workflow draft.

CRITICAL CONSTRAINTS - STRICTLY ENFORCED:
1. You may ONLY use the following 3 supported action types. NEVER invent or output any other action type:
   - "TRANSFORM_TEXT"
   - "CALCULATE_METRIC"
   - "LOG_MESSAGE"

2. Action Type Parameter Specifications:
   - For "TRANSFORM_TEXT", parameters MUST be:
     {"operation": "trim" | "uppercase" | "lowercase"}
   - For "CALCULATE_METRIC", parameters MUST be:
     {"metric": "word_count" | "char_count" | "line_count"}
   - For "LOG_MESSAGE", parameters MUST be:
     {"message": "<informative string>", "level": "INFO" | "WARNING"}

3. Step ordering must be sequential starting at 1 (1, 2, 3...).
4. Generate a concise, professional title (under 100 characters) and a clear description.
5. If the user prompt describes tasks not possible with the 3 supported actions, map to the closest logical supported actions or fail gracefully.

Output ONLY valid JSON adhering strictly to this structure:
{
  "title": "Clean & Count Words Workflow",
  "description": "Cleans the input text, calculates total word count, and logs completion.",
  "steps": [
    {
      "step_order": 1,
      "step_name": "Trim Whitespace",
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
      "parameters": {"message": "Processing is complete", "level": "INFO"}
    }
  ]
}
"""


class GroqServiceError(Exception):
    """Base exception for Groq service errors."""
    pass


class GroqConfigError(GroqServiceError):
    """Raised when Groq API key is missing or invalid."""
    pass


class GroqExecutionError(GroqServiceError):
    """Raised when Groq API call fails."""
    pass


class GroqValidationError(GroqServiceError):
    """Raised when generated response fails schema validation."""
    pass


# Backward-compatibility aliases
GeminiServiceError = GroqServiceError
GeminiConfigError = GroqConfigError
GeminiExecutionError = GroqExecutionError
GeminiValidationError = GroqValidationError


def get_groq_client() -> Groq:
    """
    Initializes and returns the official Groq client.
    Reads the key from settings or environment.
    """
    api_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    if not api_key or not api_key.strip():
        raise GroqConfigError(
            "GROQ_API_KEY is not configured. Please add your Groq API key to backend/.env."
        )
    return Groq(api_key=api_key.strip())


def generate_workflow_draft(prompt: str) -> WorkflowGenerateResponse:
    """
    Generates a structured workflow draft from a user's natural language prompt
    using Groq (openai/gpt-oss-20b) and validates it strictly using Pydantic.
    """
    trimmed_prompt = prompt.strip()
    if not trimmed_prompt:
        raise ValueError("Workflow prompt cannot be empty.")

    client = get_groq_client()

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {"role": "user", "content": f"User Workflow Request:\n{trimmed_prompt}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
    except APIError as e:
        logger.error(f"Groq API error during workflow generation: {e}")
        raise GroqExecutionError(f"Groq API error: {e.message or str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error communicating with Groq: {e}")
        raise GroqExecutionError(f"Failed to communicate with Groq API: {str(e)}")

    if not completion or not completion.choices or not completion.choices[0].message:
        raise GroqExecutionError("Groq returned an empty response.")

    raw_text = completion.choices[0].message.content
    if not raw_text or not raw_text.strip():
        raise GroqExecutionError("Groq returned an empty message content.")

    raw_text = raw_text.strip()

    # Parse JSON output
    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"Groq output was not valid JSON: {raw_text}")
        raise GroqValidationError(f"Groq response could not be parsed as JSON: {str(e)}")

    if not isinstance(data, dict):
        raise GroqValidationError("Groq response is not a valid JSON object.")

    # Attach the original prompt
    data["original_prompt"] = trimmed_prompt

    # Strictly validate against Pydantic schema
    try:
        validated_workflow = WorkflowGenerateResponse.model_validate(data)
        return validated_workflow
    except ValidationError as e:
        logger.error(f"Pydantic validation failed for generated workflow: {e}")
        errors = [f"{err['loc'][-1] if err['loc'] else 'root'}: {err['msg']}" for err in e.errors()]
        raise GroqValidationError(f"Generated workflow validation failed: {'; '.join(errors)}")

