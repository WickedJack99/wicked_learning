import { History, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import type { MapAsset } from '@/types/learning';

type MapAssetVersion = Omit<MapAsset, 'nodeId'> & {
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
    assetId: number | null;
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    onRestored: (asset: MapAsset) => void;
    open: boolean;
}) {
    const [history, setHistory] = useState<MapAssetVersionPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [restoringId, setRestoringId] = useState<number | null>(null);

    const loadHistory = useCallback(
        async (page = 1) => {
            if (!assetId) {
                return;
            }

            setLoading(true);
            setError(false);

            try {
                const response = await fetch(
                    `/settings/worlds/assets/${assetId}/versions?page=${page}&per_page=4`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The MapAsset history could not be loaded.',
                    );
                }

                setHistory((await response.json()) as MapAssetVersionPage);
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
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/assets/${assetId}/versions/${version.id}/restore`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'POST',
                },
            );

            if (!response.ok) {
                throw new Error('The MapAsset version could not be restored.');
            }

            const payload = (await response.json()) as { asset: MapAsset };
            onRestored(payload.asset);
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

function formatVersionDate(value: string | null): string {
    if (!value) {
        return 'Unknown date';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
