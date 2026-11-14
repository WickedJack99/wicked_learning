import { ArrowRight, Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerItemGrantDisplay = components['schemas']['LearnerItemGrantDisplay'];
type LearnerItemGrantResult = components['schemas']['LearnerItemGrantResult'];
type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];

/**
 * Lifted from `resources/js/features/world/item-grant-activity.tsx`. The
 * source layout and outcome flow are retained while Rust owns the active run,
 * probability roll, holding mutation and retry result.
 */
export function OriginalItemGrantActivity({
    activity,
    appearance,
    onComplete,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
    playRunId: string;
}) {
    const [result, setResult] = useState<LearnerItemGrantResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const rolledGrantKey = useRef<string | null>(null);
    const config = itemGrantConfig(activity.config);
    const t = usePlatformTranslation();

    useEffect(() => {
        const grantKey = `${activity.slug}:${playRunId}`;
        if (rolledGrantKey.current === grantKey) return;

        rolledGrantKey.current = grantKey;
        setIsLoading(true);
        setResult(null);
        setError(false);

        async function roll(): Promise<void> {
            try {
                const token = await getCsrfToken();
                const { data, response } = await apiClient.POST(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-items',
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
                if (!response.ok || !data) {
                    throw new Error('Item grant is unavailable.');
                }
                setResult(data);
                if (!data.success) await onComplete();
            } catch {
                rolledGrantKey.current = null;
                setError(true);
            } finally {
                setIsLoading(false);
            }
        }

        void roll();
    }, [activity.slug, onComplete, playRunId]);

    if (isLoading) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                {t('activities.item_grant.loading', 'Rolling for items...')}
            </div>
        );
    }

    if (error) {
        return (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                {t(
                    'activities.item_grant.error',
                    'The item grant could not be resolved right now.',
                )}
            </p>
        );
    }

    const backgroundImage = themedAsset(
        config.backgroundDark,
        config.backgroundLight,
        appearance,
    );
    const grantedItems = result?.items ?? [];

    return (
        <div className="relative isolate grid min-h-[28rem] flex-1 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/6">
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    draggable={false}
                    src={backgroundImage}
                    style={{
                        transform: config.backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,145,178,0.14),rgba(255,255,255,0.74)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.18),transparent_34%)] dark:bg-[linear-gradient(135deg,rgba(45,212,191,0.10),rgba(15,23,42,0.86)),radial-gradient(circle_at_70%_30%,rgba(45,212,191,0.14),transparent_34%)]" />
            )}
            <div className="absolute inset-0 bg-white/62 dark:bg-slate-950/58" />

            {result?.success ? (
                <ItemGrantFlightItems appearance={appearance} items={grantedItems} />
            ) : null}

            <div className="relative z-10 grid max-w-xl place-items-center gap-5">
                <h4 className="text-lg font-semibold">
                    {t('activities.item_grant.received', 'Item received:')}
                </h4>
                {grantedItems.length > 0 ? (
                    <div
                        className="mx-auto inline-grid justify-center gap-3"
                        style={itemGrantGridStyle(grantedItems.length)}
                    >
                        {grantedItems.map((item, index) => (
                            <GrantedItemTile
                                appearance={appearance}
                                item={item}
                                key={`${item.slug}-${index}`}
                            />
                        ))}
                    </div>
                ) : null}
                <button
                    className="mx-auto mt-2 inline-flex h-10 items-center justify-center rounded-md bg-[var(--learner-action-accent)] px-4 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                    onClick={() => void onComplete()}
                    type="button"
                >
                    {t('common.continue', 'Continue')}
                    <ArrowRight className="ml-2 size-4" />
                </button>
            </div>
        </div>
    );
}

function itemGrantGridStyle(itemCount: number): CSSProperties {
    const columns = Math.max(1, Math.min(itemCount, 3));
    return { gridTemplateColumns: `repeat(${columns}, minmax(0, 5rem))` };
}

function GrantedItemTile({
    appearance,
    item,
}: {
    appearance: OriginalAppearance;
    item: LearnerItemGrantDisplay;
}) {
    const imageUrl = themedAsset(item.image_dark, item.image_light, appearance);
    return (
        <div className="relative grid aspect-square place-items-center rounded-xl border border-slate-200 bg-white/88 p-2 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/82">
            {imageUrl ? (
                <img
                    alt=""
                    className="size-full object-contain"
                    decoding="async"
                    draggable={false}
                    src={imageUrl}
                />
            ) : (
                <Package className="size-8 text-cyan-700 dark:text-teal-200" />
            )}
            <span className="absolute right-1 bottom-1 min-w-5 rounded bg-slate-950/82 px-1 text-center text-xs font-semibold text-white dark:bg-teal-300 dark:text-slate-950">
                {item.quantity}
            </span>
            <span className="sr-only">{item.title}</span>
        </div>
    );
}

function ItemGrantFlightItems({
    appearance,
    items,
}: {
    appearance: OriginalAppearance;
    items: LearnerItemGrantDisplay[];
}) {
    return (
        <div className="pointer-events-none fixed inset-0 z-40">
            {items.slice(0, 9).map((item, index) => (
                <div
                    className="animate-item-grant-fly absolute top-1/2 left-1/2 grid size-16 place-items-center rounded-xl border border-cyan-500/30 bg-white/90 p-2 shadow-lg dark:border-teal-200/30 dark:bg-slate-950/90"
                    key={`${item.slug}-${index}`}
                    style={{
                        animationDelay: `${index * 120}ms`,
                        marginLeft: `${((index % 3) - 1) * 74}px`,
                        marginTop: `${(Math.floor(index / 3) - 1) * 74}px`,
                    }}
                >
                    {themedAsset(item.image_dark, item.image_light, appearance) ? (
                        <img
                            alt=""
                            className="size-full object-contain"
                            decoding="async"
                            draggable={false}
                            src={themedAsset(
                                item.image_dark,
                                item.image_light,
                                appearance,
                            )}
                        />
                    ) : (
                        <Package className="size-8 text-cyan-700 dark:text-teal-200" />
                    )}
                </div>
            ))}
        </div>
    );
}

function itemGrantConfig(value: Record<string, unknown>): {
    backgroundDark: string | null;
    backgroundLight: string | null;
    backgroundMirrored: boolean;
} {
    return {
        backgroundDark: stringOrNull(value.backgroundDark),
        backgroundLight: stringOrNull(value.backgroundLight),
        backgroundMirrored: value.backgroundMirrored === true,
    };
}

function themedAsset(
    dark: string | null,
    light: string | null,
    appearance: OriginalAppearance,
): string {
    return appearance === 'light' ? light || dark || '' : dark || light || '';
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
