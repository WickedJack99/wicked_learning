import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    Image,
    LoaderCircle,
    Plus,
    Save,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AssetLibraryWorkspace } from '@/features/settings/asset-library-workspace';
import { cn } from '@/lib/utils';
import mediaAssetRoutes from '@/routes/settings/assets/media';

export type ReusableMediaAsset = {
    canDelete: boolean;
    canViewPath: boolean;
    category: string | null;
    extension: string;
    hasTransparency: boolean | null;
    isAnimated: boolean | null;
    label: string;
    referenceCount: number;
    referenceGroups: Array<{ count: number; label: string }>;
    source: string;
    tags: string[];
    uploaded: boolean;
    url: string;
};

export default function AdminMediaAssets({
    assets,
    embedded = false,
}: {
    assets: ReusableMediaAsset[];
    embedded?: boolean;
}) {
    const [search, setSearch] = useState('');
    const [selectedUrl, setSelectedUrl] = useState(assets[0]?.url ?? '');
    const [busyUrl, setBusyUrl] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const addInputRef = useRef<HTMLInputElement | null>(null);
    const visualsLibraryRef = useRef<HTMLDivElement | null>(null);
    const replaceInputRef = useRef<HTMLInputElement | null>(null);
    const [visualsPageSize, setVisualsPageSize] = useState(13);
    const selectedAsset =
        assets.find((asset) => asset.url === selectedUrl) ?? assets[0] ?? null;
    const filteredAssets = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return assets;
        }

        return assets.filter((asset) =>
            [
                asset.label,
                asset.source,
                asset.extension,
                asset.canViewPath ? asset.url : '',
            ]
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [assets, search]);

    useEffect(() => {
        const library = visualsLibraryRef.current;

        if (!library || typeof ResizeObserver === 'undefined') {
            return;
        }

        const updatePageSize = () => {
            const item = library.querySelector<HTMLElement>(
                '[data-visual-library-item]',
            );
            const itemHeight = item?.getBoundingClientRect().height ?? 76;
            const itemGap = 8;
            const paginationHeight = 48;
            const availableHeight = library.clientHeight;
            const nextPageSize = Math.max(
                1,
                Math.min(
                    13,
                    Math.floor(
                        (availableHeight - paginationHeight + itemGap) /
                            (itemHeight + itemGap),
                    ),
                ),
            );

            setVisualsPageSize((current) =>
                current === nextPageSize ? current : nextPageSize,
            );
        };

        const observer = new ResizeObserver(updatePageSize);
        observer.observe(library);
        updatePageSize();

        return () => observer.disconnect();
    }, [filteredAssets.length]);

    const uploadNewAsset = (file: File | null | undefined) => {
        if (!file) {
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        setIsAdding(true);
        router.post('/settings/assets/media', formData, {
            forceFormData: true,
            onFinish: () => setIsAdding(false),
        });
    };

    const replaceSelectedAsset = (file: File | null | undefined) => {
        if (!file || !selectedAsset) {
            return;
        }

        if (
            !window.confirm(
                `Replace ${selectedAsset.label}?\n\n${referenceDescription(selectedAsset)}`,
            )
        ) {
            return;
        }

        const formData = new FormData();
        formData.append('url', selectedAsset.url);
        formData.append('file', file);
        setBusyUrl(selectedAsset.url);
        router.post('/settings/assets/media/replace', formData, {
            forceFormData: true,
            onFinish: () => setBusyUrl(null),
        });
    };

    const referenceDescription = (asset: ReusableMediaAsset) => {
        if (asset.referenceCount === 0) {
            return 'This visual is not currently used by saved learning content.';
        }

        const groups = asset.referenceGroups
            .map(({ count, label }) => `${count} ${label.toLowerCase()}`)
            .join(', ');

        return `This visual is used in ${groups}. Replacing it keeps those links intact; deleting it clears them.`;
    };

    const deleteSelectedAsset = () => {
        if (!selectedAsset) {
            return;
        }

        if (
            !window.confirm(
                `Delete ${selectedAsset.label}?\n\n${referenceDescription(selectedAsset)}`,
            )
        ) {
            return;
        }

        setBusyUrl(selectedAsset.url);
        router.delete('/settings/assets/media', {
            data: { url: selectedAsset.url },
            onFinish: () => setBusyUrl(null),
        });
    };

    return (
        <>
            {!embedded ? <Head title="Edit visuals" /> : null}
            <main
                className={cn(
                    'h-full overflow-hidden text-slate-950 dark:text-slate-100',
                    embedded
                        ? 'bg-transparent'
                        : 'bg-slate-100 dark:bg-[#0b1117]',
                )}
            >
                <div
                    className={cn(
                        'mx-auto flex h-full max-w-[92rem] flex-col px-4 pt-6 pb-24',
                        embedded && 'max-w-none px-0 pt-0 pb-0',
                    )}
                >
                    {!embedded ? (
                        <header className="shrink-0 pb-5">
                            <Button asChild className="mb-4" variant="ghost">
                                <Link href="/settings">
                                    <ArrowLeft className="size-4" />
                                    Settings
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                Visuals
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                                Existing images and animations
                            </h1>
                        </header>
                    ) : null}

                    <AssetLibraryWorkspace
                        library={
                            <aside className="flex h-full min-h-0 flex-col overflow-hidden">
                                <div className="shrink-0 border-b border-[var(--settings-border-color)] p-3">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            className="pl-9"
                                            onChange={(event) =>
                                                setSearch(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            placeholder="Search visuals"
                                            value={search}
                                        />
                                    </div>
                                </div>

                                <div
                                    className="min-h-0 flex-1 overflow-hidden p-3"
                                    ref={visualsLibraryRef}
                                >
                                    <LearnerPaginatedItems
                                        className="grid gap-2"
                                        emptyState={
                                            <p className="px-1 py-4 text-sm text-[var(--settings-muted-text)]">
                                                No visuals match this search.
                                            </p>
                                        }
                                        items={filteredAssets}
                                        key={search}
                                        pageSize={visualsPageSize}
                                        paginationButtonClassName="inline-flex items-center gap-1 text-sm text-[var(--settings-accent)] transition hover:text-[var(--settings-accent-foreground)] disabled:pointer-events-none disabled:opacity-40"
                                        paginationClassName="flex items-center justify-between border-t border-[var(--settings-border-color)] pt-3"
                                        paginationTextClassName="text-xs text-[var(--settings-muted-text)]"
                                        renderItem={(asset) => (
                                            <AssetListItem
                                                asset={asset}
                                                isSelected={
                                                    selectedAsset?.url ===
                                                    asset.url
                                                }
                                                key={asset.url}
                                                onSelect={() =>
                                                    setSelectedUrl(asset.url)
                                                }
                                            />
                                        )}
                                    />
                                </div>

                                <div className="shrink-0 border-t border-[var(--settings-border-color)] p-3">
                                    <Button
                                        className="w-full"
                                        disabled={isAdding}
                                        onClick={() =>
                                            addInputRef.current?.click()
                                        }
                                        type="button"
                                    >
                                        {isAdding ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <Plus className="size-4" />
                                        )}
                                        Add item
                                    </Button>
                                </div>
                            </aside>
                        }
                    >
                        <div className="h-full min-h-0 overflow-hidden">
                            {selectedAsset ? (
                                <AssetDetails
                                    asset={selectedAsset}
                                    busy={busyUrl === selectedAsset.url}
                                    key={selectedAsset.url}
                                    onDelete={deleteSelectedAsset}
                                    onReplace={() =>
                                        replaceInputRef.current?.click()
                                    }
                                />
                            ) : (
                                <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                                    No media assets are available yet.
                                </div>
                            )}
                        </div>
                    </AssetLibraryWorkspace>
                </div>

                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                        uploadNewAsset(event.currentTarget.files?.[0]);
                        event.currentTarget.value = '';
                    }}
                    ref={addInputRef}
                    type="file"
                />
                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                        replaceSelectedAsset(event.currentTarget.files?.[0]);
                        event.currentTarget.value = '';
                    }}
                    ref={replaceInputRef}
                    type="file"
                />
            </main>
        </>
    );
}

