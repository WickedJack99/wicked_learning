import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { embeddedPlatformCursors, platformCursorStyle } from '@/theme/cursors';
import type { PublicPresentationSettings } from '@/theme/presentation';

const cursorVariables = [
    '--platform-action-cursor',
    '--platform-cursor',
    '--platform-denied-cursor',
    '--platform-grab-cursor',
    '--platform-text-cursor',
] as const;

type PlatformCursorVariable = (typeof cursorVariables)[number];
type PlatformCursorStyle = CSSProperties &
    Partial<Record<PlatformCursorVariable, string>>;

const embeddedCursorStyleCache = new Map<string, PlatformCursorStyle>();

export function usePlatformCursorStyle(
    presentation?: PublicPresentationSettings | null,
): CSSProperties {
    const cacheKey = useMemo(
        () => JSON.stringify(presentation?.cursors ?? null),
        [presentation?.cursors],
    );
    const fallbackStyle = useMemo(
        () => platformCursorStyle(presentation) as PlatformCursorStyle,
        [presentation],
    );
    const [cursorStyle, setCursorStyle] = useState<PlatformCursorStyle>(
        () => embeddedCursorStyleCache.get(cacheKey) ?? fallbackStyle,
    );

    useLayoutEffect(() => {
        const cachedStyle = embeddedCursorStyleCache.get(cacheKey);

        applyDocumentCursorVariables(cachedStyle ?? fallbackStyle);
    }, [cacheKey, fallbackStyle]);

    useEffect(() => {
        let isMounted = true;
        const cachedStyle = embeddedCursorStyleCache.get(cacheKey);

        if (cachedStyle) {
            setCursorStyle(cachedStyle);
            applyDocumentCursorVariables(cachedStyle);

            return () => {
                isMounted = false;
            };
        }

        void embeddedPlatformCursors(presentation).then((cursors) => {
            if (!isMounted) {
                return;
            }

            const embeddedStyle: PlatformCursorStyle = {
                '--platform-action-cursor': cursors.action,
                '--platform-cursor': cursors.default,
                '--platform-denied-cursor': cursors.denied,
                '--platform-grab-cursor': cursors.grab,
                '--platform-text-cursor': cursors.text,
            };

            embeddedCursorStyleCache.set(cacheKey, embeddedStyle);
            setCursorStyle(embeddedStyle);
            applyDocumentCursorVariables(embeddedStyle);
        });

        return () => {
            isMounted = false;
        };
    }, [cacheKey, presentation]);

    return cursorStyle;
}

function applyDocumentCursorVariables(style: PlatformCursorStyle): void {
    if (typeof document === 'undefined') {
        return;
    }

    for (const variable of cursorVariables) {
        const value = style[variable];

        if (typeof value === 'string') {
            document.documentElement.style.setProperty(variable, value);
        }
    }
}
