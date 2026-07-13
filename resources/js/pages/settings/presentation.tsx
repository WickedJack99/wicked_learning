import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    FileText,
    Github,
    GripVertical,
    Image,
    LogIn,
    Moon,
    MousePointer2,
    Palette,
    Plus,
    Save,
    Sun,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    defaultPlatformInformationPages,
    getPlatformInformationLinks,
    getPlatformInformationPages,
    getPublicPresentationPalette,
    getWelcomePageBackgroundImage,
    getWelcomePages,
} from '@/theme/presentation';
import type {
    BackgroundImageSettings,
    CursorImageSettings,
    PlatformInformationPageSettings,
    PublicPaletteModeSettings,
    PublicPresentationSettings,
    SourceLinkSettings,
    WelcomePageButtonSettings,
    WelcomePageSettings,
} from '@/theme/presentation';

type ThemeMode = 'dark' | 'light';
type SectionKey = 'auth' | 'colors' | 'cursors' | 'info' | 'source' | 'welcome';
type CursorKey = keyof PublicPresentationSettings['cursors'];
type PaletteField = keyof PublicPaletteModeSettings;

type Props = {
    publicPresentation: PublicPresentationSettings;
};

const sections: Array<{
    icon: typeof Image;
    key: SectionKey;
    label: string;
}> = [
    { key: 'welcome', label: 'Welcome pages', icon: Image },
    { key: 'auth', label: 'Register and Login', icon: LogIn },
    { key: 'info', label: 'Platform information pages', icon: FileText },
    { key: 'source', label: 'Source code links', icon: Github },
    { key: 'cursors', label: 'Cursors', icon: MousePointer2 },
    { key: 'colors', label: 'Public text colors', icon: Palette },
];

const cursorRoles: Array<{
    key: CursorKey;
    label: string;
}> = [
    { key: 'default', label: 'Normal cursor' },
    { key: 'action', label: 'Action pointer' },
    { key: 'grab', label: 'Grab cursor' },
    { key: 'text', label: 'Text input cursor' },
    { key: 'denied', label: 'Denied cursor' },
];

const paletteFields: Array<{
    field: PaletteField;
    label: string;
    preview: string;
}> = [
    { field: 'headingText', label: 'Heading text', preview: 'Learning Worlds' },
    {
        field: 'bodyText',
        label: 'Body text',
        preview: 'A calm public paragraph describing the platform.',
    },
    { field: 'mutedText', label: 'Muted text', preview: 'Secondary context' },
    { field: 'accentText', label: 'Accent', preview: 'Highlighted action' },
    { field: 'controlText', label: 'Control text', preview: 'Log in' },
    { field: 'controlBorder', label: 'Control border', preview: 'Border' },
];

const blankButton: WelcomePageButtonSettings = {
    text: 'New button',
    target: '/world',
};

const blankWelcomePage: WelcomePageSettings = {
    backgrounds: { dark: '', light: '' },
    body: 'Describe this public welcome page.',
    buttons: [blankButton],
    eyebrow: 'New page',
    primaryLabel: 'New button',
    title: 'New welcome page',
};

const blankInfoPage: PlatformInformationPageSettings = {
    backgrounds: { dark: '', light: '' },
    key: 'new-page',
    markdown: '# New page\n\nWrite public information here.',
    title: 'New page',
};

const blankSourceLink: SourceLinkSettings = {
    label: 'Modified source',
    url: 'https://github.com/example/example',
};

