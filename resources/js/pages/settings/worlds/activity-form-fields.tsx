import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
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
import {
    ConfigColorField,
    ConfigImageInput,
    NumberField,
} from './activity-config-fields';
import type {
    ActivityForm,
    ActivityTypeDefinition,
    EditableTool,
    PortalCandidate,
} from './edit-node-activity-types';
export function ActivityFormFields({
    activityTypes,
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUploadPortalImage,
    portalCandidates,
    selectedType,
    tools,
    uploadingImageKey,
}: {
    activityTypes: ActivityTypeDefinition[];
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
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    return (
        <div className="grid gap-4">
            <SettingsAccordionSection
                defaultOpen
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
                                    <SelectItem key={type.key} value={type.key}>
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

            {form.type === 'portal' ? (
                <>
                    <SettingsAccordionSection
                        defaultOpen
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
                </>
            ) : null}

            {form.type === 'obstacle' ? (
                <SettingsAccordionSection
                    defaultOpen
                    description="Configure the obstacle scene, valid tools and completion feedback."
                    title="Obstacle"
                >
                    <ObstacleActivityFields
                        errors={errors}
                        form={form}
                        imageUploadErrors={imageUploadErrors}
                        onChange={onChange}
                        onUpload={onUploadPortalImage}
                        uploadingImageKey={uploadingImageKey}
                    />
                </SettingsAccordionSection>
            ) : null}

            {form.type === 'tool_grant' ? (
                <SettingsAccordionSection
                    defaultOpen
                    description="Choose the tool, scene visuals, motion and the message shown while it is granted."
                    title="Grant tool"
                >
                    <ToolGrantActivityFields
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
        </div>
    );
}

function PortalModeField({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor="portal-mode">Portal direction</Label>
            <Select
                onValueChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        portal_mode: value as 'input' | 'output',
                        target_portal_activity_id:
                            value === 'input'
                                ? ''
                                : current.target_portal_activity_id,
                    }))
                }
                value={form.portal_mode}
            >
                <SelectTrigger className="w-full" id="portal-mode">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="input">Exit portal</SelectItem>
                    <SelectItem value="output">Entry portal</SelectItem>
                </SelectContent>
            </Select>
            <InputError message={errors.portal_mode} />
        </div>
    );
}

