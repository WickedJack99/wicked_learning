import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
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
import type { ActivityForm, EditableTool } from './edit-node-activity-types';
export function ObstacleActivityFields({
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
    const updateBooleanField = (field: keyof ActivityForm, value: boolean) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));
    const selectedToolIds = toolIdsFrom(form.obstacle_allowed_tool_ids);
    const selectedTools = selectedToolIds
        .map((toolId) => tools.find((tool) => tool.id === toolId))
        .filter((tool): tool is EditableTool => Boolean(tool));
    const unselectedTools = tools.filter(
        (tool) => !selectedToolIds.includes(tool.id),
    );
    const updateToolIds = (toolIds: number[]) =>
        updateField('obstacle_allowed_tool_ids', toolIds.join(', '));
    const addTool = (value: string) => {
        const toolId = Number(value);

        if (!Number.isInteger(toolId) || selectedToolIds.includes(toolId)) {
            return;
        }

        updateToolIds([...selectedToolIds, toolId]);
    };
    const removeTool = (toolId: number) =>
        updateToolIds(selectedToolIds.filter((current) => current !== toolId));

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
    const revisitImageFields: Array<{
        description: string;
        field: keyof ActivityForm;
        label: string;
    }> = [
        {
            description: 'Displayed behind the cleared obstacle in dark mode.',
            field: 'obstacle_revisit_background_dark',
            label: 'Dark cleared background',
        },
        {
            description:
                'Optional light-mode override for the cleared background.',
            field: 'obstacle_revisit_background_light',
            label: 'Light cleared background',
        },
        {
            description:
                'Optional image shown when this learner already cleared the obstacle.',
            field: 'obstacle_revisit_image_dark',
            label: 'Dark cleared image',
        },
        {
            description:
                'Optional light-mode override for the cleared obstacle image.',
            field: 'obstacle_revisit_image_light',
            label: 'Light cleared image',
        },
    ];

    return (
        <div className="grid gap-5">
            <div className="grid gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="obstacle-tools">Tools that work here</Label>
                    <Select
                        key={selectedToolIds.join('-') || 'empty'}
                        onValueChange={addTool}
                    >
                        <SelectTrigger className="w-full" id="obstacle-tools">
                            <SelectValue placeholder="Add a tool" />
                        </SelectTrigger>
                        <SelectContent>
                            {unselectedTools.length > 0 ? (
                                unselectedTools.map((tool) => (
                                    <SelectItem
                                        key={tool.id}
                                        value={tool.id.toString()}
                                    >
                                        {tool.title}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem disabled value="all-tools-added">
                                    All tools are already selected
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                    {selectedTools.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {selectedTools.map((tool) => (
                                <Button
                                    key={tool.id}
                                    onClick={() => removeTool(tool.id)}
                                    size="sm"
                                    type="button"
                                    variant="secondary"
                                >
                                    {tool.title}
                                    <span aria-hidden="true">x</span>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            Add at least one tool if this obstacle should be
                            removable.
                        </p>
                    )}
                    <InputError message={errors.obstacle_allowed_tool_ids} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="obstacle-persist-after-solved">
                        After the correct tool is used
                    </Label>
                    <Select
                        onValueChange={(value) =>
                            updateBooleanField(
                                'obstacle_persist_after_solved',
                                value === 'yes',
                            )
                        }
                        value={
                            form.obstacle_persist_after_solved ? 'yes' : 'no'
                        }
                    >
                        <SelectTrigger
                            className="w-full"
                            id="obstacle-persist-after-solved"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yes">
                                Stay cleared for learner
                            </SelectItem>
                            <SelectItem value="no">
                                Reappear on each replay
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Persistent obstacles remember that each learner solved
                        them and show the cleared revisit scene next time.
                    </p>
                    <InputError
                        message={errors.obstacle_persist_after_solved}
                    />
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

                <div className="grid gap-2">
                    <Label htmlFor="obstacle-revisit">
                        Cleared revisit bubble
                    </Label>
                    <textarea
                        className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                        id="obstacle-revisit"
                        onChange={(event) =>
                            updateField(
                                'obstacle_revisit_text',
                                event.currentTarget.value,
                            )
                        }
                        value={form.obstacle_revisit_text}
                    />
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Shown when a persistent obstacle was already cleared by
                        this learner. It uses the same bubble colors and typing
                        speed.
                    </p>
                    <InputError message={errors.obstacle_revisit_text} />
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
                <NumberField
                    label="Obstacle X position"
                    max="100"
                    min="0"
                    onChange={(value) => updateField('obstacle_x', value)}
                    suffix="%"
                    value={form.obstacle_x}
                />
                <NumberField
                    label="Obstacle Y position"
                    max="100"
                    min="0"
                    onChange={(value) => updateField('obstacle_y', value)}
                    suffix="%"
                    value={form.obstacle_y}
                />
                <NumberField
                    label="Obstacle width"
                    max="100"
                    min="1"
                    onChange={(value) => updateField('obstacle_width', value)}
                    suffix="%"
                    value={form.obstacle_width}
                />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                {revisitImageFields.map((imageField) => (
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

function toolIdsFrom(value: string): number[] {
    return value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((toolId) => Number.isInteger(toolId) && toolId > 0);
}
