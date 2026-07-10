import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Download,
    Hammer,
    Image,
    LoaderCircle,
    Plus,
    Save,
    Search,
    Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type AdminTool = {
    animationDark: string | null;
    animationDurationSeconds: number | null;
    animationLight: string | null;
    createdAt: string | null;
    description: string | null;
    id: number;
    imageDark: string | null;
    imageLight: string | null;
    slug: string;
    title: string;
    updatedAt: string | null;
};

type ToolForm = {
    animation_dark: string;
    animation_duration_seconds: string;
    animation_light: string;
    description: string;
    image_dark: string;
    image_light: string;
    slug: string;
    title: string;
};

const emptyForm: ToolForm = {
    animation_dark: '',
    animation_duration_seconds: '',
    animation_light: '',
    description: '',
    image_dark: '',
    image_light: '',
    slug: '',
    title: '',
};

export default function AdminToolsPage({ tools }: { tools: AdminTool[] }) {
    const { url } = usePage();
    const querySelectedToolId = useMemo(
        () => selectedToolIdFromUrl(url),
        [url],
    );
    const [selectedToolId, setSelectedToolId] = useState<number | null>(
        () => querySelectedToolId ?? tools[0]?.id ?? null,
    );
    const selectedTool =
        tools.find((tool) => tool.id === selectedToolId) ?? null;
    const [search, setSearch] = useState('');

    const filteredTools = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return tools;
        }

        return tools.filter((tool) =>
            [tool.title, tool.slug, tool.description ?? '']
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [search, tools]);

    const createNewTool = () => {
        setSelectedToolId(null);
    };

    return (
        <>
            <Head title="Edit tools" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-7xl flex-col px-4 pt-6 pb-24">
                    <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                        <div>
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
                                Edit tools
                            </h1>
                        </div>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <ToolFormPanel
                            key={selectedTool?.id ?? 'new'}
                            isNew={!selectedTool}
                            selectedTool={selectedTool}
                        />
                        <ToolListPanel
                            filteredTools={filteredTools}
                            onCreate={createNewTool}
                            onSearch={setSearch}
                            onSelect={setSelectedToolId}
                            search={search}
                            selectedToolId={selectedToolId}
                        />
                    </section>
                </div>
            </main>
        </>
    );
}

