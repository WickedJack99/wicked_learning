import { router } from '@inertiajs/react';
import {
    Download,
    FileText,
    Github,
    Image,
    Images,
    LayoutPanelTop,
    MousePointer2,
    Palette,
    Plus,
    Save,
    Trash2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformInfoPages } from '@/features/platform-info/content';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import type {
    CursorImageSettings,
    PublicPaletteModeSettings,
    PublicPresentationSettings,
    SourceLinkSettings,
    WelcomePageSettings,
} from '@/theme/presentation';

type PlatformInfoContent = {
    key: PlatformInfoPageKey;
    markdown: string | null;
    updated_at: string | null;
    updated_by: {
        email: string;
        id: number;
        name: string;
    } | null;
};

type Props = {
    platformInfoContent: Partial<
        Record<PlatformInfoPageKey, PlatformInfoContent>
    >;
    presentation: PublicPresentationSettings;
};

type AuthBackgroundPage = 'login' | 'register' | 'welcome';
type CursorKey = 'action' | 'default' | 'denied' | 'grab' | 'text';
type PresentationSection =
    | 'backgrounds'
    | 'cursors'
    | 'palette'
    | 'source'
    | 'welcome'
    | 'info';
type ThemeMode = 'dark' | 'light';
type PaletteField = keyof PublicPaletteModeSettings;

const authBackgroundPages: Array<{
    description: string;
    key: AuthBackgroundPage;
    label: string;
}> = [
    {
        key: 'login',
        label: 'Login',
        description: 'Background image used on the login page.',
    },
    {
        key: 'register',
        label: 'Registration',
        description: 'Background image used on the registration page.',
    },
    {
        key: 'welcome',
        label: 'Welcome',
        description: 'Background image used on welcome and public info pages.',
    },
];

const infoPageKeys: PlatformInfoPageKey[] = [
    'about',
    'imprint',
    'data-protection',
];

const cursorOptions: Array<{
    description: string;
    key: CursorKey;
    label: string;
}> = [
    {
        key: 'default',
        label: 'Normal cursor',
        description: 'Used on passive surfaces and normal map areas.',
    },
    {
        key: 'action',
        label: 'Action pointer',
        description: 'Used on buttons, links and other clickable controls.',
    },
    {
        key: 'grab',
        label: 'Grab cursor',
        description: 'Used while dragging maps and graph surfaces.',
    },
    {
        key: 'text',
        label: 'Text input cursor',
        description: 'Used when hovering editable input and text areas.',
    },
    {
        key: 'denied',
        label: 'Denied cursor',
        description: 'Used on disabled controls and unavailable locked nodes.',
    },
];

const presentationSections: {
    description: string;
    icon: LucideIcon;
    key: PresentationSection;
    label: string;
}[] = [
    {
        key: 'backgrounds',
        label: 'Backgrounds',
        description: 'Authentication and public page background imagery.',
        icon: Image,
    },
    {
        key: 'cursors',
        label: 'Cursor images',
        description: 'Normal, action, grab, text and denied cursor images.',
        icon: MousePointer2,
    },
    {
        key: 'welcome',
        label: 'Welcome pages',
        description: 'Full-screen welcome sequence copy.',
        icon: LayoutPanelTop,
    },
    {
        key: 'palette',
        label: 'Public text colors',
        description: 'Text and control colors for public pages.',
        icon: Palette,
    },
    {
        key: 'info',
        label: 'Information pages',
        description: 'About, imprint and data protection markdown.',
        icon: FileText,
    },
    {
        key: 'source',
        label: 'Source links',
        description: 'Public source code links for AGPL deployments.',
        icon: Github,
    },
];

const blankWelcomePage: WelcomePageSettings = {
    eyebrow: 'New section',
    title: 'New welcome page',
    body: 'Describe this part of the platform.',
    primaryLabel: 'Continue',
};

const blankSourceLink: SourceLinkSettings = {
    label: 'Modified source',
    url: 'https://github.com/example/example',
};

