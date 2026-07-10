import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
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
import type { ActivityForm } from './edit-node-activity-types';
export function ObstacleActivityFields({
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
