import { router, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Bot,
    Check,
    FileText,
    PenLine,
    RefreshCw,
    Save,
    Sparkles,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { SettingsConfigurationDialog } from '@/components/settings-configuration-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    applyContentPlan,
    generateContentPlan,
    updateContentPlan,
} from '@/features/ai/content-authoring-client';
import type {
    ContentAuthoringRun,
    ContentPlan,
    ContentPlanActivity,
    ContentPlanActivityType,
} from '@/features/ai/content-authoring-client';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import { getSettingsPresentationStyle } from '@/theme/presentation';

export type ContentAuthoringTemplate = {
    id: number;
    model: string | null;
    name: string;
    providerLabel: string | null;
};

type FormState = {
    activityTypes: ContentPlanActivityType[];
    goal: string;
    priorKnowledge: string;
    routeLength: string;
    targetAudience: string;
    templateId: string;
};

const contentAuthoringActivityTypes: ContentPlanActivityType[] = [
    'markdown',
    'reflection',
    'message_prompt',
    'shared_task',
    'open_practice',
];

export function ContentAuthoringDialog({
    mapId,
    mapTitle,
    templates,
}: {
    mapId: number;
    mapTitle: string;
    templates: ContentAuthoringTemplate[];
}) {
    const t = usePlatformTranslation();
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const presentationStyle = getSettingsPresentationStyle(
        props.publicPresentation,
        resolvedAppearance,
    );
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ContentAuthoringRun | null>(null);
    const [editedPlan, setEditedPlan] = useState<ContentPlan | null>(null);
    const [editingDraft, setEditingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [form, setForm] = useState<FormState>(() => initialForm(templates));
    const canGenerate =
        form.goal.trim() !== '' &&
        form.templateId !== '' &&
        form.activityTypes.length > 0;
    const selectedTemplate = useMemo(
        () =>
            templates.find(
                (template) => template.id.toString() === form.templateId,
            ),
        [form.templateId, templates],
    );

    const close = (nextOpen: boolean) => {
        if (!processing) {
            setOpen(nextOpen);
        }
    };

    const generate = async () => {
        if (!canGenerate) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const generated = await generateContentPlan(mapId, {
                    activity_types: form.activityTypes,
                    goal: form.goal.trim(),
                    prior_knowledge: optionalText(form.priorKnowledge),
                    route_length: Number(form.routeLength),
                    target_audience: optionalText(form.targetAudience),
                    template_id: Number(form.templateId),
                });
            setDraft(generated);
            setEditedPlan(null);
            setEditingDraft(false);
        } catch (requestError) {
            setError(
                errorMessage(
                    requestError,
                    t(
                        'settings.ai.authoring.request_failed',
                        'The request failed.',
                    ),
                ),
            );
        } finally {
            setProcessing(false);
        }
    };

    const startEditing = () => {
        if (!draft) {
            return;
        }

        setEditedPlan(clonePlan(draft.plan));
        setEditingDraft(true);
        setError(null);
    };

    const cancelEditing = () => {
        setEditedPlan(null);
        setEditingDraft(false);
        setError(null);
    };

    const saveDraft = async () => {
        if (!draft || !editedPlan) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const saved = await updateContentPlan(draft.id, editedPlan);
            setDraft(saved);
            setEditedPlan(null);
            setEditingDraft(false);
            toast.success(
                t(
                    'settings.ai.authoring.saved_success',
                    'Draft changes saved.',
                ),
            );
        } catch (requestError) {
            setError(
                errorMessage(
                    requestError,
                    t(
                        'settings.ai.authoring.request_failed',
                        'The request failed.',
                    ),
                ),
            );
        } finally {
            setProcessing(false);
        }
    };

    const apply = async () => {
        if (!draft) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const applied = await applyContentPlan(draft.id);
            setDraft(applied);
            toast.success(
                t(
                    'settings.ai.authoring.applied_success',
                    'The MapAsset and its Activity route were created.',
                ),
            );
            setOpen(false);
            router.reload();
        } catch (requestError) {
            setError(
                errorMessage(
                    requestError,
                    t(
                        'settings.ai.authoring.request_failed',
                        'The request failed.',
                    ),
                ),
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog onOpenChange={close} open={open}>
            <Button
                className="shadow-xl"
                onClick={() => setOpen(true)}
                type="button"
                variant="secondary"
            >
                <Sparkles className="size-4" />
                {t('settings.ai.authoring.open', 'Create with AI')}
            </Button>
            <SettingsConfigurationDialog
                className="flex h-auto max-h-[calc(100svh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-0 text-slate-950 sm:max-h-[calc(100svh-4rem)] sm:max-w-6xl dark:text-slate-100"
                style={presentationStyle}
            >
                <DialogHeader className="shrink-0 border-b border-[var(--settings-border-color)] px-5 py-4 text-left">
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="size-5 text-[var(--settings-accent)]" />
                        {t(
                            'settings.ai.authoring.title',
                            'Draft learning content with AI',
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'settings.ai.authoring.description',
                            'The AI prepares a reviewable draft for this map. Nothing is created until you approve it.',
                        )}{' '}
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                            {mapTitle}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {draft ? (
                        editingDraft && editedPlan ? (
                            <DraftEditor
                                onChange={setEditedPlan}
                                plan={editedPlan}
                            />
                        ) : (
                            <DraftPreview draft={draft} />
                        )
                    ) : (
                        <AuthoringForm
                            form={form}
                            onChange={setForm}
                            selectedTemplate={selectedTemplate}
                            templates={templates}
                        />
                    )}
                    {error ? (
                        <p className="mx-5 mb-5 border-l-2 border-red-500 pl-3 text-sm text-red-600 dark:text-red-300">
                            {error}
                        </p>
                    ) : null}
                </div>

                <DialogFooter className="shrink-0 border-t border-[var(--settings-border-color)] px-5 py-4 sm:justify-between">
                    {draft ? (
                        editingDraft ? (
                            <Button
                                disabled={processing}
                                onClick={cancelEditing}
                                type="button"
                                variant="ghost"
                            >
                                <X className="size-4" />
                                {t('settings.ai.authoring.cancel_editing', 'Cancel editing')}
                            </Button>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    disabled={processing}
                                    onClick={() => {
                                        setDraft(null);
                                        setError(null);
                                    }}
                                    type="button"
                                    variant="ghost"
                                >
                                    <ArrowLeft className="size-4" />
                                    {t(
                                        'settings.ai.authoring.change_brief',
                                        'Change brief',
                                    )}
                                </Button>
                                <Button
                                    disabled={processing || draft.status !== 'draft'}
                                    onClick={startEditing}
                                    type="button"
                                    variant="outline"
                                >
                                    <PenLine className="size-4" />
                                    {t('settings.ai.authoring.edit_draft', 'Edit draft')}
                                </Button>
                            </div>
                        )
                    ) : (
                        <Button
                            disabled={processing}
                            onClick={() => setOpen(false)}
                            type="button"
                            variant="ghost"
                        >
                            {t('settings.ai.authoring.cancel', 'Cancel')}
                        </Button>
                    )}
                    {draft ? (
                        editingDraft ? (
                            <Button
                                disabled={processing}
                                onClick={() => void saveDraft()}
                                type="button"
                            >
                                <Save className="size-4" />
                                {processing
                                    ? t('settings.ai.authoring.saving', 'Saving…')
                                    : t('settings.ai.authoring.save_changes', 'Save changes')}
                            </Button>
                        ) : (
                            <Button
                                disabled={processing || draft.status !== 'draft'}
                                onClick={() => void apply()}
                                type="button"
                            >
                                <Check className="size-4" />
                                {processing
                                    ? t(
                                          'settings.ai.authoring.applying',
                                          'Creating content…',
                                      )
                                    : t(
                                          'settings.ai.authoring.apply',
                                          'Approve and create',
                                      )}
                            </Button>
                        )
                    ) : (
                        <Button
                            disabled={processing || !canGenerate}
                            onClick={() => void generate()}
                            type="button"
                        >
                            {processing ? (
                                <RefreshCw className="size-4 animate-spin" />
                            ) : (
                                <Sparkles className="size-4" />
                            )}
                            {processing
                                ? t(
                                      'settings.ai.authoring.generating',
                                      'Generating draft…',
                                  )
                                : t(
                                      'settings.ai.authoring.generate',
                                      'Generate draft',
                                  )}
                        </Button>
                    )}
                </DialogFooter>
            </SettingsConfigurationDialog>
        </Dialog>
    );
}

