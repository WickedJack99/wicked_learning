import { ArrowRight, Lock, Package } from 'lucide-react';
import type { CSSProperties, DragEvent } from 'react';
import { useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerItem = components['schemas']['LearnerItem'];
type LearnerItemObstacleResult =
    components['schemas']['LearnerItemObstacleResult'];
type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];

type ObstacleItem = Pick<
    LearnerItem,
    'image_dark' | 'image_light' | 'slug' | 'title'
>;
type ObstacleSlot = {
    itemId: string;
    slotIndex: number;
    width: number;
    x: number;
    y: number;
};
type ObstacleState = LearnerItemObstacleResult['state'];

/**
 * Source-adapted from `features/world/item-obstacle-activity.tsx`. The
 * React side retains the original inventory drag gesture and scene; Rust owns
 * all item consumption, persisted slots, locks and progression eligibility.
 */
export function OriginalItemObstacleActivity({
    activity,
    appearance,
    inventory,
    onComplete,
    onInventoryChange,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    inventory: LearnerItem[];
    onComplete: () => Promise<void>;
    onInventoryChange: (items: LearnerItem[]) => void;
    playRunId: string;
}) {
    const config = activity.config as Record<string, unknown>;
    const [state, setState] = useState<ObstacleState>(() =>
        initialState(config),
    );
    const [error, setError] = useState('');
    const [continuing, setContinuing] = useState(false);
    const slots = useMemo(() => configuredSlots(config), [activity.slug]);
    const configuredItems = useMemo(
        () => configuredObstacleItems(config),
        [activity.slug],
    );
    const configuredItemsBySlug = useMemo(
        () => new Map(configuredItems.map((item) => [item.slug, item])),
        [configuredItems],
    );
    const background = themedConfig(
        state.conditions_met
            ? (stringConfig(config.metBackgroundDark) ??
                  stringConfig(config.backgroundDark))
            : stringConfig(config.backgroundDark),
        state.conditions_met
            ? (stringConfig(config.metBackgroundLight) ??
                  stringConfig(config.backgroundLight))
            : stringConfig(config.backgroundLight),
        appearance,
    );
    const normalBackgroundMirrored = config.backgroundMirrored === true;
    const hasMetBackground = Boolean(
        themedConfig(
            stringConfig(config.metBackgroundDark),
            stringConfig(config.metBackgroundLight),
            appearance,
        ),
    );
    const backgroundMirrored =
        state.conditions_met && hasMetBackground
            ? config.metBackgroundMirrored === true
            : normalBackgroundMirrored;
    const overlay = themedConfig(
        stringConfig(config.overlayDark),
        stringConfig(config.overlayLight),
        appearance,
    );
    const lockedUntil = lockedUntilDate(state.locked_until);
    const isLocked = Boolean(lockedUntil && lockedUntil > new Date());

    async function dropItem(
        event: DragEvent,
        slotIndex: number,
    ): Promise<void> {
        event.preventDefault();
        if (isLocked) return;

        const itemSlug = event.dataTransfer.getData(
            'application/learning-item-slug',
        );
        if (!itemSlug) return;

        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle-slots/{slot_index}',
                {
                    body: { item_slug: itemSlug },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                            slot_index: slotIndex,
                        },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('placement failed');
            applyResult(data);
        } catch {
            setError('That item cannot be placed there.');
        }
    }

    async function continueActivity(): Promise<void> {
        if (isLocked || continuing) return;
        setContinuing(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/item-obstacle/continue',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('continue failed');
            applyResult(data);
            if (data.state.can_continue) await onComplete();
        } catch {
            setError('This obstacle cannot continue yet.');
        } finally {
            setContinuing(false);
        }
    }

    function applyResult(result: LearnerItemObstacleResult): void {
        onInventoryChange(result.inventory);
        setState(result.state);
    }

    return (
        <div className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6">
            {background ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    src={background}
                    style={{
                        transform: backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />

            {slots.map((slot) => (
                <ItemSlot
                    filledItem={filledItemFor(
                        state,
                        slot.slotIndex,
                        configuredItemsBySlug,
                    )}
                    key={slot.slotIndex}
                    mode={appearance}
                    onDrop={(event) => void dropItem(event, slot.slotIndex)}
                    slot={slot}
                />
            ))}

            {state.conditions_met && overlay ? (
                <img
                    alt=""
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 object-contain"
                    decoding="async"
                    draggable={false}
                    src={overlay}
                    style={{
                        left: `${numberConfig(config.overlayX, 50)}%`,
                        top: `${numberConfig(config.overlayY, 50)}%`,
                        transform:
                            config.overlayMirrored === true
                                ? 'translate(-50%, -50%) scaleX(-1)'
                                : undefined,
                        width: `${numberConfig(config.overlayWidth, 30)}%`,
                    }}
                />
            ) : null}

            <div className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4">
                {isLocked ? (
                    <p className="rounded-lg border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        <Lock className="mr-2 inline size-4" />
                        {`Locked until ${lockedUntil?.toLocaleString() ?? ''}.`}
                    </p>
                ) : null}
                {error ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {error}
                    </p>
                ) : null}
                <button
                    className="inline-flex h-9 items-center justify-center self-end rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    disabled={isLocked || continuing}
                    onClick={() => void continueActivity()}
                    type="button"
                >
                    {activity.completion.label?.trim() || 'Continue'}
                    <ArrowRight className="ml-2 size-4" />
                </button>
            </div>
        </div>
    );
}

function ItemSlot({
    filledItem,
    mode,
    onDrop,
    slot,
}: {
    filledItem: ObstacleItem | null;
    mode: OriginalAppearance;
    onDrop: (event: DragEvent) => void;
    slot: ObstacleSlot;
}) {
    const image = filledItem
        ? themedConfig(filledItem.image_dark, filledItem.image_light, mode)
        : null;
    const style: CSSProperties = {
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.width}%`,
    };

    return (
        <div
            className="absolute z-10 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-lg border border-cyan-600/40 bg-cyan-200/16 backdrop-blur-sm dark:border-teal-200/45 dark:bg-teal-200/10"
            data-wl-id={`learner.activity.item-obstacle.slot.${slot.slotIndex}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            style={style}
        >
            <div className="grid size-full place-items-center p-1">
                {image ? (
                    <img
                        alt=""
                        className="size-full object-contain"
                        decoding="async"
                        draggable={false}
                        src={image}
                    />
                ) : (
                    <Package className="size-6 text-cyan-700/70 dark:text-teal-200/70" />
                )}
            </div>
        </div>
    );
}

