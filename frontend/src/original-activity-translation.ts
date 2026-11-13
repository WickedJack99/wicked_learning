import type { components } from './api/schema';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
export type LearnerActivityTranslation = Record<string, unknown> | null;

/**
 * Applies only the learner-copy projection from the scoped active-run
 * translation endpoint. IDs, routes, correctness, media, and every other
 * behavior-bearing field remain in the server playback document.
 */
export function applyActivityTranslation(
    activity: LearnerPlaybackActivity,
    translation: LearnerActivityTranslation,
): LearnerPlaybackActivity {
    if (!isRecord(translation)) {
        return activity;
    }

    const config = translatedConfiguration(activity.config, translation.config);
    const question = isRecord(translation.question)
        ? translatedQuestionConfiguration(config, translation.question)
        : config;

    return {
        ...activity,
        title:
            typeof translation.title === 'string'
                ? translation.title
                : activity.title,
        description:
            typeof translation.introduction === 'string'
                ? translation.introduction
                : activity.description,
        config: question,
        npc_dialogue: translatedDialogue(activity.npc_dialogue, translation.npcDialogueNodes),
    };
}

function translatedConfiguration(
    configuration: Record<string, unknown>,
    candidate: unknown,
): Record<string, unknown> {
    if (!isRecord(candidate)) {
        return configuration;
    }

    const copy = { ...configuration };
    for (const key of ['promptText', 'successText', 'revisitText', 'text']) {
        if (typeof candidate[key] === 'string') {
            copy[key] = candidate[key];
        }
    }

    const markdownPageTranslations = candidate.markdownPages;
    if (
        isRecord(markdownPageTranslations) &&
        Array.isArray(configuration.markdownPages)
    ) {
        copy.markdownPages = configuration.markdownPages.map((page) =>
            translatedMarkdownPage(page, markdownPageTranslations),
        );
    }

    return copy;
}

function translatedMarkdownPage(
    page: unknown,
    translations: Record<string, unknown>,
): unknown {
    if (!isRecord(page) || typeof page.id !== 'string') {
        return page;
    }
    const candidate = translations[page.id];
    if (!isRecord(candidate)) {
        return page;
    }

    return {
        ...page,
        body: typeof candidate.body === 'string' ? candidate.body : page.body,
        title:
            typeof candidate.title === 'string' ? candidate.title : page.title,
    };
}

function translatedQuestionConfiguration(
    configuration: Record<string, unknown>,
    translation: Record<string, unknown>,
): Record<string, unknown> {
    const copy = { ...configuration };
    if (typeof translation.prompt === 'string') {
        copy.prompt = translation.prompt;
    }
    const optionTranslations = translation.options;
    if (!isRecord(optionTranslations) || !Array.isArray(configuration.options)) {
        return copy;
    }

    copy.options = configuration.options.map((option) => {
        if (!isRecord(option) || typeof option.key !== 'string') {
            return option;
        }
        const candidate = optionTranslations[option.key];
        if (!isRecord(candidate)) {
            return option;
        }
        return {
            ...option,
            body:
                typeof candidate.body === 'string'
                    ? candidate.body
                    : option.body,
            label:
                typeof candidate.label === 'string'
                    ? candidate.label
                    : option.label,
        };
    });

    return copy;
}

function translatedDialogue(
    dialogue: LearnerPlaybackActivity['npc_dialogue'],
    candidates: unknown,
): LearnerPlaybackActivity['npc_dialogue'] {
    if (!dialogue || !isRecord(candidates)) {
        return dialogue;
    }

    return {
        ...dialogue,
        nodes: dialogue.nodes.map((node) => {
            const candidate = candidates[node.id];
            if (!isRecord(candidate)) {
                return node;
            }
            return {
                ...node,
                body:
                    typeof candidate.body === 'string'
                        ? candidate.body
                        : node.body,
                title:
                    typeof candidate.title === 'string'
                        ? candidate.title
                        : node.title,
            };
        }),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
