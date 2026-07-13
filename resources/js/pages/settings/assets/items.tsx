import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    Image,
    LoaderCircle,
    Package,
    Plus,
    Save,
    Search,
    Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';

type AdminItem = {
    description: string | null;
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    slug: string;
    title: string;
};

type ItemForm = {
    description: string;
    image_dark: string;
    image_light: string;
    slug: string;
    title: string;
};

const emptyForm: ItemForm = {
    description: '',
    image_dark: '',
    image_light: '',
    slug: '',
    title: '',
};

export default function AdminItemsPage({ items }: { items: AdminItem[] }) {
    const { url } = usePage();
    const selectedFromUrl = useMemo(() => selectedItemIdFromUrl(url), [url]);
    const [selectedItemId, setSelectedItemId] = useState<number | null>(
        () => selectedFromUrl ?? items[0]?.id ?? null,
    );
    const [search, setSearch] = useState('');
    const selectedItem =
        items.find((item) => item.id === selectedItemId) ?? null;
    const filteredItems = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return needle
            ? items.filter((item) =>
                  [item.title, item.slug, item.description ?? '']
                      .join(' ')
                      .toLowerCase()
                      .includes(needle),
              )
            : items;
    }, [items, search]);

    return (
        <>
            <Head title="Edit items" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-7xl flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href="/settings/assets">
                                <ArrowLeft className="size-4" />
                                Tools, items and currencies
                            </Link>
                        </Button>
                        <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                            Administration
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Edit items
                        </h1>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <ItemFormPanel
                            key={selectedItem?.id ?? 'new'}
                            selectedItem={selectedItem}
                        />
                        <ItemListPanel
                            filteredItems={filteredItems}
                            onCreate={() => setSelectedItemId(null)}
                            onSearch={setSearch}
                            onSelect={setSelectedItemId}
                            search={search}
                            selectedItemId={selectedItemId}
                        />
                    </section>
                </div>
            </main>
        </>
    );
}

