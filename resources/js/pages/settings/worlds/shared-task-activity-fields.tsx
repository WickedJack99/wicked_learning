import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { ActivityForm } from './edit-node-activity-types';

export function SharedTaskFlowFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    const t = usePlatformTranslation();
    const projectSteps = form.shared_task_project_steps
        .split(/\r?\n/)
        .map((step) => step.trim())
        .filter(Boolean)
        .slice(0, 6);

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <SelectField
                id="shared-task-kind"
                label="Task kind"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_kind: value,
                    }))
                }
                options={[
                    ['text', 'Text'],
                    ['question', 'Question'],
                    ['reflection', 'Reflection'],
                ]}
                value={form.shared_task_kind}
            />
            <SelectField
                id="shared-task-repeat-policy"
                label="Repeat policy"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_repeat_policy: value,
                    }))
                }
                options={[
                    ['once_per_user', 'Once per user'],
                    ['unlimited', 'Unlimited'],
                ]}
                value={form.shared_task_repeat_policy}
            />
            <div className="grid gap-2">
                <Label htmlFor="shared-task-threshold">Threshold</Label>
                <Input
                    id="shared-task-threshold"
                    min="1"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_threshold: event.target.value,
                        }))
                    }
                    type="number"
                    value={form.shared_task_threshold}
                />
                <InputError message={errors.shared_task_threshold} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-minimum-length">
                    Minimum text length
                </Label>
                <Input
                    id="shared-task-minimum-length"
                    min="0"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_minimum_length: event.target.value,
                        }))
                    }
                    type="number"
                    value={form.shared_task_minimum_length}
                />
                <InputError message={errors.shared_task_minimum_length} />
            </div>
            <SelectField
                id="shared-task-validation-mode"
                label="Validation"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_validation_mode: value,
                    }))
                }
                options={[
                    ['minimum_length', 'Minimum length'],
                    ['none', 'No automatic check'],
                ]}
                value={form.shared_task_validation_mode}
            />
            <SelectField
                id="shared-task-cycle-mode"
                label="Cycle"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_cycle_mode: value,
                    }))
                }
                options={[
                    ['none', 'None'],
                    [
                        'question_response_question',
                        'Question response question',
                    ],
                ]}
                value={form.shared_task_cycle_mode}
            />
            <div className="flex items-start gap-3 md:col-span-2">
                <Checkbox
                    checked={form.shared_task_show_contributions}
                    id="shared-task-show-contributions"
                    onCheckedChange={(checked) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_show_contributions: checked === true,
                        }))
                    }
                />
                <div className="grid gap-1">
                    <Label htmlFor="shared-task-show-contributions">
                        Allow anonymous contributions to be shown
                    </Label>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Learners still choose whether to share each
                        contribution.
                    </p>
                </div>
            </div>
            <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="shared-task-prompt">Prompt</Label>
                <textarea
                    className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40"
                    id="shared-task-prompt"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_prompt: event.target.value,
                        }))
                    }
                    value={form.shared_task_prompt}
                />
                <InputError message={errors.shared_task_prompt} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-input-label">Input label</Label>
                <Input
                    id="shared-task-input-label"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_input_label: event.target.value,
                        }))
                    }
                    value={form.shared_task_input_label}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-instructions">Instructions</Label>
                <Input
                    id="shared-task-instructions"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_instructions: event.target.value,
                        }))
                    }
                    value={form.shared_task_instructions}
                />
            </div>
            <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-4 md:col-span-2 dark:border-white/10 dark:bg-slate-950/30">
                <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Project brief (optional)
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Give the group a clear shared direction without
                        assigning roles or grading the result.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="shared-task-project-goal">
                        Shared goal
                    </Label>
                    <Input
                        id="shared-task-project-goal"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                shared_task_project_goal: event.target.value,
                            }))
                        }
                        value={form.shared_task_project_goal}
                    />
                    <InputError message={errors.shared_task_project_goal} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="shared-task-project-deliverable">
                        Useful outcome
                    </Label>
                    <Input
                        id="shared-task-project-deliverable"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                shared_task_project_deliverable:
                                    event.target.value,
                            }))
                        }
                        value={form.shared_task_project_deliverable}
                    />
                    <InputError
                        message={errors.shared_task_project_deliverable}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="shared-task-project-steps">
                        Suggested steps (one per line, up to 6)
                    </Label>
                    <textarea
                        className="min-h-24 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40"
                        id="shared-task-project-steps"
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                shared_task_project_steps: event.target.value,
                            }))
                        }
                        value={form.shared_task_project_steps}
                    />
                    <InputError message={errors.shared_task_project_steps} />
                </div>
                <div className="flex items-start gap-3 md:col-span-2">
                    <Checkbox
                        checked={form.shared_task_peer_review_enabled}
                        id="shared-task-peer-review-enabled"
                        onCheckedChange={(checked) =>
                            onChange((current) => ({
                                ...current,
                                shared_task_peer_review_enabled:
                                    checked === true,
                            }))
                        }
                    />
                    <div className="grid flex-1 gap-2">
                        <Label htmlFor="shared-task-peer-review-enabled">
                            {t(
                                'activities.shared_task.authoring.peer_review_label',
                                'Invite one anonymous peer review',
                            )}
                        </Label>
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {t(
                                'activities.shared_task.authoring.peer_review_description',
                                'Learners who contribute may respond once to one shared contribution. No ratings or rankings are shown.',
                            )}
                        </p>
                        {form.shared_task_peer_review_enabled ? (
                            <>
                                <Label htmlFor="shared-task-peer-review-prompt">
                                    {t(
                                        'activities.shared_task.authoring.peer_review_prompt_label',
                                        'Review invitation',
                                    )}
                                </Label>
                                <Input
                                    id="shared-task-peer-review-prompt"
                                    onChange={(event) =>
                                        onChange((current) => ({
                                            ...current,
                                            shared_task_peer_review_prompt:
                                                event.target.value,
                                        }))
                                    }
                                    value={form.shared_task_peer_review_prompt}
                                />
                                <InputError
                                    message={
                                        errors.shared_task_peer_review_prompt
                                    }
                                />
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
            <SharedTaskLearnerPreview form={form} projectSteps={projectSteps} />
        </div>
    );
}