function ToolFormPanel({
    isNew,
    selectedTool,
}: {
    isNew: boolean;
    selectedTool: AdminTool | null;
}) {
    const [form, setForm] = useState<ToolForm>(() =>
        selectedTool ? formFromTool(selectedTool) : emptyForm,
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [uploadingField, setUploadingField] = useState<keyof ToolForm | null>(
        null,
    );
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>(
        {},
    );
    const updateField = (field: keyof ToolForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };
    const saveTool = () => {
        setSaving(true);
        setErrors({});

        const options = {
            onError: (nextErrors: Record<string, string>) =>
                setErrors(nextErrors),
            onFinish: () => setSaving(false),
            preserveScroll: true,
            preserveState: false,
        };

        if (selectedTool) {
            router.patch(
                `/settings/assets/tools/${selectedTool.id}`,
                form,
                options,
            );

            return;
        }

        router.post('/settings/assets/tools', form, options);
    };
    const uploadMedia = async (field: keyof ToolForm, file: File) => {
        const formData = new FormData();
        const csrfToken =
            document
                .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.getAttribute('content') ?? '';

        formData.append('file', file);
        setUploadingField(field);
        setUploadErrors((current) => ({ ...current, [field]: '' }));

        try {
            const response = await fetch('/settings/assets/tool-media', {
                body: formData,
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                },
                method: 'POST',
            });
            const payload = (await response.json()) as {
                durationSeconds?: number | null;
                errors?: Record<string, string[]>;
                message?: string;
                url?: string;
            };

            if (!response.ok || !payload.url) {
                setUploadErrors((current) => ({
                    ...current,
                    [field]:
                        payload.errors?.file?.[0] ??
                        payload.message ??
                        'The file could not be uploaded.',
                }));

                return;
            }

            updateField(field, payload.url);

            if (
                field.startsWith('animation_') &&
                payload.durationSeconds !== null &&
                payload.durationSeconds !== undefined
            ) {
                updateField(
                    'animation_duration_seconds',
                    String(payload.durationSeconds),
                );
            }
        } catch {
            setUploadErrors((current) => ({
                ...current,
                [field]: 'The file could not be uploaded.',
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
                            <Hammer className="size-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                                {isNew ? 'Create tool' : form.title}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isNew
                                    ? 'Define a reusable tool for learner interactions.'
                                    : `Last updated ${formatDate(selectedTool?.updatedAt ?? null)}`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="grid gap-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <TextField
                                error={errors.title}
                                id="tool-title"
                                label="Unique name"
                                onChange={(value) =>
                                    updateField('title', value)
                                }
                                value={form.title}
                            />
                            <TextField
                                error={errors.slug}
                                id="tool-slug"
                                label="Slug"
                                onChange={(value) => updateField('slug', value)}
                                placeholder="Generated from the name when empty"
                                value={form.slug}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="tool-description">
                                Description
                            </Label>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:border-teal-200 dark:focus:ring-teal-200/20"
                                id="tool-description"
                                onChange={(event) =>
                                    updateField(
                                        'description',
                                        event.currentTarget.value,
                                    )
                                }
                                value={form.description}
                            />
                            <InputError message={errors.description} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <MediaField
                                error={
                                    errors.image_dark ?? uploadErrors.image_dark
                                }
                                field="image_dark"
                                label="Dark tool image"
                                onChange={updateField}
                                onUpload={uploadMedia}
                                uploading={uploadingField === 'image_dark'}
                                value={form.image_dark}
                            />
                            <MediaField
                                error={
                                    errors.image_light ??
                                    uploadErrors.image_light
                                }
                                field="image_light"
                                label="Light tool image"
                                onChange={updateField}
                                onUpload={uploadMedia}
                                uploading={uploadingField === 'image_light'}
                                value={form.image_light}
                            />
                            <MediaField
                                error={
                                    errors.animation_dark ??
                                    uploadErrors.animation_dark
                                }
                                field="animation_dark"
                                label="Dark animation GIF/WebP"
                                onChange={updateField}
                                onUpload={uploadMedia}
                                uploading={uploadingField === 'animation_dark'}
                                value={form.animation_dark}
                            />
                            <MediaField
                                error={
                                    errors.animation_light ??
                                    uploadErrors.animation_light
                                }
                                field="animation_light"
                                label="Light animation GIF/WebP"
                                onChange={updateField}
                                onUpload={uploadMedia}
                                uploading={uploadingField === 'animation_light'}
                                value={form.animation_light}
                            />
                        </div>

                        <TextField
                            error={errors.animation_duration_seconds}
                            id="animation-duration"
                            label="Animation duration in seconds"
                            onChange={(value) =>
                                updateField('animation_duration_seconds', value)
                            }
                            placeholder="Specify manually for now"
                            type="number"
                            value={form.animation_duration_seconds}
                        />
                    </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 p-4 dark:border-white/10">
                    <Button disabled={saving} onClick={saveTool}>
                        {saving ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        {isNew ? 'Create tool' : 'Save tool'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ToolListPanel({
    filteredTools,
    onCreate,
    onSearch,
    onSelect,
    search,
    selectedToolId,
}: {
    filteredTools: AdminTool[];
    onCreate: () => void;
    onSearch: (value: string) => void;
    onSelect: (toolId: number) => void;
    search: string;
    selectedToolId: number | null;
}) {
    return (
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
            <div className="shrink-0 border-b border-slate-200 p-3 dark:border-white/10">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        className="pl-9"
                        onChange={(event) =>
                            onSearch(event.currentTarget.value)
                        }
                        placeholder="Search tools"
                        value={search}
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filteredTools.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No tools match this search.
                    </p>
                ) : (
                    <div className="grid gap-2">
                        {filteredTools.map((tool) => (
                            <ToolListItem
                                isSelected={selectedToolId === tool.id}
                                key={tool.id}
                                onSelect={() => onSelect(tool.id)}
                                tool={tool}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10">
                <Button
                    className="w-full"
                    onClick={onCreate}
                    variant="secondary"
                >
                    <Plus className="size-4" />
                    Create new tool
                </Button>
            </div>
        </aside>
    );
}

function ToolListItem({
    isSelected,
    onSelect,
    tool,
}: {
    isSelected: boolean;
    onSelect: () => void;
    tool: AdminTool;
}) {
    const image = tool.imageDark ?? tool.imageLight;

    return (
        <button
            className={cn(
                'flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-cyan-500/35 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/8 dark:bg-white/5 dark:hover:border-teal-200/35 dark:hover:bg-teal-100/8 dark:focus-visible:ring-teal-200',
                isSelected &&
                    'border-cyan-600 bg-cyan-50 dark:border-teal-200 dark:bg-teal-200/10',
            )}
            onClick={onSelect}
            type="button"
        >
            <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white dark:bg-slate-950">
                {image ? (
                    <img
                        alt=""
                        className="size-full object-contain"
                        draggable={false}
                        src={image}
                    />
                ) : (
                    <Hammer className="size-5 text-slate-400" />
                )}
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {tool.title}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {tool.slug}
                </span>
            </span>
        </button>
    );
}

function TextField({
    error,
    id,
    label,
    onChange,
    placeholder,
    type = 'text',
    value,
}: {
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                min={type === 'number' ? 0 : undefined}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder={placeholder}
                step={type === 'number' ? 0.1 : undefined}
                type={type}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function MediaField({
    error,
    field,
    label,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    error?: string;
    field: keyof ToolForm;
    label: string;
    onChange: (field: keyof ToolForm, value: string) => void;
    onUpload: (field: keyof ToolForm, file: File) => void;
    uploading: boolean;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={field}>{label}</Label>
            <div className="flex gap-2">
                <Input
                    className="min-w-0"
                    id={field}
                    onChange={(event) =>
                        onChange(field, event.currentTarget.value)
                    }
                    value={value}
                />
                <label className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-cyan-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-white/10">
                    {uploading ? (
                        <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                        <Upload className="size-4" />
                    )}
                    <input
                        className="sr-only"
                        onChange={(event) => {
                            const file = event.currentTarget.files?.[0];

                            if (file) {
                                onUpload(field, file);
                            }

                            event.currentTarget.value = '';
                        }}
                        type="file"
                    />
                </label>
                {value ? (
                    <Button asChild size="icon" variant="secondary">
                        <a download href={value}>
                            <Download className="size-4" />
                        </a>
                    </Button>
                ) : null}
            </div>
            {value ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                    <Image className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {value}
                    </span>
                </div>
            ) : null}
            <InputError message={error} />
        </div>
    );
}

function formFromTool(tool: AdminTool): ToolForm {
    return {
        animation_dark: tool.animationDark ?? '',
        animation_duration_seconds:
            tool.animationDurationSeconds === null
                ? ''
                : String(tool.animationDurationSeconds),
        animation_light: tool.animationLight ?? '',
        description: tool.description ?? '',
        image_dark: tool.imageDark ?? '',
        image_light: tool.imageLight ?? '',
        slug: tool.slug,
        title: tool.title,
    };
}

function selectedToolIdFromUrl(url: string): number | null {
    const query = url.split('?')[1] ?? '';
    const value = new URLSearchParams(query).get('tool');
    const parsed = Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatDate(value: string | null): string {
    if (!value) {
        return 'not saved yet';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
