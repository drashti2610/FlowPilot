import time
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models.models import Workflow, WorkflowStep, WorkflowExecution, StepExecution

logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExecutionState:
    """
    Maintains pipeline state safely across sequential workflow steps.
    Preserves text data, latest step outputs, and accumulated metrics.
    """
    def __init__(self, initial_text: str = ""):
        self.text: str = str(initial_text or "")
        self.last_output: Any = self.text
        self.metrics: Dict[str, Any] = {}

    def get_text_input(self) -> str:
        """
        Safely returns a string representation for steps requiring text input.
        """
        if isinstance(self.text, str):
            return self.text
        if isinstance(self.last_output, str):
            return self.last_output
        return str(self.last_output or "")


# ==========================================
# Predefined, Safe Action Handlers (No eval)
# ==========================================

def run_transform_text(input_text: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes TRANSFORM_TEXT on input text using strictly predefined operations.
    Supported operations: trim, uppercase, lowercase.
    """
    operation = str(parameters.get("operation") or "trim").lower()
    text = input_text or ""

    if operation == "trim":
        result = text.strip()
    elif operation == "uppercase":
        result = text.upper()
    elif operation == "lowercase":
        result = text.lower()
    else:
        raise ValueError(f"Unsupported TRANSFORM_TEXT operation: '{operation}'. Must be trim, uppercase, or lowercase.")

    return {
        "operation": operation,
        "result": result,
    }


def run_calculate_metric(input_text: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes CALCULATE_METRIC on input text using strictly predefined metrics.
    Supported metrics: word_count, char_count, line_count.
    """
    metric = str(parameters.get("metric") or "word_count").lower()
    text = input_text or ""

    if metric == "word_count":
        value = len(text.split()) if text else 0
    elif metric == "char_count":
        value = len(text)
    elif metric == "line_count":
        value = len(text.splitlines()) if text else 0
    else:
        raise ValueError(f"Unsupported CALCULATE_METRIC metric: '{metric}'. Must be word_count, char_count, or line_count.")

    return {
        "metric": metric,
        "value": value,
    }


def run_log_message(state: ExecutionState, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes LOG_MESSAGE, safely formatting message templates with state metrics.
    Supported levels: INFO, WARNING.
    """
    raw_message = str(parameters.get("message") or "").strip()
    if not raw_message:
        raise ValueError("LOG_MESSAGE requires a non-empty 'message' parameter.")

    level = str(parameters.get("level") or "INFO").upper()
    if level not in {"INFO", "WARNING"}:
        raise ValueError(f"Unsupported LOG_MESSAGE level: '{level}'. Must be INFO or WARNING.")

    # Safely interpolate known metrics or text if present in template
    formatted = raw_message
    if "{text}" in formatted:
        formatted = formatted.replace("{text}", state.get_text_input())
    for k, v in state.metrics.items():
        formatted = formatted.replace(f"{{{k}}}", str(v))

    # Log using standard logger
    if level == "WARNING":
        logger.warning(f"[Workflow Execution Log]: {formatted}")
    else:
        logger.info(f"[Workflow Execution Log]: {formatted}")

    return {
        "level": level,
        "message": formatted,
    }


# ==========================================
# Sequential Workflow Runner
# ==========================================

def execute_workflow(workflow: Workflow, input_text: str, db: Session) -> WorkflowExecution:
    """
    Executes a saved workflow sequentially:
    1. Creates a WorkflowExecution in RUNNING status.
    2. Runs steps in configured step_order using safe predefined handlers.
    3. Passes data safely between steps.
    4. Persists each step execution immediately (including failure details).
    5. Halts immediately if any step fails.
    6. Updates and returns the final WorkflowExecution.
    """
    cleaned_input = str(input_text or "")

    # 1. Initialize execution record
    execution = WorkflowExecution(
        workflow_id=workflow.id,
        status="RUNNING",
        input_text=cleaned_input,
        started_at=utcnow(),
        completed_at=None,
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)

    state = ExecutionState(initial_text=cleaned_input)

    # If workflow has no steps, complete immediately
    steps = sorted(workflow.steps, key=lambda s: s.step_order)
    if not steps:
        execution.status = "SUCCESS"
        execution.completed_at = utcnow()
        db.commit()
        db.refresh(execution)
        return execution

    # 2. Sequential execution loop
    for step in steps:
        start_time = time.perf_counter()
        step_exec = StepExecution(
            execution_id=execution.id,
            step_id=step.id,
            step_order=step.step_order,
            action_type=step.action_type,
            status="RUNNING",
            executed_at=utcnow(),
            duration_ms=0,
        )

        try:
            action_type = str(step.action_type).upper()
            params = step.parameters or {}

            if action_type == "TRANSFORM_TEXT":
                current_text = state.get_text_input()
                output_data = run_transform_text(current_text, params)
                # Update pipeline text stream with transformed result
                transformed_result = output_data["result"]
                state.text = transformed_result
                state.last_output = transformed_result

            elif action_type == "CALCULATE_METRIC":
                current_text = state.get_text_input()
                output_data = run_calculate_metric(current_text, params)
                # Store metric in state dictionary while preserving text stream
                state.metrics[output_data["metric"]] = output_data["value"]
                state.last_output = output_data["value"]

            elif action_type == "LOG_MESSAGE":
                output_data = run_log_message(state, params)
                state.last_output = output_data["message"]

            else:
                raise ValueError(f"Unknown action type: '{step.action_type}'")

            # Success for this step
            duration_ms = max(1, int((time.perf_counter() - start_time) * 1000))
            step_exec.status = "SUCCESS"
            step_exec.output_data = output_data
            step_exec.duration_ms = duration_ms

            db.add(step_exec)
            db.commit()

        except Exception as e:
            # Failure occurred: record immediately and halt
            duration_ms = max(1, int((time.perf_counter() - start_time) * 1000))
            error_msg = str(e)
            logger.warning(f"Step {step.step_order} failed in workflow {workflow.id}: {error_msg}")

            step_exec.status = "FAILED"
            step_exec.error_message = error_msg
            step_exec.duration_ms = duration_ms
            db.add(step_exec)

            # Mark workflow as FAILED and halt execution
            execution.status = "FAILED"
            execution.error_message = f"Step {step.step_order} ('{step.step_name}') failed: {error_msg}"
            execution.completed_at = utcnow()
            db.commit()
            db.refresh(execution)
            return execution

    # 3. All steps completed successfully
    execution.status = "SUCCESS"
    execution.completed_at = utcnow()
    db.commit()
    db.refresh(execution)
    return execution