function SharedTaskLearnerPreview({
    form,
    projectSteps,
}: {
    form: ActivityForm;
    projectSteps: string[];
}) {
    const t = usePlatformTranslation();
    const prompt =
        form.shared_task_prompt.trim() ||
        t(
            'activities.shared_task.preview_prompt_fallback',
            'Add a useful contribution.',
        );
    const inputLabel =
        form.shared_task_input_label.trim() ||
        t('activities.shared_task.preview_input_fallback', 'Your contribution');
    const instructions = form.shared_task_instructions.trim();
    const projectGoal = form.shared_task_project_goal.trim();
    const projectDeliverable = form.shared_task_project_deliverable.trim();
    const peerReviewPrompt = form.shared_task_peer_review_prompt.trim();
    const kindLabel =
        {
            reflection: t(
                'activities.shared_task.preview_kind_reflection',
                'Shared reflection',
            ),
            question: t(
                'activities.shared_task.preview_kind_question',
                'Shared question',
            ),
            text: t(
                'activities.shared_task.preview_kind_text',
                'Shared contribution',
            ),
        }[form.shared_task_kind] ??
        t('activities.shared_task.preview_kind_text', 'Shared contribution');

    return (
        <aside
            aria-labelledby="shared-task-learner-preview-title"
            className="grid gap-3 rounded-lg border border-cyan-500/25 bg-white/70 p-4 md:col-span-2 dark:border-teal-200/20 dark:bg-slate-950/55"
        >
            <div>
                <p className="text-xs font-medium tracking-[0.14em] text-cyan-800 uppercase dark:text-teal-200">
                    {t(
                        'activities.shared_task.preview_label',
                        'Learner preview',
                    )}
                </p>
                <h3
                    className="mt-1 text-sm font-semibold text-slate-950 dark:text-white"
                    id="shared-task-learner-preview-title"
                >
                    {t(
                        'activities.shared_task.preview_title',
                        'How this shared task unfolds',
                    )}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {t(
                        'activities.shared_task.preview_description',
                        'Check the learner-facing sequence before saving this activity.',
                    )}
                </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(15rem,0.85fr)]">
                <div className="grid gap-3 rounded-md border border-cyan-500/15 bg-cyan-50/50 p-3 dark:border-teal-100/15 dark:bg-teal-100/5">
                    <div>
                        <p className="text-xs font-medium tracking-[0.1em] text-cyan-800 uppercase dark:text-teal-100">
                            {kindLabel}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/85 dark:text-teal-50/85">
                            {prompt}
                        </p>
                        {instructions ? (
                            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                {instructions}
                            </p>
                        ) : null}
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-950/45">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {inputLabel}
                        </p>
                        <div className="mt-2 min-h-12 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400 dark:border-white/15 dark:text-slate-500">
                            {t(
                                'activities.shared_task.preview_input_placeholder',
                                'The learner writes here…',
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {t(
                                'activities.shared_task.preview_minimum_length',
                                'Minimum: :minimum characters',
                                {
                                    minimum:
                                        form.shared_task_minimum_length || '0',
                                },
                            )}
                        </p>
                    </div>
                </div>
                <div className="grid content-start gap-3">
                    {projectGoal ||
                    projectDeliverable ||
                    projectSteps.length ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/35">
                            <p className="text-xs font-medium tracking-[0.1em] text-cyan-800 uppercase dark:text-teal-100">
                                {t(
                                    'activities.shared_task.preview_project_brief',
                                    'Project brief',
                                )}
                            </p>
                            {projectGoal ? (
                                <p className="mt-2 text-xs leading-5 text-slate-700 dark:text-slate-200">
                                    <span className="font-semibold">
                                        {t(
                                            'activities.shared_task.preview_goal',
                                            'Goal:',
                                        )}{' '}
                                    </span>
                                    {projectGoal}
                                </p>
                            ) : null}
                            {projectDeliverable ? (
                                <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-200">
                                    <span className="font-semibold">
                                        {t(
                                            'activities.shared_task.preview_outcome',
                                            'Outcome:',
                                        )}{' '}
                                    </span>
                                    {projectDeliverable}
                                </p>
                            ) : null}
                            {projectSteps.length ? (
                                <ol className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                    {projectSteps.map((step, index) => (
                                        <li key={`${index}-${step}`}>
                                            {index + 1}. {step}
                                        </li>
                                    ))}
                                </ol>
                            ) : null}
                        </div>
                    ) : null}
                    <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/35">
                        <p className="text-xs font-medium tracking-[0.1em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'activities.shared_task.preview_after_submit',
                                'After contributing',
                            )}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {form.shared_task_show_contributions
                                ? t(
                                      'activities.shared_task.preview_shared_contributions',
                                      'Learners can choose whether to share their contribution anonymously.',
                                  )
                                : t(
                                      'activities.shared_task.preview_private_contributions',
                                      'Contributions remain private to the learner unless another setting changes that flow.',
                                  )}
                        </p>
                        {form.shared_task_peer_review_enabled ? (
                            <p className="mt-2 border-t border-slate-200 pt-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:text-slate-300">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {t(
                                        'activities.shared_task.preview_peer_review',
                                        'Anonymous peer review:',
                                    )}{' '}
                                </span>
                                {peerReviewPrompt ||
                                    t(
                                        'activities.shared_task.preview_peer_review_fallback',
                                        'One shared contribution can receive one response.',
                                    )}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </aside>
    );
}

function SelectField({
    id,
    label,
    onChange,
    options,
    value,
}: {
    id: string;
    label: string;
    onChange: (value: string) => void;
    options: Array<[string, string]>;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select onValueChange={onChange} value={value}>
                <SelectTrigger className="w-full" id={id}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map(([key, optionLabel]) => (
                        <SelectItem key={key} value={key}>
                            {optionLabel}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
