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
import { ConfigImageInput } from './activity-config-fields';
import type { ActivityForm, PortalCandidate } from './edit-node-activity-types';
export function PortalModeField({
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

export function PortalTargetField({
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

export function PortalVisualFields({
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
