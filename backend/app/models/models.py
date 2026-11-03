from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    func
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Workflow(Base):
    """Represents a user-defined automation workflow."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    original_prompt = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now(), nullable=False)

    # Relationships
    steps = relationship(
        "WorkflowStep",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="WorkflowStep.step_order"
    )
    executions = relationship(
        "WorkflowExecution",
        back_populates="workflow",
        cascade="all, delete-orphan",
        order_by="desc(WorkflowExecution.started_at)"
    )


class WorkflowStep(Base):
    """An individual action step inside a workflow."""
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    step_order = Column(Integer, nullable=False)
    step_name = Column(String(150), nullable=False)
    action_type = Column(String(50), nullable=False)  # TRANSFORM_TEXT, CALCULATE_METRIC, LOG_MESSAGE
    parameters = Column(JSON, nullable=False, default=dict)

    # Relationships
    workflow = relationship("Workflow", back_populates="steps")
    step_executions = relationship("StepExecution", back_populates="step", cascade="all, delete-orphan")


class WorkflowExecution(Base):
    """An execution run of a workflow."""
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="RUNNING")  # SUCCESS, FAILED, RUNNING
    input_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)  # Captures failure explanation if run fails
    started_at = Column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    step_executions = relationship("StepExecution", back_populates="execution", cascade="all, delete-orphan", order_by="StepExecution.step_order")


class StepExecution(Base):
    """The result and performance log of a single step within an execution run."""
    __tablename__ = "step_executions"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    step_id = Column(Integer, ForeignKey("workflow_steps.id", ondelete="SET NULL"), nullable=True)
    step_order = Column(Integer, nullable=False)
    action_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)  # SUCCESS, FAILED
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)  # Captures detailed step error if it failed
    duration_ms = Column(Integer, default=0, nullable=False)
    executed_at = Column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False)

    # Relationships
    execution = relationship("WorkflowExecution", back_populates="step_executions")
    step = relationship("WorkflowStep", back_populates="step_executions")
