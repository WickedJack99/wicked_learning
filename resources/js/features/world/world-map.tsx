import {
    BookOpen,
    LockKeyhole,
    Map as MapIcon,
    Orbit,
    RadioTower,
} from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType, PointerEvent } from 'react';
import { useLayeredSoundPlayer } from '@/features/sounds/sound-player';
import type { PlayableSound } from '@/features/sounds/sound-player';
import {
    toolAnimationUrl,
    toolAnimationWidthPercent,
    toolAnimationWidthStyle,
} from '@/features/tools/tool-visuals';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import type {
    LearningMap,
    MapVisualAsset,
    LearningNode,
    LearningProgress,
    LearningTool,
} from '@/types';
import { HEX_TILE_CLIP_PATH, resolveThemeVariant, withOpacity } from './theme';
import type { ResolvedAppearance, TileStyle } from './types';

const nodeIcons: Record<string, ElementType> = {
    bookOpen: BookOpen,
    lockKeyhole: LockKeyhole,
    orbit: Orbit,
    radioTower: RadioTower,
};

export function WorldMap({
    activityProgress,
    allowLockedSelection = false,
    map,
    mode,
    onClearFocus,
    onClearEquippedTool,
    onSelectNode,
    onUseToolOnNode,
    selectedNode,
    selectedTool,
}: {
    activityProgress: LearningProgress['activities'];
    allowLockedSelection?: boolean;
    map: LearningMap;
    mode: ResolvedAppearance;
    onClearFocus: () => void;
    onSelectNode: (node: LearningNode) => void;
    onClearEquippedTool?: () => void;
    onUseToolOnNode: (node: LearningNode) => Promise<void> | void;
    selectedNode: LearningNode | null;
    selectedTool: LearningTool | null;
}) {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [toolAnimation, setToolAnimation] = useState<ToolUseAnimation | null>(
        null,
    );
    const [drag, setDrag] = useState<{
        hasMoved: boolean;
        pointerId: number;
        startedNodeId: number | null;
        startedOnTile: boolean;
        startX: number;
        startY: number;
        x: number;
        y: number;
    } | null>(null);
    const suppressTileClick = useRef(false);
    const soundPlayer = useLayeredSoundPlayer();
    const tileWidth = map.gridConfig.tileWidth ?? 132;
    const tileHeight = map.gridConfig.tileHeight ?? 116;
    const gap = map.gridConfig.gap ?? 12;
    const gapScale = (tileHeight + gap) / tileHeight;
    const horizontalStep = tileWidth * 0.75 * gapScale;
    const tilePositions = useMemo(
        () =>
            map.nodes.map((node) => ({
                node,
                x: node.position.q * horizontalStep,
                y:
                    (node.position.r * tileHeight +
                        node.position.q * (tileHeight / 2)) *
                    gapScale,
            })),
        [gapScale, horizontalStep, map.nodes, tileHeight],
    );
    const minimumX = Math.min(...tilePositions.map((tile) => tile.x));
    const minimumY = Math.min(...tilePositions.map((tile) => tile.y));
    const maximumX = Math.max(...tilePositions.map((tile) => tile.x));
    const maximumY = Math.max(...tilePositions.map((tile) => tile.y));
    const stagePadding = Math.max(gap * 2, 24);
    const stageWidth = maximumX - minimumX + tileWidth + stagePadding * 2;
    const stageHeight = maximumY - minimumY + tileHeight + stagePadding * 2;
    const tileLayouts = useMemo(
        () =>
            tilePositions.map(({ node, x, y }) => ({
                node,
                style: {
                    left: x - minimumX + stagePadding,
                    top: y - minimumY + stagePadding,
                    width: tileWidth,
                    height: tileHeight,
                },
            })),
        [
            minimumX,
            minimumY,
            stagePadding,
            tileHeight,
            tilePositions,
            tileWidth,
        ],
    );
    const mapTheme = resolveThemeVariant(map.backgroundConfig, mode);
    const completedDimOpacity = percentConfig(
        mapTheme.completedDimOpacity,
        mode === 'light' ? 12 : 18,
    );
    const mapCursor = selectedTool
        ? 'var(--platform-cursor)'
        : drag
          ? 'var(--platform-grab-cursor)'
          : 'var(--platform-cursor)';

    const handleSelectedToolAtPointer = (
        event: PointerEvent<HTMLDivElement>,
        node: LearningNode | null,
    ) => {
        if (!selectedTool) {
            return false;
        }

        const animation = toolUseAnimationFor(selectedTool, mode, event);

        showToolAnimation(animation, setToolAnimation);
        onClearEquippedTool?.();

        if (node && canUseToolOnNode(node, selectedTool)) {
            void wait(animation.durationMs).then(() => onUseToolOnNode(node));
        }

        return true;
    };

    return (
        <div
            className="relative h-full min-h-[56vh] touch-none overflow-hidden select-none"
            data-map-appearance={mode}
            data-draggable-surface="true"
            data-dragging={drag?.hasMoved ? 'true' : undefined}
            onPointerDown={(event) => {
                if (event.button !== 0) {
                    return;
                }

                const startedOnTile =
                    event.target instanceof Element
                        ? Boolean(event.target.closest('[data-hex-tile]'))
                        : false;
                const startedNodeId =
                    event.target instanceof Element
                        ? Number(
                              event.target
                                  .closest('[data-hex-tile-id]')
                                  ?.getAttribute('data-hex-tile-id') ?? null,
                          )
                        : null;

                suppressTileClick.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrag({
                    hasMoved: false,
                    pointerId: event.pointerId,
                    startedNodeId: Number.isFinite(startedNodeId)
                        ? startedNodeId
                        : null,
                    startedOnTile,
                    startX: event.clientX,
                    startY: event.clientY,
                    x: event.clientX,
                    y: event.clientY,
                });
            }}
            onPointerMove={(event) => {
                if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                }

                if ((event.buttons & 1) !== 1) {
                    setDrag(null);

                    return;
                }

                const hasMoved =
                    drag.hasMoved ||
                    Math.abs(event.clientX - drag.startX) > 4 ||
                    Math.abs(event.clientY - drag.startY) > 4;

                if (hasMoved) {
                    suppressTileClick.current = true;
                }

                setPan((current) => ({
                    x: current.x + event.clientX - drag.x,
                    y: current.y + event.clientY - drag.y,
                }));
                setDrag({
                    hasMoved,
                    pointerId: event.pointerId,
                    startedNodeId: drag.startedNodeId,
                    startedOnTile: drag.startedOnTile,
                    startX: drag.startX,
                    startY: drag.startY,
                    x: event.clientX,
                    y: event.clientY,
                });
            }}
            onPointerCancel={() => setDrag(null)}
            onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }

                const node =
                    drag && !drag.hasMoved && drag.startedNodeId
                        ? (map.nodes.find(
                              (candidate) =>
                                  candidate.id === drag.startedNodeId,
                          ) ?? null)
                        : null;

                if (
                    drag &&
                    !drag.hasMoved &&
                    handleSelectedToolAtPointer(event, node)
                ) {
                    suppressTileClick.current = true;
                    setDrag(null);
                    window.setTimeout(() => {
                        suppressTileClick.current = false;
                    }, 0);

                    return;
                }

                if (drag && !drag.hasMoved && !drag.startedOnTile) {
                    onClearFocus();
                }

                if (
                    drag &&
                    !drag.hasMoved &&
                    node &&
                    canSelectNode(node, allowLockedSelection)
                ) {
                    onSelectNode(node);
                }

                setDrag(null);
                window.setTimeout(() => {
                    suppressTileClick.current = false;
                }, 0);
            }}
            onLostPointerCapture={() => setDrag(null)}
            style={{ cursor: mapCursor }}
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity"
                style={{
                    backgroundImage: `url(${mapTheme.imageUrl})`,
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    background: mapTheme.overlay ?? 'rgba(0, 0, 0, 0.4)',
                }}
            />
            <MapVisualAssetLayers assets={mapTheme.assets} />

            <div
                className="pointer-events-none absolute top-5 left-1/2 z-10 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-white/10 p-4 text-left shadow-2xl backdrop-blur-md md:top-8 md:left-8 md:w-auto md:translate-x-0"
                style={{
                    background:
                        mapTheme.panelBackground ?? 'rgba(5, 15, 22, 0.72)',
                    borderColor:
                        mapTheme.panelBorderColor ?? mapTheme.cardBorderColor,
                    color: mapTheme.panelTextColor,
                }}
            >
                <div
                    className="mb-3 flex items-center gap-2 text-sm"
                    style={{
                        color:
                            mapTheme.accentColor ??
                            (mode === 'light' ? '#0e7490' : '#ccfbf1'),
                    }}
                >
                    <MapIcon className="size-4" />
                    <span>Current map</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
                    {map.title}
                </h1>
                {map.description ? (
                    <p
                        className="mt-3 max-w-md text-sm leading-6"
                        style={{
                            color:
                                mapTheme.panelMutedTextColor ??
                                mapTheme.panelTextColor,
                        }}
                    >
                        {map.description}
                    </p>
                ) : null}
            </div>

            <div
                className="absolute top-1/2 left-1/2"
                style={{
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-45% + ${pan.y}px))`,
                    width: stageWidth,
                    height: stageHeight,
                }}
            >
                {tileLayouts.map(({ node, style }) => {
                    const isSelected = selectedNode?.id === node.id;
                    const hasCompletedActivity = node.activities.some(
                        (activity) =>
                            activityProgress[activity.id]?.status ===
                            'completed',
                    );

                    return (
                        <HexTile
                            isCompleted={hasCompletedActivity}
                            isSelected={isSelected}
                            allowLockedSelection={allowLockedSelection}
                            key={node.id}
                            mode={mode}
                            node={node}
                            onSelectNode={onSelectNode}
                            onPlayNodeSound={(node, trigger) =>
                                playNodeInteractionSound(
                                    soundPlayer,
                                    node,
                                    trigger,
                                )
                            }
                            onUseToolOnNode={onUseToolOnNode}
                            shouldSuppressClick={() =>
                                suppressTileClick.current
                            }
                            style={style}
                            completedDimOpacity={completedDimOpacity}
                            selectedTool={selectedTool}
                            tileCursor="var(--platform-action-cursor)"
                        />
                    );
                })}
            </div>
            {toolAnimation ? (
                <ToolUseAnimation animation={toolAnimation} />
            ) : null}
        </div>
    );
}

const HexTile = memo(function HexTile({
    isCompleted,
    isSelected,
    allowLockedSelection,
    node,
    onSelectNode,
    onPlayNodeSound,
    onUseToolOnNode,
    selectedTool,
    shouldSuppressClick,
    style,
    completedDimOpacity,
    tileCursor,
    mode,
}: {
    allowLockedSelection: boolean;
    completedDimOpacity: number;
    isCompleted: boolean;
    isSelected: boolean;
    node: LearningNode;
    onSelectNode: (node: LearningNode) => void;
    onPlayNodeSound: (
        node: LearningNode,
        trigger: keyof NonNullable<LearningNode['visualConfig']['sounds']>,
    ) => void;
    onUseToolOnNode: (node: LearningNode) => void;
    selectedTool: LearningTool | null;
    shouldSuppressClick: () => boolean;
    style: CSSProperties;
    tileCursor: string;
    mode: ResolvedAppearance;
}) {
    const visualConfig = resolveThemeVariant(node.visualConfig, mode);
    const Icon = nodeIcons[visualConfig.icon ?? ''] ?? RadioTower;
    const highlight =
        withOpacity(
            visualConfig.highlightColor ?? '#7dd3fc',
            visualConfig.highlightOpacity,
        ) ?? '#7dd3fc';
    const tileColor =
        withOpacity(
            visualConfig.tileColor ?? '#12343b',
            visualConfig.tileOpacity,
        ) ?? '#12343b';
    const label = visualConfig.label ?? node.title;
    const isLocked = node.state === 'locked';
    const isHiddenSpace = node.state === 'hidden';
    const isConcealedReveal =
        isHiddenSpace &&
        visualConfig.reveal?.isDiscoverable === true &&
        visualConfig.reveal?.isDiscovered === false;
    const hideEmptySpace =
        isHiddenSpace &&
        !isConcealedReveal &&
        visualConfig.hideEmptySpace !== false;
    const hideImage = visualConfig.hideImage === true;
    const imageUrl = visualConfig.imageUrl ?? '';
    const imageRotation = rotationConfig(visualConfig.imageRotation);
    const imageWidth = percentConfig(visualConfig.imageWidth, 100, 10, 200);
    const imageX = percentConfig(visualConfig.imageX, 50);
    const imageY = percentConfig(visualConfig.imageY, 50);
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
    const visibleImageUrl =
        !hideImage && imageUrl && failedImageUrl !== imageUrl ? imageUrl : '';
    const showFallbackIcon = !hideImage && !visibleImageUrl;
    const canUseWithTool = canUseToolOnNode(node, selectedTool);
    const canSelect = canSelectNode(node, allowLockedSelection);
    const canInteract = canUseWithTool || canSelect;
    const resolvedTileCursor = selectedTool
        ? 'var(--platform-cursor)'
        : canUseWithTool
          ? 'var(--platform-cursor)'
          : canInteract
            ? tileCursor
            : 'var(--platform-denied-cursor)';
    const highlightClass = cn(
        'pointer-events-none absolute opacity-0',
        canInteract && 'group-hover:opacity-100 group-focus:opacity-100',
        isSelected && canInteract && 'opacity-100',
        hideEmptySpace && 'hidden',
    );
    const imageStateClass = cn(isLocked && 'opacity-35 grayscale');
    const dimOverlayOpacity = isLocked
        ? 52
        : isCompleted
          ? completedDimOpacity
          : 0;
    const tileStyle: TileStyle = {
        ...style,
        clipPath: HEX_TILE_CLIP_PATH,
        cursor: resolvedTileCursor,
        '--tile-highlight': highlight,
    };

    return (
        <button
            aria-label={node.title}
            className={cn(
                'group absolute isolate flex items-center justify-center overflow-hidden text-left transition-transform duration-200 focus-visible:z-20 focus-visible:outline-none',
                canInteract && 'hover:z-20 hover:-translate-y-1',
                isSelected && canInteract && 'z-10 -translate-y-1',
                isHiddenSpace && 'opacity-45',
                isConcealedReveal && 'opacity-0',
                isConcealedReveal && !selectedTool && 'pointer-events-none',
                hideEmptySpace && 'invisible',
            )}
            data-hex-tile
            data-hex-tile-id={node.id}
            title={visualConfig.tooltip ?? node.title}
            onClick={(event) => {
                event.stopPropagation();

                if (!canInteract || shouldSuppressClick()) {
                    return;
                }

                onPlayNodeSound(node, 'click');

                if (canUseWithTool) {
                    onUseToolOnNode(node);
                } else {
                    onSelectNode(node);
                }
            }}
            onMouseEnter={() => {
                if (canInteract) {
                    onPlayNodeSound(node, 'mouseEnter');
                }
            }}
            onMouseLeave={() => {
                if (canInteract) {
                    onPlayNodeSound(node, 'mouseLeave');
                }
            }}
            style={tileStyle}
            type="button"
        >
            <span
                className={cn('absolute inset-0', imageStateClass)}
                style={{
                    background: tileColor,
                    clipPath: HEX_TILE_CLIP_PATH,
                    cursor: resolvedTileCursor,
                }}
            />
            <span
                className={cn(
                    'absolute inset-[7px] bg-black/14',
                    imageStateClass,
                )}
                style={{
                    clipPath: HEX_TILE_CLIP_PATH,
                    cursor: resolvedTileCursor,
                }}
            />
            {visibleImageUrl ? (
                <span
                    className={cn('absolute inset-[7px]', imageStateClass)}
                    style={{
                        clipPath: HEX_TILE_CLIP_PATH,
                        cursor: resolvedTileCursor,
                    }}
                >
                    <img
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        draggable={false}
                        onError={() => setFailedImageUrl(visibleImageUrl)}
                        src={visibleImageUrl}
                        style={{
                            cursor: resolvedTileCursor,
                            objectPosition: `${imageX}% ${imageY}%`,
                            transform: `scale(${imageWidth / 100}) rotate(${imageRotation}deg)`,
                        }}
                    />
                </span>
            ) : null}
            <span
                className="pointer-events-none absolute inset-[7px] transition-opacity duration-150"
                style={{
                    background: 'rgb(15, 23, 42)',
                    clipPath: HEX_TILE_CLIP_PATH,
                    opacity: dimOverlayOpacity / 100,
                }}
            />
            <span
                className={cn(highlightClass, 'inset-0')}
                style={{
                    background: 'var(--tile-highlight)',
                    clipPath: HEX_TILE_CLIP_PATH,
                    filter: 'drop-shadow(0 0 12px var(--tile-highlight))',
                }}
            />
            <span
                className={cn(highlightClass, 'inset-[7px]')}
                style={{
                    background: `linear-gradient(rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.14)), ${tileColor}`,
                    clipPath: HEX_TILE_CLIP_PATH,
                }}
            />
            <span
                className={cn(
                    'relative z-10 flex flex-col items-center justify-center px-5 text-center',
                    showFallbackIcon && 'gap-2',
                )}
                style={{ cursor: resolvedTileCursor }}
            >
                {showFallbackIcon ? (
                    <Icon
                        className={cn('size-7', imageStateClass)}
                        style={{
                            color:
                                withOpacity(
                                    visualConfig.foregroundColor ?? '#ccfbf1',
                                    visualConfig.foregroundOpacity,
                                ) ?? '#ccfbf1',
                            cursor: resolvedTileCursor,
                        }}
                    />
                ) : null}
                <span
                    className={cn(
                        'text-xs leading-tight font-medium',
                        visualConfig.hideLabel &&
                            'opacity-0 group-hover:opacity-100 group-focus:opacity-100 group-focus-visible:opacity-100',
                        visualConfig.hideLabel && isSelected && 'opacity-100',
                    )}
                    style={{
                        color:
                            withOpacity(
                                visualConfig.labelColor ?? '#ffffff',
                                visualConfig.labelOpacity,
                            ) ?? '#ffffff',
                        cursor: resolvedTileCursor,
                    }}
                >
                    {label}
                </span>
            </span>
            {isLocked ? (
                <span
                    className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
                    style={{
                        clipPath: HEX_TILE_CLIP_PATH,
                    }}
                >
                    <LockKeyhole className="size-11 text-slate-950/42 drop-shadow-[0_2px_10px_rgba(255,255,255,0.55)] dark:text-white/45 dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]" />
                </span>
            ) : null}
        </button>
    );
});

function canUseToolOnNode(
    node: LearningNode,
    selectedTool: LearningTool | null,
): boolean {
    if (!selectedTool) {
        return false;
    }

    if (
        node.state === 'hidden' &&
        node.visualConfig.reveal?.isDiscoverable === true &&
        node.visualConfig.reveal?.isDiscovered === false
    ) {
        return true;
    }

    return (
        node.state === 'locked' &&
        node.visualConfig.unlock?.isToolUnlockable === true &&
        node.visualConfig.unlock?.isUnlocked !== true
    );
}

function canSelectNode(
    node: LearningNode,
    allowLockedSelection: boolean,
): boolean {
    return (
        node.state !== 'hidden' &&
        (allowLockedSelection || node.state !== 'locked')
    );
}

export function soundFromNode(
    node: LearningNode,
    trigger: keyof NonNullable<LearningNode['visualConfig']['sounds']>,
): PlayableSound | null {
    const sound = node.visualConfig.sounds?.[trigger];

    if (!sound?.enabled || !sound.url) {
        return null;
    }

    return {
        id: `node-${node.id}-${trigger}-${sound.url}`,
        loop: false,
        playSeconds: null,
        url: sound.url,
        volume: 70,
    };
}

function playNodeInteractionSound(
    soundPlayer: ReturnType<typeof useLayeredSoundPlayer>,
    node: LearningNode,
    trigger: keyof NonNullable<LearningNode['visualConfig']['sounds']>,
) {
    const sound = soundFromNode(node, trigger);

    if (sound) {
        soundPlayer.play(sound, `node-${node.id}-${trigger}`);
    }
}

type ToolUseAnimation = {
    durationMs: number;
    id: number;
    imageUrl: string;
    widthPercent: number;
    x: number;
    y: number;
};

function ToolUseAnimation({ animation }: { animation: ToolUseAnimation }) {
    if (!animation.imageUrl) {
        return null;
    }

    return (
        <img
            alt=""
            className="pointer-events-none absolute z-40 h-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            draggable={false}
            key={animation.id}
            src={cacheBustedUrl(animation.imageUrl, animation.id)}
            style={{
                left: animation.x,
                top: animation.y,
                width: toolAnimationWidthStyle(animation.widthPercent),
            }}
        />
    );
}

function toolUseAnimationFor(
    tool: LearningTool,
    mode: ResolvedAppearance,
    event: PointerEvent<HTMLDivElement>,
): ToolUseAnimation {
    const bounds = event.currentTarget.getBoundingClientRect();
    const imageUrl = toolAnimationUrl(tool, mode);
    const durationSeconds = numericConfig(
        tool.config.animationDurationSeconds,
        imageUrl ? 0.75 : 0,
    );

    return {
        durationMs: Math.max(0, durationSeconds * 1000),
        id: Date.now(),
        imageUrl,
        widthPercent: toolAnimationWidthPercent(tool),
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
    };
}

function showToolAnimation(
    animation: ToolUseAnimation,
    setToolAnimation: (animation: ToolUseAnimation | null) => void,
) {
    setToolAnimation(animation);

    window.setTimeout(
        () => setToolAnimation(null),
        Math.max(animation.durationMs, 120),
    );
}

function wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function MapVisualAssetLayers({ assets }: { assets?: MapVisualAsset[] }) {
    if (!Array.isArray(assets) || assets.length === 0) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {assets.map((asset, index) => {
                const imageUrl = normalizeMediaUrl(asset.imageUrl ?? '');

                if (!imageUrl) {
                    return null;
                }

                return (
                    <img
                        alt=""
                        className="absolute h-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                        draggable={false}
                        key={asset.id || `${imageUrl}-${index}`}
                        src={imageUrl}
                        style={{
                            left: `${percentConfig(asset.x, 50)}%`,
                            opacity: percentConfig(asset.opacity, 100) / 100,
                            top: `${percentConfig(asset.y, 50)}%`,
                            width: `${percentConfig(asset.width, 20, 1, 200)}%`,
                        }}
                    />
                );
            })}
        </div>
    );
}

function cacheBustedUrl(url: string, id: number): string {
    const separator = url.includes('?') ? '&' : '?';

    return `${url}${separator}map_tool_use=${id}`;
}

function numericConfig(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(numeric) ? numeric : fallback;
}

function percentConfig(
    value: unknown,
    fallback: number,
    min = 0,
    max = 100,
): number {
    return Math.min(Math.max(numericConfig(value, fallback), min), max);
}

function rotationConfig(value: unknown): number {
    return Math.min(Math.max(numericConfig(value, 0), -360), 360);
}