export function AdminPresentationPanel({
    platformInfoContent,
    presentation,
}: Props) {
    const [activeSection, setActiveSection] =
        useState<PresentationSection>('backgrounds');
    const [presentationDraft, setPresentationDraft] =
        useState<PublicPresentationSettings>(() =>
            structuredClone(presentation),
        );
    const [presentationErrors, setPresentationErrors] = useState<
        Record<string, string>
    >({});
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>(
        {},
    );
    const [uploadingImage, setUploadingImage] = useState<string | null>(null);
    const [savingPresentation, setSavingPresentation] = useState(false);
    const [savingInfoPage, setSavingInfoPage] =
        useState<PlatformInfoPageKey | null>(null);
    const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
    const [markdownDrafts, setMarkdownDrafts] = useState(
        () =>
            Object.fromEntries(
                infoPageKeys.map((key) => [
                    key,
                    platformInfoContent[key]?.markdown ??
                        platformInfoPages[key].markdown,
                ]),
            ) as Record<PlatformInfoPageKey, string>,
    );

    const welcomePages = presentationDraft.welcome.pages;
    const canRemoveWelcomePage = welcomePages.length > 1;

    const backgroundImageSummary = useMemo(
        () =>
            authBackgroundPages.map((page) => ({
                ...page,
                images: presentationDraft.auth.backgroundImages[page.key],
            })),
        [presentationDraft],
    );

    const updateBackgroundImage = (
        page: AuthBackgroundPage,
        mode: ThemeMode,
        value: string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            auth: {
                ...current.auth,
                backgroundImages: {
                    ...current.auth.backgroundImages,
                    [page]: {
                        ...current.auth.backgroundImages[page],
                        [mode]: value,
                    },
                },
            },
        }));
    };

    const updateCursor = (
        key: CursorKey,
        field: keyof CursorImageSettings,
        value: number | string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            cursors: {
                ...current.cursors,
                [key]: {
                    ...current.cursors[key],
                    [field]: value,
                },
            },
        }));
    };

    const updatePalette = (
        mode: ThemeMode,
        field: PaletteField,
        value: string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            publicPalette: {
                ...current.publicPalette,
                [mode]: {
                    ...current.publicPalette[mode],
                    [field]: value,
                },
            },
        }));
    };

    const updateOriginSourceLink = (
        field: keyof SourceLinkSettings,
        value: string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            sourceLinks: {
                ...current.sourceLinks,
                origin: {
                    ...current.sourceLinks.origin,
                    [field]: value,
                },
            },
        }));
    };

    const updateCustomSourceLink = (
        index: number,
        field: keyof SourceLinkSettings,
        value: string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            sourceLinks: {
                ...current.sourceLinks,
                custom: current.sourceLinks.custom.map((link, linkIndex) =>
                    linkIndex === index ? { ...link, [field]: value } : link,
                ),
            },
        }));
    };

    const addCustomSourceLink = () => {
        setPresentationDraft((current) => ({
            ...current,
            sourceLinks: {
                ...current.sourceLinks,
                custom: [...current.sourceLinks.custom, blankSourceLink],
            },
        }));
    };

    const removeCustomSourceLink = (index: number) => {
        setPresentationDraft((current) => ({
            ...current,
            sourceLinks: {
                ...current.sourceLinks,
                custom: current.sourceLinks.custom.filter(
                    (_, linkIndex) => linkIndex !== index,
                ),
            },
        }));
    };

    const uploadCursorImage = async (key: CursorKey, file: File) => {
        const fieldKey = `cursor.${key}`;

        await uploadPresentationImage(fieldKey, file, (url) =>
            updateCursor(key, 'image', url),
        );
    };

    const uploadBackgroundImage = async (
        page: AuthBackgroundPage,
        mode: ThemeMode,
        file: File,
    ) => {
        const fieldKey = `${page}.${mode}`;
        await uploadPresentationImage(fieldKey, file, (url) =>
            updateBackgroundImage(page, mode, url),
        );
    };

    const uploadPresentationImage = async (
        fieldKey: string,
        file: File,
        onUploaded: (url: string) => void,
    ) => {
        const formData = new FormData();
        const csrfToken = document
            .querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.getAttribute('content');

        formData.append('image', file);
        setUploadingImage(fieldKey);
        setUploadErrors((current) => ({ ...current, [fieldKey]: '' }));

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
                setUploadErrors((current) => ({
                    ...current,
                    [fieldKey]:
                        payload.errors?.image?.[0] ??
                        payload.message ??
                        'The image could not be uploaded.',
                }));

                return;
            }

            onUploaded(payload.url);
        } catch {
            setUploadErrors((current) => ({
                ...current,
                [fieldKey]: 'The image could not be uploaded.',
            }));
        } finally {
            setUploadingImage(null);
        }
    };

    const updateWelcomePage = (
        index: number,
        field: keyof WelcomePageSettings,
        value: string,
    ) => {
        setPresentationDraft((current) => ({
            ...current,
            welcome: {
                ...current.welcome,
                pages: current.welcome.pages.map((page, pageIndex) =>
                    pageIndex === index ? { ...page, [field]: value } : page,
                ),
            },
        }));
    };

    const addWelcomePage = () => {
        setPresentationDraft((current) => ({
            ...current,
            welcome: {
                ...current.welcome,
                pages: [...current.welcome.pages, blankWelcomePage],
            },
        }));
    };

    const removeWelcomePage = (index: number) => {
        setPresentationDraft((current) => ({
            ...current,
            welcome: {
                ...current.welcome,
                pages: current.welcome.pages.filter(
                    (_, pageIndex) => pageIndex !== index,
                ),
            },
        }));
    };

    const savePresentation = () => {
        setSavingPresentation(true);
        router.patch('/settings/presentation', presentationDraft, {
            preserveScroll: true,
            preserveState: true,
            onError: (errors) => setPresentationErrors(errors),
            onSuccess: () => setPresentationErrors({}),
            onFinish: () => setSavingPresentation(false),
        });
    };

    const saveInfoPage = (key: PlatformInfoPageKey) => {
        setSavingInfoPage(key);
        router.patch(
            `/settings/info-pages/${key}`,
            {
                markdown: markdownDrafts[key],
                redirect_to: '/settings?panel=admin-presentation',
            },
            {
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => setInfoErrors(errors),
                onSuccess: () => setInfoErrors({}),
                onFinish: () => setSavingInfoPage(null),
            },
        );
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-cyan-700 dark:text-teal-100">
                        <Image className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            Public presentation
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Configure public visuals, welcome copy and information
                        pages without touching code.
                    </p>
                </div>
                <Button
                    disabled={savingPresentation}
                    onClick={savePresentation}
                    type="button"
                >
                    <Save className="size-4" />
                    Save presentation
                </Button>
            </div>

            <PresentationSectionSwitcher
                activeSection={activeSection}
                onChange={setActiveSection}
            />

            <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto pr-1">
                {activeSection === 'backgrounds' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                                Authentication backgrounds
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Use a public asset path such as
                                `/images/themes/mentor-calm.png` or an external
                                image URL.
                            </p>
                        </div>
                        <div className="grid gap-4">
                            {backgroundImageSummary.map((page) => (
                                <div
                                    className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5"
                                    key={page.key}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-slate-950 dark:text-white">
                                            {page.label}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {page.description}
                                        </p>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <BackgroundInput
                                            error={
                                                uploadErrors[
                                                    `${page.key}.dark`
                                                ] ??
                                                presentationErrors[
                                                    `auth.backgroundImages.${page.key}.dark`
                                                ]
                                            }
                                            fieldId={`${page.key}-dark-background`}
                                            label="Dark mode image"
                                            onChange={(value) =>
                                                updateBackgroundImage(
                                                    page.key,
                                                    'dark',
                                                    value,
                                                )
                                            }
                                            onUpload={(file) =>
                                                uploadBackgroundImage(
                                                    page.key,
                                                    'dark',
                                                    file,
                                                )
                                            }
                                            uploading={
                                                uploadingImage ===
                                                `${page.key}.dark`
                                            }
                                            value={page.images.dark ?? ''}
                                        />
                                        <BackgroundInput
                                            error={
                                                uploadErrors[
                                                    `${page.key}.light`
                                                ] ??
                                                presentationErrors[
                                                    `auth.backgroundImages.${page.key}.light`
                                                ]
                                            }
                                            fieldId={`${page.key}-light-background`}
                                            label="Light mode image"
                                            onChange={(value) =>
                                                updateBackgroundImage(
                                                    page.key,
                                                    'light',
                                                    value,
                                                )
                                            }
                                            onUpload={(file) =>
                                                uploadBackgroundImage(
                                                    page.key,
                                                    'light',
                                                    file,
                                                )
                                            }
                                            placeholder="Optional fallback to dark image"
                                            uploading={
                                                uploadingImage ===
                                                `${page.key}.light`
                                            }
                                            value={page.images.light ?? ''}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {activeSection === 'palette' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                                <Palette className="size-4 text-cyan-700 dark:text-teal-200" />
                                Public text colors
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                These colors are used on the welcome, About,
                                Imprint and Data Protection pages. Button
                                background colors still come from the main auth
                                theme.
                            </p>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <PaletteEditor
                                errors={presentationErrors}
                                mode="dark"
                                onChange={updatePalette}
                                palette={presentationDraft.publicPalette.dark}
                                title="Dark mode public colors"
                            />
                            <PaletteEditor
                                errors={presentationErrors}
                                mode="light"
                                onChange={updatePalette}
                                palette={presentationDraft.publicPalette.light}
                                title="Light mode public colors"
                            />
                        </div>
                    </section>
                ) : null}

                {activeSection === 'cursors' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                                <MousePointer2 className="size-4 text-cyan-700 dark:text-teal-200" />
                                Cursor images
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Configure the platform cursor set. Tool cursors
                                still override these while a learner equips a
                                tool.
                            </p>
                        </div>
                        <div className="grid gap-4">
                            {cursorOptions.map((cursor) => (
                                <CursorImageInput
                                    cursor={
                                        presentationDraft.cursors[cursor.key]
                                    }
                                    description={cursor.description}
                                    errorPrefix={`cursors.${cursor.key}`}
                                    errors={presentationErrors}
                                    key={cursor.key}
                                    label={cursor.label}
                                    onChange={(field, value) =>
                                        updateCursor(cursor.key, field, value)
                                    }
                                    onUpload={(file) =>
                                        void uploadCursorImage(cursor.key, file)
                                    }
                                    uploading={
                                        uploadingImage ===
                                        `cursor.${cursor.key}`
                                    }
                                />
                            ))}
                        </div>
                    </section>
                ) : null}

                {activeSection === 'welcome' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                                    Welcome pages
                                </h3>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    These pages are shown in the full-screen
                                    welcome sequence.
                                </p>
                            </div>
                            <Button
                                onClick={addWelcomePage}
                                size="sm"
                                variant="secondary"
                            >
                                <Plus className="size-4" />
                                Add page
                            </Button>
                        </div>
                        <div className="grid gap-4">
                            {welcomePages.map((page, index) => (
                                <div
                                    className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5"
                                    key={index}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-slate-950 dark:text-white">
                                            Page {index + 1}
                                        </p>
                                        <Button
                                            disabled={!canRemoveWelcomePage}
                                            onClick={() =>
                                                removeWelcomePage(index)
                                            }
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <Trash2 className="size-4" />
                                            Remove
                                        </Button>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <TextInput
                                            error={
                                                presentationErrors[
                                                    `welcome.pages.${index}.eyebrow`
                                                ]
                                            }
                                            label="Eyebrow"
                                            onChange={(value) =>
                                                updateWelcomePage(
                                                    index,
                                                    'eyebrow',
                                                    value,
                                                )
                                            }
                                            value={page.eyebrow}
                                        />
                                        <TextInput
                                            error={
                                                presentationErrors[
                                                    `welcome.pages.${index}.title`
                                                ]
                                            }
                                            label="Title"
                                            onChange={(value) =>
                                                updateWelcomePage(
                                                    index,
                                                    'title',
                                                    value,
                                                )
                                            }
                                            value={page.title}
                                        />
                                        <TextInput
                                            error={
                                                presentationErrors[
                                                    `welcome.pages.${index}.primaryLabel`
                                                ]
                                            }
                                            label="Primary button label"
                                            onChange={(value) =>
                                                updateWelcomePage(
                                                    index,
                                                    'primaryLabel',
                                                    value,
                                                )
                                            }
                                            value={page.primaryLabel}
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor={`welcome-body-${index}`}
                                        >
                                            Body
                                        </Label>
                                        <textarea
                                            className="min-h-28 resize-y rounded-md border border-input bg-white px-3 py-2 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                            id={`welcome-body-${index}`}
                                            onChange={(event) =>
                                                updateWelcomePage(
                                                    index,
                                                    'body',
                                                    event.currentTarget.value,
                                                )
                                            }
                                            value={page.body}
                                        />
                                        <InputError
                                            message={
                                                presentationErrors[
                                                    `welcome.pages.${index}.body`
                                                ]
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                {activeSection === 'info' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4">
                            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                                <FileText className="size-4 text-cyan-700 dark:text-teal-200" />
                                Platform information pages
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Markdown content for About, Imprint and Data
                                Protection lives here now.
                            </p>
                        </div>
                        <div className="grid gap-4">
                            {infoPageKeys.map((key) => {
                                const page = platformInfoPages[key];

                                return (
                                    <div
                                        className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5"
                                        key={key}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-slate-950 dark:text-white">
                                                {page.title}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {platformInfoContent[key]
                                                    ?.updated_by
                                                    ? `Last edited by ${platformInfoContent[key]?.updated_by?.name}`
                                                    : 'Default content is currently used.'}
                                            </p>
                                        </div>
                                        <textarea
                                            className="max-h-[40svh] min-h-64 resize-y overflow-y-auto rounded-md border border-input bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                            onChange={(event) =>
                                                setMarkdownDrafts(
                                                    (current) => ({
                                                        ...current,
                                                        [key]: event
                                                            .currentTarget
                                                            .value,
                                                    }),
                                                )
                                            }
                                            value={markdownDrafts[key]}
                                        />
                                        <InputError
                                            message={infoErrors.markdown}
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                disabled={
                                                    savingInfoPage === key
                                                }
                                                onClick={() =>
                                                    saveInfoPage(key)
                                                }
                                                type="button"
                                            >
                                                <Save className="size-4" />
                                                Save {page.title}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {activeSection === 'source' ? (
                    <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                                    <Github className="size-4 text-cyan-700 dark:text-teal-200" />
                                    Source code links
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    These links appear on the public source
                                    page. Origin points to the upstream
                                    repository; additional links can point to
                                    deployment forks or modified source
                                    archives.
                                </p>
                            </div>
                            <Button
                                onClick={addCustomSourceLink}
                                size="sm"
                                type="button"
                                variant="secondary"
                            >
                                <Plus className="size-4" />
                                Add source link
                            </Button>
                        </div>

                        <div className="grid gap-4">
                            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
                                <div>
                                    <p className="text-sm font-medium text-slate-950 dark:text-white">
                                        Origin
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        The default upstream source location.
                                    </p>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <TextInput
                                        error={
                                            presentationErrors[
                                                'sourceLinks.origin.label'
                                            ]
                                        }
                                        label="Button label"
                                        onChange={(value) =>
                                            updateOriginSourceLink(
                                                'label',
                                                value,
                                            )
                                        }
                                        value={
                                            presentationDraft.sourceLinks.origin
                                                .label
                                        }
                                    />
                                    <TextInput
                                        error={
                                            presentationErrors[
                                                'sourceLinks.origin.url'
                                            ]
                                        }
                                        label="Repository URL"
                                        onChange={(value) =>
                                            updateOriginSourceLink('url', value)
                                        }
                                        value={
                                            presentationDraft.sourceLinks.origin
                                                .url
                                        }
                                    />
                                </div>
                            </div>

                            {presentationDraft.sourceLinks.custom.map(
                                (link, index) => (
                                    <div
                                        className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5"
                                        key={index}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-950 dark:text-white">
                                                    Modified source {index + 1}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Optional public source link
                                                    for this deployment.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() =>
                                                    removeCustomSourceLink(
                                                        index,
                                                    )
                                                }
                                                size="sm"
                                                type="button"
                                                variant="ghost"
                                            >
                                                <Trash2 className="size-4" />
                                                Remove
                                            </Button>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2">
                                            <TextInput
                                                error={
                                                    presentationErrors[
                                                        `sourceLinks.custom.${index}.label`
                                                    ]
                                                }
                                                label="Button label"
                                                onChange={(value) =>
                                                    updateCustomSourceLink(
                                                        index,
                                                        'label',
                                                        value,
                                                    )
                                                }
                                                value={link.label}
                                            />
                                            <TextInput
                                                error={
                                                    presentationErrors[
                                                        `sourceLinks.custom.${index}.url`
                                                    ]
                                                }
                                                label="Source URL"
                                                onChange={(value) =>
                                                    updateCustomSourceLink(
                                                        index,
                                                        'url',
                                                        value,
                                                    )
                                                }
                                                value={link.url}
                                            />
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}

const paletteFields: Array<{
    field: PaletteField;
    label: string;
    purpose: string;
}> = [
    {
        field: 'headingText',
        label: 'Heading text',
        purpose: 'Main public headings and brand text.',
    },
    {
        field: 'bodyText',
        label: 'Body text',
        purpose: 'Welcome body copy and information page paragraphs.',
    },
    {
        field: 'mutedText',
        label: 'Muted text',
        purpose: 'Secondary public text when a quieter tone is needed.',
    },
    {
        field: 'accentText',
        label: 'Accent',
        purpose:
            'Primary public accent for buttons, icons, active links and highlighted labels.',
    },
    {
        field: 'controlText',
        label: 'Control text',
        purpose: 'Login, register, footer and small public control text.',
    },
    {
        field: 'controlBorder',
        label: 'Control border',
        purpose: 'Borders around public controls and footer links.',
    },
];

function PaletteEditor({
    errors,
    mode,
    onChange,
    palette,
    title,
}: {
    errors: Record<string, string>;
    mode: ThemeMode;
    onChange: (mode: ThemeMode, field: PaletteField, value: string) => void;
    palette: PublicPaletteModeSettings;
    title: string;
}) {
    return (
        <div className="grid gap-4 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
            <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">
                    {title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Used whenever public pages resolve to {mode} mode.
                </p>
            </div>
            <div className="grid gap-4">
                {paletteFields.map((field) => (
                    <div className="grid gap-1" key={field.field}>
                        <ColorField
                            error={
                                errors[`publicPalette.${mode}.${field.field}`]
                            }
                            label={field.label}
                            onChange={(value) =>
                                onChange(mode, field.field, value)
                            }
                            value={palette[field.field]}
                        />
                        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {field.purpose}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PresentationSectionSwitcher({
    activeSection,
    onChange,
}: {
    activeSection: PresentationSection;
    onChange: (section: PresentationSection) => void;
}) {
    return (
        <div
            aria-label="Presentation settings sections"
            className="mx-auto flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white/88 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/82"
            role="tablist"
        >
            {presentationSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;

                return (
                    <button
                        aria-label={section.label}
                        aria-selected={isActive}
                        className={
                            isActive
                                ? 'grid size-10 place-items-center rounded-xl bg-cyan-600 text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:bg-teal-300 dark:text-slate-950 dark:focus-visible:ring-teal-200'
                                : 'grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-teal-200'
                        }
                        key={section.key}
                        onClick={() => onChange(section.key)}
                        title={`${section.label} - ${section.description}`}
                        type="button"
                    >
                        <Icon className="size-4" />
                    </button>
                );
            })}
        </div>
    );
}

function BackgroundInput({
    error,
    fieldId,
    label,
    onChange,
    onUpload,
    placeholder = '/images/themes/example.svg',
    uploading,
    value,
}: {
    error?: string;
    fieldId: string;
    label: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    placeholder?: string;
    uploading: boolean;
    value: string;
}) {
    const uploadId = `${fieldId}-upload`;
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    return (
        <div className="grid gap-2">
            <TextInput
                error={error}
                id={fieldId}
                label={label}
                onChange={onChange}
                placeholder={placeholder}
                value={value}
            />
            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                    <label htmlFor={uploadId}>
                        <Upload className="size-4" />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </label>
                </Button>
                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    id={uploadId}
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
                    <Images className="size-4" />
                    Select existing
                </Button>
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={value || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
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

function CursorImageInput({
    cursor,
    description,
    errorPrefix,
    errors,
    label,
    onChange,
    onUpload,
    uploading,
}: {
    cursor: CursorImageSettings;
    description: string;
    errorPrefix: string;
    errors: Record<string, string>;
    label: string;
    onChange: (
        field: keyof CursorImageSettings,
        value: number | string,
    ) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
}) {
    const inputId = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
            <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">
                    {label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>
            <BackgroundInput
                error={errors[`${errorPrefix}.image`]}
                fieldId={`${inputId}-image`}
                label="Image"
                onChange={(value) => onChange('image', value)}
                onUpload={onUpload}
                placeholder="/images/cursors/example.svg"
                uploading={uploading}
                value={cursor.image ?? ''}
            />
            <div className="grid gap-3 md:grid-cols-3">
                <TextInput
                    error={errors[`${errorPrefix}.hotspotX`]}
                    label="Hotspot X"
                    onChange={(value) =>
                        onChange('hotspotX', Number.parseInt(value, 10) || 0)
                    }
                    value={(cursor.hotspotX ?? 0).toString()}
                />
                <TextInput
                    error={errors[`${errorPrefix}.hotspotY`]}
                    label="Hotspot Y"
                    onChange={(value) =>
                        onChange('hotspotY', Number.parseInt(value, 10) || 0)
                    }
                    value={(cursor.hotspotY ?? 0).toString()}
                />
                <TextInput
                    error={errors[`${errorPrefix}.size`]}
                    label="Image size"
                    onChange={(value) =>
                        onChange('size', Number.parseInt(value, 10) || 16)
                    }
                    value={(cursor.size ?? 32).toString()}
                />
                <TextInput
                    error={errors[`${errorPrefix}.fallback`]}
                    label="Fallback"
                    onChange={(value) => onChange('fallback', value)}
                    value={cursor.fallback ?? ''}
                />
            </div>
            <CursorPreview cursor={cursor} label={label} />
        </div>
    );
}

function CursorPreview({
    cursor,
    label,
}: {
    cursor: CursorImageSettings;
    label: string;
}) {
    const image = cursor.image ?? '';
    const size = clampCursorSize(cursor.size);
    const hotspotX = clampCursorPoint(cursor.hotspotX, size);
    const hotspotY = clampCursorPoint(cursor.hotspotY, size);
    const markerX = 112;
    const markerY = 76;

    return (
        <div className="grid gap-2">
            <div>
                <p className="text-xs font-medium tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                    Preview
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    The tiny pointer tip marks the real click point. Adjust size
                    and hotspot until the image sits naturally behind it.
                </p>
            </div>
            <div className="relative h-44 overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_center,rgba(14,116,144,0.12),rgba(248,250,252,0.94))] dark:border-white/10 dark:bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.12),rgba(2,6,23,0.92))]">
                <div
                    className="absolute h-px w-full bg-cyan-700/20 dark:bg-teal-200/15"
                    style={{ top: markerY }}
                />
                <div
                    className="absolute h-full w-px bg-cyan-700/20 dark:bg-teal-200/15"
                    style={{ left: markerX }}
                />
                <div
                    className="absolute rounded-full border border-cyan-700/40 bg-white/90 px-2 py-1 text-[0.65rem] font-medium text-cyan-800 shadow-sm dark:border-teal-200/35 dark:bg-slate-950/90 dark:text-teal-100"
                    style={{
                        left: markerX + 12,
                        top: markerY + 10,
                    }}
                >
                    click point
                </div>
                <div
                    aria-hidden="true"
                    className="absolute z-20"
                    style={{
                        height: size,
                        left: markerX - hotspotX,
                        top: markerY - hotspotY,
                        width: size,
                    }}
                >
                    {image ? (
                        <img
                            alt=""
                            className="h-full w-full object-contain"
                            draggable={false}
                            src={image}
                        />
                    ) : (
                        <div className="grid h-full w-full place-items-center rounded-lg border border-dashed border-slate-300 text-[0.65rem] text-slate-500 dark:border-white/15 dark:text-slate-400">
                            No image
                        </div>
                    )}
                </div>
                <div
                    aria-label={`${label} click point`}
                    className="absolute z-30"
                    style={{
                        left: markerX,
                        top: markerY,
                    }}
                >
                    <div className="h-0 w-0 border-t-[14px] border-r-[8px] border-t-slate-950 border-r-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.9)] dark:border-t-white dark:drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" />
                    <div className="absolute top-0 left-0 h-1.5 w-1.5 -translate-x-0.5 -translate-y-0.5 rounded-full bg-cyan-500 ring-2 ring-white dark:bg-teal-300 dark:ring-slate-950" />
                </div>
            </div>
        </div>
    );
}

function clampCursorSize(value: number | null | undefined): number {
    const size =
        typeof value === 'number' && Number.isFinite(value) ? value : 32;

    return Math.min(128, Math.max(16, Math.round(size)));
}

function clampCursorPoint(
    value: number | null | undefined,
    size: number,
): number {
    const point =
        typeof value === 'number' && Number.isFinite(value) ? value : 0;

    return Math.min(size, Math.max(0, Math.round(point)));
}

function TextInput({
    error,
    id,
    label,
    onChange,
    placeholder,
    value,
}: {
    error?: string;
    id?: string;
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    value: string;
}) {
    const inputId = id ?? label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={inputId}>{label}</Label>
            <Input
                id={inputId}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder={placeholder}
                value={value}
            />
            <InputError message={error} />
        </div>
    );
}
