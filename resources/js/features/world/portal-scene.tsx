import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PortalScene({
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

    return (
        <div
            className={cn(
                'relative isolate flex aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950',
                className,
            )}
        >
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    src={backgroundImage}
                    style={{
                        transform: backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.28),rgba(15,23,42,0.92))]" />
            )}
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/50" />
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
                    Foreground
                </div>
            ) : null}
            {children}
        </div>
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