function AuthoringForm({
    form,
    onChange,
    selectedTemplate,
    templates,
}: {
    form: FormState;
    onChange: (form: FormState) => void;
    selectedTemplate: ContentAuthoringTemplate | undefined;
    templates: ContentAuthoringTemplate[];
}) {
    const t = usePlatformTranslation();

    if (templates.length === 0) {
        return (
            <div className="grid min-h-72 place-items-center p-6 text-center">
                <div className="max-w-lg">
                    <Bot className="mx-auto size-8 text-[var(--settings-accent)]" />
                    <h3 className="mt-4 font-semibold text-slate-950 dark:text-white">
                        {t(
                            'settings.ai.authoring.no_template_title',
                            'Create a content-authoring template first',
                        )}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.ai.authoring.no_template_description',
                            'Enable an Agent template with the purpose Content authoring under AI & Integrations.',
                        )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid min-w-0 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="grid min-w-0 auto-rows-max gap-5">
                <Field
                    label={t(
                        'settings.ai.authoring.goal',
                        'Learning goal and context',
                    )}
                >
                    <textarea
                        className="min-h-36 w-full resize-y rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm outline-none focus:border-[var(--settings-accent)]"
                        onChange={(event) =>
                            onChange({ ...form, goal: event.target.value })
                        }
                        placeholder={t(
                            'settings.ai.authoring.goal_placeholder',
                            'What should learners understand or be able to do after this short route?',
                        )}
                        value={form.goal}
                    />
                </Field>
                <div className="grid min-w-0 gap-4 md:grid-cols-2">
                    <Field
                        label={t(
                            'settings.ai.authoring.target_audience',
                            'Target audience',
                        )}
                    >
                        <Input
                            className="w-full min-w-0"
                            onChange={(event) =>
                                onChange({
                                    ...form,
                                    targetAudience: event.target.value,
                                })
                            }
                            placeholder={t(
                                'settings.ai.authoring.target_audience_placeholder',
                                'For example, first-year trainees',
                            )}
                            value={form.targetAudience}
                        />
                    </Field>
                    <Field
                        label={t(
                            'settings.ai.authoring.prior_knowledge',
                            'Prior knowledge',
                        )}
                    >
                        <Input
                            className="w-full min-w-0"
                            onChange={(event) =>
                                onChange({
                                    ...form,
                                    priorKnowledge: event.target.value,
                                })
                            }
                            placeholder={t(
                                'settings.ai.authoring.prior_knowledge_placeholder',
                                'What can learners already assume?',
                            )}
                            value={form.priorKnowledge}
                        />
                    </Field>
                </div>
            </div>
            <aside className="grid min-w-0 auto-rows-max gap-5 border-t border-[var(--settings-border-color)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
                <Field
                    label={t(
                        'settings.ai.authoring.template',
                        'Agent template',
                    )}
                >
                    <select
                        className="h-10 w-full min-w-0 rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 text-sm"
                        onChange={(event) =>
                            onChange({
                                ...form,
                                templateId: event.target.value,
                            })
                        }
                        value={form.templateId}
                    >
                        {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                                {template.name}
                            </option>
                        ))}
                    </select>
                    {selectedTemplate ? (
                        <p className="text-xs leading-5 text-[var(--settings-muted-text)]">
                            {[
                                selectedTemplate.providerLabel,
                                selectedTemplate.model,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    ) : null}
                </Field>
                <Field
                    label={t(
                        'settings.ai.authoring.route_length',
                        'Number of Activities',
                    )}
                >
                    <select
                        className="h-10 w-full min-w-0 rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 text-sm"
                        onChange={(event) =>
                            onChange({
                                ...form,
                                routeLength: event.target.value,
                            })
                        }
                        value={form.routeLength}
                    >
                        {[1, 2, 3].map((length) => (
                            <option key={length} value={length}>
                                {length}
                            </option>
                        ))}
                    </select>
                </Field>
                <fieldset className="grid gap-3">
                    <legend className="mb-1 text-sm font-medium text-slate-950 dark:text-white">
                        {t(
                            'settings.ai.authoring.activity_types',
                            'Allowed Activity types',
                        )}
                    </legend>
                    {contentAuthoringActivityTypes.map((type) => (
                        <label
                            className="flex items-center gap-3 text-sm"
                            key={type}
                        >
                            <Checkbox
                                checked={form.activityTypes.includes(type)}
                                onCheckedChange={(checked) =>
                                    onChange({
                                        ...form,
                                        activityTypes: checked
                                            ? [...form.activityTypes, type]
                                            : form.activityTypes.filter(
                                                  (candidate) =>
                                                      candidate !== type,
                                              ),
                                    })
                                }
                            />
                            {activityTypeLabel(type, t)}
                        </label>
                    ))}
                </fieldset>
            </aside>
        </div>
    );
}

