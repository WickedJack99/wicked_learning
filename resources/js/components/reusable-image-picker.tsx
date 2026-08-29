import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { readJsonResponse } from '@/lib/json-response';
import { normalizeMediaUrl } from '@/lib/media-url';

type ReusableImageAsset = {
    canViewPath: boolean;
    extension: string;
    label: string;
    source: string;
    url: string;
};

type ReusableImagePagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

type ReusableImagePayload = {
    assets?: ReusableImageAsset[];
    message?: string;
    pagination?: ReusableImagePagination;
};

function imagePickerPageSize(): number {
    if (typeof window === 'undefined' || window.innerWidth >= 1280) {
        return 12;
    }

    if (window.innerWidth >= 1024) {
        return 9;
    }

    if (window.innerWidth >= 640) {
        return 6;
    }

    return 4;
}

export function ReusableImagePicker({
    currentValue,
    onClose,
    onClear,
    onSelect,
}: {
    currentValue: string;
    onClose: () => void;
    onClear?: () => void;
    onSelect: (url: string) => void;
}) {
    const t = usePlatformTranslation();
    const headingId = useId();
    const descriptionId = useId();
    const [assets, setAssets] = useState<ReusableImageAsset[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(imagePickerPageSize);
    const [pagination, setPagination] = useState<ReusableImagePagination>({
        currentPage: 1,
        lastPage: 1,
        perPage: pageSize,
        total: 0,
    });
    const [search, setSearch] = useState('');
    const restoreFocusRef = useRef<HTMLElement | null>(
        typeof document !== 'undefined' &&
            document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
    );
    const loadError = t(
        'settings.assets.images.load_error',
        'Images could not be loaded.',
    );
    const closePicker = useCallback(() => {
        onClose();
        window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closePicker();
        };

        window.addEventListener('keydown', handleKeyDown, true);

        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [closePicker]);

    useEffect(() => {
        const handleResize = () => {
            const nextPageSize = imagePickerPageSize();

            setPageSize((currentPageSize) => {
                if (currentPageSize === nextPageSize) {
                    return currentPageSize;
                }

                setPage(1);

                return nextPageSize;
            });
        };

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
            const params = new URLSearchParams();

            if (search.trim()) {
                params.set('q', search.trim());
            }

            params.set('page', String(page));
            params.set('per_page', String(pageSize));

            setIsLoading(true);
            setError('');

            fetch(`/settings/assets/reusable-images?${params.toString()}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then(async (response) => {
                    const payload = (await readJsonResponse(
                        response,
                        loadError,
                    )) as ReusableImagePayload;
                    setAssets(payload.assets ?? []);
                    setPagination(
                        payload.pagination ?? {
                            currentPage: page,
                            lastPage: 1,
                            perPage: pageSize,
                            total: payload.assets?.length ?? 0,
                        },
                    );
                })
                .catch((nextError: unknown) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setError(
                        nextError instanceof Error
                            ? nextError.message
                            : loadError,
                    );
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setIsLoading(false);
                    }
                });
        }, 180);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [loadError, page, pageSize, search]);

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) {
                    closePicker();
                }
            }}
            open
        >
            <DialogContent
                aria-describedby={descriptionId}
                aria-labelledby={headingId}
                className="flex max-h-[min(48rem,calc(100svh-1rem))] w-full max-w-6xl flex-col overflow-hidden border-slate-200 bg-white p-0 dark:border-white/10 dark:bg-[#111820]"
                overlayClassName="bg-slate-950/55 backdrop-blur-sm"
            >
                <DialogHeader className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 text-left dark:border-white/10">
                    <div>
                        <DialogTitle
                            className="text-lg text-slate-950 dark:text-white"
                            id={headingId}
                        >
                            {t(
                                'settings.assets.images.select_existing_title',
                                'Select existing image',
                            )}
                        </DialogTitle>
                        <DialogDescription
                            className="mt-1 text-sm text-slate-500 dark:text-slate-400"
                            id={descriptionId}
                        >
                            {t(
                                'settings.assets.images.select_existing_description',
                                'Reuse uploaded or bundled assets instead of adding duplicates.',
                            )}
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="grid shrink-0 gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto] dark:border-white/10">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            autoFocus
                            className="pl-9"
                            onChange={(event) => {
                                setSearch(event.currentTarget.value);
                                setPage(1);
                            }}
                            placeholder={t(
                                'settings.assets.images.search_placeholder',
                                'Search uploaded and bundled images',
                            )}
                            value={search}
                        />
                    </div>
                    <Button
                        disabled={!currentValue}
                        onClick={() => {
                            onClear?.();
                            closePicker();
                        }}
                        type="button"
                        variant="secondary"
                    >
                        {t('common.clear', 'Clear')}
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden p-4">
                    {error ? (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                            {error}
                        </p>
                    ) : null}

                    {!error && isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: pageSize }).map(
                                (_, index) => (
                                    <div
                                        className="h-36 animate-pulse rounded-lg bg-slate-100 dark:bg-white/8"
                                        key={index}
                                    />
                                ),
                            )}
                        </div>
                    ) : null}

                    {!error && !isLoading && assets.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                            {t(
                                'settings.assets.images.empty_search',
                                'No images match this search.',
                            )}
                        </p>
                    ) : null}

                    {!error && !isLoading && assets.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {assets.map((asset) => (
                                <button
                                    aria-pressed={
                                        normalizeMediaUrl(currentValue) ===
                                        normalizeMediaUrl(asset.url)
                                    }
                                    className={[
                                        'group grid min-w-0 gap-3 rounded-lg border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                                        normalizeMediaUrl(currentValue) ===
                                        normalizeMediaUrl(asset.url)
                                            ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                                            : 'border-slate-200 bg-slate-50 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] dark:border-white/10 dark:bg-white/5',
                                    ].join(' ')}
                                    key={asset.url}
                                    onClick={() => {
                                        onSelect(normalizeMediaUrl(asset.url));
                                        closePicker();
                                    }}
                                    type="button"
                                >
                                    <span className="grid h-24 place-items-center overflow-hidden rounded-md bg-white dark:bg-slate-950/80">
                                        <img
                                            alt=""
                                            className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
                                            draggable={false}
                                            loading="lazy"
                                            decoding="async"
                                            src={normalizeMediaUrl(asset.url)}
                                        />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                                            {asset.label}
                                        </span>
                                        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="truncate">
                                                {asset.source}
                                            </span>
                                            <span className="shrink-0 uppercase">
                                                {asset.extension}
                                            </span>
                                        </span>
                                        {asset.canViewPath ? (
                                            <span className="mt-1 block truncate text-xs text-slate-400 dark:text-slate-500">
                                                {asset.url}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                {!error && !isLoading && pagination.lastPage > 1 ? (
                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                        <Button
                            aria-label={t(
                                'settings.assets.images.previous_page',
                                'Previous image page',
                            )}
                            disabled={pagination.currentPage <= 1}
                            onClick={() =>
                                setPage((currentPage) =>
                                    Math.max(1, currentPage - 1),
                                )
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            <ChevronLeft className="size-4" />
                            {t('common.previous', 'Previous')}
                        </Button>
                        <span
                            aria-live="polite"
                            className="text-xs text-slate-500 dark:text-slate-400"
                        >
                            {t(
                                'common.pagination.page',
                                'Page :current of :total',
                                {
                                    current: pagination.currentPage,
                                    total: pagination.lastPage,
                                },
                            )}
                        </span>
                        <Button
                            aria-label={t(
                                'settings.assets.images.next_page',
                                'Next image page',
                            )}
                            disabled={
                                pagination.currentPage >= pagination.lastPage
                            }
                            onClick={() =>
                                setPage((currentPage) =>
                                    Math.min(
                                        pagination.lastPage,
                                        currentPage + 1,
                                    ),
                                )
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            {t('common.next', 'Next')}
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
