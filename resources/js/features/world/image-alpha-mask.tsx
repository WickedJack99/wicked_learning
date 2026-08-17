import { useEffect, useState } from 'react';
import type { SVGProps } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

const MASK_RESOLUTION = 128;
const ALPHA_THRESHOLD = 20;

export type ImageAlphaMask = {
    opaquePixels: Uint8Array;
    path: string;
    resolution: number;
};

const maskCache = new Map<string, ImageAlphaMask | null>();
const pendingMasks = new Map<string, Promise<ImageAlphaMask | null>>();

/**
 * Adds a pointer target that follows the visible pixels of a transparent image.
 * The surrounding element can therefore ignore pointer events without losing
 * keyboard focus or semantic button behavior.
 */
export function ImageAlphaHitArea({
    className,
    hitAreaProps,
    imageUrl,
}: {
    className?: string;
    hitAreaProps?: Omit<SVGProps<SVGPathElement>, 'd' | 'ref'>;
    imageUrl?: string | null;
}) {
    const mask = useImageAlphaMask(imageUrl);
    const path = mask?.path;
    const resolution = mask?.resolution ?? 1;

    return (
        <svg
            aria-hidden="true"
            className={cn(
                'absolute inset-0 z-30 size-full overflow-visible',
                className,
            )}
            preserveAspectRatio="xMidYMid meet"
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
): ImageAlphaMask | null | undefined {
    const source = normalizedImageSource(imageUrl);
    const [, setRevision] = useState(0);

    useEffect(() => {
        if (!source || maskCache.has(source)) {
            return;
        }

        let active = true;

        void ensureImageAlphaMask(source).then(() => {
            if (active) {
                setRevision((revision) => revision + 1);
            }
        });

        return () => {
            active = false;
        };
    }, [source]);

    return source ? maskCache.get(source) : null;
}

export function useImageAlphaMasks(
    imageUrls: Array<string | null | undefined>,
): ReadonlyMap<string, ImageAlphaMask | null> {
    const sourceKey = imageUrls
        .map((imageUrl) => normalizedImageSource(imageUrl))
        .filter((source): source is string => Boolean(source))
        .filter((source, index, sources) => sources.indexOf(source) === index)
        .join('\u001f');
    const [, setRevision] = useState(0);

    useEffect(() => {
        if (!sourceKey) {
            return;
        }

        let active = true;

        void Promise.all(
            sourceKey.split('\u001f').map(ensureImageAlphaMask),
        ).then(() => {
            if (active) {
                setRevision((revision) => revision + 1);
            }
        });

        return () => {
            active = false;
        };
    }, [sourceKey]);

    return maskCache;
}

export function imageAlphaMaskFor(
    imageUrl: string | null | undefined,
    masks: ReadonlyMap<string, ImageAlphaMask | null>,
): ImageAlphaMask | null | undefined {
    const source = normalizedImageSource(imageUrl);

    return source ? masks.get(source) : null;
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

function normalizedImageSource(imageUrl?: string | null): string {
    return imageUrl ? normalizeMediaUrl(imageUrl) : '';
}

function ensureImageAlphaMask(source: string): Promise<ImageAlphaMask | null> {
    if (maskCache.has(source)) {
        return Promise.resolve(maskCache.get(source) ?? null);
    }

    const pending = pendingMasks.get(source);

    if (pending) {
        return pending;
    }

    const request = loadImageAlphaMask(source).then((mask) => {
        maskCache.set(source, mask);
        pendingMasks.delete(source);

        return mask;
    });

    pendingMasks.set(source, request);

    return request;
}

function loadImageAlphaMask(source: string): Promise<ImageAlphaMask | null> {
    return new Promise((resolve) => {
        const image = new Image();

        if (isCrossOrigin(source)) {
            image.crossOrigin = 'anonymous';
        }

        image.decoding = 'async';
        image.onload = () => resolve(readImageAlphaMask(image));
        image.onerror = () => resolve(null);
        image.src = source;
    });
}

function readImageAlphaMask(image: HTMLImageElement): ImageAlphaMask | null {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return null;
    }

    canvas.height = MASK_RESOLUTION;
    canvas.width = MASK_RESOLUTION;

    const scale = Math.min(
        MASK_RESOLUTION / image.naturalWidth,
        MASK_RESOLUTION / image.naturalHeight,
    );
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (MASK_RESOLUTION - width) / 2;
    const y = (MASK_RESOLUTION - height) / 2;

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
