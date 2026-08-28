import { useEffect, useState } from 'react';
import type { SVGProps } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import {
    mapAssetImageFit,
    mapAssetImagePosition,
    mapAssetImagePreserveAspectRatio,
} from './map-asset-image';

const MASK_RESOLUTION = 128;
const ALPHA_THRESHOLD = 20;

export type ImageAlphaMask = {
    opaquePixels: Uint8Array;
    path: string;
    resolution: number;
};

const maskCache = new Map<string, ImageAlphaMask | null>();
const pendingMasks = new Map<string, Promise<ImageAlphaMask | null>>();

export type ImageAlphaMaskRequest = {
    imageFit?: string;
    imagePosition?: string;
    imageUrl?: string | null;
};

/**
 * Adds a pointer target that follows the visible pixels of a transparent image.
 * The surrounding element can therefore ignore pointer events without losing
 * keyboard focus or semantic button behavior.
 */
export function ImageAlphaHitArea({
    className,
    hitAreaProps,
    imageFit,
    imageUrl,
    imagePosition,
}: {
    className?: string;
    hitAreaProps?: Omit<SVGProps<SVGPathElement>, 'd' | 'ref'>;
    imageFit?: string;
    imageUrl?: string | null;
    imagePosition?: string;
}) {
    const mask = useImageAlphaMask(imageUrl, imageFit, imagePosition);
    const path = mask?.path;
    const resolution = mask?.resolution ?? 1;

    return (
        <svg
            aria-hidden="true"
            className={cn(
                'absolute inset-0 z-30 size-full overflow-visible',
                className,
            )}
            preserveAspectRatio={mapAssetImagePreserveAspectRatio(
                imageFit,
                imagePosition,
            )}
            viewBox={`0 0 ${resolution} ${resolution}`}
        >
            {path !== undefined ? (
                <path
                    {...hitAreaProps}
                    d={path}
                    fill="transparent"
                    pointerEvents={path ? 'all' : 'none'}
                />
            ) : (
                <rect
                    {...hitAreaProps}
                    fill="transparent"
                    height={resolution}
                    pointerEvents="all"
                    width={resolution}
                />
            )}
        </svg>
    );
}

export function useImageAlphaMask(
    imageUrl?: string | null,
    imageFit?: string,
    imagePosition?: string,
): ImageAlphaMask | null | undefined {
    const request = normalizedImageSource(imageUrl, imageFit, imagePosition);
    const [, setRevision] = useState(0);

    useEffect(() => {
        if (!request || maskCache.has(request.key)) {
            return;
        }

        let active = true;

        void ensureImageAlphaMask(request).then(() => {
            if (active) {
                setRevision((revision) => revision + 1);
            }
        });

        return () => {
            active = false;
        };
        // The normalized key is stable for the image and its framing settings.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request?.key]);

    return request ? maskCache.get(request.key) : null;
}

export function useImageAlphaMasks(
    requests: ImageAlphaMaskRequest[],
): ReadonlyMap<string, ImageAlphaMask | null> {
    const normalizedRequests = requests
        .map((request) =>
            normalizedImageSource(
                request.imageUrl,
                request.imageFit,
                request.imagePosition,
            ),
        )
        .filter((request): request is NormalizedImageAlphaMaskRequest =>
            Boolean(request),
        )
        .filter(
            (request, index, allRequests) =>
                allRequests.findIndex(
                    (candidate) => candidate.key === request.key,
                ) === index,
        );
    const sourceKey = normalizedRequests
        .map((request) => request.key)
        .join('\u001f');
    const [, setRevision] = useState(0);

    useEffect(() => {
        if (!sourceKey) {
            return;
        }

        let active = true;

        void Promise.all(normalizedRequests.map(ensureImageAlphaMask)).then(
            () => {
                if (active) {
                    setRevision((revision) => revision + 1);
                }
            },
        );

        return () => {
            active = false;
        };
        // The serialized request key is the stable dependency for this cache fill.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceKey]);

    return maskCache;
}

export function imageAlphaMaskFor(
    request: ImageAlphaMaskRequest,
    masks: ReadonlyMap<string, ImageAlphaMask | null>,
): ImageAlphaMask | null | undefined {
    const source = normalizedImageSource(
        request.imageUrl,
        request.imageFit,
        request.imagePosition,
    );

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

type NormalizedImageAlphaMaskRequest = {
    fit: 'contain' | 'cover';
    key: string;
    position: 'center' | 'top' | 'right' | 'bottom' | 'left';
    source: string;
};

function normalizedImageSource(
    imageUrl?: string | null,
    imageFit?: string,
    imagePosition?: string,
): NormalizedImageAlphaMaskRequest | null {
    if (!imageUrl) {
        return null;
    }

    const source = normalizeMediaUrl(imageUrl);
    const fit = mapAssetImageFit(imageFit);
    const position = mapAssetImagePosition(imagePosition);

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

    canvas.height = MASK_RESOLUTION;
    canvas.width = MASK_RESOLUTION;

    const scale =
        request.fit === 'cover'
            ? Math.max(
                  MASK_RESOLUTION / image.naturalWidth,
                  MASK_RESOLUTION / image.naturalHeight,
              )
            : Math.min(
                  MASK_RESOLUTION / image.naturalWidth,
                  MASK_RESOLUTION / image.naturalHeight,
              );
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = imagePositionOffset(MASK_RESOLUTION - width, request.position);
    const y = imagePositionOffset(
        MASK_RESOLUTION - height,
        request.position,
        true,
    );

    context.clearRect(0, 0, MASK_RESOLUTION, MASK_RESOLUTION);
    context.drawImage(image, x, y, width, height);

    try {
        const pixels = context.getImageData(
            0,
            0,
            MASK_RESOLUTION,
            MASK_RESOLUTION,
        ).data;
        const opaquePixels = new Uint8Array(MASK_RESOLUTION * MASK_RESOLUTION);

        for (let index = 0; index < opaquePixels.length; index += 1) {
            opaquePixels[index] =
                pixels[index * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
        }

        return {
            opaquePixels,
            path: maskToPath(opaquePixels, MASK_RESOLUTION),
            resolution: MASK_RESOLUTION,
        };
    } catch {
        // A remote server can allow the image but deny canvas pixel access.
        // In that case callers retain the rectangular fallback hit area.
        return null;
    }
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
        return position === 'top'
            ? 0
            : position === 'bottom'
              ? overflow
              : overflow / 2;
    }

    return position === 'left'
        ? 0
        : position === 'right'
          ? overflow
          : overflow / 2;
}

function maskToPath(mask: Uint8Array, resolution: number): string {
    const rows: string[] = [];

    for (let y = 0; y < resolution; y += 1) {
        let x = 0;

        while (x < resolution) {
            while (x < resolution && mask[y * resolution + x] === 0) {
                x += 1;
            }

            const start = x;

            while (x < resolution && mask[y * resolution + x] === 1) {
                x += 1;
            }

            if (x > start) {
                rows.push(`M${start} ${y}h${x - start}v1H${start}z`);
            }
        }
    }

    return rows.join('');
}

function isCrossOrigin(source: string): boolean {
    try {
        return (
            new URL(source, window.location.origin).origin !==
            window.location.origin
        );
    } catch {
        return false;
    }
}
