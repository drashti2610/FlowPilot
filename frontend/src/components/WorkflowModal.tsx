import React, { useState, useEffect } from 'react';
import {
  WorkflowDetail,
  WorkflowCreateInput,
  WorkflowUpdateInput,
  WorkflowStepCreate,
  WorkflowDraft,
  ActionType,
} from '../types/workflow';
import { workflowApi, formatErrorMessage } from '../services/api';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertCircle,
  Code,
} from 'lucide-react';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workflow: WorkflowDetail, isUpdate: boolean) => void;
  initialWorkflow?: WorkflowDetail | null;
  initialDraft?: WorkflowDraft | null;
}

interface StepFormState {
  id?: number;
  step_order: number;
  step_name: string;
  action_type: ActionType;
  // Parameters structured helpers
  transformOperation: string;
  metricType: string;
  logMessage: string;
  logLevel: string;
  rawJsonMode: boolean;
  rawJson: string;
}

export const WorkflowModal: React.FC<WorkflowModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialWorkflow,
  initialDraft,
}) => {
  const isEditing = Boolean(initialWorkflow);
  const isDraft = Boolean(initialDraft && !initialWorkflow);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [steps, setSteps] = useState<StepFormState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form state when opening or when initialWorkflow/initialDraft changes
  useEffect(() => {
    if (initialWorkflow) {
      setTitle(initialWorkflow.title || '');
      setDescription(initialWorkflow.description || '');
      setOriginalPrompt(initialWorkflow.original_prompt || '');

      const loadedSteps: StepFormState[] = (initialWorkflow.steps || []).map((step) => {
        const p = step.parameters || {};
        return {
          id: step.id,
          step_order: step.step_order,
          step_name: step.step_name,
          action_type: (step.action_type as ActionType) || 'TRANSFORM_TEXT',
          transformOperation: p.operation || 'trim',
          metricType: p.metric || 'char_count',
          logMessage: p.message || '',
          logLevel: (p.level || 'INFO').toUpperCase(),
          rawJsonMode: false,
          rawJson: JSON.stringify(p, null, 2),
        };
      });
      setSteps(loadedSteps);
    } else if (initialDraft) {
      setTitle(initialDraft.title || '');
      setDescription(initialDraft.description || '');
      setOriginalPrompt(initialDraft.original_prompt || '');

      const loadedSteps: StepFormState[] = (initialDraft.steps || []).map((step, idx) => {
        const p = step.parameters || {};
        return {
          step_order: step.step_order || idx + 1,
          step_name: step.step_name,
          action_type: (step.action_type as ActionType) || 'TRANSFORM_TEXT',
          transformOperation: p.operation || 'trim',
          metricType: p.metric || 'char_count',
          logMessage: p.message || '',
          logLevel: (p.level || 'INFO').toUpperCase(),
          rawJsonMode: false,
          rawJson: JSON.stringify(p, null, 2),
        };
      });
      setSteps(loadedSteps);
    } else {
      // Defaults for new workflow
      setTitle('');
      setDescription('');
      setOriginalPrompt('');
      setSteps([
        {
          step_order: 1,
          step_name: 'Sanitize Input Text',
          action_type: 'TRANSFORM_TEXT',
          transformOperation: 'trim',
          metricType: 'char_count',
          logMessage: '',
          logLevel: 'INFO',
          rawJsonMode: false,
          rawJson: '{\n  "operation": "trim"\n}',
        },
      ]);
    }
    setErrorMessage(null);
  }, [initialWorkflow, initialDraft, isOpen]);

  if (!isOpen) return null;

  const handleAddStep = () => {
    const nextOrder = steps.length + 1;
    setSteps([
      ...steps,
      {
        step_order: nextOrder,
        step_name: `Step ${nextOrder}`,
        action_type: 'TRANSFORM_TEXT',
        transformOperation: 'trim',
        metricType: 'char_count',
        logMessage: '',
        logLevel: 'INFO',
        rawJsonMode: false,
        rawJson: '{\n  "operation": "trim"\n}',
      },
    ]);
  };

  const handleRemoveStep = (indexToRemove: number) => {
    const updated = steps
      .filter((_, idx) => idx !== indexToRemove)
      .map((step, idx) => ({ ...step, step_order: idx + 1 }));
    setSteps(updated);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const reordered = [...steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const reindexed = reordered.map((step, idx) => ({
      ...step,
      step_order: idx + 1,
    }));
    setSteps(reindexed);
  };

  const updateStep = (index: number, updates: Partial<StepFormState>) => {
    setSteps((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Workflow title is required.');
      return;
    }
    if (trimmedTitle.length > 150) {
      setErrorMessage('Workflow title must be under 150 characters.');
      return;
    }

    // Build payload steps
    const compiledSteps: WorkflowStepCreate[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepName = step.step_name.trim();
      if (!stepName) {
        setErrorMessage(`Step ${i + 1} must have a name.`);
        return;
      }

      let parameters: Record<string, any> = {};

      if (step.rawJsonMode) {
        try {
          parameters = JSON.parse(step.rawJson);
        } catch {
          setErrorMessage(`Invalid JSON parameters in Step ${i + 1}.`);
          return;
        }
      } else {
        if (step.action_type === 'TRANSFORM_TEXT') {
          parameters = { operation: step.transformOperation };
        } else if (step.action_type === 'CALCULATE_METRIC') {
          parameters = { metric: step.metricType };
        } else if (step.action_type === 'LOG_MESSAGE') {
          parameters = {
            message: step.logMessage || `Executing ${stepName}`,
            level: (step.logLevel || 'INFO').toUpperCase(),
          };
        }
      }

      compiledSteps.push({
        step_order: i + 1,
        step_name: stepName,
        action_type: step.action_type,
        parameters,
      });
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialWorkflow) {
        const updatePayload: WorkflowUpdateInput = {
          title: trimmedTitle,
          description: description.trim() || null,
          original_prompt: originalPrompt.trim() || null,
          steps: compiledSteps,
        };
        const updated = await workflowApi.updateWorkflow(initialWorkflow.id, updatePayload);
        onSuccess(updated, true);
        onClose();
      } else {
        const createPayload: WorkflowCreateInput = {
          title: trimmedTitle,
          description: description.trim() || null,
          original_prompt: originalPrompt.trim() || null,
          steps: compiledSteps,
        };
        const created = await workflowApi.createWorkflow(createPayload);
        onSuccess(created, false);
        onClose();
      }
    } catch (err) {
      setErrorMessage(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing
                  ? 'Edit Workflow'
                  : isDraft
                  ? 'Review AI-Generated Workflow'
                  : 'Create New Workflow'}
              </h2>
              <p className="text-xs text-slate-500">
                {isDraft
                  ? 'Review the steps generated by Groq AI, customize parameters, and save.'
                  : 'Configure your automation metadata and define action execution steps.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {isDraft && (
            <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center space-x-2 text-brand-900 text-xs">
              <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
              <span>
                <strong>AI Workflow Draft:</strong> Generated by Groq AI. Review and adjust the parameters below, then click Save to create.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <div className="flex-1 text-xs sm:text-sm">{errorMessage}</div>
            </div>
          )}

          {/* Workflow Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Workflow Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Customer Feedback Text Sanitizer"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Workflow Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow accomplishes and its expected output."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Original Prompt */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Original Prompt / Instructions{' '}
              <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={originalPrompt}
              onChange={(e) => setOriginalPrompt(e.target.value)}
              placeholder="Natural language description or prompt (e.g. 'Take user input, clean extra spaces, and count total characters')"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Workflow Steps Section */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Workflow Steps ({steps.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Steps execute sequentially in order from 1 to {steps.length || 1}.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 border border-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-sm text-slate-500 mb-2">No steps in this workflow yet.</p>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="inline-flex items-center space-x-1.5 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add your first step</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                  >
                    {/* Step bar: order, name, action, controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          required
                          value={step.step_name}
                          onChange={(e) => updateStep(idx, { step_name: e.target.value })}
                          placeholder={`Step ${idx + 1} Name`}
                          className="font-medium text-sm text-slate-900 bg-white border border-slate-200 rounded-md px-2.5 py-1 focus:ring-1 focus:ring-brand-500 focus:outline-none w-48 sm:w-64"
                        />
                      </div>

                      <div className="flex items-center space-x-2 justify-end">
                        {/* Move Up */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveStep(idx, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                          title="Move step up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          disabled={idx === steps.length - 1}
                          onClick={() => handleMoveStep(idx, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-200"
                          title="Move step down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Raw JSON toggle */}
                        <button
                          type="button"
                          onClick={() => updateStep(idx, { rawJsonMode: !step.rawJsonMode })}
                          className={`p-1 rounded text-xs transition-colors ${
                            step.rawJsonMode
                              ? 'bg-brand-100 text-brand-700'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                          }`}
                          title="Toggle Raw JSON parameters"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete step */}
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Delete step"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Action Type & Parameters */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                          Action Type
                        </label>
                        <select
                          value={step.action_type}
                          onChange={(e) => {
                            const newAction = e.target.value as ActionType;
                            let defaultJson = '{}';
                            if (newAction === 'TRANSFORM_TEXT') {
                              defaultJson = '{\n  "operation": "trim"\n}';
                            } else if (newAction === 'CALCULATE_METRIC') {
                              defaultJson = '{\n  "metric": "char_count"\n}';
                            } else if (newAction === 'LOG_MESSAGE') {
                              defaultJson = '{\n  "message": "Step executed",\n  "level": "INFO"\n}';
                            }
                            updateStep(idx, {
                              action_type: newAction,
                              rawJson: defaultJson,
                            });
                          }}
                          className="w-full text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 font-medium focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        >
                          <option value="TRANSFORM_TEXT">TRANSFORM_TEXT</option>
                          <option value="CALCULATE_METRIC">CALCULATE_METRIC</option>
                          <option value="LOG_MESSAGE">LOG_MESSAGE</option>
                        </select>
                      </div>

                      {/* Parameters Configuration */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1 flex items-center justify-between">
                          <span>Action Parameters</span>
                          {step.rawJsonMode && (
                            <span className="text-[10px] text-brand-600 font-mono">Raw JSON</span>
                          )}
                        </label>

                        {step.rawJsonMode ? (
                          <textarea
                            rows={3}
                            value={step.rawJson}
                            onChange={(e) => updateStep(idx, { rawJson: e.target.value })}
                            className="w-full font-mono text-xs bg-slate-900 text-slate-100 p-2 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none"
                          />
                        ) : (
                          <>
                            {step.action_type === 'TRANSFORM_TEXT' && (
                              <select
                                value={step.transformOperation}
                                onChange={(e) =>
                                  updateStep(idx, { transformOperation: e.target.value })
                                }
                                className="w-full text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                              >
                                <option value="trim">trim (Trim whitespace)</option>
                                <option value="uppercase">uppercase (Convert to UPPERCASE)</option>
                                <option value="lowercase">lowercase (Convert to lowercase)</option>
                              </select>
                            )}

                            {step.action_type === 'CALCULATE_METRIC' && (
                              <select
                                value={step.metricType}
                                onChange={(e) => updateStep(idx, { metricType: e.target.value })}
                                className="w-full text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                              >
                                <option value="char_count">char_count (Character Count)</option>
                                <option value="word_count">word_count (Word Count)</option>
                                <option value="line_count">line_count (Line Count)</option>
                              </select>
                            )}

                            {step.action_type === 'LOG_MESSAGE' && (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={step.logMessage}
                                  onChange={(e) =>
                                    updateStep(idx, { logMessage: e.target.value })
                                  }
                                  placeholder="Message to log..."
                                  className="flex-1 text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                                />
                                <select
                                  value={step.logLevel}
                                  onChange={(e) =>
                                    updateStep(idx, { logLevel: e.target.value })
                                  }
                                  className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1.5 text-slate-800 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                                >
                                  <option value="INFO">INFO</option>
                                  <option value="WARNING">WARNING</option>
                                </select>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 rounded-lg shadow-sm shadow-brand-600/30 transition-all flex items-center space-x-2"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{isEditing ? 'Save Changes' : 'Create Workflow'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
