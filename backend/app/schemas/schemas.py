from datetime import datetime
from typing import List, Optional, Any, Dict, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ==========================================
# Workflow Step Schemas
# ==========================================

class WorkflowStepBase(BaseModel):
    step_order: int = Field(..., ge=1, description="Sequential order of the step, starting from 1")
    step_name: str = Field(..., min_length=1, max_length=150, description="Short descriptive label for the step")
    action_type: str = Field(..., description="Action type: TRANSFORM_TEXT, CALCULATE_METRIC, LOG_MESSAGE")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action-specific parameters")


class WorkflowStepCreate(WorkflowStepBase):
    pass


class WorkflowStepResponse(WorkflowStepBase):
    id: int
    workflow_id: int

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Workflow Schemas
# ==========================================

class WorkflowBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Workflow title")
    description: Optional[str] = Field(None, description="Detailed explanation of what the workflow does")
    original_prompt: Optional[str] = Field(None, description="Natural language prompt used to generate this workflow")


class WorkflowCreate(WorkflowBase):
    steps: List[WorkflowStepCreate] = Field(default_factory=list, description="Ordered steps for the workflow")


class WorkflowUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    original_prompt: Optional[str] = None
    steps: Optional[List[WorkflowStepCreate]] = None


class WorkflowListItemResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    step_count: int
    created_at: datetime
    updated_at: datetime
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowDetailResponse(WorkflowBase):
    id: int
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowStepResponse]
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Execution Schemas (for logging & auditing)
# ==========================================

class StepExecutionResponse(BaseModel):
    id: int
    step_order: int
    action_type: str
    status: str
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    duration_ms: int
    executed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkflowExecutionResponse(BaseModel):
    id: int
    workflow_id: int
    status: str
    input_text: Optional[str] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    step_executions: List[StepExecutionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class WorkflowRunRequest(BaseModel):
    input_text: Optional[str] = Field(default="", description="Initial input text passed to the workflow")


# ==========================================
# Gemini AI Generation Schemas (Phase 3)
# ==========================================

class GeneratedWorkflowStep(BaseModel):
    step_order: int = Field(..., ge=1, description="Sequential order starting from 1")
    step_name: str = Field(..., min_length=1, max_length=150, description="Descriptive label for this step")
    action_type: Literal["TRANSFORM_TEXT", "CALCULATE_METRIC", "LOG_MESSAGE"] = Field(
        ..., description="Supported action type strictly limited to TRANSFORM_TEXT, CALCULATE_METRIC, or LOG_MESSAGE"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, description="Action-specific parameters"
    )

    @model_validator(mode="after")
    def validate_action_parameters(self):
        action = self.action_type
        params = self.parameters or {}

        if action == "TRANSFORM_TEXT":
            op = params.get("operation")
            valid_ops = {"trim", "uppercase", "lowercase"}
            if not op or str(op).lower() not in valid_ops:
                raise ValueError(
                    f"Invalid operation '{op}' for TRANSFORM_TEXT. Must be one of: {', '.join(sorted(valid_ops))}"
                )
            params["operation"] = str(op).lower()

        elif action == "CALCULATE_METRIC":
            metric = params.get("metric")
            valid_metrics = {"word_count", "char_count", "line_count"}
            if not metric or str(metric).lower() not in valid_metrics:
                raise ValueError(
                    f"Invalid metric '{metric}' for CALCULATE_METRIC. Must be one of: {', '.join(sorted(valid_metrics))}"
                )
            params["metric"] = str(metric).lower()

        elif action == "LOG_MESSAGE":
            message = params.get("message")
            if not message or not str(message).strip():
                raise ValueError("LOG_MESSAGE requires a non-empty 'message' parameter")
            level = params.get("level", "INFO")
            valid_levels = {"INFO", "WARNING"}
            if str(level).upper() not in valid_levels:
                raise ValueError(
                    f"Invalid level '{level}' for LOG_MESSAGE. Must be one of: {', '.join(sorted(valid_levels))}"
                )
            params["level"] = str(level).upper()

        self.parameters = params
        return self


class WorkflowGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000, description="Natural language description of the workflow to generate")


class WorkflowGenerateResponse(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Generated workflow title")
    description: Optional[str] = Field(None, description="Concise explanation of the workflow purpose")
    original_prompt: str = Field(..., description="Original user prompt used for generation")
    steps: List[GeneratedWorkflowStep] = Field(..., min_length=1, description="Generated sequential steps")