function ItemFormPanel({ selectedItem }: { selectedItem: AdminItem | null }) {
    const [form, setForm] = useState<ItemForm>(() =>
        selectedItem ? formFromItem(selectedItem) : emptyForm,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>(
        {},
    );
    const [saving, setSaving] = useState(false);
    const [uploadingField, setUploadingField] = useState<keyof ItemForm | null>(
        null,
    );
    const updateField = (field: keyof ItemForm, value: string) =>
        setForm((current) => ({ ...current, [field]: value }));

    const saveItem = () => {
        setSaving(true);
        setErrors({});

        const options = {
            onError: (nextErrors: Record<string, string>) =>
                setErrors(nextErrors),
            onFinish: () => setSaving(false),
            preserveScroll: true,
            preserveState: false,
        };

        if (selectedItem) {
            router.patch(
                `/settings/assets/items/${selectedItem.id}`,
                form,
                options,
            );

            return;
        }

        router.post('/settings/assets/items', form, options);
    };

    const uploadMedia = async (field: keyof ItemForm, file: File) => {
        setUploadingField(field);
        setUploadErrors((current) => ({ ...current, [field]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/assets/item-media',
                file,
            });

            updateField(field, payload.url);
        } catch (error) {
            setUploadErrors((current) => ({
                ...current,
                [field]:
                    error instanceof Error
                        ? error.message
                        : 'The file could not be uploaded.',
            }));
        } finally {
            setUploadingField(null);
        }
    };

    return (
        <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
            <div className="flex h-full flex-col">
                <div className="shrink-0 border-b border-slate-200 p-4 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-slate-950/70 dark:text-teal-200">
                            <Package className="size-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                                {selectedItem ? selectedItem.title : 'New item'}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Consumable inventory object.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="grid gap-4">
                        <TextField
                            error={errors.title}
                            label="Name"
                            onChange={(value) => updateField('title', value)}
                            value={form.title}
                        />
                        <TextField
                            error={errors.slug}
                            label="Slug"
                            onChange={(value) => updateField('slug', value)}
                            value={form.slug}
                        />
                        <TextField
                            error={errors.description}
                            label="Description"
                            onChange={(value) =>
                                updateField('description', value)
                            }
                            value={form.description}
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                            <MediaField
                                error={
                                    errors.image_dark ?? uploadErrors.image_dark
                                }
                                label="Dark image"
                                onChange={(value) =>
                                    updateField('image_dark', value)
                                }
                                onUpload={(file) =>
                                    uploadMedia('image_dark', file)
                                }
                                uploading={uploadingField === 'image_dark'}
                                value={form.image_dark}
                            />
                            <MediaField
                                error={
                                    errors.image_light ??
                                    uploadErrors.image_light
                                }
                                label="Light image"
                                onChange={(value) =>
                                    updateField('image_light', value)
                                }
                                onUpload={(file) =>
                                    uploadMedia('image_light', file)
                                }
                                uploading={uploadingField === 'image_light'}
                                value={form.image_light}
                            />
                        </div>
                    </div>
                </div>

                <footer className="flex shrink-0 justify-end border-t border-slate-200 p-4 dark:border-white/10">
                    <Button disabled={saving} onClick={saveItem} type="button">
                        {saving ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        Save item
                    </Button>
                </footer>
            </div>
        </div>
    );
}

function ItemListPanel({
    filteredItems,
    onCreate,
    onSearch,
    onSelect,
    search,
    selectedItemId,
}: {
    filteredItems: AdminItem[];
    onCreate: () => void;
    onSearch: (value: string) => void;
    onSelect: (id: number) => void;
    search: string;
    selectedItemId: number | null;
}) {
    return (
        <aside className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
            <div className="flex h-full flex-col">
                <div className="shrink-0 border-b border-slate-200 p-4 dark:border-white/10">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            className="pl-9"
                            onChange={(event) =>
                                onSearch(event.currentTarget.value)
                            }
                            placeholder="Search items"
                            value={search}
                        />
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="grid gap-2">
                        {filteredItems.map((item) => (
                            <button
                                className={cn(
                                    'flex items-center gap-3 rounded-lg border p-3 text-left transition',
                                    selectedItemId === item.id
                                        ? 'border-cyan-500 bg-cyan-50 dark:border-teal-200 dark:bg-teal-200/10'
                                        : 'border-slate-200 bg-slate-50 hover:border-cyan-500/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-teal-200/40',
                                )}
                                key={item.id}
                                onClick={() => onSelect(item.id)}
                                type="button"
                            >
                                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-white dark:bg-slate-950/80">
                                    {item.imageDark || item.imageLight ? (
                                        <img
                                            alt=""
                                            className="h-full w-full object-contain"
                                            src={
                                                item.imageDark ??
                                                item.imageLight ??
                                                ''
                                            }
                                        />
                                    ) : (
                                        <Package className="size-5 text-cyan-700 dark:text-teal-200" />
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">
                                        {item.title}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                                        {item.slug}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="shrink-0 border-t border-slate-200 p-4 dark:border-white/10">
                    <Button className="w-full" onClick={onCreate} type="button">
                        <Plus className="size-4" />
                        Create item
                    </Button>
                </div>
            </div>
        </aside>
    );
}

function TextField({
    error,
    label,
    onChange,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            <Input
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function MediaField({
    error,
    label,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div className="grid gap-3 rounded-lg bg-slate-100 p-4 dark:bg-white/5">
            <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-200/12 dark:text-teal-200">
                    <Image className="size-4" />
                </span>
                <Label>{label}</Label>
            </div>
            <Input
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            />
            {value ? (
                <div className="grid h-28 place-items-center overflow-hidden rounded-md bg-white dark:bg-slate-950/70">
                    <img
                        alt=""
                        className="max-h-full max-w-full object-contain"
                        src={value}
                    />
                </div>
            ) : null}
            <InputError message={error} />
            <div className="flex flex-wrap gap-2">
                <Button asChild disabled={uploading} variant="secondary">
                    <label>
                        {uploading ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Upload className="size-4" />
                        )}
                        Upload
                        <input
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];

                                if (file) {
                                    onUpload(file);
                                }
                            }}
                            type="file"
                        />
                    </label>
                </Button>
                <Button
                    disabled={!value}
                    onClick={() => window.open(value, '_blank', 'noopener')}
                    type="button"
                    variant="ghost"
                >
                    <Download className="size-4" />
                    Download
                </Button>
                <Button
                    onClick={() => setPickerOpen(true)}
                    type="button"
                    variant="ghost"
                >
                    Select existing
                </Button>
            </div>
            {pickerOpen ? (
                <ReusableImagePicker
                    currentValue={value}
                    onClear={() => onChange('')}
                    onClose={() => setPickerOpen(false)}
                    onSelect={(url) => {
                        onChange(url);
                        setPickerOpen(false);
                    }}
                />
            ) : null}
        </div>
    );
}

function formFromItem(item: AdminItem): ItemForm {
    return {
        description: item.description ?? '',
        image_dark: item.imageDark ?? '',
        image_light: item.imageLight ?? '',
        slug: item.slug,
        title: item.title,
    };
}

function selectedItemIdFromUrl(url: string): number | null {
    const item = new URL(url, window.location.origin).searchParams.get('item');
    const id = item ? Number(item) : null;

    return id && Number.isFinite(id) ? id : null;
}
