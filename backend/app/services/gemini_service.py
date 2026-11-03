"""
Legacy Gemini service shim redirecting to the official Groq service.
Maintains backward compatibility across imports while using Groq (openai/gpt-oss-20b).
"""
from app.services.groq_service import (
    GROQ_MODEL,
    SYSTEM_INSTRUCTION,
    GroqServiceError,
    GroqConfigError,
    GroqExecutionError,
    GroqValidationError,
    GeminiServiceError,
    GeminiConfigError,
    GeminiExecutionError,
    GeminiValidationError,
    get_groq_client,
    generate_workflow_draft,
)

# Backward-compatibility alias
get_gemini_client = get_groq_client
GEMINI_MODEL = GROQ_MODEL
