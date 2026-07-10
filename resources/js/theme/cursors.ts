import type {
    CursorImageSettings,
    PublicPresentationSettings,
} from '@/theme/presentation';

const defaultCursors = {
    action: {
        image: '/images/cursors/cyber-pointer.svg',
        hotspotX: 12,
        hotspotY: 4,
        fallback: 'pointer',
    },
    default: {
        image: '/images/cursors/cyber-cursor.svg',
        hotspotX: 4,
        hotspotY: 4,
        fallback: 'default',
    },
    grab: {
        image: '/images/cursors/cyber-hand.svg',
        hotspotX: 12,
        hotspotY: 10,
        fallback: 'grab',
    },
} satisfies PublicPresentationSettings['cursors'];

type ResolvedCursorSettings = {
    fallback: string;
    hotspotX: number;
    hotspotY: number;
    image: string;
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

    return `url("${assetUrl(image)}") ${hotspotX} ${hotspotY}, ${fallback}`;
}

function numericHotspot(
    value: number | null | undefined,
    fallback: number,
): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function assetUrl(path: string): string {
    if (typeof window === 'undefined' || !path.startsWith('/')) {
        return path;
    }

    return new URL(path, window.location.origin).toString();
}