function AssetDetails({
    asset,
    busy,
    onDelete,
    onReplace,
}: {
    asset: ReusableMediaAsset;
    busy: boolean;
    onDelete: () => void;
    onReplace: () => void;
}) {
    const [category, setCategory] = useState(asset.category ?? '');
    const [tags, setTags] = useState(asset.tags.join(', '));
    const [hasTransparency, setHasTransparency] = useState(
        metadataChoice(asset.hasTransparency),
    );
    const [isAnimated, setIsAnimated] = useState(
        metadataChoice(asset.isAnimated),
    );
    const [isSavingMetadata, setIsSavingMetadata] = useState(false);

    const saveMetadata = () => {
        setIsSavingMetadata(true);
        router.patch(
            '/settings/assets/media/metadata',
            {
                category: category.trim() || null,
                has_transparency: parseMetadataChoice(hasTransparency),
                is_animated: parseMetadataChoice(isAnimated),
                tags: tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                url: asset.url,
            },
            { onFinish: () => setIsSavingMetadata(false) },
        );
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-[var(--settings-content-background)] p-6">
                <img
                    alt=""
                    className="max-h-full max-w-full rounded-lg object-contain"
                    draggable={false}
                    src={asset.url}
                />
            </div>

            <div className="shrink-0 border-t border-slate-200 p-4 dark:border-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-950 dark:text-white">
                            {asset.label}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {asset.source} / {asset.extension.toUpperCase()}
                        </p>
                        <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                            {asset.referenceCount === 0
                                ? 'Not currently used by saved learning content.'
                                : `Used in ${asset.referenceGroups.map(({ count, label }) => `${count} ${label.toLowerCase()}`).join(', ')}.`}
                        </p>
                        {asset.canViewPath ? (
                            <p className="mt-2 text-xs break-all text-slate-400 dark:text-slate-500">
                                {asset.url}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            disabled={busy}
                            onClick={onReplace}
                            type="button"
                            variant="secondary"
                        >
                            <Upload className="size-4" />
                            Replace and keep links
                        </Button>
                        <Button asChild type="button" variant="ghost">
                            <a
                                download
                                href={mediaAssetRoutes.download.url({
                                    query: { url: asset.url },
                                })}
                                rel="noreferrer"
                            >
                                <Download className="size-4" />
                                Download
                            </a>
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={onDelete}
                            type="button"
                            variant="destructive"
                        >
                            <Trash2 className="size-4" />
                            Delete
                        </Button>
                    </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            Library metadata
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Add a category, tags and visual properties to make
                            this asset easier to find and reuse.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                            Category
                            <Input
                                onChange={(event) =>
                                    setCategory(event.currentTarget.value)
                                }
                                placeholder="Map, character, background..."
                                value={category}
                            />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                            Tags
                            <Input
                                onChange={(event) =>
                                    setTags(event.currentTarget.value)
                                }
                                placeholder="forest, portal, dark"
                                value={tags}
                            />
                        </label>
                        <MetadataSelect
                            label="Transparency"
                            onChange={setHasTransparency}
                            value={hasTransparency}
                        />
                        <MetadataSelect
                            label="Animation"
                            onChange={setIsAnimated}
                            value={isAnimated}
                        />
                    </div>
                    <Button
                        className="mt-3"
                        disabled={isSavingMetadata}
                        onClick={saveMetadata}
                        type="button"
                    >
                        {isSavingMetadata ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        Save metadata
                    </Button>
                </div>
            </div>
        </div>
    );
}

function MetadataSelect({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {label}
            <select
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] dark:border-white/15 dark:bg-slate-950 dark:text-white"
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            >
                <option value="">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
            </select>
        </label>
    );
}

function metadataChoice(value: boolean | null): string {
    return value === null ? '' : value ? 'true' : 'false';
}

function parseMetadataChoice(value: string): boolean | null {
    return value === '' ? null : value === 'true';
}

function AssetListItem({
    asset,
    isSelected,
    onSelect,
}: {
    asset: ReusableMediaAsset;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            data-visual-library-item
            className={cn(
                'grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border p-2 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                isSelected
                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                    : 'border-slate-200 bg-slate-50 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] dark:border-white/10 dark:bg-white/5',
            )}
            onClick={onSelect}
            type="button"
        >
            <span className="grid size-14 place-items-center overflow-hidden rounded-md bg-white dark:bg-slate-950/80">
                <img
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                    src={asset.url}
                />
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {asset.label}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Image className="size-3" />
                    <span className="truncate">{asset.source}</span>
                    <span className="shrink-0 uppercase">
                        {asset.extension}
                    </span>
                </span>
                {asset.category || asset.tags.length > 0 ? (
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {[asset.category, ...asset.tags]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                ) : null}
            </span>
        </button>
    );
}
