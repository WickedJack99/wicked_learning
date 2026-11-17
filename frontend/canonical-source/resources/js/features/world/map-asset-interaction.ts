import type {
    MapAsset,
    MapAssetInteractionMode,
    MapAssetStateSprite,
} from '@/types/learning';
import type { ImageAlphaMask } from './image-alpha-mask';
import { imageAlphaMaskContains } from './image-alpha-mask';

export type MapAssetSurface = Pick<MapAsset, 'imageUrl' | 'width' | 'x' | 'y'>;

// Keep this in sync with the shared MapAsset visual's Tailwind max size (52).
const MAX_MAP_ASSET_SIZE_PX = 13 * 16;

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
    alphaMask?: ImageAlphaMask | null,
): boolean {
    const centerX = (surface.x / 100) * bounds.width;
    const centerY = (surface.y / 100) * bounds.height;
    const size = surfaceSize(surface, bounds);

    const insideBounds =
        Math.abs(point.x - centerX) <= size / 2 &&
        Math.abs(point.y - centerY) <= size / 2;

    if (!insideBounds || !alphaMask) {
        return insideBounds;
    }

    return imageAlphaMaskContains(
        alphaMask,
        (point.x - (centerX - size / 2)) / size,
        (point.y - (centerY - size / 2)) / size,
    );
}

export function mapAssetSurfacesOverlap(
    first: MapAssetSurface,
    second: MapAssetSurface,
    bounds: { height: number; width: number },
    firstAlphaMask?: ImageAlphaMask | null,
    secondAlphaMask?: ImageAlphaMask | null,
): boolean {
    const firstRect = surfaceRect(first, bounds);
    const secondRect = surfaceRect(second, bounds);

    const rectanglesOverlap = !(
        firstRect.right < secondRect.left ||
        firstRect.left > secondRect.right ||
        firstRect.bottom < secondRect.top ||
        firstRect.top > secondRect.bottom
    );

    if (!rectanglesOverlap || !firstAlphaMask || !secondAlphaMask) {
        return rectanglesOverlap;
    }

    const overlap = {
        bottom: Math.min(firstRect.bottom, secondRect.bottom),
        left: Math.max(firstRect.left, secondRect.left),
        right: Math.min(firstRect.right, secondRect.right),
        top: Math.max(firstRect.top, secondRect.top),
    };
    const firstSize = firstRect.right - firstRect.left;
    const secondSize = secondRect.right - secondRect.left;
    const step = Math.max(
        1,
        Math.min(
            firstSize / firstAlphaMask.resolution,
            secondSize / secondAlphaMask.resolution,
        ),
    );

    for (let y = overlap.top; y <= overlap.bottom; y += step) {
        for (let x = overlap.left; x <= overlap.right; x += step) {
            if (
                imageAlphaMaskContains(
                    firstAlphaMask,
                    (x - firstRect.left) / firstSize,
                    (y - firstRect.top) / firstSize,
                ) &&
                imageAlphaMaskContains(
                    secondAlphaMask,
                    (x - secondRect.left) / secondSize,
                    (y - secondRect.top) / secondSize,
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function surfaceRect(
    surface: MapAssetSurface,
    bounds: { height: number; width: number },
) {
    const centerX = (surface.x / 100) * bounds.width;
    const centerY = (surface.y / 100) * bounds.height;
    const size = surfaceSize(surface, bounds);

    return {
        bottom: centerY + size / 2,
        left: centerX - size / 2,
        right: centerX + size / 2,
        top: centerY - size / 2,
    };
}

function surfaceSize(
    surface: MapAssetSurface,
    bounds: { width: number },
): number {
    return Math.min(
        (surface.width / 100) * bounds.width,
        MAX_MAP_ASSET_SIZE_PX,
    );
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
