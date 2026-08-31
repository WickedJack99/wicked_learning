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
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type MapLayoutVersion = {
    createdAt: string | null;
    id: number;
    nodeCount: number;
    restorable: boolean;
};

type MapLayoutVersionPage = {
    items: MapLayoutVersion[];
    pagination: {
        lastPage: number;
        page: number;
    };
};

type MapLayoutPreview = {
    createdAt: string | null;
    items: Array<{
        nodeId: number;
        positionQ: number;
        positionR: number;
        title: string;
    }>;
    pagination: {
        lastPage: number;
        page: number;
    };
    versionId: number;
};

export function MapLayoutHistoryDialog({
    children,
    mapId,
    mapTitle,
    onOpenChange,
    onRestored,
    open,
}: {
    children: ReactNode;
    mapId: number;
    mapTitle: string;
    onOpenChange: (open: boolean) => void;
    onRestored: () => void;
    open: boolean;
}) {
    const t = usePlatformTranslation();
    const [history, setHistory] = useState<MapLayoutVersionPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [restoringId, setRestoringId] = useState<number | null>(null);
    const [preview, setPreview] = useState<MapLayoutPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewVersion, setPreviewVersion] =
        useState<MapLayoutVersion | null>(null);

    const loadHistory = useCallback(
        async (page = 1) => {
            setLoading(true);
            setError(false);

            try {
                const response = await fetch(
                    `/settings/worlds/maps/${mapId}/layout-versions?page=${page}&per_page=6`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error('Unable to load map layout history.');
                }

                setHistory((await response.json()) as MapLayoutVersionPage);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [mapId],
    );

    const loadPreview = useCallback(
        async (versionId: number, page = 1) => {
            setPreviewLoading(true);
            setError(false);

            try {
                const response = await fetch(
                    `/settings/worlds/maps/${mapId}/layout-versions/${versionId}/preview?page=${page}&per_page=8`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error('Unable to load map layout preview.');
                }

                setPreview((await response.json()) as MapLayoutPreview);
            } catch {
                setError(true);
            } finally {
                setPreviewLoading(false);
            }
        },
        [mapId],
    );

    const openPreview = (version: MapLayoutVersion) => {
        setPreviewVersion(version);
        setPreview(null);
        void loadPreview(version.id);
    };

    const restoreVersion = async (version: MapLayoutVersion) => {
        if (
            !window.confirm(
                t(
                    'settings.map_layout_history.restore_confirm',
                    'Restore this map layout? The current layout will be preserved in history.',
                ),
            )
        ) {
            return;
        }

        setRestoringId(version.id);

        try {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/maps/${mapId}/layout-versions/${version.id}/restore`,
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
                throw new Error('Unable to restore map layout.');
            }

            onRestored();
            setPreview(null);
            setPreviewVersion(null);
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
                } else {
                    setPreview(null);
                    setPreviewVersion(null);
                }
            }}
            open={open}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <History className="size-4" />
                        {t(
                            'settings.map_layout_history.title',
                            'Layout history',
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'settings.map_layout_history.description',
                            `Review earlier placement layouts for ${mapTitle}. Restore is available while the map has the same nodes.`,
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 gap-3 overflow-hidden">
                    {previewVersion ? (
                        <div className="grid min-h-0 gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="grid gap-1">
                                    <p className="text-sm font-medium">
                                        {t(
                                            'settings.map_layout_history.preview_title',
                                            'Layout preview',
                                        )}
                                    </p>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.map_layout_history.preview_description',
                                            'Inspect the saved node positions before restoring this layout.',
                                        )}
                                    </p>
                                </div>
                                <Button
                                    onClick={() => {
                                        setPreview(null);
                                        setPreviewVersion(null);
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    {t(
                                        'settings.map_layout_history.back_to_history',
                                        'Back to history',
                                    )}
                                </Button>
                            </div>
                            {previewLoading ? (
                                <p
                                    aria-live="polite"
                                    className="text-sm"
                                    role="status"
                                >
                                    {t(
                                        'settings.map_layout_history.preview_loading',
                                        'Loading layout preview…',
                                    )}
                                </p>
                            ) : error ? (
                                <p
                                    aria-live="polite"
                                    className="text-sm text-red-400"
                                    role="status"
                                >
                                    {t(
                                        'settings.map_layout_history.preview_error',
                                        'The layout preview could not be loaded. Try again.',
                                    )}
                                </p>
                            ) : preview && preview.items.length > 0 ? (
                                <div
                                    aria-label={t(
                                        'settings.map_layout_history.preview_items',
                                        'Saved node positions',
                                    )}
                                    className="grid gap-2 sm:grid-cols-2"
                                    role="list"
                                >
                                    {preview.items.map((item) => (
                                        <div
                                            className="grid gap-1 rounded-md border border-[var(--settings-border-color)] p-3"
                                            key={item.nodeId}
                                            role="listitem"
                                        >
                                            <p className="text-sm font-medium">
                                                {item.title}
                                            </p>
                                            <p className="text-xs text-[var(--settings-muted-text)]">
                                                {t(
                                                    'settings.map_layout_history.position',
                                                    'Position q:r',
                                                    {
                                                        q: item.positionQ,
                                                        r: item.positionR,
                                                    },
                                                )}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[var(--settings-muted-text)]">
                                    {t(
                                        'settings.map_layout_history.preview_empty',
                                        'This saved layout has no readable node positions.',
                                    )}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <Button
                                    disabled={
                                        restoringId !== null ||
                                        !previewVersion.restorable
                                    }
                                    onClick={() =>
                                        void restoreVersion(previewVersion)
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    <RotateCcw className="size-4" />
                                    {restoringId === previewVersion.id
                                        ? t(
                                              'settings.map_layout_history.restoring',
                                              'Restoring…',
                                          )
                                        : t(
                                              'settings.map_layout_history.restore',
                                              'Restore this layout',
                                          )}
                                </Button>
                                {preview ? (
                                    <PaginationControls
                                        buttonClassName="text-[var(--settings-accent)]"
                                        currentPage={preview.pagination.page}
                                        disabled={
                                            previewLoading ||
                                            restoringId !== null
                                        }
                                        label={t(
                                            'settings.map_layout_history.preview_pagination',
                                            'Layout preview pagination',
                                        )}
                                        onPageChange={(page) =>
                                            void loadPreview(
                                                previewVersion.id,
                                                page,
                                            )
                                        }
                                        pageCount={preview.pagination.lastPage}
                                        showSinglePage
                                        textClassName="text-[var(--settings-muted-text)]"
                                    />
                                ) : null}
                            </div>
                        </div>
                    ) : loading ? (
                        <p aria-live="polite" className="text-sm" role="status">
                            {t(
                                'settings.map_layout_history.loading',
                                'Loading layout history…',
                            )}
                        </p>
                    ) : error ? (
                        <p
                            aria-live="polite"
                            className="text-sm text-red-400"
                            role="status"
                        >
                            {t(
                                'settings.map_layout_history.error',
                                'Layout history could not be loaded or restored. Try again.',
                            )}
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
                                            {t(
                                                'settings.map_layout_history.entry',
                                                'Layout before placement change',
                                            )}
                                        </p>
                                        <time
                                            className="text-xs text-[var(--settings-muted-text)]"
                                            dateTime={
                                                version.createdAt ?? undefined
                                            }
                                        >
                                            {formatVersionDate(
                                                version.createdAt,
                                            )}
                                        </time>
                                    </div>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.map_layout_history.node_count',
                                            ':count nodes',
                                            { count: version.nodeCount },
                                        )}
                                    </p>
                                    {!version.restorable ? (
                                        <p className="text-xs text-[var(--settings-muted-text)]">
                                            {t(
                                                'settings.map_layout_history.unavailable_node_set',
                                                'Unavailable because the map nodes have changed.',
                                            )}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                            onClick={() => openPreview(version)}
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            {t(
                                                'settings.map_layout_history.preview',
                                                'Preview',
                                            )}
                                        </Button>
                                        <Button
                                            disabled={
                                                restoringId !== null ||
                                                !version.restorable
                                            }
                                            onClick={() =>
                                                void restoreVersion(version)
                                            }
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <RotateCcw className="size-4" />
                                            {restoringId === version.id
                                                ? t(
                                                      'settings.map_layout_history.restoring',
                                                      'Restoring…',
                                                  )
                                                : t(
                                                      'settings.map_layout_history.restore',
                                                      'Restore this layout',
                                                  )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            {t(
                                'settings.map_layout_history.empty',
                                'No earlier placement layouts yet. Moving or swapping a node will create one.',
                            )}
                        </p>
                    )}
                    {history ? (
                        <PaginationControls
                            buttonClassName="text-[var(--settings-accent)]"
                            currentPage={history.pagination.page}
                            disabled={loading || restoringId !== null}
                            label={t(
                                'settings.map_layout_history.pagination',
                                'Layout history pagination',
                            )}
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
