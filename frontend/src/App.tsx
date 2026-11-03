import { useState, useEffect, useCallback } from 'react';
import { WorkflowListItem, WorkflowDetail, WorkflowDraft } from './types/workflow';
import { workflowApi, formatErrorMessage } from './services/api';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { WorkflowModal } from './components/WorkflowModal';
import { WorkflowDetailModal } from './components/WorkflowDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { RunWorkflowModal } from './components/RunWorkflowModal';
import { ToastContainer, ToastMessage } from './components/Toast';

export function App() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDetail | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<WorkflowDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);

  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [workflowToRun, setWorkflowToRun] = useState<WorkflowListItem | null>(null);
  const [isRunModalOpen, setIsRunModalOpen] = useState<boolean>(false);

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string, title?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Health check and workflow list loader
  const checkBackendAndFetch = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // 1. Health check
      try {
        const health = await workflowApi.checkHealth();
        setBackendHealthy(health?.status === 'healthy');
      } catch {
        setBackendHealthy(false);
      }

      // 2. Workflows fetch
      const data = await workflowApi.getWorkflows();
      setWorkflows(data);
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      setBackendHealthy(false);
      if (quiet) {
        addToast('error', msg, 'Failed to sync');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    checkBackendAndFetch();
  }, [checkBackendAndFetch]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingWorkflow(null);
    setGeneratedDraft(null);
    setIsModalOpen(true);
  };

  // Generate Workflow with Groq AI
  const handleGenerateWorkflow = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const draft = await workflowApi.generateWorkflow(prompt);
      setEditingWorkflow(null);
      setGeneratedDraft(draft);
      setIsModalOpen(true);
      addToast(
        'success',
        `Generated "${draft.title}" with ${draft.steps.length} steps. Review and customize before saving.`,
        'AI Draft Ready'
      );
    } catch (err) {
      addToast('error', formatErrorMessage(err), 'Workflow Generation Failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Open View Details Modal
  const handleViewWorkflow = async (id: number) => {
    try {
      const detail = await workflowApi.getWorkflow(id);
      setSelectedWorkflow(detail);
      setIsDetailOpen(true);
    } catch (err) {
      addToast('error', formatErrorMessage(err), 'Failed to load details');
    }
  };

  // Open Edit Modal
  const handleEditWorkflow = async (id: number) => {
    try {
      const detail = await workflowApi.getWorkflow(id);
      setEditingWorkflow(detail);
      setIsModalOpen(true);
    } catch (err) {
      addToast('error', formatErrorMessage(err), 'Failed to load workflow for editing');
    }
  };

  // Open Delete Modal
  const handleDeletePrompt = (wf: WorkflowListItem) => {
    setWorkflowToDelete(wf);
  };

  // Open Run Modal
  const handleOpenRun = (wf: WorkflowListItem | WorkflowDetail) => {
    setWorkflowToRun({
      id: wf.id,
      title: wf.title,
      description: wf.description,
      step_count: (wf as any).step_count ?? (wf as any).steps?.length ?? 0,
      created_at: wf.created_at,
      updated_at: wf.updated_at,
      last_run_at: wf.last_run_at,
      last_run_status: wf.last_run_status,
    });
    setIsRunModalOpen(true);
  };

  // Confirm Delete Action
  const handleConfirmDelete = async () => {
    if (!workflowToDelete) return;
    setIsDeleting(true);

    try {
      await workflowApi.deleteWorkflow(workflowToDelete.id);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowToDelete.id));
      addToast('success', `Workflow "${workflowToDelete.title}" deleted successfully.`);
      setWorkflowToDelete(null);
    } catch (err) {
      addToast('error', formatErrorMessage(err), 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Success handler for creation / updating
  const handleModalSuccess = (savedWorkflow: WorkflowDetail, isUpdate: boolean) => {
    addToast(
      'success',
      isUpdate
        ? `Workflow "${savedWorkflow.title}" updated successfully.`
        : `Workflow "${savedWorkflow.title}" created successfully.`
    );
    // Refresh the list from the database
    checkBackendAndFetch(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navigation Bar */}
      <Navbar
        backendHealthy={backendHealthy}
        onRefresh={() => checkBackendAndFetch(true)}
        isRefreshing={isRefreshing}
        onCreateClick={handleOpenCreate}
      />

      {/* Main Dashboard */}
      <main className="flex-1">
        <Dashboard
          workflows={workflows}
          isLoading={isLoading}
          error={error}
          onRefresh={() => checkBackendAndFetch(false)}
          onCreateClick={handleOpenCreate}
          onViewWorkflow={handleViewWorkflow}
          onEditWorkflow={handleEditWorkflow}
          onDeleteWorkflow={handleDeletePrompt}
          onRunWorkflow={handleOpenRun}
          onGenerateWorkflow={handleGenerateWorkflow}
          isGenerating={isGenerating}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            <span className="font-semibold text-slate-700">FlowPilot</span> — AI-Powered Workflow Automation Platform (v1.0)
          </div>
          <div className="flex items-center space-x-4">
            <span>FastAPI + SQLite + Groq (GPT-OSS-20B)</span>
            <span>•</span>
            <span>React + Vite + Tailwind Frontend</span>
          </div>
        </div>
      </footer>

      {/* Modals & Overlays */}
      <WorkflowModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setGeneratedDraft(null);
        }}
        onSuccess={handleModalSuccess}
        initialWorkflow={editingWorkflow}
        initialDraft={generatedDraft}
      />

      <WorkflowDetailModal
        workflow={selectedWorkflow}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedWorkflow(null);
        }}
        onEdit={(wf) => {
          setEditingWorkflow(wf);
          setIsModalOpen(true);
        }}
        onDelete={(wf) => {
          setWorkflowToDelete({
            id: wf.id,
            title: wf.title,
            description: wf.description,
            step_count: wf.steps.length,
            created_at: wf.created_at,
            updated_at: wf.updated_at,
            last_run_at: wf.last_run_at,
            last_run_status: wf.last_run_status,
          });
        }}
        onRun={handleOpenRun}
      />

      <RunWorkflowModal
        workflow={workflowToRun}
        isOpen={isRunModalOpen}
        onClose={() => {
          setIsRunModalOpen(false);
          setWorkflowToRun(null);
        }}
        onExecutionComplete={() => checkBackendAndFetch(true)}
      />

      <DeleteConfirmModal
        workflow={workflowToDelete}
        isOpen={Boolean(workflowToDelete)}
        onClose={() => setWorkflowToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