export default function PresentationSettingsPage({
    publicPresentation,
}: Props) {
    const [activeSection, setActiveSection] = useState<SectionKey>('welcome');
    const [configMode, setConfigMode] = useState<ThemeMode>('dark');
    const [draft, setDraft] = useState<PublicPresentationSettings>(() => ({
        ...structuredClone(publicPresentation),
        welcome: {
            ...publicPresentation.welcome,
            pages: getWelcomePages(publicPresentation),
        },
        infoPages: {
            pages: getPlatformInformationPages(publicPresentation),
        },
    }));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = () => {
        setSaving(true);
        router.patch('/settings/presentation', draft, {
            preserveScroll: true,
            preserveState: true,
            onError: (validationErrors) => setErrors(validationErrors),
            onSuccess: () => setErrors({}),
            onFinish: () => setSaving(false),
        });
    };

    const uploadImage = async (
        fieldKey: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('image', file);
        setUploading(fieldKey);

        try {
            const response = await fetch(
                '/settings/presentation/background-images',
                {
                    body: formData,
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
                    method: 'POST',
                },
            );
            const payload = (await response.json()) as {
                errors?: Record<string, string[]>;
                message?: string;
                url?: string;
            };

            if (!response.ok || !payload.url) {
                setErrors((current) => ({
                    ...current,
                    [fieldKey]:
                        payload.errors?.image?.[0] ??
                        payload.message ??
                        'The image could not be uploaded.',
                }));

                return;
            }

            onUploaded(payload.url);
        } finally {
            setUploading(null);
        }
    };

    return (
        <>
            <Head title="Public presentation" />
            <main className="fixed inset-0 overflow-hidden bg-slate-100 px-4 pt-5 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full min-h-0 w-full max-w-[92rem] flex-col overflow-hidden">
                    <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                        <div>
                            <Button asChild className="mb-4" variant="ghost">
                                <Link href="/settings">
                                    <ArrowLeft className="size-4" />
                                    Settings
                                </Link>
                            </Button>
                            <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                Administration
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                                Public presentation
                            </h1>
                        </div>
                        <Button disabled={saving} onClick={save}>
                            <Save className="size-4" />
                            Save changes
                        </Button>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:grid-cols-[16rem_minmax(0,1fr)] dark:border-white/10 dark:bg-[#111820]">
                        <aside className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                            <nav className="grid gap-2">
                                {sections.map((section) => {
                                    const Icon = section.icon;

                                    return (
                                        <button
                                            className={cn(
                                                'flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition',
                                                activeSection === section.key
                                                    ? 'bg-cyan-600 text-white shadow-sm dark:bg-teal-300 dark:text-slate-950'
                                                    : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                                            )}
                                            key={section.key}
                                            onClick={() =>
                                                setActiveSection(section.key)
                                            }
                                            type="button"
                                        >
                                            <Icon className="size-4" />
                                            {section.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </aside>

                        <div className="flex min-h-0 flex-col overflow-hidden">
                            <div className="mb-4 flex shrink-0 justify-end">
                                <ModeConfigSwitch
                                    mode={configMode}
                                    onChange={setConfigMode}
                                />
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                {activeSection === 'welcome' ? (
                                    <WelcomePagesEditor
                                        configMode={configMode}
                                        draft={draft}
                                        errors={errors}
                                        onChange={setDraft}
                                        onUpload={uploadImage}
                                        uploading={uploading}
                                    />
                                ) : null}
                                {activeSection === 'info' ? (
                                    <InformationPagesEditor
                                        configMode={configMode}
                                        draft={draft}
                                        errors={errors}
                                        onChange={setDraft}
                                        onUpload={uploadImage}
                                        uploading={uploading}
                                    />
                                ) : null}
                                {activeSection === 'auth' ? (
                                    <AuthBackgroundsEditor
                                        configMode={configMode}
                                        draft={draft}
                                        errors={errors}
                                        onChange={setDraft}
                                        onUpload={uploadImage}
                                        uploading={uploading}
                                    />
                                ) : null}
                                {activeSection === 'source' ? (
                                    <SourceLinksEditor
                                        draft={draft}
                                        errors={errors}
                                        onChange={setDraft}
                                    />
                                ) : null}
                                {activeSection === 'cursors' ? (
                                    <CursorEditor
                                        configMode={configMode}
                                        draft={draft}
                                        errors={errors}
                                        onChange={setDraft}
                                        onUpload={uploadImage}
                                        uploading={uploading}
                                    />
                                ) : null}
                                {activeSection === 'colors' ? (
                                    <PublicPaletteEditor
                                        draft={draft}
                                        errors={errors}
                                        mode={configMode}
                                        onChange={setDraft}
                                    />
                                ) : null}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

PresentationSettingsPage.layout = {
    breadcrumbs: [
        {
            title: 'Public presentation',
            href: '/settings/presentation',
        },
    ],
};

function ModeConfigSwitch({
    mode,
    onChange,
}: {
    mode: ThemeMode;
    onChange: (mode: ThemeMode) => void;
}) {
    return (
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/80">
            {[
                { icon: Moon, label: 'Dark config', value: 'dark' as const },
                { icon: Sun, label: 'Light config', value: 'light' as const },
            ].map((option) => {
                const Icon = option.icon;

                return (
                    <button
                        aria-label={option.label}
                        className={cn(
                            'grid size-10 place-items-center rounded-xl transition',
                            mode === option.value
                                ? 'bg-cyan-600 text-white dark:bg-teal-300 dark:text-slate-950'
                                : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                        )}
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        type="button"
                    >
                        <Icon className="size-4" />
                    </button>
                );
            })}
        </div>
    );
}

function WelcomePagesEditor({
    configMode,
    draft,
    errors,
    onChange,
    onUpload,
    uploading,
}: EditorProps) {
    const pages = draft.welcome.pages;

    const updatePage = (
        index: number,
        updater: (page: WelcomePageSettings) => WelcomePageSettings,
    ) => {
        onChange((current) => ({
            ...current,
            welcome: {
                ...current.welcome,
                pages: current.welcome.pages.map((page, pageIndex) =>
                    pageIndex === index ? updater(page) : page,
                ),
            },
        }));
    };

    return (
        <section className="grid gap-4">
            <SectionHeader
                action={
                    <Button
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                welcome: {
                                    ...current.welcome,
                                    pages: [
                                        ...current.welcome.pages,
                                        structuredClone(blankWelcomePage),
                                    ],
                                },
                            }))
                        }
                    >
                        <Plus className="size-4" />
                        Add
                    </Button>
                }
                description={`Editing ${configMode} mode page backgrounds. Copy and buttons apply to both modes.`}
                title="Welcome pages"
            />
            {pages.map((page, index) => (
                <EditableCard
                    key={`${page.title}-${index}`}
                    onDelete={
                        pages.length > 1
                            ? () =>
                                  onChange((current) => ({
                                      ...current,
                                      welcome: {
                                          ...current.welcome,
                                          pages: current.welcome.pages.filter(
                                              (_, pageIndex) =>
                                                  pageIndex !== index,
                                          ),
                                      },
                                  }))
                            : undefined
                    }
                    title={`Page ${index + 1}`}
                >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="grid gap-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <TextField
                                    error={
                                        errors[`welcome.pages.${index}.eyebrow`]
                                    }
                                    label="Eyebrow"
                                    onChange={(value) =>
                                        updatePage(index, (current) => ({
                                            ...current,
                                            eyebrow: value,
                                        }))
                                    }
                                    value={page.eyebrow}
                                />
                                <TextField
                                    error={
                                        errors[`welcome.pages.${index}.title`]
                                    }
                                    label="Title"
                                    onChange={(value) =>
                                        updatePage(index, (current) => ({
                                            ...current,
                                            title: value,
                                        }))
                                    }
                                    value={page.title}
                                />
                            </div>
                            <TextareaField
                                error={errors[`welcome.pages.${index}.body`]}
                                label="Body"
                                onChange={(value) =>
                                    updatePage(index, (current) => ({
                                        ...current,
                                        body: value,
                                    }))
                                }
                                value={page.body}
                            />
                            <ImagePathField
                                error={
                                    errors[
                                        `welcome.pages.${index}.backgrounds.${configMode}`
                                    ]
                                }
                                label={`${capitalize(configMode)} mode background`}
                                onChange={(value) =>
                                    updatePage(index, (current) => ({
                                        ...current,
                                        backgrounds: updateModeImage(
                                            current.backgrounds,
                                            configMode,
                                            value,
                                        ),
                                    }))
                                }
                                onUpload={(file) =>
                                    onUpload(
                                        `welcome.${index}.${configMode}`,
                                        file,
                                        (url) =>
                                            updatePage(index, (current) => ({
                                                ...current,
                                                backgrounds: updateModeImage(
                                                    current.backgrounds,
                                                    configMode,
                                                    url,
                                                ),
                                            })),
                                    )
                                }
                                uploading={
                                    uploading ===
                                    `welcome.${index}.${configMode}`
                                }
                                value={page.backgrounds?.[configMode] ?? ''}
                            />
                            <Button
                                className="w-fit"
                                onClick={() =>
                                    updatePage(index, (current) => ({
                                        ...current,
                                        buttons: [
                                            ...(current.buttons ?? []),
                                            structuredClone(blankButton),
                                        ],
                                    }))
                                }
                                type="button"
                                variant="secondary"
                            >
                                <Plus className="size-4" />
                                Add button
                            </Button>
                            <div className="grid gap-3">
                                {(page.buttons ?? []).map(
                                    (button, buttonIndex) => (
                                        <div
                                            className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] dark:border-white/10"
                                            key={buttonIndex}
                                        >
                                            <TextField
                                                error={
                                                    errors[
                                                        `welcome.pages.${index}.buttons.${buttonIndex}.text`
                                                    ]
                                                }
                                                label="Text"
                                                onChange={(value) =>
                                                    updatePage(
                                                        index,
                                                        (current) => ({
                                                            ...current,
                                                            buttons: (
                                                                current.buttons ??
                                                                []
                                                            ).map(
                                                                (
                                                                    item,
                                                                    itemIndex,
                                                                ) =>
                                                                    itemIndex ===
                                                                    buttonIndex
                                                                        ? {
                                                                              ...item,
                                                                              text: value,
                                                                          }
                                                                        : item,
                                                            ),
                                                        }),
                                                    )
                                                }
                                                value={button.text}
                                            />
                                            <TextField
                                                error={
                                                    errors[
                                                        `welcome.pages.${index}.buttons.${buttonIndex}.target`
                                                    ]
                                                }
                                                label="Target"
                                                onChange={(value) =>
                                                    updatePage(
                                                        index,
                                                        (current) => ({
                                                            ...current,
                                                            buttons: (
                                                                current.buttons ??
                                                                []
                                                            ).map(
                                                                (
                                                                    item,
                                                                    itemIndex,
                                                                ) =>
                                                                    itemIndex ===
                                                                    buttonIndex
                                                                        ? {
                                                                              ...item,
                                                                              target: value,
                                                                          }
                                                                        : item,
                                                            ),
                                                        }),
                                                    )
                                                }
                                                value={button.target}
                                            />
                                            <Button
                                                className="self-end"
                                                onClick={() =>
                                                    updatePage(
                                                        index,
                                                        (current) => ({
                                                            ...current,
                                                            buttons: (
                                                                current.buttons ??
                                                                []
                                                            ).filter(
                                                                (
                                                                    _,
                                                                    itemIndex,
                                                                ) =>
                                                                    itemIndex !==
                                                                    buttonIndex,
                                                            ),
                                                        }),
                                                    )
                                                }
                                                type="button"
                                                variant="ghost"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                        <WelcomePreview
                            mode={configMode}
                            page={page}
                            presentation={draft}
                        />
                    </div>
                </EditableCard>
            ))}
        </section>
    );
}

function InformationPagesEditor({
    configMode,
    draft,
    errors,
    onChange,
    onUpload,
    uploading,
}: EditorProps) {
    const pages = draft.infoPages?.pages ?? defaultPlatformInformationPages;
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const updatePage = (
        index: number,
        updater: (
            page: PlatformInformationPageSettings,
        ) => PlatformInformationPageSettings,
    ) => {
        onChange((current) => ({
            ...current,
            infoPages: {
                pages: (current.infoPages?.pages ?? []).map(
                    (page, pageIndex) =>
                        pageIndex === index ? updater(page) : page,
                ),
            },
        }));
    };

    return (
        <section className="grid gap-4">
            <SectionHeader
                action={
                    <Button
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                infoPages: {
                                    pages: [
                                        ...(current.infoPages?.pages ?? []),
                                        {
                                            ...structuredClone(blankInfoPage),
                                            key: uniqueInfoKey(
                                                current.infoPages?.pages ?? [],
                                            ),
                                        },
                                    ],
                                },
                            }))
                        }
                    >
                        <Plus className="size-4" />
                        Add
                    </Button>
                }
                description={`Drag by reordering controls. Editing ${configMode} mode backgrounds.`}
                title="Platform information pages"
            />
            {pages.map((page, index) => (
                <div
                    draggable
                    key={page.key}
                    onDragEnd={() => setDraggedIndex(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => setDraggedIndex(index)}
                    onDrop={(event) => {
                        event.preventDefault();

                        if (draggedIndex === null || draggedIndex === index) {
                            return;
                        }

                        onChange((current) => ({
                            ...current,
                            infoPages: {
                                pages: moveItem(
                                    current.infoPages?.pages ?? [],
                                    draggedIndex,
                                    index,
                                ),
                            },
                        }));
                        setDraggedIndex(null);
                    }}
                >
                    <EditableCard
                        dragHandle
                        onDelete={
                            pages.length > 1
                                ? () =>
                                      onChange((current) => ({
                                          ...current,
                                          infoPages: {
                                              pages: (
                                                  current.infoPages?.pages ?? []
                                              ).filter(
                                                  (_, pageIndex) =>
                                                      pageIndex !== index,
                                              ),
                                          },
                                      }))
                                : undefined
                        }
                        title={page.title}
                        tools={
                            <div className="flex gap-1">
                                <Button
                                    disabled={index === 0}
                                    onClick={() =>
                                        onChange((current) => ({
                                            ...current,
                                            infoPages: {
                                                pages: moveItem(
                                                    current.infoPages?.pages ??
                                                        [],
                                                    index,
                                                    index - 1,
                                                ),
                                            },
                                        }))
                                    }
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <ArrowUp className="size-4" />
                                </Button>
                                <Button
                                    disabled={index === pages.length - 1}
                                    onClick={() =>
                                        onChange((current) => ({
                                            ...current,
                                            infoPages: {
                                                pages: moveItem(
                                                    current.infoPages?.pages ??
                                                        [],
                                                    index,
                                                    index + 1,
                                                ),
                                            },
                                        }))
                                    }
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                >
                                    <ArrowDown className="size-4" />
                                </Button>
                            </div>
                        }
                    >
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                            <div className="grid gap-4">
                                <div className="grid gap-3 md:grid-cols-2">
                                    <TextField
                                        error={
                                            errors[
                                                `infoPages.pages.${index}.title`
                                            ]
                                        }
                                        label="Title"
                                        onChange={(value) =>
                                            updatePage(index, (current) => ({
                                                ...current,
                                                title: value,
                                            }))
                                        }
                                        value={page.title}
                                    />
                                    <TextField
                                        error={
                                            errors[
                                                `infoPages.pages.${index}.key`
                                            ]
                                        }
                                        label="Slug"
                                        onChange={(value) =>
                                            updatePage(index, (current) => ({
                                                ...current,
                                                key: slugify(value),
                                            }))
                                        }
                                        value={page.key}
                                    />
                                </div>
                                <TextareaField
                                    error={
                                        errors[
                                            `infoPages.pages.${index}.markdown`
                                        ]
                                    }
                                    label="Body"
                                    onChange={(value) =>
                                        updatePage(index, (current) => ({
                                            ...current,
                                            markdown: value,
                                        }))
                                    }
                                    rows={12}
                                    value={page.markdown}
                                />
                                <ImagePathField
                                    error={
                                        errors[
                                            `infoPages.pages.${index}.backgrounds.${configMode}`
                                        ]
                                    }
                                    label={`${capitalize(configMode)} mode background`}
                                    onChange={(value) =>
                                        updatePage(index, (current) => ({
                                            ...current,
                                            backgrounds: updateModeImage(
                                                current.backgrounds,
                                                configMode,
                                                value,
                                            ),
                                        }))
                                    }
                                    onUpload={(file) =>
                                        onUpload(
                                            `info.${index}.${configMode}`,
                                            file,
                                            (url) =>
                                                updatePage(
                                                    index,
                                                    (current) => ({
                                                        ...current,
                                                        backgrounds:
                                                            updateModeImage(
                                                                current.backgrounds,
                                                                configMode,
                                                                url,
                                                            ),
                                                    }),
                                                ),
                                        )
                                    }
                                    uploading={
                                        uploading ===
                                        `info.${index}.${configMode}`
                                    }
                                    value={page.backgrounds?.[configMode] ?? ''}
                                />
                            </div>
                            <InfoPreview
                                links={getPlatformInformationLinks(draft)}
                                mode={configMode}
                                page={page}
                            />
                        </div>
                    </EditableCard>
                </div>
            ))}
        </section>
    );
}

function AuthBackgroundsEditor({
    configMode,
    draft,
    errors,
    onChange,
    onUpload,
    uploading,
}: {
    configMode: ThemeMode;
    draft: PublicPresentationSettings;
    errors: Record<string, string>;
    onChange: (draft: PublicPresentationSettings) => void;
    onUpload: (
        fieldKey: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploading: string | null;
}) {
    const pages: Array<{ key: 'login' | 'register'; label: string }> = [
        { key: 'login', label: 'Login page' },
        { key: 'register', label: 'Registration page' },
    ];

    return (
        <section className="grid gap-4">
            <SectionHeader
                description={`Editing ${configMode} mode authentication backgrounds. Form colors come from Public text colors.`}
                title="Register and Login"
            />

            <div className="grid gap-4 xl:grid-cols-2">
                {pages.map((page) => {
                    const image =
                        draft.auth.backgroundImages[page.key]?.[configMode] ??
                        draft.auth.backgroundImages[page.key]?.dark ??
                        '';
                    const fieldKey = `auth.backgroundImages.${page.key}.${configMode}`;

                    return (
                        <EditableCard key={page.key} title={page.label}>
                            <div className="grid gap-4">
                                <ImagePathField
                                    error={errors[fieldKey]}
                                    label={`${capitalize(configMode)} mode background`}
                                    onChange={(value) =>
                                        onChange({
                                            ...draft,
                                            auth: {
                                                ...draft.auth,
                                                backgroundImages: {
                                                    ...draft.auth
                                                        .backgroundImages,
                                                    [page.key]: updateModeImage(
                                                        draft.auth
                                                            .backgroundImages[
                                                            page.key
                                                        ],
                                                        configMode,
                                                        value,
                                                    ),
                                                },
                                            },
                                        })
                                    }
                                    onUpload={(file) =>
                                        onUpload(fieldKey, file, (url) =>
                                            onChange({
                                                ...draft,
                                                auth: {
                                                    ...draft.auth,
                                                    backgroundImages: {
                                                        ...draft.auth
                                                            .backgroundImages,
                                                        [page.key]:
                                                            updateModeImage(
                                                                draft.auth
                                                                    .backgroundImages[
                                                                    page.key
                                                                ],
                                                                configMode,
                                                                url,
                                                            ),
                                                    },
                                                },
                                            }),
                                        )
                                    }
                                    uploading={uploading === fieldKey}
                                    value={
                                        draft.auth.backgroundImages[page.key]?.[
                                            configMode
                                        ] ?? ''
                                    }
                                />
                                <AuthBackgroundPreview
                                    backgroundImage={image || null}
                                    mode={configMode}
                                    presentation={draft}
                                    title={
                                        page.key === 'login'
                                            ? 'Log in to your account'
                                            : 'Create an account'
                                    }
                                />
                            </div>
                        </EditableCard>
                    );
                })}
            </div>
        </section>
    );
}

function SourceLinksEditor({
    draft,
    errors,
    onChange,
}: Pick<EditorProps, 'draft' | 'errors' | 'onChange'>) {
    return (
        <section className="grid gap-4">
            <SectionHeader
                action={
                    <Button
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                sourceLinks: {
                                    ...current.sourceLinks,
                                    custom: [
                                        ...current.sourceLinks.custom,
                                        structuredClone(blankSourceLink),
                                    ],
                                },
                            }))
                        }
                    >
                        <Plus className="size-4" />
                        Add
                    </Button>
                }
                description="Public AGPL source links for the original project and modified deployments."
                title="Source code links"
            />
            <EditableCard title="Origin">
                <SourceLinkFields
                    errorPrefix="sourceLinks.origin"
                    errors={errors}
                    link={draft.sourceLinks.origin}
                    onChange={(field, value) =>
                        onChange((current) => ({
                            ...current,
                            sourceLinks: {
                                ...current.sourceLinks,
                                origin: {
                                    ...current.sourceLinks.origin,
                                    [field]: value,
                                },
                            },
                        }))
                    }
                />
            </EditableCard>
            {draft.sourceLinks.custom.map((link, index) => (
                <EditableCard
                    key={index}
                    onDelete={() =>
                        onChange((current) => ({
                            ...current,
                            sourceLinks: {
                                ...current.sourceLinks,
                                custom: current.sourceLinks.custom.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                ),
                            },
                        }))
                    }
                    title={`Custom source ${index + 1}`}
                >
                    <SourceLinkFields
                        errorPrefix={`sourceLinks.custom.${index}`}
                        errors={errors}
                        link={link}
                        onChange={(field, value) =>
                            onChange((current) => ({
                                ...current,
                                sourceLinks: {
                                    ...current.sourceLinks,
                                    custom: current.sourceLinks.custom.map(
                                        (item, itemIndex) =>
                                            itemIndex === index
                                                ? { ...item, [field]: value }
                                                : item,
                                    ),
                                },
                            }))
                        }
                    />
                </EditableCard>
            ))}
        </section>
    );
}

