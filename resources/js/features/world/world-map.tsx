import {
    BookOpen,
    CheckCircle2,
    LockKeyhole,
    Map as MapIcon,
    Orbit,
    RadioTower,
} from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType } from 'react';
import { cn } from '@/lib/utils';
import type { LearningMap, LearningNode, LearningProgress } from '@/types';
import {
    HEX_TILE_CLIP_PATH,
    normalizeCursorValue,
    resolveThemeVariant,
    withOpacity,
} from './theme';
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
    onSelectNode,
    selectedNode,
}: {
    activityProgress: LearningProgress['activities'];
    allowLockedSelection?: boolean;
    map: LearningMap;
    mode: ResolvedAppearance;
    onClearFocus: () => void;
    onSelectNode: (node: LearningNode) => void;
    selectedNode: LearningNode | null;
}) {
    const [pan, setPan] = useState({ x: 0, y: 0 });
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
    const mapCursor = drag
        ? normalizeCursorValue(mapTheme.draggingCursor ?? 'default')
        : normalizeCursorValue(mapTheme.cursor ?? 'default');

    return (
        <div
            className="relative h-full min-h-[56vh] touch-none overflow-hidden select-none"
            data-map-appearance={mode}
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

                if (drag && !drag.hasMoved && !drag.startedOnTile) {
                    onClearFocus();
                }

                if (drag && !drag.hasMoved && drag.startedNodeId) {
                    const node = map.nodes.find(
                        (candidate) => candidate.id === drag.startedNodeId,
                    );

                    if (node) {
                        onSelectNode(node);
                    }
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

            <div
                className="pointer-events-none absolute top-5 left-1/2 z-10 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-lg border border-white/10 p-4 text-left shadow-2xl backdrop-blur-md md:top-8 md:left-8 md:w-auto md:translate-x-0"
                style={{
                    background:
                        mapTheme.panelBackground ?? 'rgba(5, 15, 22, 0.72)',
                    borderColor: mapTheme.cardBorderColor,
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
                            shouldSuppressClick={() =>
                                suppressTileClick.current
                            }
                            style={style}
                            tileCursor={normalizeCursorValue(
                                mapTheme.tileCursor ?? 'pointer',
                            )}
                        />
                    );
                })}
            </div>
        </div>
    );
}

const HexTile = memo(function HexTile({
    isCompleted,
    isSelected,
    allowLockedSelection,
    node,
    onSelectNode,
    shouldSuppressClick,
    style,
    tileCursor,
    mode,
}: {
    allowLockedSelection: boolean;
    isCompleted: boolean;
    isSelected: boolean;
    node: LearningNode;
    onSelectNode: (node: LearningNode) => void;
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
    const isLocked = node.state === 'locked';
    const isHiddenSpace = node.state === 'hidden';
    const hideEmptySpace =
        isHiddenSpace && visualConfig.hideEmptySpace !== false;
    const hideImage = visualConfig.hideImage === true;
    const imageUrl = visualConfig.imageUrl ?? '';
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
    const visibleImageUrl =
        !hideImage && imageUrl && failedImageUrl !== imageUrl ? imageUrl : '';
    const showFallbackIcon = !hideImage && !visibleImageUrl;
    const canInteract =
        node.state !== 'hidden' && (allowLockedSelection || !isLocked);
    const resolvedTileCursor = canInteract ? tileCursor : 'default';
    const highlightClass = cn(
        'pointer-events-none absolute opacity-0 transition-opacity duration-150 group-hover:opacity-100',
        isSelected && canInteract && 'opacity-100',
        hideEmptySpace && 'hidden',
    );
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
                hideEmptySpace && 'invisible',
            )}
            data-hex-tile
            data-hex-tile-id={node.id}
            title={visualConfig.tooltip}
            onClick={(event) => {
                event.stopPropagation();

                if (!canInteract || shouldSuppressClick()) {
                    return;
                }

                onSelectNode(node);
            }}
            style={tileStyle}
            type="button"
        >
            <span
                className="absolute inset-0"
                style={{
                    background: tileColor,
                    clipPath: HEX_TILE_CLIP_PATH,
                    cursor: resolvedTileCursor,
                }}
            />
            <span
                className="absolute inset-[7px] bg-black/14"
                style={{
                    clipPath: HEX_TILE_CLIP_PATH,
                    cursor: resolvedTileCursor,
                }}
            />
            {visibleImageUrl ? (
                <img
                    alt=""
                    className="absolute inset-[7px] size-[calc(100%-14px)] object-cover"
                    draggable={false}
                    onError={() => setFailedImageUrl(visibleImageUrl)}
                    src={visibleImageUrl}
                    style={{
                        clipPath: HEX_TILE_CLIP_PATH,
                        cursor: resolvedTileCursor,
                    }}
                />
            ) : null}
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
                className="relative z-10 flex flex-col items-center gap-2 px-5 text-center"
                style={{ cursor: resolvedTileCursor }}
            >
                <span
                    className="relative"
                    style={{ cursor: resolvedTileCursor }}
                >
                    <Icon
                        className={cn('size-7', !showFallbackIcon && 'hidden')}
                        style={{
                            color:
                                withOpacity(
                                    visualConfig.foregroundColor ?? '#ccfbf1',
                                    visualConfig.foregroundOpacity,
                                ) ?? '#ccfbf1',
                            cursor: resolvedTileCursor,
                        }}
                    />
                    {isCompleted ? (
                        <CheckCircle2 className="absolute -top-2 -right-3 size-4 text-emerald-300" />
                    ) : null}
                </span>
                {!visualConfig.hideLabel ? (
                    <span
                        className="text-xs leading-tight font-medium"
                        style={{
                            color:
                                withOpacity(
                                    visualConfig.labelColor ?? '#ffffff',
                                    visualConfig.labelOpacity,
                                ) ?? '#ffffff',
                            cursor: resolvedTileCursor,
                        }}
                    >
                        {visualConfig.label ?? node.title}
                    </span>
                ) : null}
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
