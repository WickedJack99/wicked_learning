import { History, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { LiftedPaginationControls as PaginationControls } from './lifted-pagination-controls';
import { LiftedButton as Button } from './lifted-button';
import {
    LiftedDialog as Dialog,
    LiftedDialogContent as DialogContent,
    LiftedDialogDescription as DialogDescription,
    LiftedDialogHeader as DialogHeader,
    LiftedDialogTitle as DialogTitle,
    LiftedDialogTrigger as DialogTrigger,
} from './lifted-dialog';
import type { MapAsset } from './lifted-world-builder-types';
import { apiClient, getCsrfToken } from './api/client';

type MapAssetVersion = MapAsset & {
    createdAt: string | null;
};

type MapAssetVersionPage = {
    items: MapAssetVersion[];
    pagination: {
        lastPage: number;
        page: number;
    };
};

export function MapAssetHistoryDialog({
    assetId,
    children,
    onOpenChange,
    onRestored,
    open,
}: {
    assetId: string | null;
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    onRestored: (asset: MapAsset) => void;
    open: boolean;
}) {
    const [history, setHistory] = useState<MapAssetVersionPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    const loadHistory = useCallback(
        async (page = 1) => {
            if (!assetId) {
                return;
            }

            setLoading(true);
            setError(false);

            try {
                const { data, response } = await apiClient.GET(
                    '/admin/world-builder/assets/{asset_id}/versions',
                    { params: { path: { asset_id: assetId }, query: { page, per_page: 4 } } },
                );
                if (!response.ok || !data) {
                    throw new Error(
                        'The MapAsset history could not be loaded.',
                    );
                }
                setHistory({
                    items: data.items.map((asset) => sourceAsset(asset)),
                    pagination: { lastPage: data.last_page, page: data.page },
                });
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [assetId],
    );

    const restoreVersion = async (version: MapAssetVersion) => {
        if (
            !window.confirm(
                'Restore this MapAsset version? The current configuration will be preserved in history.',
            )
        ) {
            return;
        }

        if (!assetId) {
            return;
        }

        setRestoringId(version.id);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/assets/{asset_id}/versions/{version_id}',
                { params: { header: { 'X-CSRF-Token': token }, path: { asset_id: assetId, version_id: version.id } } },
            );
            if (!response.ok || !data) {
                throw new Error('The MapAsset version could not be restored.');
            }
            onRestored(sourceAsset(data));
            await loadHistory(history?.pagination.page ?? 1);
        } catch {
            setError(true);
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);

                if (nextOpen) {
                    void loadHistory();
                }
            }}
            open={open}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <History className="size-4" />
                        MapAsset history
                    </DialogTitle>
                    <DialogDescription>
                        Review earlier learner-facing configuration and restore
                        a version without losing the current state.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 gap-3 overflow-hidden">
                    {loading ? (
                        <p aria-live="polite" className="text-sm" role="status">
                            Loading MapAsset history…
                        </p>
                    ) : error ? (
                        <p
                            aria-live="polite"
                            className="text-sm text-red-400"
                            role="status"
                        >
                            MapAsset history could not be loaded. Try again.
                        </p>
                    ) : history && history.items.length > 0 ? (
                        <div className="grid min-h-0 gap-2">
                            {history.items.map((version) => (
                                <div
                                    className="grid gap-1 rounded-md border border-[var(--settings-border-color)] p-3"
                                    key={version.id}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="text-sm font-medium">
                                            {version.text || 'Untitled MapAsset'}
                                        </p>
                                        <time className="text-xs text-[var(--settings-muted-text)]">
                                            {formatVersionDate(version.createdAt)}
                                        </time>
                                    </div>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {version.imageUrl || 'No image'} ·{' '}
                                        {version.interactionMode || 'default'}
                                    </p>
                                    <Button
                                        className="justify-self-end"
                                        disabled={restoringId !== null}
                                        onClick={() => void restoreVersion(version)}
                                        size="sm"
                                        type="button"
                                        variant="ghost"
                                    >
                                        <RotateCcw className="size-4" />
                                        {restoringId === version.id
                                            ? 'Restoring…'
                                            : 'Restore this version'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            No earlier MapAsset configuration yet. The first
                            update will create one.
                        </p>
                    )}
                    {history ? (
                        <PaginationControls
                            buttonClassName="text-[var(--settings-accent)]"
                            currentPage={history.pagination.page}
                            disabled={loading || restoringId !== null}
                            label="MapAsset history pagination"
                            onPageChange={(page) => void loadHistory(page)}
                            pageCount={history.pagination.lastPage}
                            showSinglePage
                            textClassName="text-[var(--settings-muted-text)]"
                        />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function sourceAsset(asset: {
    asset_id?: string;
    created_at?: string;
    id?: string;
    image_url: string | null;
    interaction_config: Record<string, unknown>;
    interaction_mode: MapAsset['interactionMode'];
    locked: boolean;
    opacity: number;
    position_x: number;
    position_y: number;
    position_z: number;
    sound_config: Record<string, unknown>;
    text: string | null;
    visual_config: Record<string, unknown>;
    width: number;
}): MapAssetVersion {
    return {
        createdAt: asset.created_at ?? null,
        focusable: asset.interaction_mode === 'focusable',
        // Version rows identify the immutable snapshot as `id`; the restore
        // response identifies the mutable asset as `asset_id`. Prefer the
        // latter whenever it is present so a restored configuration continues
        // to save against the MapAsset, never a historical snapshot.
        id: asset.asset_id ?? asset.id ?? '',
        imageUrl: asset.image_url,
        interactionConfig: asset.interaction_config,
        interactionMode: asset.interaction_mode,
        locked: asset.locked,
        nodeId: null,
        opacity: asset.opacity,
        soundConfig: asset.sound_config,
        text: asset.text,
        visualConfig: asset.visual_config,
        width: asset.width,
        x: asset.position_x,
        y: asset.position_y,
        z: asset.position_z,
    };
}

function formatVersionDate(value: string | null): string {
    if (!value) {
        return 'Unknown date';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
