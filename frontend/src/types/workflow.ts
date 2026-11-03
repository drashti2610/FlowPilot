export type ActionType = 'TRANSFORM_TEXT' | 'CALCULATE_METRIC' | 'LOG_MESSAGE';

export interface WorkflowStepBase {
  step_order: number;
  step_name: string;
  action_type: ActionType;
  parameters: Record<string, any>;
}

export interface WorkflowStepCreate extends WorkflowStepBase {}

export interface WorkflowStepResponse extends WorkflowStepBase {
  id: number;
  workflow_id: number;
}

export interface WorkflowListItem {
  id: number;
  title: string;
  description: string | null;
  step_count: number;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_run_status: 'SUCCESS' | 'FAILED' | 'RUNNING' | string | null;
}

export interface WorkflowDetail {
  id: number;
  title: string;
  description: string | null;
  original_prompt: string | null;
  created_at: string;
  updated_at: string;
  steps: WorkflowStepResponse[];
  last_run_at: string | null;
  last_run_status: 'SUCCESS' | 'FAILED' | 'RUNNING' | string | null;
}

export interface WorkflowCreateInput {
  title: string;
  description?: string | null;
  original_prompt?: string | null;
  steps: WorkflowStepCreate[];
}

export interface WorkflowUpdateInput {
  title?: string;
  description?: string | null;
  original_prompt?: string | null;
  steps?: WorkflowStepCreate[];
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
}

export interface WorkflowGenerateRequest {
  prompt: string;
}

export interface WorkflowDraftStep {
  step_order: number;
  step_name: string;
  action_type: ActionType;
  parameters: Record<string, any>;
}

export interface WorkflowGenerateResponse {
  title: string;
  description: string | null;
  original_prompt: string;
  steps: WorkflowDraftStep[];
}

export type WorkflowDraft = WorkflowGenerateResponse;

export interface StepExecution {
  id: number;
  step_order: number;
  action_type: string;
  status: 'SUCCESS' | 'FAILED' | string;
  output_data?: Record<string, any> | null;
  error_message?: string | null;
  duration_ms: number;
  executed_at: string;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING' | string;
  input_text?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  step_executions: StepExecution[];
}

export interface WorkflowRunRequest {
  input_text?: string;
}

