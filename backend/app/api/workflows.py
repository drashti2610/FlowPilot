from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.models import Workflow, WorkflowStep, WorkflowExecution
from app.schemas.schemas import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowDetailResponse,
    WorkflowListItemResponse,
    WorkflowGenerateRequest,
    WorkflowGenerateResponse,
    WorkflowRunRequest,
    WorkflowExecutionResponse,
)
from app.services.groq_service import (
    generate_workflow_draft,
    GroqConfigError,
    GroqValidationError,
    GroqExecutionError,
)
from app.services.execution_engine import execute_workflow

router = APIRouter()


@router.get("", response_model=List[WorkflowListItemResponse])
def list_workflows(db: Session = Depends(get_db)):
    """
    Retrieve all workflows.
    Includes step count, last run timestamp, and last run status for each workflow.
    """
    workflows = db.query(Workflow).order_by(Workflow.created_at.desc()).all()
    response = []
    for wf in workflows:
        last_exec = wf.executions[0] if wf.executions else None
        response.append(
            WorkflowListItemResponse(
                id=wf.id,
                title=wf.title,
                description=wf.description,
                step_count=len(wf.steps),
                created_at=wf.created_at,
                updated_at=wf.updated_at,
                last_run_at=last_exec.started_at if last_exec else None,
                last_run_status=last_exec.status if last_exec else None,
            )
        )
    return response


@router.post("", response_model=WorkflowDetailResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(workflow_in: WorkflowCreate, db: Session = Depends(get_db)):
    """
    Create a new workflow along with its optional ordered steps.
    """
    new_workflow = Workflow(
        title=workflow_in.title,
        description=workflow_in.description,
        original_prompt=workflow_in.original_prompt,
    )
    db.add(new_workflow)
    db.flush()  # Populates new_workflow.id

    for step_data in workflow_in.steps:
        step = WorkflowStep(
            workflow_id=new_workflow.id,
            step_order=step_data.step_order,
            step_name=step_data.step_name,
            action_type=step_data.action_type,
            parameters=step_data.parameters,
        )
        db.add(step)

    db.commit()
    db.refresh(new_workflow)

    last_exec = new_workflow.executions[0] if new_workflow.executions else None
    return WorkflowDetailResponse(
        id=new_workflow.id,
        title=new_workflow.title,
        description=new_workflow.description,
        original_prompt=new_workflow.original_prompt,
        created_at=new_workflow.created_at,
        updated_at=new_workflow.updated_at,
        steps=new_workflow.steps,
        last_run_at=last_exec.started_at if last_exec else None,
        last_run_status=last_exec.status if last_exec else None,
    )


@router.post("/generate", response_model=WorkflowGenerateResponse)
def generate_workflow(request: WorkflowGenerateRequest):
    """
    Generate a structured workflow draft using Groq AI (openai/gpt-oss-20b) based on a natural language prompt.
    The returned draft is not saved to the database. The user must review and explicitly save it.
    """
    try:
        draft = generate_workflow_draft(request.prompt)
        return draft
    except GroqConfigError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except GroqValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except GroqExecutionError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during workflow generation: {str(e)}",
        )


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a specific workflow by its ID, including ordered steps.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with ID {workflow_id} not found",
        )

    last_exec = workflow.executions[0] if workflow.executions else None
    return WorkflowDetailResponse(
        id=workflow.id,
        title=workflow.title,
        description=workflow.description,
        original_prompt=workflow.original_prompt,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        steps=workflow.steps,
        last_run_at=last_exec.started_at if last_exec else None,
        last_run_status=last_exec.status if last_exec else None,
    )


@router.put("/{workflow_id}", response_model=WorkflowDetailResponse)
def update_workflow(
    workflow_id: int,
    workflow_in: WorkflowUpdate,
    db: Session = Depends(get_db),
):
    """
    Update an existing workflow's details and/or steps.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with ID {workflow_id} not found",
        )

    if workflow_in.title is not None:
        workflow.title = workflow_in.title
    if workflow_in.description is not None:
        workflow.description = workflow_in.description
    if workflow_in.original_prompt is not None:
        workflow.original_prompt = workflow_in.original_prompt

    # Replace steps if provided in the update payload
    if workflow_in.steps is not None:
        # Remove old steps
        db.query(WorkflowStep).filter(WorkflowStep.workflow_id == workflow.id).delete()
        db.flush()

        # Add updated steps
        for step_data in workflow_in.steps:
            new_step = WorkflowStep(
                workflow_id=workflow.id,
                step_order=step_data.step_order,
                step_name=step_data.step_name,
                action_type=step_data.action_type,
                parameters=step_data.parameters,
            )
            db.add(new_step)

    db.commit()
    db.refresh(workflow)

    last_exec = workflow.executions[0] if workflow.executions else None
    return WorkflowDetailResponse(
        id=workflow.id,
        title=workflow.title,
        description=workflow.description,
        original_prompt=workflow.original_prompt,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        steps=workflow.steps,
        last_run_at=last_exec.started_at if last_exec else None,
        last_run_status=last_exec.status if last_exec else None,
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    """
    Delete a workflow by ID. Associated steps and executions are automatically cascaded.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with ID {workflow_id} not found",
        )

    db.delete(workflow)
    db.commit()
    return None


@router.post("/{workflow_id}/run", response_model=WorkflowExecutionResponse)
def run_workflow_endpoint(
    workflow_id: int,
    run_req: Optional[WorkflowRunRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Execute a saved workflow sequentially using safe predefined action functions.
    Passes output between steps and persists full execution and step details.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with ID {workflow_id} not found",
        )

    input_text = run_req.input_text if run_req and run_req.input_text is not None else ""
    execution = execute_workflow(workflow=workflow, input_text=input_text, db=db)
    return execution


@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
def get_workflow_executions(
    workflow_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieve all execution runs (both successful and failed) for a workflow.
    """
    workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow with ID {workflow_id} not found",
        )

    executions = (
        db.query(WorkflowExecution)
        .filter(WorkflowExecution.workflow_id == workflow_id)
        .order_by(WorkflowExecution.started_at.desc())
        .all()
    )
    return executions
