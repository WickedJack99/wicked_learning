import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { SettingsAccordionSection } from '@/components/settings-accordion-section';
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
    EditableTool,
    PortalCandidate,
} from './edit-node-activity-types';
import { ObstacleActivityFields } from './obstacle-activity-fields';
import {
    PortalModeField,
    PortalTargetField,
    PortalVisualFields,
} from './portal-activity-fields';
import { ToolGrantActivityFields } from './tool-grant-activity-fields';
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
