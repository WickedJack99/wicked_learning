import { ArrowRight, Map as MapIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerPortalTravelResult =
    components['schemas']['LearnerPortalTravelResult'];

/**
 * Lifted from `features/world/standard-activities.tsx` and
 * `features/world/portal-scene.tsx`. Its only transport change is that the
 * travel target comes from the server-owned portal command, never a client
 * route assembled from a link payload.
 */
export function OriginalPortalActivity({
    activity,
    appearance,
    onComplete,
    onTravel,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
    onTravel: (result: LearnerPortalTravelResult) => void;
    playRunId: string;
}) {
    const [isTravelling, setIsTravelling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const skippedArrival = useRef<string | null>(null);
    const config = activity.config;
    const destination = activity.portal?.destination ?? null;
    const isInputPortal = stringConfig(config.portalMode, 'output') === 'input';
    const backgroundImage = themedAsset(
        nullableString(config.portalBackgroundDark),
        nullableString(config.portalBackgroundLight),
        appearance,
    );
    const foregroundImage = themedAsset(
        nullableString(config.portalForegroundDark),
        nullableString(config.portalForegroundLight),
        appearance,
    );
    const showOnArrival = booleanConfig(config.portalShowOnArrival, true);
    const bubbleText = stringConfig(config.portalBubbleText).trim();

    useEffect(() => {
        if (!isInputPortal || showOnArrival || skippedArrival.current === activity.slug) {
            return;
        }
        skippedArrival.current = activity.slug;
        void onComplete().catch(() => {
            skippedArrival.current = null;
        });
    }, [activity.slug, isInputPortal, onComplete, showOnArrival]);

    const travel = useCallback(async () => {
        if (isTravelling || !destination) return;
        if (destination.node_state !== 'available') {
            setError(
                destination.node_state === 'locked'
                    ? `${destination.node_title} is still locked.`
                    : `${destination.node_title} has not been discovered yet.`,
            );
            return;
        }
        setIsTravelling(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/portal/travel',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activity.slug, play_run_id: playRunId },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('portal travel failed');
            onTravel(data);
        } catch {
            setError('This portal is no longer available. Return to the map and try again.');
            setIsTravelling(false);
        }
    }, [activity.slug, destination, isTravelling, onTravel, playRunId]);

    if (isInputPortal && !showOnArrival) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                Continuing from this exit portal…
            </div>
        );
    }

    const heading = isInputPortal
        ? 'Exit portal'
        : destination?.label ?? 'Portal not linked yet';
    const description = isInputPortal
        ? 'This portal is configured as the exit point for paths that arrive here.'
        : destination
          ? `Travel to ${destination.map_title} / ${destination.node_title}.`
          : 'An admin can choose a target exit portal in this portal activity.';

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <PortalScene
                assets={portalSceneAssets(config.portalAssets, appearance)}
                backgroundImage={backgroundImage}
                backgroundMirrored={booleanConfig(config.portalBackgroundMirrored, false)}
                className="max-h-full"
                foregroundImage={foregroundImage}
                foregroundMirrored={booleanConfig(config.portalForegroundMirrored, false)}
                foregroundWidth={numberConfig(config.portalForegroundWidth, 28)}
                foregroundX={numberConfig(config.portalForegroundX, 50)}
                foregroundY={numberConfig(config.portalForegroundY, 50)}
                swirlEnabled={booleanConfig(config.portalSwirlEnabled, true)}
            >
                <div className="relative z-20 mt-auto grid w-full gap-3 bg-white/82 p-4 backdrop-blur dark:bg-slate-950/72">
                    {bubbleText ? (
                        <div className="rounded-lg border p-4 text-sm leading-6" style={portalBubbleStyle(config, appearance)}>
                            <TypingText speed={numberConfig(config.portalBubbleTypingSpeed, 24)} text={bubbleText} />
                        </div>
                    ) : null}
                    <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/14 dark:text-teal-200"><MapIcon className="size-4" /></span>
                        <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{heading}</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
                            {destination?.description ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{destination.description}</p> : null}
                            {error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-200" role="alert">{error}</p> : null}
                            <button className="mt-4 inline-flex items-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950 dark:hover:bg-teal-100" disabled={isTravelling || (!isInputPortal && !destination)} onClick={() => {
                                if (isInputPortal) {
                                    setIsTravelling(true);
                                    void onComplete().catch(() => setIsTravelling(false));
                                    return;
                                }
                                void travel();
                            }} type="button">
                                {isInputPortal ? 'Continue' : 'Traverse'}<ArrowRight className="ml-2 size-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </PortalScene>
        </div>
    );
}

type PortalAsset = { id: string; image: string; layer: 'behind-background' | 'above-background' | 'above-foreground' | 'front'; mirrored: boolean; opacity: number; width: number; x: number; y: number };

