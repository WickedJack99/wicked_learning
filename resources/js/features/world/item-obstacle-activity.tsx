import { ArrowRight, Lock, Package } from 'lucide-react';
import type { CSSProperties, DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { setLearningItems } from '@/features/items/item-inventory';
import { useLayeredSoundPlayer } from '@/features/sounds/sound-player';
import { useAppearance } from '@/hooks/use-appearance';
import type {
    ActivityTransition,
    LearningActivity,
    LearningItem,
    LearningProgress,
} from '@/types';
import { numericConfig, themedConfig } from './activity-utils';
import { postJson } from './api';

type ItemObstacleState = {
    canContinue?: boolean;
    conditionsMet: boolean;
    filledSlots: Record<string, { itemId: number; filledAt: string }>;
    lockedUntil?: string | null;
};

export function ItemObstacleActivity({
    activity,
    onComplete,
    onMoveToActivity,
    progress,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    progress?: LearningProgress['activities'][number];
    transition: ActivityTransition | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const soundPlayer = useLayeredSoundPlayer();
    const [state, setState] = useState<ItemObstacleState>(() =>
        initialState(progress),
    );
    const previousConditionsMet = useRef(state.conditionsMet);
    const [error, setError] = useState('');
    const slots = configuredSlots(activity);
    const configuredItemsById = useMemo(
        () => new Map(activity.configuredItems.map((item) => [item.id, item])),
        [activity.configuredItems],
    );
    const background = themedConfig(
        state.conditionsMet
            ? activity.config.metBackgroundDark ||
                  activity.config.backgroundDark
            : activity.config.backgroundDark,
        state.conditionsMet
            ? activity.config.metBackgroundLight ||
                  activity.config.backgroundLight
            : activity.config.backgroundLight,
        resolvedAppearance,
    );
    const overlay = themedConfig(
        activity.config.overlayDark,
        activity.config.overlayLight,
        resolvedAppearance,
    );
    const lockedUntil = lockedUntilDate(state.lockedUntil);
    const isLocked = Boolean(lockedUntil && lockedUntil > new Date());

    useEffect(() => {
        const wasMet = previousConditionsMet.current;
        previousConditionsMet.current = state.conditionsMet;

        if (!wasMet && state.conditionsMet) {
            playConfiguredSound(activity, soundPlayer.play, 'transition');
            playConfiguredSound(activity, soundPlayer.play, 'met');

            return;
        }

        playConfiguredSound(
            activity,
            soundPlayer.play,
            state.conditionsMet ? 'met' : 'notMet',
        );
    }, [activity, soundPlayer.play, state.conditionsMet]);

    const dropItem = async (event: DragEvent, slotIndex: number) => {
        event.preventDefault();

        if (isLocked) {
            return;
        }

        const itemId = Number(
            event.dataTransfer.getData('application/learning-item-id'),
        );

        if (!itemId) {
            return;
        }

        setError('');

        try {
            const response = await postJson<{
                inventory: LearningItem[];
                state: ItemObstacleState;
            }>(`/learning/activities/${activity.id}/item-obstacle-slot`, {
                item_id: itemId,
                slot_index: slotIndex,
            });

            setLearningItems(response.inventory);
            setState(response.state);
        } catch {
            setError('That item cannot be placed there.');
        }
    };

    const continueActivity = async () => {
        setError('');

        try {
            const response = await postJson<{ state: ItemObstacleState }>(
                `/learning/activities/${activity.id}/item-obstacle-continue`,
                {},
            );

            setState(response.state);

            if (response.state.canContinue) {
                await onComplete(activity);
                onMoveToActivity(transition?.toActivityId ?? null);
            }
        } catch {
            setError('This obstacle cannot continue yet.');
        }
    };

    return (
        <div className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6">
            {background ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    src={background}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />

            {slots.map((slot, index) => (
                <ItemSlot
                    filledItem={filledItemFor(state, index, configuredItemsById)}
                    key={index}
                    mode={resolvedAppearance}
                    onDrop={(event) => void dropItem(event, index)}
                    slot={slot}
                />
            ))}

            {state.conditionsMet && overlay ? (
                <img
                    alt=""
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 object-contain"
                    draggable={false}
                    src={overlay}
                    style={{
                        left: `${numericConfig(activity.config.overlayX, 50)}%`,
                        top: `${numericConfig(activity.config.overlayY, 50)}%`,
                        width: `${numericConfig(activity.config.overlayWidth, 30)}%`,
                    }}
                />
            ) : null}

            <div className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4">
                {isLocked ? (
                    <p className="rounded-lg border border-amber-400/40 bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">
                        <Lock className="mr-2 inline size-4" />
                        Locked until {lockedUntil?.toLocaleString()}.
                    </p>
                ) : null}
                {error ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {error}
                    </p>
                ) : null}
                <Button
                    className="self-end"
                    disabled={isLocked}
                    onClick={() => void continueActivity()}
                    type="button"
                >
                    Continue
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
}

type ItemSlotConfig = {
    itemId: number;
    width: number;
    x: number;
    y: number;
};

function ItemSlot({
    filledItem,
    mode,
    onDrop,
    slot,
}: {
    filledItem: LearningItem | null;
    mode: 'dark' | 'light';
    onDrop: (event: DragEvent) => void;
    slot: ItemSlotConfig;
}) {
    const image =
        filledItem &&
        (mode === 'light'
            ? filledItem.imageLight || filledItem.imageDark
            : filledItem.imageDark || filledItem.imageLight);
    const style: CSSProperties = {
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.width}%`,
    };

    return (
        <div
            className="absolute z-10 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-lg border border-cyan-600/40 bg-cyan-200/16 backdrop-blur-sm dark:border-teal-200/45 dark:bg-teal-200/10"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            style={style}
        >
            <div className="grid size-full place-items-center p-1">
                {image ? (
                    <img
                        alt=""
                        className="size-full object-contain"
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

function configuredSlots(activity: LearningActivity): ItemSlotConfig[] {
    const slots = Array.isArray(activity.config.slots)
        ? activity.config.slots
        : [];

    return slots
        .filter((slot): slot is Record<string, unknown> =>
            Boolean(slot && typeof slot === 'object' && !Array.isArray(slot)),
        )
        .map((slot) => ({
            itemId: numericConfig(slot.itemId, 0),
            width: numericConfig(slot.width, 10),
            x: numericConfig(slot.x, 50),
            y: numericConfig(slot.y, 50),
        }))
        .filter((slot) => slot.itemId > 0);
}

function filledItemFor(
    state: ItemObstacleState,
    slotIndex: number,
    configuredItemsById: Map<number, LearningItem>,
): LearningItem | null {
    const filledSlot = state.filledSlots[String(slotIndex)];

    return filledSlot ? configuredItemsById.get(filledSlot.itemId) ?? null : null;
}

function initialState(
    progress: LearningProgress['activities'][number] | undefined,
): ItemObstacleState {
    const obstacle =
        progress?.metadata &&
        typeof progress.metadata === 'object' &&
        !Array.isArray(progress.metadata)
            ? progress.metadata.itemObstacle
            : null;

    if (obstacle && typeof obstacle === 'object' && !Array.isArray(obstacle)) {
        return obstacle as ItemObstacleState;
    }

    return {
        conditionsMet: false,
        filledSlots: {},
        lockedUntil: null,
    };
}

function lockedUntilDate(value: unknown): Date | null {
    if (typeof value !== 'string' || !value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function playConfiguredSound(
    activity: LearningActivity,
    play: ReturnType<typeof useLayeredSoundPlayer>['play'],
    key: 'met' | 'notMet' | 'transition',
) {
    const sounds: Record<string, unknown> = isRecord(activity.config.sounds)
        ? activity.config.sounds
        : {};
    const soundConfig = isRecord(sounds[key]) ? sounds[key] : {};

    if (!soundConfig.enabled) {
        return;
    }

    const soundId = numericConfig(soundConfig.soundId, 0);
    const sound = activity.configuredSounds.find((candidate) => candidate.id === soundId);

    if (!sound?.url) {
        return;
    }

    play(sound, `item-obstacle-${activity.id}-${key}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
