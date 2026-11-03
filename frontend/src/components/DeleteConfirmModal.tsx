import React from 'react';
import { WorkflowListItem } from '../types/workflow';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  workflow: WorkflowListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !workflow) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <h3 className="text-base font-bold text-slate-900">Delete Workflow</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-900">"{workflow.title}"</span>?
              This action cannot be undone and will permanently remove all associated steps and execution logs.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 rounded-lg shadow-sm transition-all"
            >
              {isDeleting && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{isDeleting ? 'Deleting...' : 'Delete Workflow'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

