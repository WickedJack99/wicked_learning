import type { ReviewOutcome } from '@/types';

type Translate = (
    key: string,
    fallback?: string,
    replacements?: Record<string, number | string>,
) => string;

export const reviewOutcomeOptions: ReadonlyArray<{
    description: string;
    descriptionKey: string;
    label: string;
    labelKey: string;
    value: ReviewOutcome;
}> = [
    {
        description: 'The idea feels easier to explain or use now.',
        descriptionKey: 'learning.review.outcome_clearer_description',
        label: 'Clearer now',
        labelKey: 'learning.review.outcome_clearer',
        value: 'clearer',
    },
    {
        description: 'A relationship or context is more visible now.',
        descriptionKey: 'learning.review.outcome_connected_description',
        label: 'More connected',
        labelKey: 'learning.review.outcome_connected',
        value: 'connected',
    },
    {
        description:
            'The idea may need more time, another example, or a different route.',
        descriptionKey: 'learning.review.outcome_open_description',
        label: 'Still open',
        labelKey: 'learning.review.outcome_open',
        value: 'open',
    },
];

const questionOutcomeCopy: Record<
    string,
    {
        description: string;
        descriptionKey: string;
        label: string;
        labelKey: string;
    }
> = {
    correct: {
        description: 'The answer matched the configured response.',
        descriptionKey: 'learning.review.outcome_correct_description',
        label: 'Useful clue found',
        labelKey: 'learning.review.outcome_correct',
    },
    incorrect: {
        description: 'The answer gives you a reason to adjust the hypothesis.',
        descriptionKey: 'learning.review.outcome_incorrect_description',
        label: 'Adjust the hypothesis',
        labelKey: 'learning.review.outcome_incorrect',
    },
};

export function reviewOutcomeLabel(
    outcome: string,
    translate: Translate,
): string {
    const option = reviewOutcomeOptions.find(
        (candidate) => candidate.value === outcome,
    );
    const copy = option ?? questionOutcomeCopy[outcome];

    return translate(
        copy?.labelKey ?? 'learning.review.outcome_unknown',
        copy?.label ?? 'Review completed',
    );
}

export function reviewOutcomeDescription(
    outcome: string,
    translate: Translate,
): string | null {
    const option = reviewOutcomeOptions.find(
        (candidate) => candidate.value === outcome,
    );
    const copy = option ?? questionOutcomeCopy[outcome];

    return copy ? translate(copy.descriptionKey, copy.description) : null;
}
