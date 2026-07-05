import { router } from '@inertiajs/react';
import {
    Download,
    FileText,
    Image,
    Plus,
    Save,
    Trash2,
    Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformInfoPages } from '@/features/platform-info/content';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import type {
    PublicPresentationSettings,
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
type ThemeMode = 'dark' | 'light';

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

const blankWelcomePage: WelcomePageSettings = {
    eyebrow: 'New section',
    title: 'New welcome page',
    body: 'Describe this part of the platform.',
    primaryLabel: 'Continue',
};

export function AdminPresentationPanel({
    platformInfoContent,
    presentation,
}: Props) {
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

    const uploadBackgroundImage = async (
        page: AuthBackgroundPage,
        mode: ThemeMode,
        file: File,
    ) => {
        const fieldKey = `${page}.${mode}`;
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

            updateBackgroundImage(page, mode, payload.url);
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
        <div>
            <div className="border-b border-slate-200 pb-5 dark:border-white/10">
                <div className="mb-3 flex items-center gap-3 text-cyan-700 dark:text-teal-100">
                    <Image className="size-5" />
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                        Public presentation
                    </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Configure the public welcome experience, authentication
                    backgrounds and public information pages without touching
                    code.
                </p>
            </div>

            <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                        Authentication backgrounds
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Use a public asset path such as
                        `/images/themes/mentor-calm.svg` or an external image
                        URL.
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
                                        uploadErrors[`${page.key}.dark`] ??
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
                                        uploadingImage === `${page.key}.dark`
                                    }
                                    value={page.images.dark ?? ''}
                                />
                                <BackgroundInput
                                    error={
                                        uploadErrors[`${page.key}.light`] ??
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
                                        uploadingImage === `${page.key}.light`
                                    }
                                    value={page.images.light ?? ''}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                            Welcome pages
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            These pages are shown in the full-screen welcome
                            sequence.
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
                                    onClick={() => removeWelcomePage(index)}
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
                                        updateWelcomePage(index, 'title', value)
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
                                <Label htmlFor={`welcome-body-${index}`}>
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
                <div className="mt-4 flex justify-end">
                    <Button
                        disabled={savingPresentation}
                        onClick={savePresentation}
                        type="button"
                    >
                        <Save className="size-4" />
                        Save presentation
                    </Button>
                </div>
            </section>

            <section className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-white/10">
                <div className="mb-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                        <FileText className="size-4 text-cyan-700 dark:text-teal-200" />
                        Platform information pages
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Markdown content for About, Imprint and Data Protection
                        lives here now.
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
                                        {platformInfoContent[key]?.updated_by
                                            ? `Last edited by ${platformInfoContent[key]?.updated_by?.name}`
                                            : 'Default content is currently used.'}
                                    </p>
                                </div>
                                <textarea
                                    className="max-h-[40svh] min-h-64 resize-y overflow-y-auto rounded-md border border-input bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                    onChange={(event) =>
                                        setMarkdownDrafts((current) => ({
                                            ...current,
                                            [key]: event.currentTarget.value,
                                        }))
                                    }
                                    value={markdownDrafts[key]}
                                />
                                <InputError message={infoErrors.markdown} />
                                <div className="flex justify-end">
                                    <Button
                                        disabled={savingInfoPage === key}
                                        onClick={() => saveInfoPage(key)}
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
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={value || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
                </Button>
            </div>
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
