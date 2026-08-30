import { Plus, Trash2 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    ActivityForm,
    SourceReferenceForm,
} from './edit-node-activity-types';

const emptyReference = (): SourceReferenceForm => ({
    anchor: '',
    excerpt: '',
    publishedAt: '',
    publisher: '',
    rights: '',
    title: '',
    url: '',
});

export function ActivitySourceReferenceFields({
    errors,
    form,
    onChange,
}: {
    errors: Record<string, string>;
    form: ActivityForm;
    onChange: Dispatch<SetStateAction<ActivityForm>>;
}) {
    function addReference() {
        if (form.source_references.length >= 5) {
            return;
        }

        onChange((current) => ({
            ...current,
            source_references: [...current.source_references, emptyReference()],
        }));
    }

    function removeReference(index: number) {
        onChange((current) => ({
            ...current,
            source_references: current.source_references.filter(
                (_, referenceIndex) => referenceIndex !== index,
            ),
        }));
    }

    function updateReference(
        index: number,
        field: keyof SourceReferenceForm,
        value: string,
    ) {
        onChange((current) => ({
            ...current,
            source_references: current.source_references.map(
                (reference, referenceIndex) =>
                    referenceIndex === index
                        ? { ...reference, [field]: value }
                        : reference,
            ),
        }));
    }

    return (
        <div className="grid gap-4">
            <div className="flex items-start justify-between gap-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-white/15 dark:bg-slate-950/30">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Add up to five references that learners can inspect while
                    working through this activity. These references support
                    provenance; they are not learner evidence or grades.
                </p>
                <Button
                    aria-label="Add source reference"
                    className="shrink-0"
                    disabled={form.source_references.length >= 5}
                    onClick={addReference}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <Plus className="size-4" />
                    Add source
                </Button>
            </div>

            {form.source_references.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    No sources attached yet.
                </p>
            ) : (
                form.source_references.map((reference, index) => (
                    <div
                        className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10"
                        key={`source-reference-${index}`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                Source {index + 1}
                            </p>
                            <Button
                                aria-label={`Remove source ${index + 1}`}
                                onClick={() => removeReference(index)}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <SourceField
                                error={
                                    errors[`source_references.${index}.title`]
                                }
                                id={`source-reference-${index}-title`}
                                label="Title"
                                onChange={(value) =>
                                    updateReference(index, 'title', value)
                                }
                                value={reference.title}
                            />
                            <SourceField
                                error={errors[`source_references.${index}.url`]}
                                id={`source-reference-${index}-url`}
                                label="URL"
                                onChange={(value) =>
                                    updateReference(index, 'url', value)
                                }
                                type="url"
                                value={reference.url}
                            />
                            <div className="grid gap-2 md:col-span-2">
                                <Label
                                    htmlFor={`source-reference-${index}-excerpt`}
                                >
                                    Short excerpt or location note (optional)
                                </Label>
                                <textarea
                                    className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                                    id={`source-reference-${index}-excerpt`}
                                    maxLength={800}
                                    onChange={(event) =>
                                        updateReference(
                                            index,
                                            'excerpt',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="A short passage or a precise place to look"
                                    rows={3}
                                    value={reference.excerpt}
                                />
                                <InputError
                                    message={
                                        errors[
                                            `source_references.${index}.excerpt`
                                        ]
                                    }
                                />
                            </div>
                            <SourceField
                                error={
                                    errors[
                                        `source_references.${index}.publisher`
                                    ]
                                }
                                id={`source-reference-${index}-publisher`}
                                label="Publisher"
                                onChange={(value) =>
                                    updateReference(index, 'publisher', value)
                                }
                                value={reference.publisher}
                            />
                            <SourceField
                                error={
                                    errors[
                                        `source_references.${index}.publishedAt`
                                    ]
                                }
                                id={`source-reference-${index}-published-at`}
                                label="Published date"
                                onChange={(value) =>
                                    updateReference(index, 'publishedAt', value)
                                }
                                type="date"
                                value={reference.publishedAt}
                            />
                            <SourceField
                                error={
                                    errors[`source_references.${index}.rights`]
                                }
                                id={`source-reference-${index}-rights`}
                                label="Rights or licence"
                                onChange={(value) =>
                                    updateReference(index, 'rights', value)
                                }
                                value={reference.rights}
                            />
                            <SourceField
                                error={
                                    errors[`source_references.${index}.anchor`]
                                }
                                id={`source-reference-${index}-anchor`}
                                label="Stable anchor (optional)"
                                onChange={(value) =>
                                    updateReference(index, 'anchor', value)
                                }
                                value={reference.anchor}
                            />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function SourceField({
    error,
    id,
    label,
    onChange,
    type = 'text',
    value,
}: {
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    type?: 'date' | 'text' | 'url';
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.target.value)}
                type={type}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}
