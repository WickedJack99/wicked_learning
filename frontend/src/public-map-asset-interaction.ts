import { imageAlphaMaskContains } from './public-image-alpha-mask';
import type { ImageAlphaMask } from './public-image-alpha-mask';

const MAX_MAP_ASSET_SIZE_PX = 13 * 16;

export type MapAssetSurface = {
    width: number;
    x: number;
    y: number;
};

export function pointInsideMapAsset(
    surface: MapAssetSurface,
    point: { x: number; y: number },
    bounds: { height: number; width: number },
    alphaMask?: ImageAlphaMask | null,
): boolean {
    const rect = surfaceRect(surface, bounds);
    const insideBounds =
        point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    if (!insideBounds || !alphaMask) {
        return insideBounds;
    }

    return imageAlphaMaskContains(
        alphaMask,
        (point.x - rect.left) / (rect.right - rect.left),
        (point.y - rect.top) / (rect.bottom - rect.top),
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

    const left = Math.max(firstRect.left, secondRect.left);
    const right = Math.min(firstRect.right, secondRect.right);
    const top = Math.max(firstRect.top, secondRect.top);
    const bottom = Math.min(firstRect.bottom, secondRect.bottom);
    const step = Math.max(
        1,
        Math.min(
            (firstRect.right - firstRect.left) / firstAlphaMask.resolution,
            (secondRect.right - secondRect.left) / secondAlphaMask.resolution,
        ),
    );

    for (let y = top; y <= bottom; y += step) {
        for (let x = left; x <= right; x += step) {
            if (
                imageAlphaMaskContains(
                    firstAlphaMask,
                    (x - firstRect.left) / (firstRect.right - firstRect.left),
                    (y - firstRect.top) / (firstRect.bottom - firstRect.top),
                ) &&
                imageAlphaMaskContains(
                    secondAlphaMask,
                    (x - secondRect.left) / (secondRect.right - secondRect.left),
                    (y - secondRect.top) / (secondRect.bottom - secondRect.top),
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
    const size = Math.min((surface.width / 100) * bounds.width, MAX_MAP_ASSET_SIZE_PX);
    const centerX = (surface.x / 100) * bounds.width;
    const centerY = (surface.y / 100) * bounds.height;
    return {
        bottom: centerY + size / 2,
        left: centerX - size / 2,
        right: centerX + size / 2,
        top: centerY - size / 2,
    };
}
