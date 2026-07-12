import { Link } from '@inertiajs/react';
import {
    FileText,
    GitBranch,
    Info,
    Palette,
    Package,
    SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
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
    ObstacleFlowFields,
    ObstacleVisualFields,
} from './obstacle-activity-fields';
import {
    PortalModeField,
    PortalTargetField,
    PortalVisualFields,
} from './portal-activity-fields';
import {
    ToolGrantFlowFields,
    ToolGrantVisualFields,
} from './tool-grant-activity-fields';
import {
    ItemGrantFlowFields,
    ItemGrantVisualFields,
    ItemObstacleFlowFields,
    ItemObstacleVisualFields,
} from './item-activity-fields';

type ActivitySettingsSection = 'basics' | 'flow' | 'visuals' | 'details';

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
        form.type === 'tool_grant';
    const hasPresentationSettings =
        form.type === 'portal' ||
        form.type === 'item_grant' ||
        form.type === 'item_obstacle' ||
        form.type === 'obstacle' ||
        form.type === 'tool_grant';

    return (
        <div className="grid gap-4">
            <ActivitySettingsSwitcher
                activeSection={activeSection}
                onChange={setActiveSection}
            />

            {activeSection === 'basics' ? (
                <SettingsAccordionSection
                    description="Name the activity and choose the renderer that will play it."
                    title="Core activity"
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="activity-title">Title</Label>
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
                </SettingsAccordionSection>
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
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'markdown' ? (
                        <SettingsAccordionSection
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
                                            Create or save this activity, then
                                            open the full editor to connect
                                            pages, add media and tune page
                                            colors.
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'obstacle' ? (
                        <SettingsAccordionSection
                            description="Choose which tools can solve this obstacle and what happens on replay."
                            title="Obstacle behavior"
                        >
                            <ObstacleFlowFields
                                errors={errors}
                                form={form}
                                onChange={onChange}
                                tools={tools}
                            />
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'item_grant' ? (
                        <SettingsAccordionSection
                            description="Choose consumable items and the server-side probability roll."
                            title="Item grant behavior"
                        >
                            <ItemGrantFlowFields
                                errors={errors}
                                form={form}
                                items={items}
                                onChange={onChange}
                            />
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'item_obstacle' ? (
                        <SettingsAccordionSection
                            description="Define item slots and optional replay lockout."
                            title="Item obstacle behavior"
                        >
                            <ItemObstacleFlowFields
                                errors={errors}
                                form={form}
                                items={items}
                                onChange={onChange}
                            />
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'item_grant' ? (
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'tool_grant' ? (
                        <SettingsAccordionSection
                            description="Choose which existing tool this activity gives the learner."
                            title="Tool grant behavior"
                        >
                            <ToolGrantFlowFields
                                errors={errors}
                                form={form}
                                onChange={onChange}
                                tools={tools}
                            />
                        </SettingsAccordionSection>
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
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'obstacle' ? (
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'item_obstacle' ? (
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}

                    {form.type === 'tool_grant' ? (
                        <SettingsAccordionSection
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
                        </SettingsAccordionSection>
                    ) : null}
                </>
            ) : null}

            {activeSection === 'details' ? (
                <SettingsAccordionSection
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
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                                id="activity-introduction"
                                onChange={(event) =>
                                    onChange((current) => ({
                                        ...current,
                                        introduction: event.target.value,
                                    }))
                                }
                                value={form.introduction}
                            />
                            <InputError message={errors.introduction} />
                        </div>
                    </div>
                </SettingsAccordionSection>
            ) : null}
        </div>
    );
}

const activitySettingsSections: {
    description: string;
    icon: LucideIcon;
    key: ActivitySettingsSection;
    label: string;
}[] = [
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
        <div
            aria-label="Activity settings sections"
            className="mx-auto flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white/88 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/82"
            role="tablist"
        >
            {activitySettingsSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;

                return (
                    <button
                        aria-label={section.label}
                        aria-selected={isActive}
                        className={
                            isActive
                                ? 'grid size-10 place-items-center rounded-xl bg-cyan-600 text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:bg-teal-300 dark:text-slate-950 dark:focus-visible:ring-teal-200'
                                : 'grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-teal-200'
                        }
                        key={section.key}
                        onClick={() => onChange(section.key)}
                        title={`${section.label} - ${section.description}`}
                        type="button"
                    >
                        <Icon className="size-4" />
                    </button>
                );
            })}
        </div>
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
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                {title}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
            </p>
        </div>
    );
}
