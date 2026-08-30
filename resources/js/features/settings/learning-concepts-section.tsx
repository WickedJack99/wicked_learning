import { BookOpenText, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { router } from '@inertiajs/react';

const PAGE_SIZE = 4;

export type LearningConceptDefinition = {
    description: string | null;
    isActive: boolean;
    name: string;
    slug: string;
};

type LearningConceptDraft = {
    description: string;
    isActive: boolean;
    name: string;
};

export function LearningConceptsSection({
    concepts,
}: {
    concepts: LearningConceptDefinition[];
}) {
    const t = usePlatformTranslation();
    const baselineDrafts = useMemo(() => conceptDrafts(concepts), [concepts]);
    const [drafts, setDrafts] = useState<LearningConceptDraft[]>(
        () => baselineDrafts,
    );
    const [page, setPage] = useState(1);
    const hasChanges = useDirtyState(drafts, baselineDrafts);
    const pageCount = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
    const pageDrafts = drafts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => {
        if (!hasChanges) {
            setDrafts(baselineDrafts);
        }
    }, [baselineDrafts, hasChanges]);

    useEffect(() => {
        setPage((current) => Math.min(current, pageCount));
    }, [pageCount]);

    function updateConcept(
        index: number,
        field: keyof LearningConceptDraft,
        value: string | boolean,
    ) {
        const absoluteIndex = (page - 1) * PAGE_SIZE + index;

        setDrafts((current) =>
            current.map((concept, conceptIndex) =>
                conceptIndex === absoluteIndex
                    ? { ...concept, [field]: value }
                    : concept,
            ),
        );
    }

    function addConcept() {
        setDrafts((current) => {
            const next = [...current, emptyConcept()];
            setPage(Math.ceil(next.length / PAGE_SIZE));

            return next;
        });
    }

    function removeConcept(index: number) {
        const absoluteIndex = (page - 1) * PAGE_SIZE + index;

        setDrafts((current) => {
            const next = current.filter(
                (_, conceptIndex) => conceptIndex !== absoluteIndex,
            );

            return next.length > 0 ? next : [emptyConcept()];
        });
    }

    function saveConcepts(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!hasChanges) {
            return;
        }

        router.patch(
            '/settings/admin-panel/learning-concepts',
            {
                concepts: drafts
                    .filter((concept) => concept.name.trim().length > 0)
                    .map((concept) => ({
                        description: concept.description,
                        is_active: concept.isActive,
                        name: concept.name,
                    })),
            },
            { preserveScroll: true },
        );
    }

    return (
        <form className="flex h-full min-h-0 flex-col" onSubmit={saveConcepts}>
            <section className="shrink-0 border-b border-[var(--settings-border-color)] pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <BookOpenText
                                aria-hidden="true"
                                className="size-4"
                                style={{ color: 'var(--settings-accent)' }}
                            />
                            <h2 className="font-semibold">
                                {t(
                                    'settings.learning_concepts.editor_title',
                                    'Reusable learning concepts',
                                )}
                            </h2>
                        </div>
                        <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                            {t(
                                'settings.learning_concepts.editor_description',
                                'Maintain shared vocabulary for authoring evidence. Activities keep the selected names as stable snapshots.',
                            )}
                        </p>
                    </div>
                    <Button
                        onClick={addConcept}
                        type="button"
                        variant="secondary"
                    >
                        <Plus aria-hidden="true" className="size-4" />
                        {t('settings.learning_concepts.add', 'Add concept')}
                    </Button>
                </div>
            </section>

            <div className="min-h-0 flex-1 overflow-hidden pr-1">
                <div className="grid min-h-[32rem] gap-3">
                    {pageDrafts.map((concept, index) => (
                        <article
                            className="grid content-start gap-3 border-b border-[var(--settings-border-color)] py-4"
                            key={(page - 1) * PAGE_SIZE + index}
                        >
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                                <div className="grid gap-2">
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor={`learning-concept-name-${index}`}
                                    >
                                        {t(
                                            'settings.learning_concepts.name',
                                            'Name',
                                        )}
                                    </label>
                                    <Input
                                        id={`learning-concept-name-${index}`}
                                        onChange={(event) =>
                                            updateConcept(
                                                index,
                                                'name',
                                                event.target.value,
                                            )
                                        }
                                        placeholder={t(
                                            'settings.learning_concepts.name_placeholder',
                                            'e.g. Cognitive load',
                                        )}
                                        value={concept.name}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor={`learning-concept-description-${index}`}
                                    >
                                        {t(
                                            'settings.learning_concepts.description',
                                            'Description',
                                        )}
                                    </label>
                                    <textarea
                                        className="min-h-16 rounded-md border px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] dark:text-white"
                                        id={`learning-concept-description-${index}`}
                                        onChange={(event) =>
                                            updateConcept(
                                                index,
                                                'description',
                                                event.target.value,
                                            )
                                        }
                                        value={concept.description}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-3 text-sm font-medium">
                                    <Checkbox
                                        checked={concept.isActive}
                                        onCheckedChange={(checked) =>
                                            updateConcept(
                                                index,
                                                'isActive',
                                                checked === true,
                                            )
                                        }
                                    />
                                    {t(
                                        'settings.learning_concepts.active',
                                        'Available in authoring',
                                    )}
                                </label>
                                <Button
                                    aria-label={t(
                                        'settings.learning_concepts.remove',
                                        'Remove learning concept',
                                    )}
                                    onClick={() => removeConcept(index)}
                                    type="button"
                                    variant="ghost"
                                >
                                    <Trash2
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--settings-border-color)] py-4">
                <PaginationControls
                    currentPage={page}
                    onPageChange={setPage}
                    pageCount={pageCount}
                />
                <Button disabled={!hasChanges} type="submit">
                    <Save aria-hidden="true" className="size-4" />
                    {t('settings.learning_concepts.save', 'Save concepts')}
                </Button>
            </footer>
        </form>
    );
}

function conceptDrafts(
    concepts: LearningConceptDefinition[],
): LearningConceptDraft[] {
    return concepts.length > 0 ? concepts.map(conceptDraft) : [emptyConcept()];
}

function conceptDraft(
    concept: LearningConceptDefinition,
): LearningConceptDraft {
    return {
        description: concept.description ?? '',
        isActive: concept.isActive,
        name: concept.name,
    };
}

function emptyConcept(): LearningConceptDraft {
    return {
        description: '',
        isActive: true,
        name: '',
    };
}
