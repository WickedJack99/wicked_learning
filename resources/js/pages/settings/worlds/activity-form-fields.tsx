import { Link } from '@inertiajs/react';
import {
    FileText,
    GitBranch,
    Info,
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
import type {
    ActivityForm,
    ActivityTypeDefinition,
    EditableItem,
    EditableSound,
    EditableTool,
    PortalCandidate,
} from './edit-node-activity-types';
import {
    ItemGrantFlowFields,
    ItemGrantVisualFields,
    ItemObstacleFlowFields,
    ItemObstacleVisualFields,
} from './item-activity-fields';
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
    | 'flow'
    | 'visuals'
    | 'competence'
    | 'details';

export function ActivityFormFields({
    activityTypes,
    errors,
    editingActivityId = null,
    form,
    imageUploadErrors,
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
    editingActivityId?: number | null;
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
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
        form.type === 'reflection';
    const hasPresentationSettings =
        form.type === 'portal' ||
        form.type === 'item_grant' ||
        form.type === 'item_obstacle' ||
        form.type === 'obstacle' ||
        form.type === 'tool_grant';

    return (
        <SettingsConfigurationLayout
            className="max-h-[calc(90svh-14rem)] min-h-[32rem]"
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

                            {form.type === 'reflection' ? (
                                <SettingsConfigurationSection
                                    description="Ask a learner-owned question and optionally file its journal entry under a topic."
                                    title="Reflection prompt"
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
                        </>
                    ) : null}

                    {activeSection === 'competence' ? (
                        <SettingsConfigurationSection
                            description="Add topic weights that increase a learner's competence counters when they complete this activity during route play."
                            title="Competence topics"
                        >
                            <CompetenceTopicFields
                                errors={errors}
                                form={form}
                                onChange={onChange}
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
            description: 'Topics and weights awarded on route completion.',
            icon: Star,
            key: 'competence',
            label: 'Competence',
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
    errors,
    form,
    onChange,
}: {
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
                            <InputError
                                message={
                                    errors[`competence_topics.${index}.topic`]
                                }
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor={`competence-weight-${index}`}>
                                Weight
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
                    Points are awarded only during route play and only once for
                    the same activity in the same play run.
                </p>
                <Button onClick={addTopic} type="button" variant="secondary">
                    <Star className="size-4" />
                    Add topic
                </Button>
            </div>
        </div>
    );
}
