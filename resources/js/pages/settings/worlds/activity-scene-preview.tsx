import type { CSSProperties, ReactNode } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

type AppearanceMode = 'dark' | 'light';

export function ActivityScenePreview({
    backgroundImage,
    children,
    className,
    description,
    title,
}: {
    backgroundImage: string;
    children?: ReactNode;
    className?: string;
    description?: string;
    title: string;
}) {
    return (
        <div className="grid gap-2">
            <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                </p>
                {description ? (
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                ) : null}
            </div>
            <div
                className={cn(
                    'relative isolate aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-inner dark:border-white/10 dark:bg-slate-950',
                    className,
                )}
            >
                {backgroundImage ? (
                    <img
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        draggable={false}
                        src={backgroundImage}
                    />
                ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,145,178,0.14),rgba(15,23,42,0.04)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.16),transparent_34%)] dark:bg-[linear-gradient(135deg,rgba(45,212,191,0.10),rgba(15,23,42,0.86)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.14),transparent_34%)]" />
                )}
                <div className="absolute inset-0 bg-white/62 dark:bg-slate-950/58" />
                {children}
            </div>
        </div>
    );
}

export function ScenePreviewImage({
    imageUrl,
    label,
    x,
    y,
    width,
}: {
    imageUrl: string;
    label: string;
    width: string | number;
    x: string | number;
    y: string | number;
}) {
    const style: CSSProperties = {
        left: `${boundedPercent(x, 50)}%`,
        top: `${boundedPercent(y, 50)}%`,
        width: `${boundedPercent(width, 28, 1)}%`,
    };

    if (!imageUrl) {
        return (
            <div
                className="absolute z-10 grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border border-dashed border-cyan-600/45 bg-cyan-100/45 px-3 text-center text-xs font-semibold text-cyan-800 dark:border-teal-200/35 dark:bg-teal-200/10 dark:text-teal-100"
                style={style}
            >
                {label}
            </div>
        );
    }

    return (
        <img
            alt=""
            className="absolute z-10 max-h-[64%] -translate-x-1/2 -translate-y-1/2 object-contain"
            draggable={false}
            src={imageUrl}
            style={style}
        />
    );
}

export function ScenePreviewBubble({
    borderColor,
    color,
    label,
    opacity,
    text,
}: {
    borderColor: string;
    color: string;
    label: string;
    opacity: string | number;
    text: string;
}) {
    return (
        <div
            className="relative z-20 rounded-2xl border p-3 text-sm leading-5 shadow-sm backdrop-blur-md"
            style={{
                backgroundColor: colorWithOpacity(color, opacity),
                borderColor: borderColor || '#0891b2',
            }}
        >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                {label}
            </p>
            <p className="text-slate-800 dark:text-slate-100">
                {text || 'Preview text appears here.'}
            </p>
        </div>
    );
}

export function ScenePreviewSlot({
    imageUrl,
    label,
    width,
    x,
    y,
}: {
    imageUrl: string;
    label: string;
    width: string | number;
    x: string | number;
    y: string | number;
}) {
    return (
        <div
            className="absolute z-10 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-lg border border-cyan-600/45 bg-cyan-100/30 p-1 backdrop-blur-sm dark:border-teal-200/45 dark:bg-teal-200/10"
            style={{
                left: `${boundedPercent(x, 50)}%`,
                top: `${boundedPercent(y, 50)}%`,
                width: `${boundedPercent(width, 12, 1)}%`,
            }}
        >
            <div className="grid size-full place-items-center rounded bg-white/30 text-center text-[0.65rem] font-semibold text-cyan-800 dark:bg-slate-950/30 dark:text-teal-100">
                {imageUrl ? (
                    <img
                        alt=""
                        className="size-full object-contain"
                        draggable={false}
                        src={imageUrl}
                    />
                ) : (
                    label
                )}
            </div>
        </div>
    );
}

export function themedPreviewAsset(
    darkValue: unknown,
    lightValue: unknown,
    mode: AppearanceMode,
): string {
    const dark = normalizeMediaUrl(stringValue(darkValue));
    const light = normalizeMediaUrl(stringValue(lightValue));

    return mode === 'light' ? light || dark : dark || light;
}

export function boundedPercent(
    value: unknown,
    fallback: number,
    min = 0,
    max = 100,
): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : fallback;

    return Math.min(max, Math.max(min, numeric));
}

export function colorWithOpacity(color: string, opacity: unknown): string {
    const parsedOpacity =
        typeof opacity === 'number' ? opacity : Number(opacity);
    const boundedOpacity = Number.isFinite(parsedOpacity)
        ? Math.min(100, Math.max(0, parsedOpacity))
        : 100;

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return color;
    }

    const alpha = Math.round((boundedOpacity / 100) * 255)
        .toString(16)
        .padStart(2, '0');

    return `${color}${alpha}`;
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}
