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
import type { ActivityForm } from './edit-node-activity-types';

export function SharedTaskFlowFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <SelectField
                id="shared-task-kind"
                label="Task kind"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_kind: value,
                    }))
                }
                options={[
                    ['text', 'Text'],
                    ['question', 'Question'],
                    ['reflection', 'Reflection'],
                ]}
                value={form.shared_task_kind}
            />
            <SelectField
                id="shared-task-repeat-policy"
                label="Repeat policy"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_repeat_policy: value,
                    }))
                }
                options={[
                    ['once_per_user', 'Once per user'],
                    ['unlimited', 'Unlimited'],
                ]}
                value={form.shared_task_repeat_policy}
            />
            <div className="grid gap-2">
                <Label htmlFor="shared-task-threshold">Threshold</Label>
                <Input
                    id="shared-task-threshold"
                    min="1"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_threshold: event.target.value,
                        }))
                    }
                    type="number"
                    value={form.shared_task_threshold}
                />
                <InputError message={errors.shared_task_threshold} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-minimum-length">
                    Minimum text length
                </Label>
                <Input
                    id="shared-task-minimum-length"
                    min="0"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_minimum_length: event.target.value,
                        }))
                    }
                    type="number"
                    value={form.shared_task_minimum_length}
                />
                <InputError message={errors.shared_task_minimum_length} />
            </div>
            <SelectField
                id="shared-task-validation-mode"
                label="Validation"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_validation_mode: value,
                    }))
                }
                options={[
                    ['minimum_length', 'Minimum length'],
                    ['none', 'No automatic check'],
                ]}
                value={form.shared_task_validation_mode}
            />
            <SelectField
                id="shared-task-cycle-mode"
                label="Cycle"
                onChange={(value) =>
                    onChange((current) => ({
                        ...current,
                        shared_task_cycle_mode: value,
                    }))
                }
                options={[
                    ['none', 'None'],
                    ['question_response_question', 'Question response question'],
                ]}
                value={form.shared_task_cycle_mode}
            />
            <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="shared-task-prompt">Prompt</Label>
                <textarea
                    className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-slate-950/40"
                    id="shared-task-prompt"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_prompt: event.target.value,
                        }))
                    }
                    value={form.shared_task_prompt}
                />
                <InputError message={errors.shared_task_prompt} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-input-label">Input label</Label>
                <Input
                    id="shared-task-input-label"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_input_label: event.target.value,
                        }))
                    }
                    value={form.shared_task_input_label}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="shared-task-instructions">Instructions</Label>
                <Input
                    id="shared-task-instructions"
                    onChange={(event) =>
                        onChange((current) => ({
                            ...current,
                            shared_task_instructions: event.target.value,
                        }))
                    }
                    value={form.shared_task_instructions}
                />
            </div>
        </div>
    );
}

function SelectField({
    id,
    label,
    onChange,
    options,
    value,
}: {
    id: string;
    label: string;
    onChange: (value: string) => void;
    options: Array<[string, string]>;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select onValueChange={onChange} value={value}>
                <SelectTrigger className="w-full" id={id}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map(([key, optionLabel]) => (
                        <SelectItem key={key} value={key}>
                            {optionLabel}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
