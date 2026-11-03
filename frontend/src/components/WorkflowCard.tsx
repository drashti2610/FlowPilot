import React from 'react';
import { WorkflowListItem } from '../types/workflow';
import { formatDate, formatRelativeTime, getStatusBadge } from '../utils/formatters';
import { Layers, Calendar, Clock, Edit2, Trash2, ArrowUpRight, Play } from 'lucide-react';

interface WorkflowCardProps {
  workflow: WorkflowListItem;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (workflow: WorkflowListItem) => void;
  onRun: (workflow: WorkflowListItem) => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  onView,
  onEdit,
  onDelete,
  onRun,
}) => {
  const statusBadge = getStatusBadge(workflow.last_run_status);

  return (
    <div className="group relative flex flex-col justify-between bg-white rounded-xl border border-slate-200 hover:border-brand-300 shadow-sm hover:shadow transition-all duration-200 overflow-hidden">
      {/* Top accent bar indicating status subtly */}
      <div
        className={`h-1 w-full ${
          workflow.last_run_status === 'SUCCESS'
            ? 'bg-emerald-500'
            : workflow.last_run_status === 'FAILED'
            ? 'bg-rose-500'
            : workflow.last_run_status === 'RUNNING'
            ? 'bg-amber-500'
            : 'bg-slate-200 group-hover:bg-brand-500'
        } transition-colors`}
      />

      <div className="p-5">
        {/* Header: Title and Status */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <h3
            onClick={() => onView(workflow.id)}
            className="text-base font-semibold text-slate-900 group-hover:text-brand-700 cursor-pointer transition-colors line-clamp-1"
            title={workflow.title}
          >
            {workflow.title}
          </h3>
          <span
            className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.bgClass} ${statusBadge.textClass} ${statusBadge.borderClass} shrink-0`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass}`} />
            <span>{statusBadge.label}</span>
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 line-clamp-2 min-h-[2rem] mb-4">
          {workflow.description || <span className="italic text-slate-400">No description provided</span>}
        </p>

        {/* Metadata badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-2">
          {/* Steps Count */}
          <div className="flex items-center space-x-1 font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{workflow.step_count}</span>
            <span>{workflow.step_count === 1 ? 'step' : 'steps'}</span>
          </div>

          {/* Created date */}
          <div className="flex items-center space-x-1" title={`Created at: ${formatDate(workflow.created_at)}`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(workflow.created_at)}</span>
          </div>

          {/* Last Run Time */}
          {workflow.last_run_at && (
            <div className="flex items-center space-x-1 text-slate-500" title={`Last ran: ${formatDate(workflow.last_run_at)}`}>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Ran {formatRelativeTime(workflow.last_run_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <button
          onClick={() => onView(workflow.id)}
          className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-brand-600 transition-colors"
        >
          <span>View Details</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onRun(workflow)}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
            title="Run Workflow"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run</span>
          </button>
          <button
            onClick={() => onEdit(workflow.id)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
            title="Edit Workflow"
            aria-label="Edit Workflow"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(workflow)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
            title="Delete Workflow"
            aria-label="Delete Workflow"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

