import { router, usePage } from '@inertiajs/react';
import {
    Download,
    FileText,
    Github,
    Image,
    Images,
    LayoutPanelTop,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    SettingsNestedWorkspace,
    SettingsSectionButton,
    SettingsSaveButton,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { platformInfoPages } from '@/features/platform-info/content';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { uploadMediaFile } from '@/lib/media-upload';
import type {
    PublicPresentationSettings,
    SourceLinkSettings,
    WelcomePageSettings,
} from '@/theme/presentation';
import type { Auth } from '@/types';

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
type PresentationSection = 'backgrounds' | 'source' | 'welcome' | 'info';
type ThemeMode = 'dark' | 'light';

const settingsFormGroupClassName =
    'grid gap-3 border-b border-[var(--settings-border-color)] pb-4 last:border-b-0 last:pb-0';

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
        key: 'welcome',
        label: 'Welcome pages',
        description: 'Full-screen welcome sequence copy.',
        icon: LayoutPanelTop,
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
    const hasPresentationChanges = useDirtyState(
        presentationDraft,
        presentation,
    );
    const initialMarkdownDrafts = useMemo(
        () =>
            Object.fromEntries(
                infoPageKeys.map((key) => [
                    key,
                    platformInfoContent[key]?.markdown ??
                        platformInfoPages[key].markdown,
                ]),
            ) as Record<PlatformInfoPageKey, string>,
        [platformInfoContent],
    );
    const hasAboutChanges = useDirtyState(
        markdownDrafts.about,
        initialMarkdownDrafts.about,
    );
    const hasImprintChanges = useDirtyState(
        markdownDrafts.imprint,
        initialMarkdownDrafts.imprint,
    );
    const hasDataProtectionChanges = useDirtyState(
        markdownDrafts['data-protection'],
        initialMarkdownDrafts['data-protection'],
    );
    const changedInfoPages: Record<PlatformInfoPageKey, boolean> = {
        about: hasAboutChanges,
        imprint: hasImprintChanges,
        'data-protection': hasDataProtectionChanges,
    };
    const changedInfoPageKeys = infoPageKeys.filter(
        (key) => changedInfoPages[key],
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
        setUploadingImage(fieldKey);
        setUploadErrors((current) => ({ ...current, [fieldKey]: '' }));

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/presentation/background-images',
                errorMessage: 'The image could not be uploaded.',
                fieldName: 'image',
                file,
            });
            onUploaded(payload.url);
        } catch (error) {
            setUploadErrors((current) => ({
                ...current,
                [fieldKey]:
                    error instanceof Error
                        ? error.message
                        : 'The image could not be uploaded.',
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
        if (!hasPresentationChanges) {
            return;
        }

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
        if (!changedInfoPages[key]) {
            return;
        }

        setSavingInfoPage(key);
        router.patch(
            `/settings/info-pages/${key}`,
            {
                markdown: markdownDrafts[key],
                redirect_to: '/settings?panel=admin-public-pages',
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
    const saveChangedInfoPages = () => {
        changedInfoPageKeys.forEach((key) => saveInfoPage(key));
    };
    const saveAction: SettingsSaveAction =
        activeSection === 'info'
            ? {
                  disabled:
                      savingInfoPage !== null || changedInfoPageKeys.length < 1,
                  label: 'Save',
                  onClick: saveChangedInfoPages,
                  saving: savingInfoPage !== null,
                  savingLabel: 'Saving...',
              }
            : {
                  disabled: savingPresentation || !hasPresentationChanges,
                  label: 'Save',
                  onClick: savePresentation,
                  saving: savingPresentation,
                  savingLabel: 'Saving...',
              };

    return (
        <SettingsNestedWorkspace
            action={<SettingsSaveButton action={saveAction} />}
            description="Configure authentication backgrounds, welcome copy, information pages and source links without touching code."
            icon={Image}
            sidebar={
                <PresentationSectionNavigation
                    activeSection={activeSection}
                    onSelectSection={setActiveSection}
                />
            }
            title="Public pages"
        >
            <div className="grid gap-5">
                {activeSection === 'backgrounds' ? (
                    <section className="grid gap-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                                Authentication backgrounds
                            </h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Use a public asset path such as
                                `/images/characters/mentor-calm.png` or an
                                external image URL.
                            </p>
                        </div>
                        <div className="grid gap-4">
                            {backgroundImageSummary.map((page) => (
                                <div
                                    className={settingsFormGroupClassName}
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

                {activeSection === 'welcome' ? (
                    <section className="grid gap-4">
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
                                    className={settingsFormGroupClassName}
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
                    <section className="grid gap-4">
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
                                        className={settingsFormGroupClassName}
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
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {activeSection === 'source' ? (
                    <section className="grid gap-4">
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
                            <div className={settingsFormGroupClassName}>
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
                                        className={settingsFormGroupClassName}
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
        </SettingsNestedWorkspace>
    );
}

function PresentationSectionNavigation({
    activeSection,
    onSelectSection,
}: {
    activeSection: PresentationSection;
    onSelectSection: (section: PresentationSection) => void;
}) {
    return (
        <>
            {presentationSections.map((section) => (
                <SettingsSectionButton
                    active={activeSection === section.key}
                    description={section.description}
                    icon={section.icon}
                    id={section.key}
                    key={section.key}
                    label={section.label}
                    onSelect={onSelectSection}
                />
            ))}
        </>
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
    const { auth } = usePage<{ auth: Auth }>().props;
    const canViewPath = auth.canViewMediaPaths;
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    return (
        <div className="grid gap-2">
            {canViewPath ? (
                <TextInput
                    error={error}
                    id={fieldId}
                    label={label}
                    onChange={onChange}
                    placeholder={placeholder}
                    value={value}
                />
            ) : value ? (
                <div className="grid gap-1">
                    <Label htmlFor={fieldId}>{label}</Label>
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
                        Path hidden by role permissions.
                    </p>
                    <InputError message={error} />
                </div>
            ) : (
                <InputError message={error} />
            )}
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
