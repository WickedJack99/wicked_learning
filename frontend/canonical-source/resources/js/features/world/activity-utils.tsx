import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
    ActivityTransition,
    LearningActivity,
    LearningCheckInNextDirection,
} from '@/types';

export function activityTransitionLabel(
    transition: ActivityTransition | null,
    fallback: string,
): string {
    const label = transition?.label?.trim();

    return label || fallback;
}

type PlatformTranslate = (key: string, fallback?: string) => string;

export const LEARNING_INTENTS = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
] as const;

const learningFocusCopy: Record<string, [string, string]> = {
    apply: ['activities.focus.apply', 'Apply an idea'],
    explain: ['activities.focus.explain', 'Explain an idea in your own words'],
    participate: ['activities.focus.participate', 'Participate'],
    reflect: ['activities.focus.reflect', 'Reflect'],
    retrieve: ['activities.focus.retrieve', 'Retrieve an idea'],
    review: ['activities.focus.review', 'Review / revisit'],
    transfer: ['activities.focus.transfer', 'Try an idea in a new context'],
};

const learningCheckInDirectionCopy: Record<string, [string, string]> = {
    related: [
        'learning.activity.check_in.direction.related.label',
        'Look for something related',
    ],
    revisit: [
        'learning.activity.check_in.direction.revisit.label',
        'Return to this place',
    ],
    settle: [
        'learning.activity.check_in.direction.settle.label',
        'Let it settle',
    ],
};

const learningActivityTypeCopy: Record<string, [string, string]> = {
    markdown: ['learning.activity.type.markdown', 'Markdown'],
    npc_dialogue: ['learning.activity.type.npc_dialogue', 'NPC dialogue'],
    question: ['learning.activity.type.question', 'Question'],
    reflection: ['learning.activity.type.reflection', 'Reflection'],
    review: ['learning.activity.type.review', 'Review'],
    message_prompt: ['learning.activity.type.message_prompt', 'Message prompt'],
    message_wall: ['learning.activity.type.message_wall', 'Message wall'],
    shared_task: ['learning.activity.type.shared_task', 'Shared task'],
    obstacle: ['learning.activity.type.obstacle', 'Obstacle'],
    item_grant: ['learning.activity.type.item_grant', 'Item grant'],
    item_obstacle: ['learning.activity.type.item_obstacle', 'Item obstacle'],
    tool_grant: ['learning.activity.type.tool_grant', 'Tool grant'],
    open_practice: ['learning.activity.type.open_practice', 'Open practice'],
    portal: ['learning.activity.type.portal', 'Portal'],
};

export function TypingText({ speed, text }: { speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');

    useEffect(() => {
        if (!text) {
            const timer = window.setTimeout(() => setVisibleText(''), 0);

            return () => window.clearTimeout(timer);
        }

        let index = 0;
        const timer = window.setInterval(
            () => {
                index += 1;
                setVisibleText(text.slice(0, index));

                if (index >= text.length) {
                    window.clearInterval(timer);
                }
            },
            Math.max(1, speed),
        );

        return () => window.clearInterval(timer);
    }, [speed, text]);

    return <p className="min-h-12 text-sm leading-6">{visibleText}</p>;
}

export function activityBubbleStyle(
    activity: LearningActivity,
    mode: 'dark' | 'light',
): CSSProperties {
    const isLight = mode === 'light';
    const backgroundColor = stringValue(
        isLight
            ? activity.config.bubbleColorLight
            : activity.config.bubbleColorDark,
        isLight ? '#ffffff' : '#0f172a',
    );
    const borderColor = stringValue(
        isLight
            ? activity.config.bubbleBorderColorLight
            : activity.config.bubbleBorderColorDark,
        isLight ? '#0891b2' : '#2dd4bf',
    );
    const opacity = numericConfig(
        isLight
            ? activity.config.bubbleOpacityLight
            : activity.config.bubbleOpacityDark,
        isLight ? 94 : 92,
    );

    return {
        backgroundColor: colorWithOpacity(backgroundColor, opacity),
        borderColor,
    };
}

export function learningFocusLabel(
    activity: LearningActivity,
    translate: PlatformTranslate,
): string {
    const intentLabel = learningIntentLabel(
        activity.config.learningIntent,
        translate,
    );

    return intentLabel || activityTypeLabel(activity.type, translate);
}

export function learningIntentLabel(
    intent: unknown,
    translate: PlatformTranslate,
): string | null {
    if (typeof intent === 'string' && learningFocusCopy[intent]) {
        const [key, fallback] = learningFocusCopy[intent];

        return translate(key, fallback);
    }

    return null;
}

export function learningCheckInDirectionLabel(
    direction: LearningCheckInNextDirection | string | null,
    translate: PlatformTranslate,
): string | null {
    const directionCopy = learningCheckInDirectionCopy[direction ?? ''];

    return directionCopy ? translate(...directionCopy) : null;
}

function activityTypeLabel(type: string, translate: PlatformTranslate): string {
    const typeCopy = learningActivityTypeCopy[type];

    if (typeCopy) {
        return translate(...typeCopy);
    }

    return translate('learning.activity.type.default', 'Learning activity');
}

export function themedConfig(
    darkValue: unknown,
    lightValue: unknown,
    mode: 'dark' | 'light',
): string {
    const darkImage = stringValue(darkValue);
    const lightImage = stringValue(lightValue);

    return mode === 'light' ? lightImage || darkImage : darkImage || lightImage;
}

export function entranceTransform(direction: unknown): string {
    const value = stringValue(direction, 'left');

    if (value === 'right') {
        return 'translate(calc(-50% + 6rem), -50%)';
    }

    if (value === 'top') {
        return 'translate(-50%, calc(-50% - 6rem))';
    }

    if (value === 'bottom') {
        return 'translate(-50%, calc(-50% + 6rem))';
    }

    if (value === 'none') {
        return 'translate(-50%, -50%)';
    }

    return 'translate(calc(-50% - 6rem), -50%)';
}

export function successAnimationClass(value: string): string {
    if (value === 'shake') {
        return 'animate-obstacle-resolved-shake';
    }

    if (value === 'rotate') {
        return 'animate-obstacle-resolved-rotate';
    }

    if (value === 'none') {
        return '';
    }

    return 'animate-obstacle-resolved-zoom';
}

export function stringConfig(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

export function stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export function numericConfig(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

export function booleanConfig(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }

    return fallback;
}

function colorWithOpacity(color: string, opacity: number): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return color;
    }

    const alpha = Math.round((Math.min(100, Math.max(0, opacity)) / 100) * 255)
        .toString(16)
        .padStart(2, '0');

    return `${color}${alpha}`;
}
