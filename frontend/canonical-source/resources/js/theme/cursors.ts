import type { CSSProperties } from 'react';
import type {
    CursorImageSettings,
    PublicPresentationSettings,
} from '@/theme/presentation';

const defaultCursors = {
    action: {
        image: '/images/cursors/fantasy-pointer.png',
        hotspotX: 12,
        hotspotY: 4,
        size: 32,
        fallback: 'pointer',
    },
    default: {
        image: '/images/cursors/fantasy-cursor.png',
        hotspotX: 4,
        hotspotY: 4,
        size: 32,
        fallback: 'default',
    },
    denied: {
        image: '/images/cursors/fantasy-denied-cursor.png',
        hotspotX: 12,
        hotspotY: 10,
        size: 40,
        fallback: 'not-allowed',
    },
    grab: {
        image: '/images/cursors/fantasy-grab-backhand.png',
        hotspotX: 12,
        hotspotY: 10,
        size: 40,
        fallback: 'grab',
    },
    text: {
        image: '/images/cursors/fantasy-text-cursor.png',
        hotspotX: 13,
        hotspotY: 30,
        size: 40,
        fallback: 'text',
    },
} satisfies PublicPresentationSettings['cursors'];

type ResolvedCursorSettings = {
    fallback: string;
    hotspotX: number;
    hotspotY: number;
    image: string;
    size: number;
};

type PlatformCursorSet = {
    action: string;
    default: string;
    denied: string;
    grab: string;
    text: string;
};

export function platformCursor(
    presentation?: PublicPresentationSettings | null,
): string {
    return cursorValue(presentation?.cursors?.default, defaultCursors.default);
}

export function platformActionCursor(
    presentation?: PublicPresentationSettings | null,
): string {
    return cursorValue(presentation?.cursors?.action, defaultCursors.action);
}

export function platformGrabCursor(
    presentation?: PublicPresentationSettings | null,
): string {
    return cursorValue(presentation?.cursors?.grab, defaultCursors.grab);
}

export function platformTextCursor(
    presentation?: PublicPresentationSettings | null,
): string {
    return cursorValue(presentation?.cursors?.text, defaultCursors.text);
}

export function platformDeniedCursor(
    presentation?: PublicPresentationSettings | null,
): string {
    return cursorValue(presentation?.cursors?.denied, defaultCursors.denied);
}

export function platformCursorStyle(
    presentation?: PublicPresentationSettings | null,
): CSSProperties {
    return {
        '--platform-action-cursor': platformActionCursor(presentation),
        '--platform-cursor': platformCursor(presentation),
        '--platform-denied-cursor': platformDeniedCursor(presentation),
        '--platform-grab-cursor': platformGrabCursor(presentation),
        '--platform-text-cursor': platformTextCursor(presentation),
    } as CSSProperties;
}

export function cursorValue(
    settings: CursorImageSettings | undefined,
    fallbackSettings: ResolvedCursorSettings,
): string {
    const resolved = resolveCursorSettings(settings, fallbackSettings);

    return cursorCssValue(
        sizedCursorAssetUrl(assetUrl(resolved.image), resolved.size),
        resolved,
    );
}

export async function embeddedPlatformCursors(
    presentation?: PublicPresentationSettings | null,
): Promise<PlatformCursorSet> {
    const [defaultCursor, actionCursor, grabCursor, textCursor, deniedCursor] =
        await Promise.all([
            embeddedCursorValue(
                presentation?.cursors?.default,
                defaultCursors.default,
            ),
            embeddedCursorValue(
                presentation?.cursors?.action,
                defaultCursors.action,
            ),
            embeddedCursorValue(
                presentation?.cursors?.grab,
                defaultCursors.grab,
            ),
            embeddedCursorValue(
                presentation?.cursors?.text,
                defaultCursors.text,
            ),
            embeddedCursorValue(
                presentation?.cursors?.denied,
                defaultCursors.denied,
            ),
        ]);

    return {
        action: actionCursor,
        default: defaultCursor,
        denied: deniedCursor,
        grab: grabCursor,
        text: textCursor,
    };
}

async function embeddedCursorValue(
    settings: CursorImageSettings | undefined,
    fallbackSettings: ResolvedCursorSettings,
): Promise<string> {
    const resolved = resolveCursorSettings(settings, fallbackSettings);

    try {
        const embeddedImage = await imageDataUrl(resolved.image);

        return cursorCssValue(
            sizedCursorAssetUrl(embeddedImage, resolved.size),
            resolved,
        );
    } catch {
        return cursorCssValue(
            sizedCursorAssetUrl(assetUrl(resolved.image), resolved.size),
            resolved,
        );
    }
}

function resolveCursorSettings(
    settings: CursorImageSettings | undefined,
    fallbackSettings: ResolvedCursorSettings,
): ResolvedCursorSettings {
    const image = settings?.image || fallbackSettings.image;
    const fallback = settings?.fallback || fallbackSettings.fallback;
    const hotspotX = numericHotspot(
        settings?.hotspotX,
        fallbackSettings.hotspotX,
    );
    const hotspotY = numericHotspot(
        settings?.hotspotY,
        fallbackSettings.hotspotY,
    );
    const size = numericCursorSize(settings?.size, fallbackSettings.size);

    return {
        fallback,
        hotspotX,
        hotspotY,
        image,
        size,
    };
}

function cursorCssValue(
    imageUrl: string,
    settings: ResolvedCursorSettings,
): string {
    return `url("${imageUrl}") ${settings.hotspotX} ${settings.hotspotY}, ${settings.fallback}`;
}

function numericHotspot(
    value: number | null | undefined,
    fallback: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function numericCursorSize(
    value: number | null | undefined,
    fallback: number,
): number {
    const numericValue =
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;

    return Math.min(128, Math.max(16, Math.round(numericValue)));
}

function assetUrl(path: string): string {
    if (typeof window === 'undefined' || !path.startsWith('/')) {
        return path;
    }

    return new URL(path, window.location.origin).toString();
}

function sizedCursorAssetUrl(imageData: string, size: number): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="${escapeXmlAttribute(imageData)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function imageDataUrl(path: string): Promise<string> {
    const response = await fetch(assetUrl(path), {
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error('Cursor image could not be loaded.');
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Cursor image could not be encoded.'));
            }
        });
        reader.addEventListener('error', () => reject(reader.error));
        reader.readAsDataURL(blob);
    });
}

function escapeXmlAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
