import { Link } from '@inertiajs/react';
import {
    FileText,
    GitBranch,
    Info,
    Music2,
    Palette,
    SlidersHorizontal,
    Star,
    Trash2,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import {
    SettingsConfigurationSection,
    SettingsEmptyStateSection,
} from '@/components/settings-configuration-section';
import {
    SettingsConfigurationLayout,
    SettingsContentPane,
    SettingsSectionNavigation,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ActivityAmbientSoundFields } from './activity-ambient-sound-fields';
import type {
    ActivityForm,
    ActivityTypeDefinition,
    EditableItem,
    EditableSound,
    EditableTool,
    MessageTopicOption,
    PortalCandidate,
} from './edit-node-activity-types';
import {
    ItemGrantFlowFields,
    ItemGrantVisualFields,
    ItemObstacleFlowFields,
    ItemObstacleVisualFields,
} from './item-activity-fields';
import {
    MessageActivityFlowFields,
    MessageActivityVisualFields,
} from './message-activity-fields';
import {
    ObstacleFlowFields,
    ObstacleVisualFields,
} from './obstacle-activity-fields';
import {
    PortalModeField,
    PortalTargetField,
    PortalVisualFields,
} from './portal-activity-fields';
import { SharedTaskFlowFields } from './shared-task-activity-fields';
import {
    ToolGrantFlowFields,
    ToolGrantVisualFields,
} from './tool-grant-activity-fields';

type ActivitySettingsSection =
    | 'basics'
    | 'sound'
    | 'flow'
    | 'visuals'
    | 'competence'
    | 'details';

export function ActivityFormFields({
    activityTypes,
    competenceTopicOptions,
    errors,
    editingActivityId = null,
    form,
    imageUploadErrors,
    messageTopics,
    onChange,
    onUploadPortalImage,
    portalCandidates,
    selectedType,
    sounds,
    items,
    tools,
    uploadingImageKey,
}: {
    activityTypes: ActivityTypeDefinition[];
    competenceTopicOptions: string[];
    editingActivityId?: number | null;
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    messageTopics: MessageTopicOption[];
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUploadPortalImage: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    portalCandidates: PortalCandidate[];
    selectedType: ActivityTypeDefinition | undefined;
    sounds: EditableSound[];
    items: EditableItem[];
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    const [activeSection, setActiveSection] =
        useState<ActivitySettingsSection>('basics');
    const hasFlowSettings =
        form.type === 'portal' ||
        form.type === 'markdown' ||
        form.type === 'item_grant' ||
        form.type === 'item_obstacle' ||
        form.type === 'obstacle' ||
        form.type === 'tool_grant' ||
        form.type === 'shared_task' ||
        form.type === 'reflection' ||
        form.type === 'review' ||
        form.type === 'message_prompt' ||
        form.type === 'message_wall' ||
        form.type === 'open_practice';
    const hasPresentationSettings =
        form.type === 'portal' ||
        form.type === 'item_grant' ||
        form.type === 'item_obstacle' ||
        form.type === 'obstacle' ||
        form.type === 'tool_grant' ||
        form.type === 'message_prompt' ||
        form.type === 'message_wall';

    return (
        <SettingsConfigurationLayout
            className="h-full max-h-[calc(90svh-14rem)] min-h-[32rem]"
            sidebar={
                <SettingsSidebar>
                    <ActivitySettingsSwitcher
                        activeSection={activeSection}
                        onChange={setActiveSection}
                    />
                </SettingsSidebar>
            }
        >
            <SettingsContentPane>
                <div className="grid gap-4">
                    {activeSection === 'basics' ? (
                        <SettingsConfigurationSection
                            description="Name the activity and choose the renderer that will play it."
                            title="Core activity"
                        >
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="activity-title">
                                        Title
                                    </Label>
                                    <Input
                                        id="activity-title"
                                        onChange={(event) =>
                                            onChange((current) => ({
                                                ...current,
                                                title: event.target.value,
                                            }))
                                        }
                                        value={form.title}
                                    />
                                    <InputError message={errors.title} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="activity-type">Type</Label>
                                    <Select
                                        onValueChange={(value) =>
                                            onChange((current) => ({
                                                ...current,
                                                type: value,
                                            }))
                                        }
                                        value={form.type}
                                    >
                                        <SelectTrigger
                                            className="w-full"
                                            id="activity-type"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activityTypes.map((type) => (
                                                <SelectItem
                                                    key={type.key}
                                                    value={type.key}
                                                >
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={errors.type} />
                                </div>
                            </div>
                            {selectedType ? (
                                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {selectedType.description}
                                </p>
                            ) : null}
                        </SettingsConfigurationSection>
                    ) : null}

                    {activeSection === 'flow' ? (
                        <>
                            {!hasFlowSettings ? (
                                <ActivityEmptySection
                                    description="This activity type currently has no extra flow settings."
                                    title="No flow settings"
                                />
                            ) : null}

                            {form.type === 'portal' ? (
                                <SettingsConfigurationSection
                                    description="Choose whether this portal starts travel or receives a traveller."
                                    title="Portal route"
                                >
                                    <PortalModeField
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                    />
                                    <PortalTargetField
                                        candidates={portalCandidates}
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'markdown' ? (
                                <SettingsConfigurationSection
                                    description="Markdown activities use a dedicated page editor because their internal page route needs room."
                                    title="Markdown pages"
                                >
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                                                    Page graph editor
                                                </p>
                                                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                                    Create or save this
                                                    activity, then open the full
                                                    editor to connect pages, add
                                                    media and tune page colors.
                                                </p>
                                            </div>
                                            {editingActivityId ? (
                                                <Button asChild type="button">
                                                    <Link
                                                        href={`/settings/worlds/activities/${editingActivityId}/markdown`}
                                                    >
                                                        <FileText className="size-4" />
                                                        Edit markdown pages
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button disabled type="button">
                                                    <FileText className="size-4" />
                                                    Save activity first
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'obstacle' ? (
                                <SettingsConfigurationSection
                                    description="Choose which tools can solve this obstacle and what happens on replay."
                                    title="Obstacle behavior"
                                >
                                    <ObstacleFlowFields
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                        tools={tools}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'item_grant' ? (
                                <SettingsConfigurationSection
                                    description="Choose consumable items and the server-side probability roll."
                                    title="Item grant behavior"
                                >
                                    <ItemGrantFlowFields
                                        errors={errors}
                                        form={form}
                                        items={items}
                                        onChange={onChange}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'item_obstacle' ? (
                                <SettingsConfigurationSection
                                    description="Define item slots and optional replay lockout."
                                    title="Item obstacle behavior"
                                >
                                    <ItemObstacleFlowFields
                                        errors={errors}
                                        form={form}
                                        items={items}
                                        onChange={onChange}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'item_grant' ? (
                                <SettingsConfigurationSection
                                    description="Theme-specific grant backgrounds and a preview of the granted item display."
                                    title="Grant item scene"
                                >
                                    <ItemGrantVisualFields
                                        errors={errors}
                                        form={form}
                                        imageUploadErrors={imageUploadErrors}
                                        items={items}
                                        onChange={onChange}
                                        onUpload={onUploadPortalImage}
                                        uploadingImageKey={uploadingImageKey}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'tool_grant' ? (
                                <SettingsConfigurationSection
                                    description="Choose which existing tool this activity gives the learner."
                                    title="Tool grant behavior"
                                >
                                    <ToolGrantFlowFields
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                        tools={tools}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'reflection' ||
                            form.type === 'review' ? (
                                <SettingsConfigurationSection
                                    description={
                                        form.type === 'review' ||
                                        form.learning_intent === 'review'
                                            ? 'Invite a learner to revisit earlier material and notice what feels clearer, more connected, or still open.'
                                            : 'Ask a learner-owned question and optionally file its journal entry under a topic.'
                                    }
                                    title={
                                        form.type === 'review' ||
                                        form.learning_intent === 'review'
                                            ? 'Review / revisit prompt'
                                            : 'Reflection prompt'
                                    }
                                >
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="reflection-prompt">
                                                Question
                                            </Label>
                                            <textarea
                                                className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40"
                                                id="reflection-prompt"
                                                onChange={(event) =>
                                                    onChange((current) => ({
                                                        ...current,
                                                        reflection_prompt:
                                                            event.target.value,
                                                    }))
                                                }
                                                value={form.reflection_prompt}
                                            />
                                            <InputError
                                                message={
                                                    errors.reflection_prompt
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="reflection-topic">
                                                Journal topic
                                            </Label>
                                            <Input
                                                id="reflection-topic"
                                                onChange={(event) =>
                                                    onChange((current) => ({
                                                        ...current,
                                                        reflection_topic:
                                                            event.target.value,
                                                    }))
                                                }
                                                value={form.reflection_topic}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="reflection-subtopic">
                                                Optional subtopic
                                            </Label>
                                            <Input
                                                id="reflection-subtopic"
                                                onChange={(event) =>
                                                    onChange((current) => ({
                                                        ...current,
                                                        reflection_subtopic:
                                                            event.target.value,
                                                    }))
                                                }
                                                value={form.reflection_subtopic}
                                            />
                                        </div>
                                        <div className="grid gap-2 md:col-span-2">
                                            <Label htmlFor="reflection-note">
                                                Supporting note
                                            </Label>
                                            <Input
                                                id="reflection-note"
                                                onChange={(event) =>
                                                    onChange((current) => ({
                                                        ...current,
                                                        reflection_note:
                                                            event.target.value,
                                                    }))
                                                }
                                                value={form.reflection_note}
                                            />
                                        </div>
                                    </div>
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'shared_task' ? (
                                <SettingsConfigurationSection
                                    description="Collect learner contributions toward one activity-wide threshold."
                                    title="Shared task"
                                >
                                    <SharedTaskFlowFields
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'open_practice' ? (
                                <SettingsConfigurationSection
                                    description="Give the learner a clear invitation for the self-directed step before they continue."
                                    title="Open practice prompt"
                                >
                                    <div className="grid gap-2">
                                        <Label htmlFor="open-practice-next-step">
                                            Learner invitation
                                        </Label>
                                        <textarea
                                            className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40"
                                            id="open-practice-next-step"
                                            onChange={(event) =>
                                                onChange((current) => ({
                                                    ...current,
                                                    open_practice_next_step:
                                                        event.target.value,
                                                }))
                                            }
                                            value={form.open_practice_next_step}
                                        />
                                        <InputError
                                            message={
                                                errors.open_practice_next_step
                                            }
                                        />
                                    </div>
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'message_prompt' ||
                            form.type === 'message_wall' ? (
                                <SettingsConfigurationSection
                                    description="Link prompt and wall activities through a reusable topic inside this MapAsset."
                                    title="Learner messages"
                                >
                                    <MessageActivityFlowFields
                                        errors={errors}
                                        form={form}
                                        onChange={onChange}
                                        topics={messageTopics}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}
                        </>
                    ) : null}

                    {activeSection === 'visuals' ? (
                        <>
                            {!hasPresentationSettings ? (
                                <ActivityEmptySection
                                    description="This activity type currently keeps its visual settings inside its specialized editor."
                                    title="No separate visual settings"
                                />
                            ) : null}

                            {form.type === 'portal' ? (
                                <SettingsConfigurationSection
                                    description="Theme-specific portal images, timing and motion."
                                    title="Portal visuals"
                                >
                                    <PortalVisualFields
                                        errors={errors}
                                        form={form}
                                        imageUploadErrors={imageUploadErrors}
                                        onChange={onChange}
                                        onUpload={onUploadPortalImage}
                                        uploadingImageKey={uploadingImageKey}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'obstacle' ? (
                                <SettingsConfigurationSection
                                    description="Scene backgrounds, obstacle images, placement, bubble text, bubble styling and completion animation."
                                    title="Obstacle scene"
                                >
                                    <ObstacleVisualFields
                                        errors={errors}
                                        form={form}
                                        imageUploadErrors={imageUploadErrors}
                                        onChange={onChange}
                                        onUpload={onUploadPortalImage}
                                        uploadingImageKey={uploadingImageKey}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'item_obstacle' ? (
                                <SettingsConfigurationSection
                                    description="Scene backgrounds, completed-state overlay and optional sounds."
                                    title="Item obstacle scene"
                                >
                                    <ItemObstacleVisualFields
                                        errors={errors}
                                        form={form}
                                        imageUploadErrors={imageUploadErrors}
                                        items={items}
                                        onChange={onChange}
                                        onUpload={onUploadPortalImage}
                                        sounds={sounds}
                                        uploadingImageKey={uploadingImageKey}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'tool_grant' ? (
                                <SettingsConfigurationSection
                                    description="Grant scene backgrounds, tool placement, motion and speech bubble presentation."
                                    title="Grant tool scene"
                                >
                                    <ToolGrantVisualFields
                                        errors={errors}
                                        form={form}
                                        imageUploadErrors={imageUploadErrors}
                                        onChange={onChange}
                                        onUpload={onUploadPortalImage}
                                        tools={tools}
                                        uploadingImageKey={uploadingImageKey}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}

                            {form.type === 'message_prompt' ||
                            form.type === 'message_wall' ? (
                                <SettingsConfigurationSection
                                    description="Colors are stored with this activity and previewed in the current appearance."
                                    title="Message surface"
                                >
                                    <MessageActivityVisualFields
                                        form={form}
                                        onChange={onChange}
                                    />
                                </SettingsConfigurationSection>
                            ) : null}
                        </>
                    ) : null}

                    {activeSection === 'competence' ? (
                        <SettingsConfigurationSection
                            description="Describe the learning evidence this activity is meant to invite, then connect it to one or more competence topics."
                            title="Learning evidence"
                        >
                            <div className="grid gap-6">
                                <LearningIntentField
                                    errors={errors}
                                    form={form}
                                    onChange={onChange}
                                />
                                <FeedbackGuidanceFields
                                    errors={errors}
                                    form={form}
                                    onChange={onChange}
                                />
                                <CompletionChoiceField
                                    errors={errors}
                                    form={form}
                                    onChange={onChange}
                                />
                                <CompetenceTopicFields
                                    competenceTopicOptions={
                                        competenceTopicOptions
                                    }
                                    errors={errors}
                                    form={form}
                                    onChange={onChange}
                                />
                            </div>
                        </SettingsConfigurationSection>
                    ) : null}

                    {activeSection === 'sound' ? (
                        <SettingsConfigurationSection
                            description="Choose optional reusable ambience for this learner-facing activity."
                            title="Scene sound"
                        >
                            <ActivityAmbientSoundFields
                                form={form}
                                onChange={onChange}
                                sounds={sounds}
                            />
                        </SettingsConfigurationSection>
                    ) : null}

                    {activeSection === 'details' ? (
                        <SettingsConfigurationSection
                            description="Optional text and stable URL-friendly naming."
                            title="Advanced details"
                        >
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="activity-slug">Slug</Label>
                                    <Input
                                        id="activity-slug"
                                        onChange={(event) =>
                                            onChange((current) => ({
                                                ...current,
                                                slug: event.target.value,
                                            }))
                                        }
                                        placeholder="Generated from the title if empty"
                                        value={form.slug}
                                    />
                                    <InputError message={errors.slug} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="activity-introduction">
                                        Introduction
                                    </Label>
                                    <textarea
                                        className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                        id="activity-introduction"
                                        onChange={(event) =>
                                            onChange((current) => ({
                                                ...current,
                                                introduction:
                                                    event.target.value,
                                            }))
                                        }
                                        value={form.introduction}
                                    />
                                    <InputError message={errors.introduction} />
                                </div>
                            </div>
                        </SettingsConfigurationSection>
                    ) : null}
                </div>
            </SettingsContentPane>
        </SettingsConfigurationLayout>
    );
}

const activitySettingsSections: SettingsNavigationItem<ActivitySettingsSection>[] =
    [
        {
            description: 'Activity title, type and renderer summary.',
            icon: Info,
            key: 'basics',
            label: 'Basics',
        },
        {
            description: 'Flow, route and specialized behavior settings.',
            icon: GitBranch,
            key: 'flow',
            label: 'Flow',
        },
        {
            description: 'Theme-specific images, colors and motion.',
            icon: Palette,
            key: 'visuals',
            label: 'Visuals',
        },
        {
            description: 'Optional reusable scene ambience during playback.',
            icon: Music2,
            key: 'sound',
            label: 'Sound',
        },
        {
            description: 'Learning purpose and competence evidence.',
            icon: Star,
            key: 'competence',
            label: 'Learning evidence',
        },
        {
            description: 'Slug and optional introductory text.',
            icon: SlidersHorizontal,
            key: 'details',
            label: 'Details',
        },
    ];

function ActivitySettingsSwitcher({
    activeSection,
    onChange,
}: {
    activeSection: ActivitySettingsSection;
    onChange: (section: ActivitySettingsSection) => void;
}) {
    return (
        <SettingsSectionNavigation
            activeSection={activeSection}
            ariaLabel="Activity settings sections"
            items={activitySettingsSections}
            onChange={onChange}
        />
    );
}

function ActivityEmptySection({
    description,
    title,
}: {
    description: string;
    title: string;
}) {
    return (
        <SettingsEmptyStateSection description={description} title={title} />
    );
}

function CompetenceTopicFields({
    competenceTopicOptions,
    errors,
    form,
    onChange,
}: {
    competenceTopicOptions: string[];
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    function updateTopic(
        index: number,
        field: 'topic' | 'weight',
        value: string,
    ) {
        onChange((current) => ({
            ...current,
            competence_topics: current.competence_topics.map(
                (topic, topicIndex) =>
                    topicIndex === index ? { ...topic, [field]: value } : topic,
            ),
        }));
    }

    function addTopic() {
        onChange((current) => ({
            ...current,
            competence_topics: [
                ...current.competence_topics,
                { topic: '', weight: '1' },
            ],
        }));
    }

    function removeTopic(index: number) {
        onChange((current) => {
            const nextTopics = current.competence_topics.filter(
                (_, topicIndex) => topicIndex !== index,
            );

            return {
                ...current,
                competence_topics:
                    nextTopics.length > 0
                        ? nextTopics
                        : [{ topic: '', weight: '1' }],
            };
        });
    }

    return (
        <div className="grid gap-4">
            <div className="grid gap-3">
                {form.competence_topics.map((topic, index) => (
                    <div
                        className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-start dark:border-white/10 dark:bg-white/5"
                        key={index}
                    >
                        <div className="grid gap-2">
                            <Label htmlFor={`competence-topic-${index}`}>
                                Topic
                            </Label>
                            <Input
                                id={`competence-topic-${index}`}
                                list={`competence-topic-options-${index}`}
                                onChange={(event) =>
                                    updateTopic(
                                        index,
                                        'topic',
                                        event.target.value,
                                    )
                                }
                                placeholder="e.g. Algebra"
                                value={topic.topic}
                            />
                            <datalist id={`competence-topic-options-${index}`}>
                                {competenceTopicOptions.map((option) => (
                                    <option key={option} value={option} />
                                ))}
                            </datalist>
                            <InputError
                                message={
                                    errors[`competence_topics.${index}.topic`]
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`competence-weight-${index}`}>
                                Contribution
                            </Label>
                            <Input
                                id={`competence-weight-${index}`}
                                min="0"
                                onChange={(event) =>
                                    updateTopic(
                                        index,
                                        'weight',
                                        event.target.value,
                                    )
                                }
                                step="0.1"
                                type="number"
                                value={topic.weight}
                            />
                            <InputError
                                message={
                                    errors[`competence_topics.${index}.weight`]
                                }
                            />
                        </div>
                        <Button
                            aria-label="Remove topic"
                            className="md:mt-7"
                            onClick={() => removeTopic(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <InputError message={errors.competence_topics} />
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Reuse an existing topic label when it fits. New labels are
                    allowed when the learning design needs one. Contribution is
                    an internal signal; learners see the result through the star
                    map, not as a score.
                </p>
                <Button onClick={addTopic} type="button" variant="secondary">
                    <Star className="size-4" />
                    Add topic
                </Button>
            </div>
        </div>
    );
}

function LearningIntentField({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    const intents = [
        {
            description:
                'Return to an idea and notice what is clearer or more connected now.',
            label: 'Review / revisit',
            value: 'review',
        },
        {
            description:
                'Bring an idea back from memory before looking at an answer.',
            label: 'Retrieve',
            value: 'retrieve',
        },
        {
            description:
                'Put an idea into your own words or make it understandable to someone else.',
            label: 'Explain',
            value: 'explain',
        },
        {
            description: 'Use an idea to work through a situation or obstacle.',
            label: 'Apply',
            value: 'apply',
        },
        {
            description:
                'Notice thinking, uncertainty, emotion, or connections to prior experience.',
            label: 'Reflect',
            value: 'reflect',
        },
        {
            description:
                'Take part in a guided learning moment without assigning a narrower purpose.',
            label: 'Participate',
            value: 'participate',
        },
        {
            description:
                'Use an idea in a new context or with a changed surface problem.',
            label: 'Transfer',
            value: 'transfer',
        },
    ];

    return (
        <div className="grid gap-2">
            <Label htmlFor="activity-learning-intent">Learning purpose</Label>
            <Select
                onValueChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        learning_intent: value === 'default' ? '' : value,
                    }))
                }
                value={form.learning_intent || 'default'}
            >
                <SelectTrigger
                    className="w-full md:max-w-xl"
                    id="activity-learning-intent"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">
                        Use the activity type's usual purpose
                    </SelectItem>
                    {intents.map((intent) => (
                        <SelectItem key={intent.value} value={intent.value}>
                            {intent.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                This is a teaching intention, not a grade. Leave it on the
                default when the renderer's usual purpose is a good fit.
            </p>
            {form.learning_intent ? (
                <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {
                        intents.find(
                            (intent) => intent.value === form.learning_intent,
                        )?.description
                    }
                </p>
            ) : null}
            <InputError message={errors.learning_intent} />
        </div>
    );
}

function FeedbackGuidanceFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    const fields = [
        {
            description:
                'Name the capability or understanding this activity invites.',
            id: 'activity-feedback-purpose',
            label: 'Purpose',
            name: 'feedback_purpose' as const,
            placeholder: 'e.g. Notice how the pattern changes when…',
        },
        {
            description:
                form.learning_intent === 'explain' ||
                form.learning_intent === 'transfer'
                    ? 'Required to represent this as explanation or transfer evidence: point to something observable in the learner’s response or action.'
                    : 'Point to something observable in the learner’s response or action.',
            id: 'activity-feedback-evidence',
            label: 'What to notice',
            name: 'feedback_evidence' as const,
            placeholder: 'e.g. Look for a reason that connects…',
        },
        {
            description:
                'Offer one small direction the learner could try next.',
            id: 'activity-feedback-next-action',
            label: 'Next action',
            name: 'feedback_next_action' as const,
            placeholder: 'e.g. Try the same idea with…',
        },
        {
            description:
                form.learning_intent === 'explain' ||
                form.learning_intent === 'transfer'
                    ? 'Optional: add up to three observable cues, one per line. These guide noticing; they do not produce a grade.'
                    : 'Optional: add up to three observable cues, one per line, for later review.',
            id: 'activity-feedback-rubric',
            label: 'Observable rubric cues',
            name: 'feedback_rubric' as const,
            placeholder:
                'e.g. Names the observation\nConnects it to a reason\nUses the idea in the changed context',
        },
    ];

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    Feedback guidance
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Optional guidance keeps feedback anchored in the task and
                    the learner’s work.
                </p>
            </div>
            {fields.map((field) => (
                <div className="grid gap-2" key={field.name}>
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <textarea
                        className="min-h-20 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 dark:border-white/10 dark:bg-slate-950/40"
                        id={field.id}
                        onChange={(event) =>
                            onChange((current) => ({
                                ...current,
                                [field.name]: event.target.value,
                            }))
                        }
                        placeholder={field.placeholder}
                        value={form[field.name]}
                    />
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {field.description}
                    </p>
                    <InputError message={errors[field.name]} />
                </div>
            ))}
        </div>
    );
}

function CompletionChoiceField({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <Label htmlFor="activity-completion-choice-prompt">
                Choice context
            </Label>
            <textarea
                className="min-h-20 rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 dark:border-white/10 dark:bg-slate-950/40"
                id="activity-completion-choice-prompt"
                onChange={(event) =>
                    onChange((current) => ({
                        ...current,
                        completion_choice_prompt: event.target.value,
                    }))
                }
                placeholder="e.g. Choose the kind of continuation that would support your next step."
                value={form.completion_choice_prompt}
            />
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Optional: explain why a learner might choose a direction after
                this activity. The three directions remain short and optional.
            </p>
            <InputError message={errors.completion_choice_prompt} />
        </div>
    );
}
