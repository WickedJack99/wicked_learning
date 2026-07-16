import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PortalSceneAssetLayer =
    | 'behind-background'
    | 'above-background'
    | 'above-foreground'
    | 'front';

export type PortalSceneAsset = {
    id: string;
    image: string;
    layer: PortalSceneAssetLayer;
    mirrored: boolean;
    opacity: number;
    width: number;
    x: number;
    y: number;
};

export function PortalScene({
    assets = [],
    backgroundImage,
    backgroundMirrored = false,
    children,
    className,
    foregroundImage,
    foregroundMirrored = false,
    foregroundWidth,
    foregroundX,
    foregroundY,
    showForegroundPlaceholder = false,
    swirlEnabled,
}: {
    assets?: PortalSceneAsset[];
    backgroundImage: string;
    backgroundMirrored?: boolean;
    children?: ReactNode;
    className?: string;
    foregroundImage: string;
    foregroundMirrored?: boolean;
    foregroundWidth: number;
    foregroundX: number;
    foregroundY: number;
    showForegroundPlaceholder?: boolean;
    swirlEnabled: boolean;
}) {
    const foregroundStyle = {
        left: `${boundedNumber(foregroundX, 50, 0, 100)}%`,
        top: `${boundedNumber(foregroundY, 50, 0, 100)}%`,
        width: `${boundedNumber(foregroundWidth, 28, 1, 100)}%`,
    };
    const assetsBehindBackground = assets.filter(
        (asset) => asset.layer === 'behind-background',
    );
    const assetsAboveBackground = assets.filter(
        (asset) => asset.layer === 'above-background',
    );
    const assetsAboveForeground = assets.filter(
        (asset) => asset.layer === 'above-foreground',
    );
    const assetsFront = assets.filter((asset) => asset.layer === 'front');

    return (
        <div
            className={cn(
                'relative isolate flex aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950',
                className,
            )}
        >
            {assetsBehindBackground.map((asset) => (
                <PortalSceneAssetImage
                    asset={asset}
                    key={asset.id}
                    zIndex={0}
                />
            ))}
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 z-[1] size-full object-cover"
                    src={backgroundImage}
                    style={{
                        transform: backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : (
                <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.28),rgba(15,23,42,0.92))]" />
            )}
            <div className="absolute inset-0 z-[2] bg-white/60 dark:bg-slate-950/50" />
            {assetsAboveBackground.map((asset) => (
                <PortalSceneAssetImage
                    asset={asset}
                    key={asset.id}
                    zIndex={5}
                />
            ))}
            {foregroundImage ? (
                <span
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={foregroundStyle}
                >
                    <span
                        className="block w-full"
                        style={{
                            transform: foregroundMirrored
                                ? 'scaleX(-1)'
                                : undefined,
                        }}
                    >
                        <img
                            alt=""
                            className={cn(
                                'w-full object-contain',
                                swirlEnabled && 'animate-portal-swirl',
                            )}
                            src={foregroundImage}
                        />
                    </span>
                </span>
            ) : showForegroundPlaceholder ? (
                <div
                    className="absolute z-10 grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-300/70 bg-cyan-400/20 text-xs font-semibold text-cyan-900 dark:border-teal-200/50 dark:bg-teal-300/12 dark:text-teal-100"
                    style={foregroundStyle}
                >
                    Swirl
                </div>
            ) : null}
            {assetsAboveForeground.map((asset) => (
                <PortalSceneAssetImage
                    asset={asset}
                    key={asset.id}
                    zIndex={15}
                />
            ))}
            {assetsFront.map((asset) => (
                <PortalSceneAssetImage
                    asset={asset}
                    key={asset.id}
                    zIndex={20}
                />
            ))}
            {children}
        </div>
    );
}

function PortalSceneAssetImage({
    asset,
    zIndex,
}: {
    asset: PortalSceneAsset;
    zIndex: number;
}) {
    if (!asset.image) {
        return null;
    }

    return (
        <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
                left: `${boundedNumber(asset.x, 50, 0, 100)}%`,
                opacity: boundedNumber(asset.opacity, 100, 0, 100) / 100,
                top: `${boundedNumber(asset.y, 50, 0, 100)}%`,
                width: `${boundedNumber(asset.width, 28, 1, 160)}%`,
                zIndex,
            }}
        >
            <img
                alt=""
                className="w-full object-contain"
                src={asset.image}
                style={{
                    transform: asset.mirrored ? 'scaleX(-1)' : undefined,
                }}
            />
        </span>
    );
}

function boundedNumber(
    value: number,
    fallback: number,
    min: number,
    max: number,
): number {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, value));
}
