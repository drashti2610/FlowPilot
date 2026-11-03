import React, { useState, useEffect } from 'react';
import { WorkflowListItem, WorkflowExecution } from '../types/workflow';
import { workflowApi, formatErrorMessage } from '../services/api';
import { formatDate, formatRelativeTime, getActionTypeBadge } from '../utils/formatters';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  History,
  Terminal,
} from 'lucide-react';

interface RunWorkflowModalProps {
  workflow: WorkflowListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onExecutionComplete?: () => void;
}

export const RunWorkflowModal: React.FC<RunWorkflowModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onExecutionComplete,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [latestExecution, setLatestExecution] = useState<WorkflowExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<WorkflowExecution[]>([]);
  const [activeTab, setActiveTab] = useState<'run' | 'history'>('run');
  const [selectedHistoricalRun, setSelectedHistoricalRun] = useState<WorkflowExecution | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load history whenever modal opens
  useEffect(() => {
    if (isOpen && workflow) {
      setErrorBanner(null);
      setLatestExecution(null);
      setSelectedHistoricalRun(null);
      setActiveTab('run');

      // Fetch past executions
      workflowApi
        .getWorkflowExecutions(workflow.id)
        .then((runs) => setExecutionHistory(runs))
        .catch(() => setExecutionHistory([]));
    }
  }, [isOpen, workflow]);

  if (!isOpen || !workflow) return null;

  const handleRun = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsRunning(true);
    setErrorBanner(null);

    try {
      const result = await workflowApi.runWorkflow(workflow.id, inputText);
      setLatestExecution(result);
      setSelectedHistoricalRun(null);
      setActiveTab('run');

      // Update history list
      setExecutionHistory((prev) => [result, ...prev]);

      if (onExecutionComplete) {
        onExecutionComplete();
      }
    } catch (err) {
      setErrorBanner(formatErrorMessage(err));
    } finally {
      setIsRunning(false);
    }
  };

  const displayedRun = selectedHistoricalRun || latestExecution;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900">Execute Workflow</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  ID #{workflow.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">{workflow.title}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tab switch */}
            <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('run');
                  setSelectedHistoricalRun(null);
                }}
                className={`px-3 py-1 rounded-md transition-colors ${
                  activeTab === 'run' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center space-x-1 ${
                  activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>History ({executionHistory.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorBanner && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {activeTab === 'run' ? (
            <>
              {/* Input Configuration Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {workflow.step_count === 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>This workflow has 0 steps configured. Running it will record an execution with no transformations applied.</span>
                  </div>
                )}
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Input Text</span>
                  <span className="text-[11px] text-slate-400 lowercase font-normal">Passed to Step 1</span>
                </label>
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isRunning}
                  placeholder="Enter input text for this workflow (e.g. '   sample review text with extra spaces   ')..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-slate-900 placeholder:text-slate-400 resize-none"
                />

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                    <span>Sample:</span>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setInputText('   clean customer feedback string with extra padding   ')}
                      className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 rounded border border-slate-200"
                    >
                      Padded Text
                    </button>
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => setInputText('Line 1 of report\nLine 2 of report\nLine 3 of report')}
                      className="px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-700 rounded border border-slate-200"
                    >
                      Multiline Text
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRun()}
                    disabled={isRunning}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Run Workflow</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Execution Results Section */}
              {displayedRun ? (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Execution Result
                      </span>
                      <span
                        className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          displayedRun.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {displayedRun.status === 'SUCCESS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span>{displayedRun.status}</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatRelativeTime(displayedRun.started_at)}</span>
                    </div>
                  </div>

                  {/* Overall error message if failed */}
                  {displayedRun.error_message && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-medium">
                      {displayedRun.error_message}
                    </div>
                  )}

                  {/* Sequential Steps Result List */}
                  {displayedRun.step_executions.length === 0 ? (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">No Steps Configured</p>
                      <p>This workflow has no execution steps defined. The pipeline ran successfully with 0 actions performed.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedRun.step_executions.map((step) => {
                        const badge = getActionTypeBadge(step.action_type);
                        const isSuccess = step.status === 'SUCCESS';
                        return (
                          <div
                            key={step.id || step.step_order}
                            className={`p-3.5 rounded-xl border transition-colors ${
                              isSuccess
                                ? 'bg-white border-slate-200'
                                : 'bg-rose-50/50 border-rose-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`w-5 h-5 rounded flex items-center justify-center font-mono text-xs font-bold text-white ${
                                    isSuccess ? 'bg-slate-900' : 'bg-rose-600'
                                  }`}
                                >
                                  {step.step_order}
                                </span>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badge.badgeBg} ${badge.color}`}
                                >
                                  {badge.label}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2 text-xs">
                                <span className="font-mono text-slate-500 text-[11px]">
                                  {step.duration_ms} ms
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                                    isSuccess
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {step.status}
                                </span>
                              </div>
                            </div>

                            {/* Error message for failed step */}
                            {step.error_message && (
                              <p className="text-xs text-rose-700 font-medium mb-1.5">
                                Error: {step.error_message}
                              </p>
                            )}

                            {/* Output data */}
                            {step.output_data && (
                              <div className="mt-1">
                                <pre className="font-mono text-[11px] bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto">
                                  {JSON.stringify(step.output_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <Terminal className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    Ready to execute. Click <strong>Run Workflow</strong> above to run this pipeline.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* History Tab (Adjustment 3: both successful and failed runs) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold uppercase tracking-wider text-slate-700">
                  Execution Runs ({executionHistory.length})
                </span>
                <span>Click any run to view details</span>
              </div>

              {executionHistory.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-500">
                  No execution history recorded for this workflow yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {executionHistory.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => {
                        setSelectedHistoricalRun(run);
                        setActiveTab('run');
                      }}
                      className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            run.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900">
                              Run #{run.id}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                run.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {run.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate max-w-xs sm:max-w-md mt-0.5">
                            Input: "{run.input_text || 'empty'}"
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-400">
                        <div>{formatDate(run.started_at)}</div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-end space-x-1 mt-0.5">
                          <Layers className="w-3 h-3" />
                          <span>{run.step_executions?.length || 0} steps</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/70">
          <div className="text-[11px] text-slate-500">
            {workflow.step_count} configured {workflow.step_count === 1 ? 'step' : 'steps'}
          </div>
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
