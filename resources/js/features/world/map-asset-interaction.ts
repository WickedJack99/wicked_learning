import type {
    MapAsset,
    MapAssetInteractionMode,
    MapAssetStateSprite,
} from '@/types/learning';

export type MapAssetSurface = Pick<MapAsset, 'imageUrl' | 'width' | 'x' | 'y'>;

export function mapAssetInteractionMode(
    asset: Pick<MapAsset, 'focusable' | 'interactionMode'>,
): MapAssetInteractionMode {
    return (
        asset.interactionMode ?? (asset.focusable ? 'focusable' : 'decorative')
    );
}

export function mapAssetSurface(
    asset: MapAsset,
    secondState = false,
): MapAssetSurface {
    if (mapAssetInteractionMode(asset) !== 'toggle') {
        return asset;
    }

    const state = secondState
        ? asset.interactionConfig?.states?.second
        : asset.interactionConfig?.states?.first;

    return {
        imageUrl: state?.imageUrl || asset.imageUrl,
        width: stateNumber(state, 'width', asset.width),
        x: stateNumber(state, 'x', asset.x),
        y: stateNumber(state, 'y', asset.y),
    };
}

export function pointInsideMapAsset(
    surface: MapAssetSurface,
    point: { x: number; y: number },
    bounds: { height: number; width: number },
): boolean {
    const centerX = (surface.x / 100) * bounds.width;
    const centerY = (surface.y / 100) * bounds.height;
    const size = (surface.width / 100) * bounds.width;

    return (
        Math.abs(point.x - centerX) <= size / 2 &&
        Math.abs(point.y - centerY) <= size / 2
    );
}

export function mapAssetSurfacesOverlap(
    first: MapAssetSurface,
    second: MapAssetSurface,
    bounds: { height: number; width: number },
): boolean {
    const firstRect = surfaceRect(first, bounds);
    const secondRect = surfaceRect(second, bounds);

    return !(
        firstRect.right < secondRect.left ||
        firstRect.left > secondRect.right ||
        firstRect.bottom < secondRect.top ||
        firstRect.top > secondRect.bottom
    );
}

function surfaceRect(
    surface: MapAssetSurface,
    bounds: { height: number; width: number },
) {
    const centerX = (surface.x / 100) * bounds.width;
    const centerY = (surface.y / 100) * bounds.height;
    const size = (surface.width / 100) * bounds.width;

    return {
        bottom: centerY + size / 2,
        left: centerX - size / 2,
        right: centerX + size / 2,
        top: centerY - size / 2,
    };
}

function stateNumber(
    state: MapAssetStateSprite | undefined,
    key: 'width' | 'x' | 'y',
    fallback: number,
): number {
    const value = state?.[key];

    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}