function configuredSlots(config: Record<string, unknown>): ObstacleSlot[] {
    return Array.isArray(config.slots)
        ? config.slots.filter(isObstacleSlot)
        : [];
}

function isObstacleSlot(value: unknown): value is ObstacleSlot {
    return Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as ObstacleSlot).itemId === 'string' &&
        typeof (value as ObstacleSlot).slotIndex === 'number' &&
        typeof (value as ObstacleSlot).width === 'number' &&
        typeof (value as ObstacleSlot).x === 'number' &&
        typeof (value as ObstacleSlot).y === 'number',
    );
}

function configuredObstacleItems(
    config: Record<string, unknown>,
): ObstacleItem[] {
    if (!Array.isArray(config.configuredItems)) return [];
    return config.configuredItems.filter((value): value is ObstacleItem =>
        Boolean(
            value &&
            typeof value === 'object' &&
            typeof (value as ObstacleItem).slug === 'string' &&
            typeof (value as ObstacleItem).title === 'string',
        ),
    );
}

function initialState(config: Record<string, unknown>): ObstacleState {
    const state = config.state;
    if (
        state &&
        typeof state === 'object' &&
        Array.isArray((state as ObstacleState).filled_slots) &&
        typeof (state as ObstacleState).conditions_met === 'boolean'
    ) {
        return state as ObstacleState;
    }
    return {
        can_continue: null,
        conditions_met: false,
        filled_slots: [],
        locked_until: null,
    };
}

function filledItemFor(
    state: ObstacleState,
    slotIndex: number,
    configuredItems: Map<string, ObstacleItem>,
): ObstacleItem | null {
    const filledSlot = state.filled_slots.find(
        (slot) => slot.slot_index === slotIndex,
    );
    return filledSlot
        ? (configuredItems.get(filledSlot.item_slug) ?? null)
        : null;
}

function themedConfig(
    dark: string | null | undefined,
    light: string | null | undefined,
    mode: OriginalAppearance,
): string | null {
    return mode === 'light' ? light || dark || null : dark || light || null;
}

function stringConfig(value: unknown): string | null {
    return typeof value === 'string' && value ? value : null;
}

function numberConfig(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}

function lockedUntilDate(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