function CursorEditor({
    draft,
    errors,
    onChange,
    onUpload,
    uploading,
}: EditorProps) {
    const activeCursorKeys = Object.keys(draft.cursors) as CursorKey[];
    const availableRoles = cursorRoles.filter(
        (role) => !activeCursorKeys.includes(role.key),
    );

    return (
        <section className="grid gap-4">
            <SectionHeader
                action={
                    <Button
                        disabled={!availableRoles.length}
                        onClick={() => {
                            const role = availableRoles[0];

                            if (!role) {
                                return;
                            }

                            onChange((current) => ({
                                ...current,
                                cursors: {
                                    ...current.cursors,
                                    [role.key]: {},
                                },
                            }));
                        }}
                    >
                        <Plus className="size-4" />
                        Add
                    </Button>
                }
                description="Map cursor images to the default cursor roles. Each role can be selected once."
                title="Cursors"
            />
            {activeCursorKeys.map((cursorKey) => (
                <EditableCard
                    key={cursorKey}
                    onDelete={() =>
                        onChange((current) => {
                            const next = { ...current.cursors };
                            delete next[cursorKey];

                            return { ...current, cursors: next };
                        })
                    }
                    title={cursorLabel(cursorKey)}
                >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="grid gap-4">
                            <div className="grid gap-1">
                                <Label>Default role</Label>
                                <select
                                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-950"
                                    onChange={(event) => {
                                        const nextKey = event.currentTarget
                                            .value as CursorKey;

                                        onChange((current) => {
                                            const next = {
                                                ...current.cursors,
                                            };
                                            next[nextKey] = next[cursorKey];
                                            delete next[cursorKey];

                                            return {
                                                ...current,
                                                cursors: next,
                                            };
                                        });
                                    }}
                                    value={cursorKey}
                                >
                                    {cursorRoles
                                        .filter(
                                            (role) =>
                                                role.key === cursorKey ||
                                                !activeCursorKeys.includes(
                                                    role.key,
                                                ),
                                        )
                                        .map((role) => (
                                            <option
                                                key={role.key}
                                                value={role.key}
                                            >
                                                {role.label}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <CursorFields
                                cursor={draft.cursors[cursorKey] ?? {}}
                                errorPrefix={`cursors.${cursorKey}`}
                                errors={errors}
                                onChange={(field, value) =>
                                    onChange((current) => ({
                                        ...current,
                                        cursors: {
                                            ...current.cursors,
                                            [cursorKey]: {
                                                ...(current.cursors[
                                                    cursorKey
                                                ] ?? {}),
                                                [field]: value,
                                            },
                                        },
                                    }))
                                }
                                onUpload={(file) =>
                                    onUpload(
                                        `cursor.${cursorKey}`,
                                        file,
                                        (url) =>
                                            onChange((current) => ({
                                                ...current,
                                                cursors: {
                                                    ...current.cursors,
                                                    [cursorKey]: {
                                                        ...(current.cursors[
                                                            cursorKey
                                                        ] ?? {}),
                                                        image: url,
                                                    },
                                                },
                                            })),
                                    )
                                }
                                uploading={uploading === `cursor.${cursorKey}`}
                            />
                        </div>
                        <CursorPreview
                            cursor={draft.cursors[cursorKey] ?? {}}
                        />
                    </div>
                </EditableCard>
            ))}
        </section>
    );
}

function PublicPaletteEditor({
    draft,
    errors,
    mode,
    onChange,
}: Pick<EditorProps, 'draft' | 'errors' | 'onChange'> & {
    mode: ThemeMode;
}) {
    const [selectedField, setSelectedField] =
        useState<PaletteField>('accentText');
    const palette = getPublicPresentationPalette(draft, mode);
    const activeField = paletteFields.find(
        (field) => field.field === selectedField,
    );

    return (
        <section className="grid gap-4">
            <SectionHeader
                description={`Editing ${mode} mode public colors. This switch does not change the settings page theme.`}
                title="Public text colors"
            />
            <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <aside className="grid h-fit gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                    {paletteFields.map((field) => (
                        <button
                            className={cn(
                                'rounded-lg px-3 py-3 text-left text-sm font-medium transition',
                                selectedField === field.field
                                    ? 'bg-cyan-600 text-white dark:bg-teal-300 dark:text-slate-950'
                                    : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                            )}
                            key={field.field}
                            onClick={() => setSelectedField(field.field)}
                            type="button"
                        >
                            {field.label}
                        </button>
                    ))}
                </aside>
                <EditableCard title={activeField?.label ?? 'Color'}>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <ColorField
                            error={
                                errors[`publicPalette.${mode}.${selectedField}`]
                            }
                            label={activeField?.label ?? 'Color'}
                            onChange={(value) =>
                                onChange((current) => ({
                                    ...current,
                                    publicPalette: {
                                        ...current.publicPalette,
                                        [mode]: {
                                            ...current.publicPalette[mode],
                                            [selectedField]: value,
                                        },
                                    },
                                }))
                            }
                            value={palette[selectedField]}
                        />
                        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
                            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                Preview
                            </p>
                            <div
                                className="mt-4 rounded-lg border p-4"
                                style={{
                                    borderColor: palette.controlBorder,
                                }}
                            >
                                <p
                                    className="text-2xl font-semibold"
                                    style={{ color: palette.headingText }}
                                >
                                    Learning Worlds
                                </p>
                                <p
                                    className="mt-2 text-sm"
                                    style={{ color: palette.bodyText }}
                                >
                                    Public presentation copy uses the configured
                                    palette.
                                </p>
                                <p
                                    className="mt-2 text-xs"
                                    style={{ color: palette.mutedText }}
                                >
                                    Muted secondary context
                                </p>
                                <button
                                    className="mt-4 rounded-md px-4 py-2 text-sm font-semibold"
                                    style={{
                                        background: palette.accentText,
                                        color: palette.controlText,
                                    }}
                                    type="button"
                                >
                                    {activeField?.preview ?? 'Action'}
                                </button>
                            </div>
                        </div>
                    </div>
                </EditableCard>
            </div>
        </section>
    );
}

