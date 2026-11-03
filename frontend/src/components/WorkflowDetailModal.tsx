import React, { useState, useEffect } from 'react';
import { WorkflowDetail, WorkflowExecution } from '../types/workflow';
import { workflowApi } from '../services/api';
import { formatDate, formatRelativeTime, getStatusBadge, getActionTypeBadge } from '../utils/formatters';
import { X, Layers, Edit2, Trash2, Sparkles, Terminal, Play, History, Clock } from 'lucide-react';

interface WorkflowDetailModalProps {
  workflow: WorkflowDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (workflow: WorkflowDetail) => void;
  onDelete: (workflow: WorkflowDetail) => void;
  onRun: (workflow: WorkflowDetail) => void;
}

export const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onRun,
}) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);

  useEffect(() => {
    if (isOpen && workflow) {
      workflowApi
        .getWorkflowExecutions(workflow.id)
        .then((runs) => setExecutions(runs))
        .catch(() => setExecutions([]));
    }
  }, [isOpen, workflow]);

  if (!isOpen || !workflow) return null;

  const statusBadge = getStatusBadge(workflow.last_run_status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-200/80 text-slate-700">
              ID #{workflow.id}
            </span>
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.bgClass} ${statusBadge.textClass} ${statusBadge.borderClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
              <span>{statusBadge.label}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                onClose();
                onRun(workflow);
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(workflow);
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onDelete(workflow);
              }}
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title and Description */}
          <div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">{workflow.title}</h1>
            <p className="text-sm text-slate-600">
              {workflow.description || <span className="italic text-slate-400">No description provided for this workflow.</span>}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="block text-slate-400 uppercase font-semibold text-[10px] tracking-wider mb-0.5">
                Total Steps
              </span>
              <span className="font-semibold text-slate-800 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-brand-600" />
                <span>{workflow.steps?.length || 0} steps</span>
              </span>
            </div>
            <div>
              <span className="block text-slate-400 uppercase font-semibold text-[10px] tracking-wider mb-0.5">
                Created
              </span>
              <span className="font-medium text-slate-700" title={formatDate(workflow.created_at)}>
                {formatDate(workflow.created_at)}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 uppercase font-semibold text-[10px] tracking-wider mb-0.5">
                Last Updated
              </span>
              <span className="font-medium text-slate-700">
                {formatRelativeTime(workflow.updated_at)}
              </span>
            </div>
            <div>
              <span className="block text-slate-400 uppercase font-semibold text-[10px] tracking-wider mb-0.5">
                Last Execution
              </span>
              <span className="font-medium text-slate-700">
                {workflow.last_run_at ? `Ran ${formatRelativeTime(workflow.last_run_at)}` : 'Never Run'}
              </span>
            </div>
          </div>

          {/* Original Prompt (if present) */}
          {workflow.original_prompt && (
            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-900 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Original Prompt</span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-950/80 font-mono bg-white/80 p-3 rounded-lg border border-indigo-100/80">
                {workflow.original_prompt}
              </p>
            </div>
          )}

          {/* Steps Pipeline View */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-slate-600" />
                <span>Pipeline Execution Order ({workflow.steps?.length || 0})</span>
              </h3>
            </div>

            {(!workflow.steps || workflow.steps.length === 0) ? (
              <div className="p-6 text-center border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-500">
                This workflow does not have any execution steps defined.
              </div>
            ) : (
              <div className="space-y-3">
                {workflow.steps.map((step) => {
                  const badge = getActionTypeBadge(step.action_type);
                  return (
                    <div
                      key={step.id || step.step_order}
                      className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center space-x-2.5">
                          <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {step.step_order}
                          </span>
                          <span className="font-semibold text-sm text-slate-900">
                            {step.step_name}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${badge.badgeBg} ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Parameters view */}
                      <div className="mt-2 text-xs">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                          Configured Parameters:
                        </span>
                        <pre className="mt-1 font-mono text-xs bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto">
                          {JSON.stringify(step.parameters, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Execution History Section (Adjustment 3) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-slate-600" />
                <span>Execution History ({executions.length})</span>
              </h3>
            </div>

            {executions.length === 0 ? (
              <div className="p-4 text-center border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-500">
                No past executions recorded yet. Click <strong>Run</strong> in the top right to execute this workflow.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {executions.map((run) => (
                  <div
                    key={run.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          run.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800">Run #{run.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              run.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {run.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono truncate max-w-sm mt-0.5">
                          Input: "{run.input_text || 'empty'}"
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{formatRelativeTime(run.started_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50/70">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
