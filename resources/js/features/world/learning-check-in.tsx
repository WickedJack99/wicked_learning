import { ArrowRight, Heart } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LearningCheckInFeeling } from '@/types';

const feelings: Array<{
    description: string;
    label: string;
    value: LearningCheckInFeeling;
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

export function LearningCheckIn({
    activityTitle,
    learningAreas,
    onContinue,
}: {
    activityTitle: string;
    learningAreas: Array<{ name: string; slug: string | null }>;
    onContinue: (feeling: LearningCheckInFeeling | null) => Promise<void>;
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const continueWith = async (feeling: LearningCheckInFeeling | null) => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            await onContinue(feeling);
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
            className="mb-3 rounded-lg border border-cyan-200 bg-cyan-50/80 p-4 dark:border-teal-200/20 dark:bg-teal-200/8"
        >
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/80 text-cyan-700 dark:bg-white/10 dark:text-teal-200">
                    <Heart className="size-4" />
                </span>
                <div className="min-w-0">
                    <h2
                        className="text-sm font-semibold text-slate-950 dark:text-white"
                        id="learning-check-in-title"
                    >
                        A small pause after {activityTitle}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        How did this feel? Choose a phrase if one fits, or
                        continue without answering.
                    </p>
                </div>
            </div>
            {learningAreas.length > 0 ? (
                <div className="mt-4 rounded-md border border-cyan-200/70 bg-white/50 px-3 py-2 dark:border-teal-100/15 dark:bg-black/10">
                    <p className="text-xs font-medium text-cyan-900 dark:text-teal-100">
                        Connected learning areas
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {learningAreas.map((area) => (
                            <span
                                className="rounded-full border border-cyan-300/70 bg-cyan-100/60 px-2 py-0.5 text-xs text-cyan-900 dark:border-teal-100/20 dark:bg-teal-100/8 dark:text-teal-100"
                                key={area.slug ?? area.name}
                            >
                                {area.name}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {feelings.map((feeling) => (
                    <button
                        className="rounded-md border border-cyan-200 bg-white/80 px-3 py-2 text-left transition hover:border-cyan-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/25 dark:hover:border-teal-200/60 dark:hover:bg-white/10 dark:focus-visible:ring-teal-200"
                        disabled={isSaving}
                        key={feeling.value}
                        onClick={() => void continueWith(feeling.value)}
                        type="button"
                    >
                        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                            {feeling.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
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
                Continue without answering
                <ArrowRight className="ml-2 size-4" />
            </Button>
        </section>
    );
}