type EditorProps = {
    configMode: ThemeMode;
    draft: PublicPresentationSettings;
    errors: Record<string, string>;
    onChange: React.Dispatch<React.SetStateAction<PublicPresentationSettings>>;
    onUpload: (
        fieldKey: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => void;
    uploading: string | null;
};

function SectionHeader({
    action,
    description,
    title,
}: {
    action?: React.ReactNode;
    description: string;
    title: string;
}) {
    return (
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
            <div>
                <h2 className="text-xl font-semibold tracking-normal text-slate-950 dark:text-white">
                    {title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>
            {action}
        </div>
    );
}

function EditableCard({
    children,
    dragHandle = false,
    onDelete,
    title,
    tools,
}: {
    children: React.ReactNode;
    dragHandle?: boolean;
    onDelete?: () => void;
    title: string;
    tools?: React.ReactNode;
}) {
    return (
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    {dragHandle ? (
                        <GripVertical className="size-4 text-slate-400" />
                    ) : null}
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {title}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    {tools}
                    {onDelete ? (
                        <Button
                            onClick={onDelete}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <Trash2 className="size-4" />
                            Delete
                        </Button>
                    ) : null}
                </div>
            </div>
            {children}
        </article>
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
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function TextareaField({
    error,
    label,
    onChange,
    rows = 5,
    value,
}: {
    error?: string;
    label: string;
    onChange: (value: string) => void;
    rows?: number;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <textarea
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/30 dark:border-white/10 dark:bg-slate-950 dark:focus:border-teal-200 dark:focus:ring-teal-200/30"
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                rows={rows}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}

function ImagePathField({
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
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const inputId = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-2">
            <TextField
                error={error}
                label={label}
                onChange={onChange}
                value={value}
            />
            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                    <label htmlFor={`${inputId}-upload`}>
                        {uploading ? 'Uploading...' : 'Upload'}
                    </label>
                </Button>
                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    id={`${inputId}-upload`}
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) {
                            onUpload(file);
                        }
                        event.currentTarget.value = '';
                    }}
                    type="file"
                />
                <Button
                    onClick={() => setIsPickerOpen(true)}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    Select existing
                </Button>
                <Button
                    onClick={() => onChange('')}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Clear
                </Button>
            </div>
            {isPickerOpen ? (
                <ReusableImagePicker
                    currentValue={value}
                    onClear={() => {
                        onChange('');
                        setIsPickerOpen(false);
                    }}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(url) => {
                        onChange(url);
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
        </div>
    );
}

function SourceLinkFields({
    errorPrefix,
    errors,
    link,
    onChange,
}: {
    errorPrefix: string;
    errors: Record<string, string>;
    link: SourceLinkSettings;
    onChange: (field: keyof SourceLinkSettings, value: string) => void;
}) {
    return (
        <div className="grid gap-3 md:grid-cols-2">
            <TextField
                error={errors[`${errorPrefix}.label`]}
                label="Label"
                onChange={(value) => onChange('label', value)}
                value={link.label}
            />
            <TextField
                error={errors[`${errorPrefix}.url`]}
                label="URL"
                onChange={(value) => onChange('url', value)}
                value={link.url}
            />
        </div>
    );
}

function CursorFields({
    cursor,
    errorPrefix,
    errors,
    onChange,
    onUpload,
    uploading,
}: {
    cursor: CursorImageSettings;
    errorPrefix: string;
    errors: Record<string, string>;
    onChange: (
        field: keyof CursorImageSettings,
        value: number | string,
    ) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
}) {
    return (
        <div className="grid gap-4">
            <ImagePathField
                error={errors[`${errorPrefix}.image`]}
                label="Image"
                onChange={(value) => onChange('image', value)}
                onUpload={onUpload}
                uploading={uploading}
                value={cursor.image ?? ''}
            />
            <div className="grid gap-3 md:grid-cols-4">
                <TextField
                    error={errors[`${errorPrefix}.hotspotX`]}
                    label="Hotspot X"
                    onChange={(value) =>
                        onChange('hotspotX', Number.parseInt(value, 10) || 0)
                    }
                    value={(cursor.hotspotX ?? 0).toString()}
                />
                <TextField
                    error={errors[`${errorPrefix}.hotspotY`]}
                    label="Hotspot Y"
                    onChange={(value) =>
                        onChange('hotspotY', Number.parseInt(value, 10) || 0)
                    }
                    value={(cursor.hotspotY ?? 0).toString()}
                />
                <TextField
                    error={errors[`${errorPrefix}.size`]}
                    label="Image size"
                    onChange={(value) =>
                        onChange('size', Number.parseInt(value, 10) || 16)
                    }
                    value={(cursor.size ?? 32).toString()}
                />
                <TextField
                    error={errors[`${errorPrefix}.fallback`]}
                    label="Fallback"
                    onChange={(value) => onChange('fallback', value)}
                    value={cursor.fallback ?? ''}
                />
            </div>
        </div>
    );
}

function WelcomePreview({
    mode,
    page,
    presentation,
}: {
    mode: ThemeMode;
    page: WelcomePageSettings;
    presentation: PublicPresentationSettings;
}) {
    const backgroundImage = getWelcomePageBackgroundImage(
        presentation,
        page,
        mode,
    );
    const palette = getPublicPresentationPalette(presentation, mode);

    return (
        <PreviewFrame backgroundImage={backgroundImage}>
            <p
                className="text-xs font-medium tracking-[0.16em] uppercase"
                style={{ color: palette.accentText }}
            >
                {page.eyebrow}
            </p>
            <h4
                className="mt-3 text-3xl font-semibold"
                style={{ color: palette.headingText }}
            >
                {page.title}
            </h4>
            <p
                className="mt-3 text-sm leading-6"
                style={{ color: palette.bodyText }}
            >
                {page.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {(page.buttons ?? []).map((button) => (
                    <span
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
                        key={`${button.text}-${button.target}`}
                        style={{
                            background: palette.accentText,
                            color: palette.controlText,
                        }}
                    >
                        {button.text}
                        <ArrowRight className="size-3" />
                    </span>
                ))}
            </div>
        </PreviewFrame>
    );
}

function InfoPreview({
    links,
    mode,
    page,
}: {
    links: Array<{ href: string; key: string; label: string }>;
    mode: ThemeMode;
    page: PlatformInformationPageSettings;
}) {
    const palette = getPublicPresentationPalette(undefined, mode);
    const backgroundImage =
        page.backgrounds?.[mode] || page.backgrounds?.dark || null;

    return (
        <PreviewFrame backgroundImage={backgroundImage}>
            <nav className="mb-4 flex flex-wrap gap-2">
                {links.map((link) => (
                    <span
                        className="rounded-md px-2 py-1 text-xs"
                        key={link.key}
                        style={{
                            color:
                                link.key === page.key
                                    ? palette.accentText
                                    : palette.controlText,
                        }}
                    >
                        {link.label}
                    </span>
                ))}
            </nav>
            <h4
                className="text-2xl font-semibold"
                style={{ color: palette.headingText }}
            >
                {page.title}
            </h4>
            <p
                className="mt-3 line-clamp-5 text-sm leading-6 whitespace-pre-line"
                style={{ color: palette.bodyText }}
            >
                {page.markdown.replace(/^#+\s*/gm, '')}
            </p>
        </PreviewFrame>
    );
}

function AuthBackgroundPreview({
    backgroundImage,
    mode,
    presentation,
    title,
}: {
    backgroundImage: string | null;
    mode: ThemeMode;
    presentation: PublicPresentationSettings;
    title: string;
}) {
    const palette = getPublicPresentationPalette(presentation, mode);

    return (
        <PreviewFrame backgroundImage={backgroundImage}>
            <div
                className="w-64 rounded-xl border p-4 shadow-xl backdrop-blur-md"
                style={{
                    background:
                        mode === 'dark'
                            ? 'rgba(5, 15, 22, 0.78)'
                            : 'rgba(255, 255, 255, 0.78)',
                    borderColor: palette.controlBorder,
                }}
            >
                <div
                    className="mb-3 h-8 w-8 rounded-lg"
                    style={{ background: palette.accentText }}
                />
                <h3
                    className="text-sm font-semibold"
                    style={{ color: palette.headingText }}
                >
                    {title}
                </h3>
                <p className="mt-1 text-xs" style={{ color: palette.bodyText }}>
                    Public palette colors style auth text and controls.
                </p>
                <div
                    className="mt-4 h-8 rounded-md border"
                    style={{ borderColor: palette.controlBorder }}
                />
                <div
                    className="mt-3 h-8 rounded-md"
                    style={{ background: palette.accentText }}
                />
            </div>
        </PreviewFrame>
    );
}

function CursorPreview({ cursor }: { cursor: CursorImageSettings }) {
    const size = Number(cursor.size ?? 32);

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950">
            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                Preview
            </p>
            <div className="relative mt-4 h-44 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),rgba(248,250,252,0.94))] dark:bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.12),rgba(2,6,23,0.92))]">
                <div className="absolute top-16 left-20 h-px w-28 bg-cyan-700/20 dark:bg-teal-200/20" />
                <div className="absolute top-8 left-28 h-28 w-px bg-cyan-700/20 dark:bg-teal-200/20" />
                {cursor.image ? (
                    <img
                        alt=""
                        className="absolute top-8 left-20 object-contain"
                        draggable={false}
                        src={cursor.image}
                        style={{ height: size, width: size }}
                    />
                ) : null}
                <span className="absolute top-16 left-28 size-2 rounded-full bg-cyan-600 ring-2 ring-white dark:bg-teal-300 dark:ring-slate-950" />
            </div>
        </div>
    );
}

function PreviewFrame({
    backgroundImage,
    children,
}: {
    backgroundImage: string | null;
    children: React.ReactNode;
}) {
    return (
        <div
            className="min-h-80 overflow-hidden rounded-xl border border-slate-200 bg-cover bg-center p-5 shadow-inner dark:border-white/10"
            style={{
                backgroundImage: backgroundImage
                    ? `linear-gradient(120deg, rgba(2,6,23,0.78), rgba(2,6,23,0.35)), url(${backgroundImage})`
                    : 'linear-gradient(120deg, rgba(14,116,144,0.16), rgba(15,23,42,0.94))',
            }}
        >
            <div className="rounded-xl bg-slate-950/55 p-4 backdrop-blur-sm">
                {children}
            </div>
        </div>
    );
}

function updateModeImage(
    current: BackgroundImageSettings | undefined,
    mode: ThemeMode,
    value: string,
): BackgroundImageSettings {
    return {
        ...(current ?? {}),
        [mode]: value,
    };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
    const next = [...items];
    const [item] = next.splice(from, 1);

    if (item === undefined) {
        return items;
    }

    next.splice(to, 0, item);

    return next;
}

function uniqueInfoKey(pages: PlatformInformationPageSettings[]): string {
    const base = 'new-page';
    let index = pages.length + 1;
    let key = `${base}-${index}`;

    while (pages.some((page) => page.key === key)) {
        index += 1;
        key = `${base}-${index}`;
    }

    return key;
}

function cursorLabel(key: CursorKey): string {
    return cursorRoles.find((role) => role.key === key)?.label ?? key;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
