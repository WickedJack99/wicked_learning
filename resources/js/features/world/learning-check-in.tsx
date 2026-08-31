import { Link } from '@inertiajs/react';
import { ArrowRight, EyeOff, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { competenceTopicHref } from '@/features/competence/competence-links';
import { ActivityEvidenceContext } from '@/features/world/activity-panel';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    LearningEvidenceContext,
    LearningCheckInFeeling,
    LearningCheckInNextDirection,
} from '@/types';

export function LearningCheckIn({
    activityTitle,
    choicePrompt,
    evidenceContext,
    learningAreas,
    originTopicSlug,
    onContinue,
    onHide,
    transitionLabel,
}: {
    activityTitle: string;
    choicePrompt: string | null;
    evidenceContext: LearningEvidenceContext;
    learningAreas: Array<{ name: string; slug: string | null }>;
    originTopicSlug?: string | null;
    onContinue: (
        feeling: LearningCheckInFeeling | null,
        note: string,
        nextDirection: LearningCheckInNextDirection | null,
    ) => Promise<void>;
    onHide: () => void;
    transitionLabel?: string | null;
}) {
    const t = usePlatformTranslation();
    const feelings: Array<{
        description: string;
        label: string;
        value: LearningCheckInFeeling;
    }> = [
        {
            description: t(
                'learning.activity.check_in.feeling.clearer.description',
                'A connection became easier to see.',
            ),
            label: t(
                'learning.activity.check_in.feeling.clearer.label',
                'Something clicked',
            ),
            value: 'clearer',
        },
        {
            description: t(
                'learning.activity.check_in.feeling.forming.description',
                'I want to let this settle for a while.',
            ),
            label: t(
                'learning.activity.check_in.feeling.forming.label',
                'Still taking shape',
            ),
            value: 'forming',
        },
        {
            description: t(
                'learning.activity.check_in.feeling.stretched.description',
                'It asked me to reach a little further.',
            ),
            label: t(
                'learning.activity.check_in.feeling.stretched.label',
                'It stretched me',
            ),
            value: 'stretched',
        },
        {
            description: t(
                'learning.activity.check_in.feeling.stuck.description',
                'I may need another way in.',
            ),
            label: t(
                'learning.activity.check_in.feeling.stuck.label',
                'I got stuck',
            ),
            value: 'stuck',
        },
    ];
    const nextDirections: Array<{
        description: string;
        label: string;
        value: LearningCheckInNextDirection;
    }> = [
        {
            description: t(
                'learning.activity.check_in.direction.revisit.description',
                'Try this place again when it feels useful.',
            ),
            label: t(
                'learning.activity.check_in.direction.revisit.label',
                'Return to this place',
            ),
            value: 'revisit',
        },
        {
            description: t(
                'learning.activity.check_in.direction.related.description',
                'Follow a nearby learning area.',
            ),
            label: t(
                'learning.activity.check_in.direction.related.label',
                'Look for something related',
            ),
            value: 'related',
        },
        {
            description: t(
                'learning.activity.check_in.direction.settle.description',
                'Leave the idea here and come back later.',
            ),
            label: t(
                'learning.activity.check_in.direction.settle.label',
                'Let it settle',
            ),
            value: 'settle',
        },
    ];
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [nextDirection, setNextDirection] =
        useState<LearningCheckInNextDirection | null>(null);
    const headingRef = useRef<HTMLHeadingElement | null>(null);

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const continueWith = async (feeling: LearningCheckInFeeling | null) => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onContinue(feeling, note.trim(), nextDirection);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : t(
                          'learning.activity.check_in.save_error',
                          'Your check-in could not be saved.',
                      ),
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section
            aria-labelledby="learning-check-in-title"
            className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-[color-mix(in_srgb,var(--learner-action-accent)_30%,var(--learner-border-color))] bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))] p-4"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-action-accent)]">
                        <Heart className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h2
                            className="text-sm font-semibold text-[var(--learner-heading-text)]"
                            id="learning-check-in-title"
                            ref={headingRef}
                            tabIndex={-1}
                        >
                            {t(
                                'learning.activity.check_in.title',
                                'A small pause after :activity',
                                { activity: activityTitle },
                            )}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-[var(--learner-body-text)]">
                            {t(
                                'learning.activity.check_in.description',
                                'How did this feel? Choose a phrase if one fits, or continue without answering.',
                            )}
                        </p>
                    </div>
                </div>
                <Button
                    aria-label={t(
                        'learning.activity.check_in.hide_label',
                        'Hide conclusion',
                    )}
                    className="shrink-0"
                    onClick={onHide}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    <EyeOff className="size-4" />
                    {t('learning.activity.check_in.hide', 'Hide')}
                </Button>
            </div>
            {transitionLabel ? (
                <p className="mt-3 rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2 text-sm leading-6 text-[var(--learner-body-text)]">
                    <span className="font-medium">
                        {t(
                            'learning.activity.conclusion.next_step',
                            'Next step',
                        )}
                        :
                    </span>{' '}
                    {transitionLabel}
                </p>
            ) : null}
            {evidenceContext.objective ||
            evidenceContext.concepts.length > 0 ? (
                <div>
                    <p className="mt-4 text-sm leading-6 text-[var(--learner-body-text)]">
                        {t(
                            'learning.activity.conclusion.learning_focus_description',
                            'This is the focus the activity invited. It remains context for reflection, not a grade.',
                        )}
                    </p>
                    <ActivityEvidenceContext
                        context={evidenceContext}
                        title={t(
                            'learning.activity.conclusion.learning_focus_title',
                            'Learning focus',
                        )}
                    />
                </div>
            ) : null}
            {learningAreas.length > 0 ? (
                <div className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--learner-action-accent)_25%,var(--learner-border-color))] bg-[color-mix(in_srgb,var(--learner-panel-background)_70%,transparent)] px-3 py-2">
                    <p className="text-xs font-medium text-[var(--learner-action-accent)]">
                        {t(
                            'learning.activity.check_in.connected_areas',
                            'Connected learning areas',
                        )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {learningAreas.map((area) =>
                            area.slug ? (
                                <Link
                                    className="rounded-full border border-[color-mix(in_srgb,var(--learner-action-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--learner-action-accent)] underline decoration-[color-mix(in_srgb,var(--learner-action-accent)_40%,transparent)] underline-offset-2 transition hover:border-[var(--learner-action-accent)] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_16%,transparent)]"
                                    href={competenceTopicHref(
                                        area.slug,
                                        originTopicSlug,
                                    )}
                                    key={area.slug}
                                >
                                    {area.name}
                                </Link>
                            ) : (
                                <span
                                    className="rounded-full border border-[color-mix(in_srgb,var(--learner-action-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--learner-action-accent)]"
                                    key={area.name}
                                >
                                    {area.name}
                                </span>
                            ),
                        )}
                    </div>
                </div>
            ) : null}

            <div className="mt-4">
                <label
                    className="block text-xs font-medium text-[var(--learner-action-accent)]"
                    htmlFor="learning-check-in-note"
                >
                    {t(
                        'learning.activity.check_in.note_label',
                        'Add a note (optional)',
                    )}
                </label>
                <textarea
                    className="mt-1 min-h-20 w-full resize-y rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2 text-sm leading-5 text-[var(--learner-body-text)] transition outline-none placeholder:text-[var(--learner-muted-text)] focus:border-[var(--learner-action-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)]"
                    id="learning-check-in-note"
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t(
                        'learning.activity.check_in.note_placeholder',
                        'What would be useful to remember later?',
                    )}
                    value={note}
                />
            </div>

            <div className="mt-4">
                <p className="text-xs font-medium text-[var(--learner-action-accent)]">
                    {t(
                        'learning.activity.check_in.direction_label',
                        'Choose a direction for later (optional)',
                    )}
                </p>
                {choicePrompt ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--learner-body-text)]">
                        {choicePrompt}
                    </p>
                ) : null}
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {nextDirections.map((direction) => {
                        const isSelected = nextDirection === direction.value;

                        return (
                            <button
                                aria-pressed={isSelected}
                                className={`rounded-md border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none ${
                                    isSelected
                                        ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)]'
                                        : 'border-[var(--learner-border-color)] bg-[var(--learner-page-background)] hover:border-[color-mix(in_srgb,var(--learner-action-accent)_70%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,transparent)]'
                                }`}
                                disabled={isSaving}
                                key={direction.value}
                                onClick={() =>
                                    setNextDirection((current) =>
                                        current === direction.value
                                            ? null
                                            : direction.value,
                                    )
                                }
                                type="button"
                            >
                                <span className="block text-sm font-medium text-[var(--learner-heading-text)]">
                                    {direction.label}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                    {direction.description}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {feelings.map((feeling) => (
                    <button
                        className="rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2 text-left transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_70%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                        disabled={isSaving}
                        key={feeling.value}
                        onClick={() => void continueWith(feeling.value)}
                        type="button"
                    >
                        <span className="block text-sm font-medium text-[var(--learner-heading-text)]">
                            {feeling.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--learner-muted-text)]">
                            {feeling.description}
                        </span>
                    </button>
                ))}
            </div>

            {error ? (
                <p className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-600 dark:text-red-300">
                    {error}
                </p>
            ) : null}

            <Button
                className="mt-3"
                disabled={isSaving}
                onClick={() => void continueWith(null)}
                type="button"
                variant="ghost"
            >
                {note.trim()
                    ? t(
                          'learning.activity.check_in.save_note',
                          'Save note and continue',
                      )
                    : nextDirection
                      ? t(
                            'learning.activity.check_in.save_direction',
                            'Save direction and continue',
                        )
                      : t(
                            'learning.activity.check_in.continue_without_answer',
                            'Continue without answering',
                        )}
                <ArrowRight className="ml-2 size-4" />
            </Button>
        </section>
    );
}
