import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { LearningActivity } from '@/types';

type PlatformTranslate = (key: string, fallback?: string) => string;

const learningFocusCopy: Record<string, [string, string]> = {
    apply: ['activities.focus.apply', 'Apply an idea'],
    explain: ['activities.focus.explain', 'Explain an idea in your own words'],
    participate: ['activities.focus.participate', 'Participate'],
    reflect: ['activities.focus.reflect', 'Reflect'],
    retrieve: ['activities.focus.retrieve', 'Retrieve an idea'],
    review: ['activities.focus.review', 'Review / revisit'],
    transfer: ['activities.focus.transfer', 'Try an idea in a new context'],
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

    return intentLabel || activityTypeLabel(activity.type);
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

function activityTypeLabel(type: string): string {
    const label = type.replaceAll('_', ' ').trim();

    if (label === '') {
        return 'Learning activity';
    }

    return label.charAt(0).toUpperCase() + label.slice(1);
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
