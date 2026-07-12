import { ArrowRight, Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { setLearningItems } from '@/features/items/item-inventory';
import { useAppearance } from '@/hooks/use-appearance';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type {
    ActivityTransition,
    LearningActivity,
    LearningItem,
} from '@/types';
import { stringConfig, themedConfig } from './activity-utils';
import { postJson } from './api';

type ItemGrantResult = {
    grantedItemIds?: number[];
    success: boolean;
};

type GrantedItemDisplay = {
    imageUrl: string;
    item: LearningItem;
    quantity: number;
};

export function ItemGrantActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const [result, setResult] = useState<ItemGrantResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const rolledActivityId = useRef<number | null>(null);
    const { resolvedAppearance } = useAppearance();

    useEffect(() => {
        if (rolledActivityId.current === activity.id) {
            return;
        }

        rolledActivityId.current = activity.id;

        postJson<{ inventory: LearningItem[]; result: ItemGrantResult }>(
            `/learning/activities/${activity.id}/grant-items`,
            {},
        )
            .then(async (response) => {
                setLearningItems(response.inventory);
                setResult(response.result);

                if (!response.result.success) {
                    await onComplete(activity);
                    onMoveToActivity(transition?.toActivityId ?? null);
                }
            })
            .catch(() => {
                rolledActivityId.current = null;
                setError('The item grant could not be resolved right now.');
            })
            .finally(() => setIsLoading(false));
    }, [activity, onComplete, onMoveToActivity, transition]);

    if (isLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                Rolling for items...
            </div>
        );
    }

    if (error) {
        return (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                {error}
            </p>
        );
    }

    const grantedItems = grantedItemDisplays(activity, resolvedAppearance);
    const backgroundImage = themedConfig(
        activity.config.backgroundDark,
        activity.config.backgroundLight,
        resolvedAppearance,
    );

    return (
        <div className="relative isolate grid min-h-[28rem] flex-1 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/6">
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    draggable={false}
                    src={backgroundImage}
                />
            ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,145,178,0.14),rgba(255,255,255,0.74)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.18),transparent_34%)] dark:bg-[linear-gradient(135deg,rgba(45,212,191,0.10),rgba(15,23,42,0.86)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.14),transparent_34%)]" />
            )}
            <div className="absolute inset-0 bg-white/62 dark:bg-slate-950/58" />

            {result?.success ? (
                <ItemGrantFlightItems items={grantedItems} />
            ) : null}

            <div className="relative z-10 grid max-w-xl gap-5">
                <div className="mx-auto grid size-14 place-items-center rounded-xl bg-cyan-100 text-cyan-700 shadow-sm dark:bg-teal-300/14 dark:text-teal-200">
                    <Package className="size-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold">
                    Items added to inventory
                </h4>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    The configured consumables are now available from the
                    inventory rail.
                </p>
                {grantedItems.length > 0 ? (
                    <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
                        {grantedItems.map((display) => (
                            <GrantedItemTile
                                display={display}
                                key={display.item.id}
                            />
                        ))}
                    </div>
                ) : null}
                <Button
                    className="mx-auto mt-2"
                    onClick={() => {
                        void onComplete(activity).then(() =>
                            onMoveToActivity(transition?.toActivityId ?? null),
                        );
                    }}
                    type="button"
                >
                    Continue
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
}

function GrantedItemTile({ display }: { display: GrantedItemDisplay }) {
    return (
        <div className="relative grid aspect-square place-items-center rounded-xl border border-slate-200 bg-white/88 p-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/82">
            {display.imageUrl ? (
                <img
                    alt=""
                    className="size-full object-contain"
                    draggable={false}
                    src={display.imageUrl}
                />
            ) : (
                <Package className="size-8 text-cyan-700 dark:text-teal-200" />
            )}
            <span className="absolute right-1 bottom-1 min-w-5 rounded bg-slate-950/82 px-1 text-center text-[0.65rem] font-semibold text-white dark:bg-teal-300 dark:text-slate-950">
                {display.quantity}
            </span>
            <span className="sr-only">{display.item.title}</span>
        </div>
    );
}

function ItemGrantFlightItems({ items }: { items: GrantedItemDisplay[] }) {
    return (
        <div className="pointer-events-none fixed inset-0 z-40">
            {items.slice(0, 9).map((display, index) => (
                <div
                    className={cn(
                        'animate-item-grant-fly absolute left-1/2 top-1/2 grid size-16 place-items-center rounded-xl border border-cyan-500/30 bg-white/90 p-2 shadow-lg dark:border-teal-200/30 dark:bg-slate-950/90',
                    )}
                    key={display.item.id}
                    style={{
                        animationDelay: `${index * 120}ms`,
                        marginLeft: `${(index % 3 - 1) * 74}px`,
                        marginTop: `${(Math.floor(index / 3) - 1) * 74}px`,
                    }}
                >
                    {display.imageUrl ? (
                        <img
                            alt=""
                            className="size-full object-contain"
                            draggable={false}
                            src={display.imageUrl}
                        />
                    ) : (
                        <Package className="size-8 text-cyan-700 dark:text-teal-200" />
                    )}
                </div>
            ))}
        </div>
    );
}

function grantedItemDisplays(
    activity: LearningActivity,
    mode: 'dark' | 'light',
): GrantedItemDisplay[] {
    const configuredItems = Array.isArray(activity.config.items)
        ? activity.config.items
        : [];

    return configuredItems
        .map((config) => {
            const configuredItem = configuredItemConfig(config);

            if (!configuredItem) {
                return null;
            }

            const item = activity.configuredItems.find(
                (candidate) => candidate.id === configuredItem.itemId,
            );

            if (!item) {
                return null;
            }

            return {
                imageUrl: normalizeMediaUrl(
                    mode === 'light'
                        ? stringConfig(item.imageLight) ||
                              stringConfig(item.imageDark)
                        : stringConfig(item.imageDark) ||
                              stringConfig(item.imageLight),
                ),
                item,
                quantity: configuredItem.quantity,
            };
        })
        .filter((display): display is GrantedItemDisplay => display !== null);
}

function configuredItemConfig(
    value: unknown,
): { itemId: number; quantity: number } | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const rawItemId = (value as { itemId?: unknown }).itemId;
    const rawQuantity = (value as { quantity?: unknown }).quantity;
    const itemId = typeof rawItemId === 'number' ? rawItemId : Number(rawItemId);
    const quantity =
        typeof rawQuantity === 'number' ? rawQuantity : Number(rawQuantity);

    if (!Number.isInteger(itemId) || !Number.isInteger(quantity)) {
        return null;
    }

    return {
        itemId,
        quantity: Math.max(1, quantity),
    };
}
