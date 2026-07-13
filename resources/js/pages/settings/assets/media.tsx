import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    Image,
    LoaderCircle,
    Plus,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ReusableMediaAsset = {
    canDelete: boolean;
    extension: string;
    label: string;
    source: string;
    uploaded: boolean;
    url: string;
};

export default function AdminMediaAssets({
    assets,
}: {
    assets: ReusableMediaAsset[];
}) {
    const [search, setSearch] = useState('');
    const [selectedUrl, setSelectedUrl] = useState(assets[0]?.url ?? '');
    const [busyUrl, setBusyUrl] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const addInputRef = useRef<HTMLInputElement | null>(null);
    const replaceInputRef = useRef<HTMLInputElement | null>(null);
    const selectedAsset =
        assets.find((asset) => asset.url === selectedUrl) ?? assets[0] ?? null;
    const filteredAssets = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return assets;
        }

        return assets.filter((asset) =>
            [asset.label, asset.source, asset.extension, asset.url]
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [assets, search]);

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

        const formData = new FormData();
        formData.append('url', selectedAsset.url);
        formData.append('file', file);
        setBusyUrl(selectedAsset.url);
        router.post('/settings/assets/media/replace', formData, {
            forceFormData: true,
            onFinish: () => setBusyUrl(null),
        });
    };

    const deleteSelectedAsset = () => {
        if (!selectedAsset) {
            return;
        }

        if (!window.confirm(`Delete ${selectedAsset.label}?`)) {
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
            <Head title="Edit visuals" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-[92rem] flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href="/settings">
                                <ArrowLeft className="size-4" />
                                Settings
                            </Link>
                        </Button>
                        <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                            Visuals
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Existing images and animations
                        </h1>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            {selectedAsset ? (
                                <AssetDetails
                                    asset={selectedAsset}
                                    busy={busyUrl === selectedAsset.url}
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

                        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            <div className="shrink-0 border-b border-slate-200 p-3 dark:border-white/10">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        onChange={(event) =>
                                            setSearch(event.currentTarget.value)
                                        }
                                        placeholder="Search visuals"
                                        value={search}
                                    />
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <div className="grid gap-2">
                                    {filteredAssets.map((asset) => (
                                        <AssetListItem
                                            asset={asset}
                                            isSelected={
                                                selectedAsset?.url === asset.url
                                            }
                                            key={asset.url}
                                            onSelect={() =>
                                                setSelectedUrl(asset.url)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10">
                                <Button
                                    className="w-full"
                                    disabled={isAdding}
                                    onClick={() => addInputRef.current?.click()}
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
                    </section>
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
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-slate-50 p-6 dark:bg-slate-950/50">
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
                            {asset.source} · {asset.extension.toUpperCase()}
                        </p>
                        <p className="mt-2 text-xs break-all text-slate-400 dark:text-slate-500">
                            {asset.url}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            disabled={busy}
                            onClick={onReplace}
                            type="button"
                            variant="secondary"
                        >
                            <Upload className="size-4" />
                            Replace and keep
                        </Button>
                        <Button asChild type="button" variant="ghost">
                            <a download href={asset.url} rel="noreferrer">
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
            </div>
        </div>
    );
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
            className={cn(
                'grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border p-2 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:focus-visible:ring-teal-200',
                isSelected
                    ? 'border-cyan-600 bg-cyan-50 dark:border-teal-200 dark:bg-teal-200/10'
                    : 'border-slate-200 bg-slate-50 hover:border-cyan-500/40 hover:bg-cyan-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal-200/40 dark:hover:bg-teal-200/10',
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
            </span>
        </button>
    );
}