function DraftEditor({
    onChange,
    plan,
}: {
    onChange: (plan: ContentPlan) => void;
    plan: ContentPlan;
}) {
    const t = usePlatformTranslation();
    const updateActivity = (
        index: number,
        changes: Partial<ContentPlanActivity>,
    ) => {
        onChange({
            ...plan,
            activities: plan.activities.map((activity, activityIndex) =>
                activityIndex === index
                    ? { ...activity, ...changes }
                    : activity,
            ),
        });
    };

    return (
        <div className="grid gap-6 p-5">
            <section className="grid gap-2 border-b border-[var(--settings-border-color)] pb-5">
                <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                    {t('settings.ai.authoring.editing', 'Edit draft')}
                </p>
                <p className="text-sm leading-6 text-[var(--settings-muted-text)]">
                    {t(
                        'settings.ai.authoring.editing_description',
                        'Adjust the wording or learning details before approval. Saving checks the complete draft again.',
                    )}
                </p>
            </section>

            <section className="grid gap-3">
                <h4 className="font-semibold text-slate-950 dark:text-white">
                    {t('settings.ai.authoring.map_asset', 'MapAsset')}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('settings.ai.authoring.title_field', 'Title')}>
                        <Input
                            onChange={(event) =>
                                onChange({
                                    ...plan,
                                    mapAsset: {
                                        ...plan.mapAsset,
                                        title: event.target.value,
                                    },
                                })
                            }
                            value={plan.mapAsset.title}
                        />
                    </Field>
                    <Field label={t('settings.ai.authoring.label', 'Label')}>
                        <Input
                            onChange={(event) =>
                                onChange({
                                    ...plan,
                                    mapAsset: {
                                        ...plan.mapAsset,
                                        label: nullableText(event.target.value),
                                    },
                                })
                            }
                            value={plan.mapAsset.label ?? ''}
                        />
                    </Field>
                </div>
                <Field
                    label={t(
                        'settings.ai.authoring.description_field',
                        'Description',
                    )}
                >
                    <textarea
                        className={textAreaClass}
                        onChange={(event) =>
                            onChange({
                                ...plan,
                                mapAsset: {
                                    ...plan.mapAsset,
                                    description: nullableText(event.target.value),
                                },
                            })
                        }
                        value={plan.mapAsset.description ?? ''}
                    />
                </Field>
            </section>

            <section className="grid gap-3">
                <h4 className="font-semibold text-slate-950 dark:text-white">
                    {t('settings.ai.authoring.route', 'Linear Activity route')}
                </h4>
                <div className="grid gap-4">
                    {plan.activities.map((activity, index) => (
                        <article
                            className="grid gap-4 rounded-lg border border-[var(--settings-border-color)] p-4"
                            key={`${activity.title}-${index}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--settings-accent)_18%,transparent)] text-sm font-semibold text-[var(--settings-accent)]">
                                    {index + 1}
                                </div>
                                <div>
                                    <p className="font-medium text-slate-950 dark:text-white">
                                        {activityTypeLabel(activity.type, t)}
                                    </p>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.ai.authoring.activity_edit_hint',
                                            'This activity remains part of the selected route.',
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label={t('settings.ai.authoring.title_field', 'Title')}>
                                    <Input
                                        onChange={(event) =>
                                            updateActivity(index, {
                                                title: event.target.value,
                                            })
                                        }
                                        value={activity.title}
                                    />
                                </Field>
                                <Field
                                    label={t(
                                        'settings.ai.authoring.learning_purpose',
                                        'Learning purpose',
                                    )}
                                >
                                    <select
                                        className="h-10 w-full min-w-0 rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 text-sm"
                                        onChange={(event) =>
                                            updateActivity(index, {
                                                learningIntent: event.target.value,
                                            })
                                        }
                                        value={activity.learningIntent}
                                    >
                                        {learningIntentOptions.map((intent) => (
                                            <option key={intent} value={intent}>
                                                {intent}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            <Field
                                label={t(
                                    'settings.ai.authoring.introduction',
                                    'Introduction',
                                )}
                            >
                                <textarea
                                    className={textAreaClass}
                                    onChange={(event) =>
                                        updateActivity(index, {
                                            introduction: nullableText(
                                                event.target.value,
                                            ),
                                        })
                                    }
                                    value={activity.introduction ?? ''}
                                />
                            </Field>
                            <Field
                                label={
                                    activity.type === 'markdown'
                                        ? t(
                                              'settings.ai.authoring.content',
                                              'Content',
                                          )
                                        : t(
                                              'settings.ai.authoring.prompt',
                                              'Learner invitation',
                                          )
                                }
                            >
                                <textarea
                                    className={textAreaClass}
                                    onChange={(event) =>
                                        updateActivity(
                                            index,
                                            activity.type === 'markdown'
                                                ? {
                                                      body: nullableText(
                                                          event.target.value,
                                                      ),
                                                  }
                                                : {
                                                      prompt: nullableText(
                                                          event.target.value,
                                                      ),
                                                  },
                                        )
                                    }
                                    value={
                                        activity.type === 'markdown'
                                            ? activity.body ?? ''
                                            : activity.prompt ?? ''
                                    }
                                />
                            </Field>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    label={t(
                                        'settings.ai.authoring.competence_topics',
                                        'Competence topics',
                                    )}
                                >
                                    <Input
                                        onChange={(event) =>
                                            updateActivity(index, {
                                                competenceTopics:
                                                    event.target.value
                                                        .split(',')
                                                        .map((topic) => topic.trim())
                                                        .filter(Boolean),
                                            })
                                        }
                                        value={activity.competenceTopics.join(', ')}
                                    />
                                </Field>
                                <Field
                                    label={t(
                                        'settings.ai.authoring.note',
                                        'Note for the learner',
                                    )}
                                >
                                    <Input
                                        onChange={(event) =>
                                            updateActivity(index, {
                                                note: nullableText(event.target.value),
                                            })
                                        }
                                        value={activity.note ?? ''}
                                    />
                                </Field>
                            </div>
                            {activity.type === 'message_prompt' ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label={t('settings.ai.authoring.shared_topic', 'Shared topic')}>
                                        <Input
                                            onChange={(event) =>
                                                updateActivity(index, {
                                                    topic: nullableText(event.target.value),
                                                })
                                            }
                                            value={activity.topic ?? ''}
                                        />
                                    </Field>
                                    <Field label={t('settings.ai.authoring.input_label', 'Input label')}>
                                        <Input
                                            onChange={(event) =>
                                                updateActivity(index, {
                                                    inputLabel: nullableText(event.target.value),
                                                })
                                            }
                                            value={activity.inputLabel ?? ''}
                                        />
                                    </Field>
                                </div>
                            ) : null}
                            {activity.type === 'shared_task' ? (
                                <Field label={t('settings.ai.authoring.input_label', 'Input label')}>
                                    <Input
                                        onChange={(event) =>
                                            updateActivity(index, {
                                                inputLabel: nullableText(event.target.value),
                                            })
                                        }
                                        value={activity.inputLabel ?? ''}
                                    />
                                </Field>
                            ) : null}
                        </article>
                    ))}
                </div>
            </section>

            <Field label={t('settings.ai.authoring.summary', 'Summary')}>
                <textarea
                    className={textAreaClass}
                    onChange={(event) =>
                        onChange({ ...plan, summary: event.target.value })
                    }
                    value={plan.summary}
                />
            </Field>
        </div>
    );
}

function DraftPreview({ draft }: { draft: ContentAuthoringRun }) {
    const t = usePlatformTranslation();

    return (
        <div className="grid gap-6 p-5">
            <section className="grid gap-2 border-b border-[var(--settings-border-color)] pb-5">
                <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                    {t('settings.ai.authoring.preview', 'Draft preview')}
                </p>
                <h3 className="text-xl font-semibold text-slate-950 dark:text-white">
                    {draft.plan.mapAsset.title}
                </h3>
                <p className="max-w-4xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    {draft.plan.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--settings-muted-text)]">
                    <span>{draft.provider}</span>
                    <span>{draft.model}</span>
                    <span>
                        {t(
                            'settings.ai.authoring.tokens',
                            ':count tokens',
                        ).replace(
                            ':count',
                            String(draft.usage.totalTokens ?? '—'),
                        )}
                    </span>
                    <span>
                        {t(
                            'settings.ai.authoring.contract',
                            'Contract :version',
                        ).replace(':version', draft.contractVersion)}
                    </span>
                </div>
            </section>

            {draft.warnings.length > 0 ? (
                <section className="border-l-2 border-amber-500 pl-4">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="size-4" />
                        {t(
                            'settings.ai.authoring.warnings',
                            'Review before applying',
                        )}
                    </h4>
                    <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-[var(--settings-muted-text)]">
                        {draft.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <section className="grid gap-2">
                <h4 className="font-semibold text-slate-950 dark:text-white">
                    {t('settings.ai.authoring.map_asset', 'MapAsset')}
                </h4>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <dt className="text-[var(--settings-muted-text)]">
                        {t('settings.ai.authoring.label', 'Label')}
                    </dt>
                    <dd>{draft.plan.mapAsset.label ?? '—'}</dd>
                    <dt className="text-[var(--settings-muted-text)]">
                        {t(
                            'settings.ai.authoring.description_field',
                            'Description',
                        )}
                    </dt>
                    <dd>{draft.plan.mapAsset.description ?? '—'}</dd>
                    <dt className="text-[var(--settings-muted-text)]">
                        {t('settings.ai.authoring.placement', 'Placement')}
                    </dt>
                    <dd>
                        {t(
                            'settings.ai.authoring.placement_value',
                            'Centered at 50% × 50%, size 14%',
                        )}
                    </dd>
                </dl>
            </section>

            <section className="grid gap-3">
                <h4 className="font-semibold text-slate-950 dark:text-white">
                    {t('settings.ai.authoring.route', 'Linear Activity route')}
                </h4>
                <div className="divide-y divide-[var(--settings-border-color)] border-y border-[var(--settings-border-color)]">
                    {draft.plan.activities.map((activity, index) => (
                        <article
                            className="grid gap-2 py-4 sm:grid-cols-[3rem_minmax(0,1fr)]"
                            key={`${activity.title}-${index}`}
                        >
                            <div className="grid size-8 place-items-center rounded-full bg-[color-mix(in_srgb,var(--settings-accent)_18%,transparent)] text-sm font-semibold text-[var(--settings-accent)]">
                                {index + 1}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h5 className="font-medium text-slate-950 dark:text-white">
                                        {activity.title}
                                    </h5>
                                    <span className="inline-flex items-center gap-1 text-xs text-[var(--settings-accent)]">
                                        <FileText className="size-3" />
                                        {activityTypeLabel(activity.type, t)}
                                    </span>
                                </div>
                                {activity.introduction ? (
                                    <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                                        {activity.introduction}
                                    </p>
                                ) : null}
                                <p
                                    className={cn(
                                        'mt-3 max-h-28 overflow-auto border-l-2 border-[var(--settings-border-color)] pl-3 text-sm leading-6 whitespace-pre-wrap',
                                        !activity.body &&
                                            !activity.prompt &&
                                            'text-[var(--settings-muted-text)]',
                                    )}
                                >
                                    {activity.body ?? activity.prompt ?? '—'}
                                </p>
                                {activity.note ? (
                                    <p className="mt-2 text-xs text-[var(--settings-muted-text)]">
                                        {activity.note}
                                    </p>
                                ) : null}
                                <p className="mt-2 text-xs text-[var(--settings-muted-text)]">
                                    Learning purpose: {activity.learningIntent}{' '}
                                    · Topics:{' '}
                                    {activity.competenceTopics.join(', ')}
                                </p>
                                {(activity.type === 'message_prompt' ||
                                    activity.type === 'shared_task') &&
                                (activity.topic || activity.inputLabel) ? (
                                    <p className="mt-2 text-xs text-[var(--settings-muted-text)]">
                                        {activity.topic
                                            ? `Shared topic: ${activity.topic}`
                                            : null}
                                        {activity.topic && activity.inputLabel
                                            ? ' · '
                                            : null}
                                        {activity.inputLabel
                                            ? `Input: ${activity.inputLabel}`
                                            : null}
                                    </p>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
    return (
        <Label className="grid min-w-0 gap-2 text-sm font-medium">
            {label}
            {children}
        </Label>
    );
}

const learningIntentOptions = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
];

const textAreaClass =
    'min-h-24 w-full resize-y rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--settings-accent)]';

function clonePlan(plan: ContentPlan): ContentPlan {
    return JSON.parse(JSON.stringify(plan)) as ContentPlan;
}

function nullableText(value: string): string | null {
    return value.trim() === '' ? null : value;
}

function initialForm(templates: ContentAuthoringTemplate[]): FormState {
    return {
        activityTypes: [
            'markdown',
            'reflection',
            'message_prompt',
            'shared_task',
            'open_practice',
        ],
        goal: '',
        priorKnowledge: '',
        routeLength: '2',
        targetAudience: '',
        templateId: templates[0]?.id.toString() ?? '',
    };
}

function optionalText(value: string): string | null {
    const trimmed = value.trim();

    return trimmed === '' ? null : trimmed;
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function activityTypeLabel(
    type: ContentPlanActivityType,
    t: (key: string, fallback: string) => string,
): string {
    return type === 'markdown'
        ? t('settings.ai.authoring.activity_type.markdown', 'Markdown')
        : type === 'reflection'
          ? t('settings.ai.authoring.activity_type.reflection', 'Reflection')
          : type === 'message_prompt'
            ? t(
                  'settings.ai.authoring.activity_type.message_prompt',
                  'Message prompt',
              )
            : type === 'shared_task'
              ? t(
                    'settings.ai.authoring.activity_type.shared_task',
                    'Shared task',
                )
              : t(
                    'settings.ai.authoring.activity_type.open_practice',
                    'Open practice',
                );
}
