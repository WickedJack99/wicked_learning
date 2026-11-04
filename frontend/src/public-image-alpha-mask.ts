import { useEffect, useState } from 'react';

const ALPHA_THRESHOLD = 20;
const MASK_RESOLUTION = 128;

export type ImageAlphaMask = {
    opaquePixels: Uint8Array;
    resolution: number;
};

export type ImageAlphaMaskRequest = {
    imageFit?: string;
    imagePosition?: string;
    imageUrl?: string | null;
};

type NormalizedImageAlphaMaskRequest = {
    fit: 'contain' | 'cover';
    key: string;
    position: 'center' | 'top' | 'right' | 'bottom' | 'left';
    source: string;
};

const maskCache = new Map<string, ImageAlphaMask | null>();
const pendingMasks = new Map<string, Promise<ImageAlphaMask | null>>();

/**
 * Adapted from the original learner map. It lets public map interactions
 * follow opaque image pixels, while unavailable or cross-origin-unreadable
 * image data retains the original rectangular fallback.
 */
export function useImageAlphaMasks(
    requests: ImageAlphaMaskRequest[],
): ReadonlyMap<string, ImageAlphaMask | null> {
    const normalizedRequests = uniqueRequests(requests);
    const sourceKey = normalizedRequests.map((request) => request.key).join('\u001f');
    const [, setRevision] = useState(0);

    useEffect(() => {
        if (!sourceKey) {
            return;
        }

        let active = true;
        void Promise.all(normalizedRequests.map(ensureImageAlphaMask)).then(() => {
            if (active) {
                setRevision((revision) => revision + 1);
            }
        });

        return () => {
            active = false;
        };
        // sourceKey is the stable dependency for this cache fill. The request
        // array is rebuilt by the caller on each render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey]);

    return maskCache;
}

export function imageAlphaMaskFor(
    request: ImageAlphaMaskRequest,
    masks: ReadonlyMap<string, ImageAlphaMask | null>,
): ImageAlphaMask | null | undefined {
    const source = normalizeRequest(request);

    return source ? masks.get(source.key) : null;
}

export function imageAlphaMaskContains(
    mask: ImageAlphaMask,
    normalizedX: number,
    normalizedY: number,
): boolean {
    if (
        normalizedX < 0 ||
        normalizedX > 1 ||
        normalizedY < 0 ||
        normalizedY > 1
    ) {
        return false;
    }

    const x = Math.min(
        mask.resolution - 1,
        Math.floor(normalizedX * mask.resolution),
    );
    const y = Math.min(
        mask.resolution - 1,
        Math.floor(normalizedY * mask.resolution),
    );

    return mask.opaquePixels[y * mask.resolution + x] === 1;
}

function uniqueRequests(
    requests: ImageAlphaMaskRequest[],
): NormalizedImageAlphaMaskRequest[] {
    return requests
        .map(normalizeRequest)
        .filter((request): request is NormalizedImageAlphaMaskRequest => Boolean(request))
        .filter(
            (request, index, allRequests) =>
                allRequests.findIndex((candidate) => candidate.key === request.key) === index,
        );
}

function normalizeRequest(
    request: ImageAlphaMaskRequest,
): NormalizedImageAlphaMaskRequest | null {
    const source = request.imageUrl?.trim();
    if (!source) {
        return null;
    }

    const fit = request.imageFit === 'cover' ? 'cover' : 'contain';
    const position = imagePosition(request.imagePosition);

    return {
        fit,
        key: `${source}\u0000${fit}\u0000${position}`,
        position,
        source,
    };
}

function ensureImageAlphaMask(
    request: NormalizedImageAlphaMaskRequest,
): Promise<ImageAlphaMask | null> {
    if (maskCache.has(request.key)) {
        return Promise.resolve(maskCache.get(request.key) ?? null);
    }

    const pending = pendingMasks.get(request.key);
    if (pending) {
        return pending;
    }

    const imageRequest = loadImageAlphaMask(request).then((mask) => {
        maskCache.set(request.key, mask);
        pendingMasks.delete(request.key);
        return mask;
    });
    pendingMasks.set(request.key, imageRequest);

    return imageRequest;
}

function loadImageAlphaMask(
    request: NormalizedImageAlphaMaskRequest,
): Promise<ImageAlphaMask | null> {
    return new Promise((resolve) => {
        const image = new Image();
        if (isCrossOrigin(request.source)) {
            image.crossOrigin = 'anonymous';
        }
        image.decoding = 'async';
        image.onload = () => resolve(readImageAlphaMask(image, request));
        image.onerror = () => resolve(null);
        image.src = request.source;
    });
}

function readImageAlphaMask(
    image: HTMLImageElement,
    request: NormalizedImageAlphaMaskRequest,
): ImageAlphaMask | null {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return null;
    }

    canvas.width = MASK_RESOLUTION;
    canvas.height = MASK_RESOLUTION;
    const scale =
        request.fit === 'cover'
            ? Math.max(MASK_RESOLUTION / image.naturalWidth, MASK_RESOLUTION / image.naturalHeight)
            : Math.min(MASK_RESOLUTION / image.naturalWidth, MASK_RESOLUTION / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    context.clearRect(0, 0, MASK_RESOLUTION, MASK_RESOLUTION);
    context.drawImage(
        image,
        imagePositionOffset(MASK_RESOLUTION - width, request.position),
        imagePositionOffset(MASK_RESOLUTION - height, request.position, true),
        width,
        height,
    );

    try {
        const pixels = context.getImageData(0, 0, MASK_RESOLUTION, MASK_RESOLUTION).data;
        const opaquePixels = new Uint8Array(MASK_RESOLUTION * MASK_RESOLUTION);
        for (let index = 0; index < opaquePixels.length; index += 1) {
            opaquePixels[index] = pixels[index * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
        }
        return { opaquePixels, resolution: MASK_RESOLUTION };
    } catch {
        return null;
    }
}

function imagePosition(value: string | undefined): NormalizedImageAlphaMaskRequest['position'] {
    return ['top', 'right', 'bottom', 'left'].includes(value ?? '')
        ? (value as NormalizedImageAlphaMaskRequest['position'])
        : 'center';
}

function imagePositionOffset(
    overflow: number,
    position: NormalizedImageAlphaMaskRequest['position'],
    vertical = false,
): number {
    if (position === 'center') {
        return overflow / 2;
    }
    if (vertical) {
        return position === 'top' ? 0 : position === 'bottom' ? overflow : overflow / 2;
    }
    return position === 'left' ? 0 : position === 'right' ? overflow : overflow / 2;
}

function isCrossOrigin(source: string): boolean {
    try {
        return new URL(source, window.location.origin).origin !== window.location.origin;
    } catch {
        return false;
    }
}
