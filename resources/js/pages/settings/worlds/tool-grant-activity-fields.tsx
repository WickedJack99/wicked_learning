import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
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
    MirrorImageCheckbox,
    NumberField,
} from './activity-config-fields';
import {
    ActivityScenePreview,
    ScenePreviewBubble,
    ScenePreviewImage,
    themedPreviewAsset,
} from './activity-scene-preview';
import type { ActivityForm, EditableTool } from './edit-node-activity-types';
import { useAppearance } from '@/hooks/use-appearance';
type ToolGrantFieldProps = {
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
};

export function ToolGrantActivityFields(props: ToolGrantFieldProps) {
    return (
        <div className="grid gap-5">
            <ToolGrantFlowFields {...props} />
            <ToolGrantVisualFields {...props} />
        </div>
    );
}

export function ToolGrantFlowFields({
    errors,
    form,
    onChange,
    tools,
}: Pick<ToolGrantFieldProps, 'errors' | 'form' | 'onChange' | 'tools'>) {
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));

    return (
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
                        <SelectItem key={tool.id} value={tool.id.toString()}>
                            {tool.title}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <InputError message={errors.tool_grant_tool_id} />
        </div>
    );
}

export function ToolGrantVisualFields({
    errors,
    form,
    imageUploadErrors,
    onChange,
    onUpload,
    tools,
    uploadingImageKey,
}: ToolGrantFieldProps) {
    const { resolvedAppearance } = useAppearance();
    const selectedTool = tools.find(
        (tool) => tool.id.toString() === form.tool_grant_tool_id,
    );
    const isLight = resolvedAppearance === 'light';
    const backgroundImage = themedPreviewAsset(
        form.tool_grant_background_dark,
        form.tool_grant_background_light,
        resolvedAppearance,
    );
    const toolImage = themedPreviewAsset(
        selectedTool?.imageDark,
        selectedTool?.imageLight,
        resolvedAppearance,
    );
    const bubbleColor = isLight
        ? form.tool_grant_bubble_color_light
        : form.tool_grant_bubble_color_dark;
    const bubbleBorderColor = isLight
        ? form.tool_grant_bubble_border_color_light
        : form.tool_grant_bubble_border_color_dark;
    const bubbleOpacity = isLight
        ? form.tool_grant_bubble_opacity_light
        : form.tool_grant_bubble_opacity_dark;
    const updateField = (field: keyof ActivityForm, value: string | boolean) =>
        onChange((current) => ({
            ...current,
            [field]: value,
        }));

    return (
        <div className="grid gap-5">
            <ActivityScenePreview
                backgroundImage={backgroundImage}
                backgroundMirrored={form.tool_grant_background_mirrored}
                description="Uses the current appearance mode and selected tool."
                title="Grant scene preview"
            >
                <ScenePreviewImage
                    imageUrl={toolImage}
                    label={selectedTool?.title ?? 'Selected tool'}
                    mirrored={form.tool_grant_tool_mirrored}
                    width={18}
                    x={form.tool_grant_tool_x}
                    y={form.tool_grant_tool_y}
                />
                <div className="absolute inset-x-3 bottom-3">
                    <ScenePreviewBubble
                        borderColor={bubbleBorderColor}
                        color={bubbleColor}
                        label={selectedTool?.title ?? 'Tool'}
                        opacity={bubbleOpacity}
                        text={form.tool_grant_text}
                    />
                </div>
            </ActivityScenePreview>

            <div className="grid gap-3 md:grid-cols-2">
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
                <MirrorImageCheckbox
                    checked={form.tool_grant_background_mirrored}
                    label="Mirror background horizontally"
                    onChange={(checked) =>
                        updateField('tool_grant_background_mirrored', checked)
                    }
                />
                <MirrorImageCheckbox
                    checked={form.tool_grant_tool_mirrored}
                    label="Mirror tool image horizontally"
                    onChange={(checked) =>
                        updateField('tool_grant_tool_mirrored', checked)
                    }
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