function PortalTargetField({
    candidates,
    errors,
    form,
    onChange,
}: {
    candidates: PortalCandidate[];
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    if (form.type !== 'portal' || form.portal_mode !== 'output') {
        return null;
    }

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <Label htmlFor="portal-target">Travel target</Label>
            <Select
                onValueChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        target_portal_activity_id:
                            value === 'none' ? '' : value,
                    }))
                }
                value={form.target_portal_activity_id || 'none'}
            >
                <SelectTrigger className="w-full" id="portal-target">
                    <SelectValue placeholder="Choose exit portal activity" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">No target yet</SelectItem>
                    {candidates.map((candidate) => (
                        <SelectItem
                            key={candidate.id}
                            value={candidate.id.toString()}
                        >
                            {candidate.mapTitle} / {candidate.nodeTitle} /{' '}
                            {candidate.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Entry portals end this activity path and move learners to the
                selected exit portal.
            </p>
            <InputError message={errors.target_portal_activity_id} />
        </div>
    );
}

function ToolGrantActivityFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    tools,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    tools: EditableTool[];
    uploadingImageKey: string | null;
}) {
    const updateField = (field: keyof ActivityForm, value: string) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));

    return (
        <div className="grid gap-5">
            <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="tool-grant-tool">Tool to give</Label>
                    <Select
                        onValueChange={(value) =>
                            updateField('tool_grant_tool_id', value)
                        }
                        value={form.tool_grant_tool_id}
                    >
                        <SelectTrigger className="w-full" id="tool-grant-tool">
                            <SelectValue placeholder="Select a tool" />
                        </SelectTrigger>
                        <SelectContent>
                            {tools.map((tool) => (
                                <SelectItem
                                    key={tool.id}
                                    value={tool.id.toString()}
                                >
                                    {tool.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.tool_grant_tool_id} />
                </div>
                <NumberField
                    label="Typing speed"
                    max="250"
                    min="1"
                    onChange={(value) =>
                        updateField('tool_grant_typing_speed', value)
                    }
                    suffix="ms"
                    value={form.tool_grant_typing_speed}
                />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="tool-grant-text">Speech bubble text</Label>
                <textarea
                    className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                    id="tool-grant-text"
                    onChange={(event) =>
                        updateField(
                            'tool_grant_text',
                            event.currentTarget.value,
                        )
                    }
                    value={form.tool_grant_text}
                />
                <InputError message={errors.tool_grant_text} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <ConfigImageInput
                    description="Displayed behind the grant scene in dark mode."
                    error={
                        errors.tool_grant_background_dark ??
                        imageUploadErrors.tool_grant_background_dark
                    }
                    id="tool-grant-background-dark"
                    label="Dark background"
                    onChange={(value) =>
                        updateField('tool_grant_background_dark', value)
                    }
                    onUpload={(file) =>
                        onUpload('tool_grant_background_dark', file, (url) =>
                            updateField('tool_grant_background_dark', url),
                        )
                    }
                    uploading={
                        uploadingImageKey === 'tool_grant_background_dark'
                    }
                    value={form.tool_grant_background_dark}
                />
                <ConfigImageInput
                    description="Optional light-mode override for the background."
                    error={
                        errors.tool_grant_background_light ??
                        imageUploadErrors.tool_grant_background_light
                    }
                    id="tool-grant-background-light"
                    label="Light background"
                    onChange={(value) =>
                        updateField('tool_grant_background_light', value)
                    }
                    onUpload={(file) =>
                        onUpload('tool_grant_background_light', file, (url) =>
                            updateField('tool_grant_background_light', url),
                        )
                    }
                    uploading={
                        uploadingImageKey === 'tool_grant_background_light'
                    }
                    value={form.tool_grant_background_light}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <NumberField
                    label="Tool x position"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_tool_x', value)
                    }
                    suffix="%"
                    value={form.tool_grant_tool_x}
                />
                <NumberField
                    label="Tool y position"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_tool_y', value)
                    }
                    suffix="%"
                    value={form.tool_grant_tool_y}
                />
                <div className="grid gap-2">
                    <Label htmlFor="tool-grant-slide-direction">
                        Slide direction
                    </Label>
                    <Select
                        onValueChange={(value) =>
                            updateField('tool_grant_slide_direction', value)
                        }
                        value={form.tool_grant_slide_direction}
                    >
                        <SelectTrigger
                            className="w-full"
                            id="tool-grant-slide-direction"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="left">From left</SelectItem>
                            <SelectItem value="right">From right</SelectItem>
                            <SelectItem value="top">From top</SelectItem>
                            <SelectItem value="bottom">From bottom</SelectItem>
                            <SelectItem value="none">No slide</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.tool_grant_slide_direction} />
                </div>
                <NumberField
                    label="Slide duration"
                    max="30"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_slide_duration_seconds', value)
                    }
                    suffix="s"
                    value={form.tool_grant_slide_duration_seconds}
                />
                <NumberField
                    label="Fade duration"
                    max="30"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_fade_duration_seconds', value)
                    }
                    suffix="s"
                    value={form.tool_grant_fade_duration_seconds}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <ConfigColorField
                    label="Dark bubble color"
                    onChange={(value) =>
                        updateField('tool_grant_bubble_color_dark', value)
                    }
                    value={form.tool_grant_bubble_color_dark}
                />
                <ConfigColorField
                    label="Dark bubble border"
                    onChange={(value) =>
                        updateField(
                            'tool_grant_bubble_border_color_dark',
                            value,
                        )
                    }
                    value={form.tool_grant_bubble_border_color_dark}
                />
                <NumberField
                    label="Dark opacity"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_bubble_opacity_dark', value)
                    }
                    suffix="%"
                    value={form.tool_grant_bubble_opacity_dark}
                />
                <ConfigColorField
                    label="Light bubble color"
                    onChange={(value) =>
                        updateField('tool_grant_bubble_color_light', value)
                    }
                    value={form.tool_grant_bubble_color_light}
                />
                <ConfigColorField
                    label="Light bubble border"
                    onChange={(value) =>
                        updateField(
                            'tool_grant_bubble_border_color_light',
                            value,
                        )
                    }
                    value={form.tool_grant_bubble_border_color_light}
                />
                <NumberField
                    label="Light opacity"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('tool_grant_bubble_opacity_light', value)
                    }
                    suffix="%"
                    value={form.tool_grant_bubble_opacity_light}
                />
            </div>
        </div>
    );
}

function ObstacleActivityFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const updateField = (field: keyof ActivityForm, value: string) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));

    const imageFields: Array<{
        description: string;
        field: keyof ActivityForm;
        label: string;
    }> = [
        {
            description: 'Displayed behind the obstacle in dark mode.',
            field: 'obstacle_background_dark',
            label: 'Dark background image',
        },
        {
            description: 'Optional light-mode override for the background.',
            field: 'obstacle_background_light',
            label: 'Light background image',
        },
        {
            description: 'The obstacle image shown in dark mode.',
            field: 'obstacle_image_dark',
            label: 'Dark obstacle image',
        },
        {
            description: 'Optional light-mode override for the obstacle image.',
            field: 'obstacle_image_light',
            label: 'Light obstacle image',
        },
    ];

    return (
        <div className="grid gap-5">
            <div className="grid gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="obstacle-tools">Valid tool IDs</Label>
                    <Input
                        id="obstacle-tools"
                        onChange={(event) =>
                            updateField(
                                'obstacle_allowed_tool_ids',
                                event.currentTarget.value,
                            )
                        }
                        placeholder="1, 2"
                        value={form.obstacle_allowed_tool_ids}
                    />
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Temporary input until the tool library picker exists.
                        Use comma-separated tool IDs.
                    </p>
                    <InputError message={errors.obstacle_allowed_tool_ids} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="obstacle-prompt">Prompt bubble</Label>
                    <textarea
                        className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                        id="obstacle-prompt"
                        onChange={(event) =>
                            updateField(
                                'obstacle_prompt_text',
                                event.currentTarget.value,
                            )
                        }
                        value={form.obstacle_prompt_text}
                    />
                    <InputError message={errors.obstacle_prompt_text} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="obstacle-success">Success bubble</Label>
                    <textarea
                        className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                        id="obstacle-success"
                        onChange={(event) =>
                            updateField(
                                'obstacle_success_text',
                                event.currentTarget.value,
                            )
                        }
                        value={form.obstacle_success_text}
                    />
                    <InputError message={errors.obstacle_success_text} />
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {imageFields.map((imageField) => (
                    <ConfigImageInput
                        description={imageField.description}
                        error={
                            errors[imageField.field] ??
                            imageUploadErrors[imageField.field]
                        }
                        id={imageField.field}
                        key={imageField.field}
                        label={imageField.label}
                        onChange={(value) =>
                            updateField(imageField.field, value)
                        }
                        onUpload={(file) =>
                            onUpload(String(imageField.field), file, (url) =>
                                updateField(imageField.field, url),
                            )
                        }
                        uploading={uploadingImageKey === imageField.field}
                        value={String(form[imageField.field] ?? '')}
                    />
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <ConfigColorField
                    label="Dark bubble color"
                    onChange={(value) =>
                        updateField('obstacle_bubble_color_dark', value)
                    }
                    value={form.obstacle_bubble_color_dark}
                />
                <ConfigColorField
                    label="Dark bubble border"
                    onChange={(value) =>
                        updateField('obstacle_bubble_border_color_dark', value)
                    }
                    value={form.obstacle_bubble_border_color_dark}
                />
                <NumberField
                    label="Dark opacity"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('obstacle_bubble_opacity_dark', value)
                    }
                    suffix="%"
                    value={form.obstacle_bubble_opacity_dark}
                />
                <ConfigColorField
                    label="Light bubble color"
                    onChange={(value) =>
                        updateField('obstacle_bubble_color_light', value)
                    }
                    value={form.obstacle_bubble_color_light}
                />
                <ConfigColorField
                    label="Light bubble border"
                    onChange={(value) =>
                        updateField('obstacle_bubble_border_color_light', value)
                    }
                    value={form.obstacle_bubble_border_color_light}
                />
                <NumberField
                    label="Light opacity"
                    max="100"
                    min="0"
                    onChange={(value) =>
                        updateField('obstacle_bubble_opacity_light', value)
                    }
                    suffix="%"
                    value={form.obstacle_bubble_opacity_light}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <NumberField
                    label="Typing speed"
                    max="250"
                    min="1"
                    onChange={(value) =>
                        updateField('obstacle_typing_speed', value)
                    }
                    suffix="ms"
                    value={form.obstacle_typing_speed}
                />
                <div className="grid gap-2">
                    <Label htmlFor="obstacle-success-animation">
                        Success animation
                    </Label>
                    <Select
                        onValueChange={(value) =>
                            updateField('obstacle_success_animation', value)
                        }
                        value={form.obstacle_success_animation}
                    >
                        <SelectTrigger
                            className="w-full"
                            id="obstacle-success-animation"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zoom">Zoom</SelectItem>
                            <SelectItem value="shake">Shake</SelectItem>
                            <SelectItem value="rotate">Rotate</SelectItem>
                            <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.obstacle_success_animation} />
                </div>
            </div>
        </div>
    );
}

function PortalVisualFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    uploadingImageKey,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    imageUploadErrors: Record<string, string>;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
    onUpload: (
        key: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploadingImageKey: string | null;
}) {
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));

    const imageFields: Array<{
        description: string;
        field: keyof ActivityForm;
        label: string;
    }> = [
        {
            description:
                'Displayed behind the portal effect when the learner uses dark mode.',
            field: 'portal_background_dark',
            label: 'Dark background image',
        },
        {
            description:
                'Optional light-mode override. If empty, the dark image is reused.',
            field: 'portal_background_light',
            label: 'Light background image',
        },
        {
            description:
                'Displayed in front of the background and can rotate around its center.',
            field: 'portal_foreground_dark',
            label: 'Dark foreground image',
        },
        {
            description:
                'Optional light-mode override. If empty, the dark foreground is reused.',
            field: 'portal_foreground_light',
            label: 'Light foreground image',
        },
    ];

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">
                    Portal visuals
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    These settings control the full-screen portal moment before
                    the learner arrives at the linked node.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {imageFields.map((imageField) => (
                    <ConfigImageInput
                        description={imageField.description}
                        error={
                            errors[imageField.field] ??
                            imageUploadErrors[imageField.field]
                        }
                        id={imageField.field}
                        key={imageField.field}
                        label={imageField.label}
                        onChange={(value) =>
                            updateField(imageField.field, value)
                        }
                        onUpload={(file) =>
                            onUpload(String(imageField.field), file, (url) =>
                                updateField(imageField.field, url),
                            )
                        }
                        uploading={uploadingImageKey === imageField.field}
                        value={String(form[imageField.field] ?? '')}
                    />
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-2">
                    <Label htmlFor="portal-foreground-x">Foreground X</Label>
                    <Input
                        id="portal-foreground-x"
                        max="100"
                        min="0"
                        onChange={(event) =>
                            updateField(
                                'portal_foreground_x',
                                event.currentTarget.value,
                            )
                        }
                        step="1"
                        type="number"
                        value={form.portal_foreground_x}
                    />
                    <InputError message={errors.portal_foreground_x} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="portal-foreground-y">Foreground Y</Label>
                    <Input
                        id="portal-foreground-y"
                        max="100"
                        min="0"
                        onChange={(event) =>
                            updateField(
                                'portal_foreground_y',
                                event.currentTarget.value,
                            )
                        }
                        step="1"
                        type="number"
                        value={form.portal_foreground_y}
                    />
                    <InputError message={errors.portal_foreground_y} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="portal-duration">Duration in seconds</Label>
                    <Input
                        id="portal-duration"
                        max="60"
                        min="0.5"
                        onChange={(event) =>
                            updateField(
                                'portal_duration_seconds',
                                event.currentTarget.value,
                            )
                        }
                        step="0.5"
                        type="number"
                        value={form.portal_duration_seconds}
                    />
                    <InputError message={errors.portal_duration_seconds} />
                </div>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10">
                <Checkbox
                    checked={form.portal_swirl_enabled}
                    className="mt-0.5"
                    onCheckedChange={(checked) =>
                        updateField('portal_swirl_enabled', checked === true)
                    }
                />
                <span>
                    <span className="block text-sm font-medium text-slate-950 dark:text-white">
                        Rotate foreground image
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Disable this when the configured image should stay
                        still.
                    </span>
                </span>
            </label>
            <InputError message={errors.portal_swirl_enabled} />
        </div>
    );
}
