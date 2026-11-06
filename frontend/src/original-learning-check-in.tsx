import { ArrowRight, EyeOff, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { components } from './api/schema';

type LearnerPlaybackCheckIn = components['schemas']['LearnerPlaybackCheckIn'];

type Feeling = 'clearer' | 'forming' | 'stretched' | 'stuck';
type NextDirection = 'revisit' | 'related' | 'settle';

const feelings: Array<{
    description: string;
    label: string;
    value: Feeling;
}> = [
    {
        description: 'A connection became easier to see.',
        label: 'Something clicked',
        value: 'clearer',
    },
    {
        description: 'I want to let this settle for a while.',
        label: 'Still taking shape',
        value: 'forming',
    },
    {
        description: 'It asked me to reach a little further.',
        label: 'It stretched me',
        value: 'stretched',
    },
    {
        description: 'I may need another way in.',
        label: 'I got stuck',
        value: 'stuck',
    },
];

const nextDirections: Array<{
    description: string;
    label: string;
    value: NextDirection;
}> = [
    {
        description: 'Try this place again when it feels useful.',
        label: 'Return to this place',
        value: 'revisit',
    },
    {
        description: 'Follow a nearby learning area.',
        label: 'Look for something related',
        value: 'related',
    },
    {
        description: 'Leave the idea here and come back later.',
        label: 'Let it settle',
        value: 'settle',
    },
];

/**
 * Lifted from `features/world/learning-check-in.tsx`. Links into the source
 * competence surface are intentionally represented as labels: Rust has not
 * exposed that source route or a server-authorized historical activity link.
 */
export function OriginalLearningCheckIn({
    activityTitle,
    checkIn,
    onContinue,
    onHide,
    transitionLabel,
}: {
    activityTitle: string;
    checkIn: LearnerPlaybackCheckIn;
    onContinue: (
        feeling: Feeling | null,
        note: string,
        nextDirection: NextDirection | null,
    ) => Promise<void>;
    onHide: () => void;
    transitionLabel: string | null;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [nextDirection, setNextDirection] =
        useState<NextDirection | null>(null);
    const headingRef = useRef<HTMLHeadingElement | null>(null);

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const continueWith = async (feeling: Feeling | null) => {
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
                    : 'Your check-in could not be saved.',
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section
            aria-labelledby="learning-check-in-title"
            className="h-full min-h-0 overflow-y-auto overscroll-contain rounded-lg border border-[color-mix(in_srgb,var(--learner-action-accent)_30%,var(--learner-border-color))] bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))] p-4"
            data-wl-id="learner.activity.check-in"
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
                            A small pause after {activityTitle}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-[var(--learner-body-text)]">
                            How did this feel? Choose a phrase if one fits, or
                            continue without answering.
                        </p>
                    </div>
                </div>
                <button
                    aria-label="Hide conclusion"
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--learner-body-text)] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                    onClick={onHide}
                    type="button"
                >
                    <EyeOff className="size-4" />
                    Hide
                </button>
            </div>
            {transitionLabel ? (
                <p className="mt-3 rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2 text-sm leading-6 text-[var(--learner-body-text)]">
                    <span className="font-medium">Next step:</span>{' '}
                    {transitionLabel}
                </p>
            ) : null}
            {checkIn.objective || checkIn.concepts.length > 0 ? (
                <div>
                    <p className="mt-4 text-sm leading-6 text-[var(--learner-body-text)]">
                        This is the focus the activity invited. It remains
                        context for reflection, not a grade.
                    </p>
                    <div className="mt-3 rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2">
                        <p className="text-xs font-medium text-[var(--learner-action-accent)]">
                            Learning focus
                        </p>
                        {checkIn.objective ? (
                            <p className="mt-1 text-sm leading-6 text-[var(--learner-body-text)]">
                                {checkIn.objective}
                            </p>
                        ) : null}
                        {checkIn.concepts.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {checkIn.concepts.map((concept) => (
                                    <span
                                        className="rounded-full border border-[color-mix(in_srgb,var(--learner-action-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--learner-action-accent)]"
                                        key={concept}
                                    >
                                        {concept}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {checkIn.learning_areas.length > 0 ? (
                <div className="mt-4 rounded-md border border-[color-mix(in_srgb,var(--learner-action-accent)_25%,var(--learner-border-color))] bg-[color-mix(in_srgb,var(--learner-panel-background)_70%,transparent)] px-3 py-2">
                    <p className="text-xs font-medium text-[var(--learner-action-accent)]">
                        Connected learning areas
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {checkIn.learning_areas.map((area) => (
                            <span
                                className="rounded-full border border-[color-mix(in_srgb,var(--learner-action-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] px-2 py-0.5 text-xs text-[var(--learner-action-accent)]"
                                key={area.slug}
                            >
                                {area.name}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
            <div className="mt-4">
                <label
                    className="block text-xs font-medium text-[var(--learner-action-accent)]"
                    htmlFor="learning-check-in-note"
                >
                    Add a note (optional)
                </label>
                <textarea
                    className="mt-1 min-h-20 w-full resize-y rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-page-background)] px-3 py-2 text-sm leading-5 text-[var(--learner-body-text)] transition outline-none placeholder:text-[var(--learner-muted-text)] focus:border-[var(--learner-action-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)]"
                    id="learning-check-in-note"
                    maxLength={500}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="What would be useful to remember later?"
                    value={note}
                />
            </div>
            <div className="mt-4">
                <p className="text-xs font-medium text-[var(--learner-action-accent)]">
                    Choose a direction for later (optional)
                </p>
                {checkIn.choice_prompt ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--learner-body-text)]">
                        {checkIn.choice_prompt}
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
                <p className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-600 dark:text-red-300" role="alert">
                    {error}
                </p>
            ) : null}
            <button
                className="mt-3 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-[var(--learner-body-text)] transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:opacity-60"
                disabled={isSaving}
                onClick={() => void continueWith(null)}
                type="button"
            >
                {note.trim()
                    ? 'Save note and continue'
                    : nextDirection
                      ? 'Save direction and continue'
                      : 'Continue without answering'}
                <ArrowRight className="ml-2 size-4" />
            </button>
        </section>
    );
}
