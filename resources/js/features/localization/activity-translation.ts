import type { LearningActivity } from '@/types';

export type LearningActivityTranslation = {
    config?: Partial<{
        markdownPages: Record<
            string,
            Partial<{
                body: string;
                title: string;
            }>
        >;
        promptText: string;
        revisitText: string;
        successText: string;
        text: string;
    }>;
    dialogueStages?: Record<
        number,
        Partial<{
            body: string;
            imageAlt: string | null;
            mood: string | null;
            speakerName: string;
            speakerRole: string | null;
        }>
    >;
    introduction?: string | null;
    npcDialogueNodes?: Record<
        number,
        Partial<{
            body: string | null;
            title: string;
        }>
    >;
    question?: {
        options?: Record<
            number,
            Partial<{
                body: string;
                label: string;
            }>
        >;
        prompt?: string;
    } | null;
    title?: string;
    transitions?: Record<number, Partial<{ label: string | null }>>;
};

/**
 * Applies learner-visible copy without changing route structure, answer state,
 * correctness metadata, or any other protected activity behavior.
 */
export function applyActivityTranslation(
    activity: LearningActivity,
    translation: LearningActivityTranslation | null,
): LearningActivity {
    if (!translation) {
        return activity;
    }

    return {
        ...activity,
        title: translation.title ?? activity.title,
        introduction: translation.introduction ?? activity.introduction,
        dialogueStages: activity.dialogueStages.map((stage) => ({
            ...stage,
            ...translation.dialogueStages?.[stage.id],
        })),
        npcDialogueNodes: activity.npcDialogueNodes.map((node) => ({
            ...node,
            ...translation.npcDialogueNodes?.[node.id],
        })),
        question: activity.question
            ? {
                  ...activity.question,
                  prompt:
                      translation.question?.prompt ?? activity.question.prompt,
                  options: activity.question.options.map((option) => ({
                      ...option,
                      ...translation.question?.options?.[option.id],
                  })),
              }
            : null,
        transitions: activity.transitions.map((transition) => ({
            ...transition,
            ...translation.transitions?.[transition.id],
        })),
        config: {
            ...activity.config,
            ...translatedConfiguration(activity.config, translation.config),
        },
    };
}

function translatedConfiguration(
    configuration: LearningActivity['config'],
    translation: LearningActivityTranslation['config'],
): LearningActivity['config'] {
    if (!translation) {
        return {};
    }

    const copy: LearningActivity['config'] = {};

    for (const key of [
        'promptText',
        'successText',
        'revisitText',
        'text',
    ] as const) {
        if (typeof translation[key] === 'string') {
            copy[key] = translation[key];
        }
    }

    if (translation.markdownPages) {
        copy.markdownPages = translatedMarkdownPages(
            configuration.markdownPages,
            translation.markdownPages,
        );
    }

    return copy;
}

function translatedMarkdownPages(
    pages: LearningActivity['config']['markdownPages'],
    translations: NonNullable<
        NonNullable<LearningActivityTranslation['config']>['markdownPages']
    >,
): Array<Record<string, unknown>> {
    if (!Array.isArray(pages)) {
        return [];
    }

    return pages.filter(isRecord).map((page) => {
        if (typeof page.id !== 'string') {
            return page;
        }

        return {
            ...page,
            ...translations[page.id],
        };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
