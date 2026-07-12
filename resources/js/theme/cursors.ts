import type {
    CursorImageSettings,
    PublicPresentationSettings,
} from '@/theme/presentation';

const defaultCursors = {
    action: {
        image: '/images/cursors/action-pointer.svg',
        hotspotX: 12,
        hotspotY: 4,
        size: 32,
        fallback: 'pointer',
    },
    default: {
        image: '/images/cursors/default-cursor.svg',
        hotspotX: 4,
        hotspotY: 4,
        size: 32,
        fallback: 'default',
    },
    grab: {
        image: '/images/cursors/fantasy-grab-backhand.png',
        hotspotX: 12,
        hotspotY: 10,
        size: 40,
        fallback: 'grab',
    },
} satisfies PublicPresentationSettings['cursors'];

type ResolvedCursorSettings = {
    fallback: string;
    hotspotX: number;
    hotspotY: number;
    image: string;
    size: number;
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

export function cursorValue(
    settings: CursorImageSettings | undefined,
    fallbackSettings: ResolvedCursorSettings,
): string {
    const resolved = resolveCursorSettings(settings, fallbackSettings);

    return cursorCssValue(assetUrl(resolved.image), resolved);
}

export async function embeddedPlatformCursors(
    presentation?: PublicPresentationSettings | null,
): Promise<{ action: string; default: string; grab: string }> {
    const [defaultCursor, actionCursor, grabCursor] = await Promise.all([
        embeddedCursorValue(
            presentation?.cursors?.default,
            defaultCursors.default,
        ),
        embeddedCursorValue(
            presentation?.cursors?.action,
            defaultCursors.action,
        ),
        embeddedCursorValue(presentation?.cursors?.grab, defaultCursors.grab),
    ]);

    return {
        action: actionCursor,
        default: defaultCursor,
        grab: grabCursor,
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
        return cursorCssValue(assetUrl(resolved.image), resolved);
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