function PortalScene({ assets, backgroundImage, backgroundMirrored, children, className, foregroundImage, foregroundMirrored, foregroundWidth, foregroundX, foregroundY, swirlEnabled }: { assets: PortalAsset[]; backgroundImage: string; backgroundMirrored: boolean; children: ReactNode; className: string; foregroundImage: string; foregroundMirrored: boolean; foregroundWidth: number; foregroundX: number; foregroundY: number; swirlEnabled: boolean }) {
    const layers = (layer: PortalAsset['layer'], zIndex: number) => assets.filter((asset) => asset.layer === layer).map((asset) => <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" key={asset.id} style={{ left: `${boundedNumber(asset.x, 50, 0, 100)}%`, opacity: boundedNumber(asset.opacity, 100, 0, 100) / 100, top: `${boundedNumber(asset.y, 50, 0, 100)}%`, width: `${boundedNumber(asset.width, 28, 1, 160)}%`, zIndex }}><img alt="" className="w-full object-contain" decoding="async" src={asset.image} style={{ transform: asset.mirrored ? 'scaleX(-1)' : undefined }} /></span>);
    const foregroundStyle = { left: `${boundedNumber(foregroundX, 50, 0, 100)}%`, top: `${boundedNumber(foregroundY, 50, 0, 100)}%`, width: `${boundedNumber(foregroundWidth, 28, 1, 100)}%` };
    return <div className={`relative isolate flex aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950 ${className}`}>
        {layers('behind-background', 0)}
        {backgroundImage ? <img alt="" className="absolute inset-0 z-[1] size-full object-cover" decoding="async" src={backgroundImage} style={{ transform: backgroundMirrored ? 'scaleX(-1)' : undefined }} /> : <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.28),rgba(15,23,42,0.92))]" />}
        <div className="absolute inset-0 z-[2] bg-white/60 dark:bg-slate-950/50" />
        {layers('above-background', 5)}
        {foregroundImage ? <span className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={foregroundStyle}><span className="block w-full" style={{ transform: foregroundMirrored ? 'scaleX(-1)' : undefined }}><img alt="" className={`w-full object-contain ${swirlEnabled ? 'animate-portal-swirl' : ''}`} decoding="async" src={foregroundImage} /></span></span> : null}
        {layers('above-foreground', 15)}{layers('front', 20)}{children}
    </div>;
}

function TypingText({ speed, text }: { speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');
    useEffect(() => {
        let index = 0;
        const timer = window.setInterval(() => { index += 1; setVisibleText(text.slice(0, index)); if (index >= text.length) window.clearInterval(timer); }, Math.max(1, speed));
        return () => window.clearInterval(timer);
    }, [speed, text]);
    return <p className="min-h-12 text-sm leading-6">{visibleText}</p>;
}

function portalSceneAssets(value: unknown, appearance: OriginalAppearance): PortalAsset[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((value, index) => {
        if (!isRecord(value)) return [];
        const image = themedAsset(nullableString(value.imageDark), nullableString(value.imageLight), appearance);
        if (!image) return [];
        const layer = stringConfig(value.layer, 'above-background');
        return [{ id: stringConfig(value.id, `portal-asset-${index + 1}`), image, layer: isPortalLayer(layer) ? layer : 'above-background', mirrored: booleanConfig(value.mirrored, false), opacity: numberConfig(value.opacity, 100), width: numberConfig(value.width, 28), x: numberConfig(value.x, 50), y: numberConfig(value.y, 50) }];
    });
}

function portalBubbleStyle(config: Record<string, unknown>, appearance: OriginalAppearance): CSSProperties {
    const light = appearance === 'light';
    return { backgroundColor: stringConfig(light ? config.portalBubbleColorLight : config.portalBubbleColorDark, light ? '#ffffff' : '#0f172a'), borderColor: stringConfig(light ? config.portalBubbleBorderColorLight : config.portalBubbleBorderColorDark, light ? '#0891b2' : '#2dd4bf'), color: stringConfig(light ? config.portalBubbleTextColorLight : config.portalBubbleTextColorDark, light ? '#0f172a' : '#f8fafc') };
}

function themedAsset(dark: string | null, light: string | null, appearance: OriginalAppearance): string { return appearance === 'light' ? light || dark || '' : dark || light || ''; }
function nullableString(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function stringConfig(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function booleanConfig(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }
function numberConfig(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
function boundedNumber(value: number, fallback: number, min: number, max: number): number { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback)); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isPortalLayer(value: string): value is PortalAsset['layer'] { return value === 'behind-background' || value === 'above-background' || value === 'above-foreground' || value === 'front'; }
