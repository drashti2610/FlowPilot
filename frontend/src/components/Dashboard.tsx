import React, { useState, useMemo } from 'react';
import { WorkflowListItem } from '../types/workflow';
import { WorkflowCard } from './WorkflowCard';
import {
  Search,
  Plus,
  Layers,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Filter,
  RefreshCw,
  FolderGit2,
  Wand2,
  Loader2,
} from 'lucide-react';

interface DashboardProps {
  workflows: WorkflowListItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreateClick: () => void;
  onViewWorkflow: (id: number) => void;
  onEditWorkflow: (id: number) => void;
  onDeleteWorkflow: (workflow: WorkflowListItem) => void;
  onRunWorkflow: (workflow: WorkflowListItem) => void;
  onGenerateWorkflow: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  workflows,
  isLoading,
  error,
  onRefresh,
  onCreateClick,
  onViewWorkflow,
  onEditWorkflow,
  onDeleteWorkflow,
  onRunWorkflow,
  onGenerateWorkflow,
  isGenerating,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [aiPrompt, setAiPrompt] = useState('');

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || isGenerating) return;
    await onGenerateWorkflow(aiPrompt.trim());
  };

  // Compute platform metrics
  const stats = useMemo(() => {
    const total = workflows.length;
    const totalSteps = workflows.reduce((acc, w) => acc + (w.step_count || 0), 0);
    const successRuns = workflows.filter((w) => w.last_run_status === 'SUCCESS').length;
    const failedRuns = workflows.filter((w) => w.last_run_status === 'FAILED').length;
    return { total, totalSteps, successRuns, failedRuns };
  }, [workflows]);

  // Filter workflows by search query and status filter
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      const matchesSearch =
        wf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wf.description && wf.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'SUCCESS') matchesStatus = wf.last_run_status === 'SUCCESS';
      else if (statusFilter === 'FAILED') matchesStatus = wf.last_run_status === 'FAILED';
      else if (statusFilter === 'NEVER_RUN') matchesStatus = !wf.last_run_status;

      return matchesSearch && matchesStatus;
    });
  }, [workflows, searchQuery, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Workflows Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build, manage, and monitor your automated multi-step pipelines.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onCreateClick}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold rounded-xl shadow-sm shadow-brand-600/30 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Workflow</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-brand-50 text-brand-600 rounded-lg">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Workflows
            </span>
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Configured Steps
            </span>
            <div className="text-xl font-bold text-slate-900">{stats.totalSteps}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Successful Runs
            </span>
            <div className="text-xl font-bold text-slate-900">{stats.successRuns}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Failed Runs
            </span>
            <div className="text-xl font-bold text-slate-900">{stats.failedRuns}</div>
          </div>
        </div>
      </div>

      {/* AI Workflow Generator Section (Groq: openai/gpt-oss-20b) */}
      <div className="bg-gradient-to-r from-brand-50/70 via-white to-indigo-50/60 border border-brand-200/90 rounded-2xl p-6 shadow-sm mb-8 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-sm shadow-brand-600/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  AI Workflow Architect
                </h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200">
                  Groq (GPT-OSS-20B)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Describe your desired automation in natural language. Groq AI will design the structured multi-step pipeline for you.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleGenerateSubmit} className="mt-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Wand2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-500" />
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={isGenerating}
                placeholder="e.g., Clean the input text, count the words, and log that processing is complete."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-brand-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 placeholder:text-slate-400 shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isGenerating || !aiPrompt.trim()}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm shadow-brand-600/30 transition-all shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Workflow</span>
                </>
              )}
            </button>
          </div>

          {/* Quick inspiration prompts */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Try prompt:</span>
            {[
              'Clean the input text, count the words, and log that processing is complete.',
              'Trim extra spaces, convert text to uppercase, and count characters.',
              'Convert text to lowercase and log execution details.',
            ].map((sample, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isGenerating}
                onClick={() => setAiPrompt(sample)}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-brand-50 text-slate-600 hover:text-brand-700 border border-slate-200 rounded-lg transition-colors truncate max-w-xs sm:max-w-none text-left"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Search, Filter and Actions Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows by title or description..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors"
          />
        </div>

        {/* Filter controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed Only</option>
              <option value="NEVER_RUN">Never Run</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-rose-900 mb-2">Backend Connection Error</h2>
          <p className="text-xs sm:text-sm text-rose-700 mb-6">{error}</p>
          <button
            onClick={onRefresh}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      ) : isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 animate-pulse shadow-sm"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-16" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 bg-slate-200 rounded w-16" />
                <div className="h-5 bg-slate-200 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        /* Empty State (No Workflows exist in Database) */
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-lg mx-auto my-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 mx-auto flex items-center justify-center mb-4 shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">No Workflows Created Yet</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
            Get started by building your first automated workflow. You can chain text transformations,
            metric calculations, and log messages.
          </p>
          <button
            onClick={onCreateClick}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-brand-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Workflow</span>
          </button>
        </div>
      ) : filteredWorkflows.length === 0 ? (
        /* No Search Matches */
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto my-8">
          <p className="text-sm font-medium text-slate-700 mb-2">
            No workflows match "{searchQuery}"
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Try adjusting your search query or reset status filters.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
            }}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Workflow Cards Grid */
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Recent Workflows ({filteredWorkflows.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onView={onViewWorkflow}
                onEdit={onEditWorkflow}
                onDelete={onDeleteWorkflow}
                onRun={onRunWorkflow}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
