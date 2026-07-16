import { Head, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    FileText,
    Github,
    GripVertical,
    Image,
    LogIn,
    MousePointer2,
    Palette,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    ColorOpacityField,
    type AvailableColorOption,
} from '@/components/color-input';
import { ConfigImageInput } from '@/components/config-image-input';
import { ConfigModeSwitch } from '@/components/config-mode-switch';
import InputError from '@/components/input-error';
import {
    SettingsConfigurationShell,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';
import {
    defaultPlatformInformationPages,
    getPlatformInformationLinks,
    getPlatformInformationPages,
    getPublicPresentationPalette,
    getWelcomePageBackgroundImage,
    getWelcomePages,
    publicPaletteColor,
} from '@/theme/presentation';
import type {
    BackgroundImageSettings,
    CursorImageSettings,
    PlatformInformationPageSettings,
    PublicPaletteField,
    PublicPaletteModeSettings,
    PublicPresentationSettings,
    SourceLinkSettings,
    WelcomePageButtonSettings,
    WelcomePageSettings,
} from '@/theme/presentation';

type ThemeMode = 'dark' | 'light';
type SectionKey = 'auth' | 'colors' | 'cursors' | 'info' | 'source' | 'welcome';
type CursorKey = keyof PublicPresentationSettings['cursors'];
type PaletteField = PublicPaletteField;

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
    { key: 'colors', label: 'Public colors', icon: Palette },
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
    {
        field: 'welcomeOverlay',
        label: 'Welcome background blend',
        preview: 'Background blend',
    },
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
    const { url } = usePage();
    const [activeSection, setActiveSection] = useState<SectionKey>(() =>
        sectionFromUrl(url),
    );
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
        setUploading(fieldKey);

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/presentation/background-images',
                errorMessage: 'The image could not be uploaded.',
                fieldName: 'image',
                file,
            });
            onUploaded(payload.url);
        } catch (error) {
            setErrors((current) => ({
                ...current,
                [fieldKey]:
                    error instanceof Error
                        ? error.message
                        : 'The image could not be uploaded.',
            }));
        } finally {
            setUploading(null);
        }
    };

    return (
        <>
            <Head title="Public presentation" />
            <SettingsConfigurationShell
                action={
                    <Button disabled={saving} onClick={save}>
                        <Save className="size-4" />
                        Save changes
                    </Button>
                }
                eyebrow="Administration"
                sidebar={
                    <SettingsSidebar>
                        {sections.map((section) => (
                            <SettingsSectionButton
                                active={activeSection === section.key}
                                icon={section.icon}
                                id={section.key}
                                key={section.key}
                                label={section.label}
                                onSelect={setActiveSection}
                            />
                        ))}
                    </SettingsSidebar>
                }
                title="Public presentation"
            >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="mb-4 flex shrink-0 justify-end">
                        <ConfigModeSwitch
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
            </SettingsConfigurationShell>
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
                            <ConfigImageInput
                                description="Displayed behind this welcome page in the selected mode."
                                error={
                                    errors[
                                        `welcome.pages.${index}.backgrounds.${configMode}`
                                    ]
                                }
                                id={`welcome-page-${index}-${configMode}-background`}
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
                                <ConfigImageInput
                                    description="Displayed behind this public information page in the selected mode."
                                    error={
                                        errors[
                                            `infoPages.pages.${index}.backgrounds.${configMode}`
                                        ]
                                    }
                                    id={`info-page-${index}-${configMode}-background`}
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
                                presentation={draft}
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
                                <ConfigImageInput
                                    description="Displayed behind this authentication page in the selected mode."
                                    error={errors[fieldKey]}
                                    id={`${page.key}-${configMode}-background`}
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
    const availableColors = useMemo(
        () => collectPublicPaletteColors(draft),
        [draft],
    );
    const activeField = paletteFields.find(
        (field) => field.field === selectedField,
    );
    const opacityField =
        `${selectedField}Opacity` as keyof PublicPaletteModeSettings;
    const previewColors = {
        accentText: publicPaletteColor(palette, 'accentText'),
        bodyText: publicPaletteColor(palette, 'bodyText'),
        controlBorder: publicPaletteColor(palette, 'controlBorder'),
        controlText: publicPaletteColor(palette, 'controlText'),
        headingText: publicPaletteColor(palette, 'headingText'),
        mutedText: publicPaletteColor(palette, 'mutedText'),
        welcomeOverlay: publicPaletteColor(palette, 'welcomeOverlay'),
    };

    return (
        <section className="grid gap-4">
            <SectionHeader
                description={`Editing ${mode} mode public colors and welcome background blending. This switch does not change the settings page theme.`}
                title="Public colors"
            />
            <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <aside className="grid h-fit gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                    {paletteFields.map((field) => (
                        <button
                            className={cn(
                                'rounded-lg px-3 py-3 text-left text-sm font-medium transition',
                                selectedField === field.field
                                    ? 'text-white dark:text-slate-950'
                                    : 'text-slate-600 hover:bg-white hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
                            )}
                            key={field.field}
                            onClick={() => setSelectedField(field.field)}
                            style={
                                selectedField === field.field
                                    ? {
                                          background: 'var(--settings-accent)',
                                          color: 'var(--settings-accent-foreground)',
                                      }
                                    : undefined
                            }
                            type="button"
                        >
                            {field.label}
                        </button>
                    ))}
                </aside>
                <EditableCard title={activeField?.label ?? 'Color'}>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <ColorOpacityField
                            availableColors={availableColors.filter(
                                (color) =>
                                    color.label !==
                                    `${capitalize(mode)} ${activeField?.label}`,
                            )}
                            colorError={
                                errors[`publicPalette.${mode}.${selectedField}`]
                            }
                            colorValue={palette[selectedField]}
                            label={activeField?.label ?? 'Color'}
                            onColorChange={(value) =>
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
                            onOpacityChange={(value) =>
                                onChange((current) => ({
                                    ...current,
                                    publicPalette: {
                                        ...current.publicPalette,
                                        [mode]: {
                                            ...current.publicPalette[mode],
                                            [opacityField]: value,
                                        },
                                    },
                                }))
                            }
                            opacityError={
                                errors[
                                    `publicPalette.${mode}.${String(opacityField)}`
                                ]
                            }
                            opacityValue={String(palette[opacityField] ?? 100)}
                        />
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                background:
                                    mode === 'dark' ? '#020617' : '#f8fafc',
                                borderColor:
                                    mode === 'dark'
                                        ? 'rgba(255,255,255,0.12)'
                                        : 'rgba(15,23,42,0.12)',
                            }}
                        >
                            <p className="text-xs font-medium tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                                Preview
                            </p>
                            <div
                                className="mt-4 rounded-lg border p-4"
                                style={{
                                    backgroundImage:
                                        selectedField === 'welcomeOverlay'
                                            ? 'linear-gradient(120deg, rgba(15, 23, 42, 0.1), rgba(14, 165, 233, 0.2))'
                                            : undefined,
                                    backgroundColor:
                                        mode === 'dark' ? '#082038' : '#ffffff',
                                    borderColor: previewColors.controlBorder,
                                }}
                            >
                                <p
                                    className="text-2xl font-semibold"
                                    style={{ color: previewColors.headingText }}
                                >
                                    Learning Worlds
                                </p>
                                <p
                                    className="mt-2 text-sm"
                                    style={{ color: previewColors.bodyText }}
                                >
                                    Public presentation copy uses the configured
                                    palette.
                                </p>
                                <p
                                    className="mt-2 text-xs"
                                    style={{ color: previewColors.mutedText }}
                                >
                                    Muted secondary context
                                </p>
                                {selectedField === 'welcomeOverlay' ? (
                                    <div className="relative mt-4 h-20 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1e3a8a,#22c55e,#f8fafc)]">
                                        <div
                                            aria-hidden="true"
                                            className="absolute inset-0"
                                            style={{
                                                background:
                                                    previewColors.welcomeOverlay,
                                            }}
                                        />
                                        <span className="relative z-10 flex h-full items-center justify-center text-sm font-semibold text-white">
                                            Background blend preview
                                        </span>
                                    </div>
                                ) : null}
                                <button
                                    className="mt-4 rounded-md px-4 py-2 text-sm font-semibold"
                                    style={{
                                        background: previewColors.accentText,
                                        color: previewColors.controlText,
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

function collectPublicPaletteColors(
    presentation: PublicPresentationSettings,
): AvailableColorOption[] {
    const colors: AvailableColorOption[] = [];

    for (const mode of ['dark', 'light'] as const) {
        const palette = getPublicPresentationPalette(presentation, mode);

        for (const field of paletteFields) {
            const opacityField =
                `${field.field}Opacity` as keyof PublicPaletteModeSettings;
            const value = palette[field.field];

            if (!value) {
                continue;
            }

            colors.push({
                label: `${capitalize(mode)} ${field.label}`,
                opacity:
                    typeof palette[opacityField] === 'number' ||
                    typeof palette[opacityField] === 'string'
                        ? palette[opacityField]
                        : undefined,
                value,
            });
        }
    }

    return colors;
}

function sectionFromUrl(url: string): SectionKey {
    const section = new URLSearchParams(url.split('?')[1] ?? '').get('section');

    if (sections.some((current) => current.key === section)) {
        return section as SectionKey;
    }

    return 'welcome';
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
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] dark:border-white/10 dark:bg-slate-950"
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                rows={rows}
                value={value}
            />
            <InputError message={error} />
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
            <ConfigImageInput
                description="Image used for this cursor role."
                error={errors[`${errorPrefix}.image`]}
                id={`${errorPrefix}-image`}
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
    const colors = {
        accentText: publicPaletteColor(palette, 'accentText'),
        bodyText: publicPaletteColor(palette, 'bodyText'),
        controlText: publicPaletteColor(palette, 'controlText'),
        headingText: publicPaletteColor(palette, 'headingText'),
    };

    return (
        <PreviewFrame
            backgroundImage={backgroundImage}
            mode={mode}
            overlayColor={publicPaletteColor(palette, 'welcomeOverlay')}
        >
            <p
                className="text-xs font-medium tracking-[0.16em] uppercase"
                style={{ color: colors.accentText }}
            >
                {page.eyebrow}
            </p>
            <h4
                className="mt-3 text-3xl font-semibold"
                style={{ color: colors.headingText }}
            >
                {page.title}
            </h4>
            <p
                className="mt-3 text-sm leading-6"
                style={{ color: colors.bodyText }}
            >
                {page.body}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {(page.buttons ?? []).map((button) => (
                    <span
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold"
                        key={`${button.text}-${button.target}`}
                        style={{
                            background: colors.accentText,
                            color: colors.controlText,
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
    presentation,
}: {
    links: Array<{ href: string; key: string; label: string }>;
    mode: ThemeMode;
    page: PlatformInformationPageSettings;
    presentation: PublicPresentationSettings;
}) {
    const palette = getPublicPresentationPalette(presentation, mode);
    const colors = {
        accentText: publicPaletteColor(palette, 'accentText'),
        bodyText: publicPaletteColor(palette, 'bodyText'),
        controlText: publicPaletteColor(palette, 'controlText'),
        headingText: publicPaletteColor(palette, 'headingText'),
    };
    const backgroundImage =
        page.backgrounds?.[mode] || page.backgrounds?.dark || null;

    return (
        <PreviewFrame backgroundImage={backgroundImage} mode={mode}>
            <nav className="mb-4 flex flex-wrap gap-2">
                {links.map((link) => (
                    <span
                        className="rounded-md px-2 py-1 text-xs"
                        key={link.key}
                        style={{
                            color:
                                link.key === page.key
                                    ? colors.accentText
                                    : colors.controlText,
                        }}
                    >
                        {link.label}
                    </span>
                ))}
            </nav>
            <h4
                className="text-2xl font-semibold"
                style={{ color: colors.headingText }}
            >
                {page.title}
            </h4>
            <p
                className="mt-3 line-clamp-5 text-sm leading-6 whitespace-pre-line"
                style={{ color: colors.bodyText }}
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
    const colors = {
        accentText: publicPaletteColor(palette, 'accentText'),
        bodyText: publicPaletteColor(palette, 'bodyText'),
        controlBorder: publicPaletteColor(palette, 'controlBorder'),
        headingText: publicPaletteColor(palette, 'headingText'),
    };

    return (
        <PreviewFrame backgroundImage={backgroundImage} mode={mode}>
            <div
                className="w-64 rounded-xl border p-4 shadow-xl backdrop-blur-md"
                style={{
                    background:
                        mode === 'dark'
                            ? 'rgba(5, 15, 22, 0.78)'
                            : 'rgba(255, 255, 255, 0.78)',
                    borderColor: colors.controlBorder,
                }}
            >
                <div
                    className="mb-3 h-8 w-8 rounded-lg"
                    style={{ background: colors.accentText }}
                />
                <h3
                    className="text-sm font-semibold"
                    style={{ color: colors.headingText }}
                >
                    {title}
                </h3>
                <p className="mt-1 text-xs" style={{ color: colors.bodyText }}>
                    Public palette colors style auth text and controls.
                </p>
                <div
                    className="mt-4 h-8 rounded-md border"
                    style={{ borderColor: colors.controlBorder }}
                />
                <div
                    className="mt-3 h-8 rounded-md"
                    style={{ background: colors.accentText }}
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
                <div className="absolute top-16 left-20 h-px w-28 bg-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)]" />
                <div className="absolute top-8 left-28 h-28 w-px bg-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)]" />
                {cursor.image ? (
                    <img
                        alt=""
                        className="absolute top-8 left-20 object-contain"
                        draggable={false}
                        src={cursor.image}
                        style={{ height: size, width: size }}
                    />
                ) : null}
                <span className="absolute top-16 left-28 size-2 rounded-full bg-[var(--settings-accent)] ring-2 ring-white dark:ring-slate-950" />
            </div>
        </div>
    );
}

function PreviewFrame({
    backgroundImage,
    children,
    mode,
    overlayColor,
}: {
    backgroundImage: string | null;
    children: React.ReactNode;
    mode: ThemeMode;
    overlayColor?: string;
}) {
    const fallbackBackground =
        mode === 'dark'
            ? 'linear-gradient(120deg, rgba(14,116,144,0.16), rgba(15,23,42,0.94))'
            : 'linear-gradient(120deg, rgba(224,242,254,0.95), rgba(248,250,252,0.98))';
    const imageOverlay =
        overlayColor ??
        (mode === 'dark' ? 'rgba(2,6,23,0.58)' : 'rgba(255,255,255,0.62)');

    return (
        <div
            className="min-h-80 overflow-hidden rounded-xl border bg-cover bg-center p-5 shadow-inner"
            style={{
                borderColor:
                    mode === 'dark'
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(15,23,42,0.12)',
                backgroundImage: backgroundImage
                    ? `linear-gradient(120deg, ${imageOverlay}, ${imageOverlay}), url(${backgroundImage})`
                    : fallbackBackground,
            }}
        >
            <div
                className="rounded-xl p-4 backdrop-blur-sm"
                style={{
                    background:
                        mode === 'dark'
                            ? 'rgba(2, 6, 23, 0.55)'
                            : 'rgba(255, 255, 255, 0.68)',
                }}
            >
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
