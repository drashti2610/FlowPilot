import axios, { AxiosError } from 'axios';
import {
  WorkflowListItem,
  WorkflowDetail,
  WorkflowCreateInput,
  WorkflowUpdateInput,
  WorkflowGenerateResponse,
  WorkflowExecution,
  HealthCheckResponse,
} from '../types/workflow';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Normalizes error messages from FastAPI and network failures.
 */
export function formatErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<any>;
    if (axiosErr.response) {
      const data = axiosErr.response.data;
      if (typeof data?.detail === 'string') {
        return data.detail;
      }
      if (Array.isArray(data?.detail)) {
        // FastAPI validation errors
        return data.detail.map((err: any) => `${err.loc?.join('.') || 'field'}: ${err.msg}`).join(', ');
      }
      if (data?.message) {
        return data.message;
      }
      return `Server error (${axiosErr.response.status}): ${axiosErr.response.statusText}`;
    } else if (axiosErr.request) {
      return 'Unable to reach backend server. Please verify FastAPI is running at ' + API_BASE_URL;
    }
    return axiosErr.message;
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred';
}

export const workflowApi = {
  /**
   * Check backend server health status.
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    const response = await apiClient.get<HealthCheckResponse>('/health');
    return response.data;
  },

  /**
   * Fetch all workflows (summarized listing with step_count and last_run info).
   */
  async getWorkflows(): Promise<WorkflowListItem[]> {
    const response = await apiClient.get<WorkflowListItem[]>('/api/workflows');
    return response.data;
  },

  /**
   * Fetch a single workflow by ID with complete steps.
   */
  async getWorkflow(id: number): Promise<WorkflowDetail> {
    const response = await apiClient.get<WorkflowDetail>(`/api/workflows/${id}`);
    return response.data;
  },

  /**
   * Create a new workflow with optional steps.
   */
  async createWorkflow(payload: WorkflowCreateInput): Promise<WorkflowDetail> {
    const response = await apiClient.post<WorkflowDetail>('/api/workflows', payload);
    return response.data;
  },

  /**
   * Update an existing workflow.
   */
  async updateWorkflow(id: number, payload: WorkflowUpdateInput): Promise<WorkflowDetail> {
    const response = await apiClient.put<WorkflowDetail>(`/api/workflows/${id}`, payload);
    return response.data;
  },

  /**
   * Delete a workflow by ID.
   */
  async deleteWorkflow(id: number): Promise<void> {
    await apiClient.delete(`/api/workflows/${id}`);
  },

  /**
   * Generate an AI workflow draft from a natural language prompt using Groq.
   * Does NOT automatically save to database; returns a draft for user review.
   */
  async generateWorkflow(prompt: string): Promise<WorkflowGenerateResponse> {
    const response = await apiClient.post<WorkflowGenerateResponse>('/api/workflows/generate', {
      prompt,
    });
    return response.data;
  },

  /**
   * Execute a saved workflow with optional input text.
   */
  async runWorkflow(id: number, inputText?: string): Promise<WorkflowExecution> {
    const response = await apiClient.post<WorkflowExecution>(`/api/workflows/${id}/run`, {
      input_text: inputText || '',
    });
    return response.data;
  },

  /**
   * Retrieve all execution runs for a workflow (both successful and failed).
   */
  async getWorkflowExecutions(id: number): Promise<WorkflowExecution[]> {
    const response = await apiClient.get<WorkflowExecution[]>(`/api/workflows/${id}/executions`);
    return response.data;
  },
};

