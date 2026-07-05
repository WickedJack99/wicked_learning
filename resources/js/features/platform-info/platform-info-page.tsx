import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Compass, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    platformInfoLinks,
    platformInfoPages,
} from '@/features/platform-info/content';
import type { PlatformInfoPageKey } from '@/features/platform-info/content';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { useAppearance, useAppearancePageSync } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { getAuthTheme, getAuthThemeStyle } from '@/theme/platform-theme';
import { getPresentationBackgroundImage } from '@/theme/presentation';

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
    pageKey: PlatformInfoPageKey;
    variant: 'public' | 'settings';
};

export function PlatformInfoPage({ pageKey, variant }: Props) {
    const { props } = usePage<{
        canEditPlatformInfo?: boolean;
        platformInfoContent?: PlatformInfoContent;
    }>();
    const {
        auth,
        appearance,
        canEditPlatformInfo,
        platformInfoContent,
        publicPresentation,
    } = props;
    useAppearancePageSync(Boolean(auth.user), appearance);
    const { resolvedAppearance } = useAppearance();
    const page = platformInfoPages[pageKey];
    const markdown = platformInfoContent?.markdown ?? page.markdown;
    const canEdit = variant === 'settings' && Boolean(canEditPlatformInfo);
    const [isEditing, setIsEditing] = useState(false);
    const { data, errors, patch, processing, setData } = useForm({
        markdown,
        redirect_to: `/settings/${pageKey}`,
    });

    useEffect(() => {
        if (!isEditing) {
            setData('markdown', markdown);
        }
    }, [isEditing, markdown, setData]);

    const cancelEditing = () => {
        setData('markdown', markdown);
        setIsEditing(false);
    };

    const saveMarkdown = () => {
        patch(`/settings/info-pages/${pageKey}`, {
            preserveScroll: true,
            onSuccess: () => setIsEditing(false),
        });
    };

    if (variant === 'settings') {
        return (
            <>
                <Head title={page.title} />
                <main className="h-full overflow-hidden bg-slate-100 px-4 py-6 pb-24 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                    <div className="mx-auto flex h-full max-w-3xl flex-col">
                        <div className="mb-6 flex shrink-0 items-center justify-between gap-3">
                            <Button asChild variant="ghost">
                                <Link href="/settings">
                                    <ArrowLeft className="size-4" />
                                    Settings
                                </Link>
                            </Button>
                            {canEdit && !isEditing ? (
                                <Button
                                    onClick={() => setIsEditing(true)}
                                    variant="secondary"
                                >
                                    <Pencil className="size-4" />
                                    Edit
                                </Button>
                            ) : null}
                        </div>

                        <InfoArticle
                            isEditing={isEditing}
                            markdown={markdown}
                            pageKey={pageKey}
                            variant="settings"
                        >
                            {isEditing ? (
                                <MarkdownEditor
                                    errors={errors}
                                    markdown={data.markdown}
                                    onCancel={cancelEditing}
                                    onChange={(value) =>
                                        setData('markdown', value)
                                    }
                                    onSave={saveMarkdown}
                                    processing={processing}
                                />
                            ) : null}
                        </InfoArticle>
                    </div>
                </main>
            </>
        );
    }

    const backgroundImage = getPresentationBackgroundImage(
        publicPresentation,
        'welcome',
        resolvedAppearance,
    );
    const theme = {
        ...getAuthTheme('welcome', resolvedAppearance),
        ...(backgroundImage ? { backgroundImage } : {}),
    };
    const themeStyle = getAuthThemeStyle(theme);

    return (
        <>
            <Head title={page.title} />
            <main
                className="relative min-h-svh overflow-hidden bg-[var(--auth-background-color)]"
                style={themeStyle}
            >
                <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'var(--auth-background-image)' }}
                />
                <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ background: 'var(--auth-background-overlay)' }}
                />
                <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
                    <Link
                        className="flex items-center gap-3 text-sm font-semibold"
                        href="/"
                    >
                        <span
                            className="flex size-9 items-center justify-center rounded-md"
                            style={{
                                background: 'var(--auth-logo-background)',
                                color: 'var(--auth-logo-color)',
                            }}
                        >
                            <Compass className="size-5" />
                        </span>
                        <span style={{ color: 'var(--auth-title-text-color)' }}>
                            Learning Worlds
                        </span>
                    </Link>
                    <nav className="flex items-center gap-2">
                        {platformInfoLinks.map((link) => (
                            <Link
                                className="rounded-md px-3 py-2 text-sm font-medium transition hover:bg-white/10"
                                href={link.href}
                                key={link.key}
                                style={{
                                    color:
                                        link.key === pageKey
                                            ? 'var(--auth-eyebrow-text-color)'
                                            : 'var(--auth-title-text-color)',
                                }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </header>

                <section className="relative z-10 flex min-h-[calc(100svh-5rem)] items-center px-6 py-8 md:px-10">
                    <div className="w-full max-w-3xl">
                        <InfoArticle
                            markdown={markdown}
                            pageKey={pageKey}
                            variant="public"
                        />
                    </div>
                </section>
            </main>
        </>
    );
}

function InfoArticle({
    children,
    isEditing = false,
    markdown,
    pageKey,
    variant,
}: {
    children?: React.ReactNode;
    isEditing?: boolean;
    markdown: string;
    pageKey: PlatformInfoPageKey;
    variant: 'public' | 'settings';
}) {
    const page = platformInfoPages[pageKey];

    return (
        <article
            className={cn(
                'rounded-xl border p-6 shadow-2xl backdrop-blur-md md:p-8',
                variant === 'public'
                    ? 'border-[var(--auth-border-line-color,rgba(148,163,184,0.24))] bg-[var(--auth-panel-background,rgba(255,255,255,0.86))] shadow-slate-950/15 dark:shadow-black/30'
                    : 'min-h-0 flex-1 border-slate-200 bg-white shadow-slate-950/10 dark:border-white/10 dark:bg-[#111820] dark:shadow-black/30',
                isEditing && 'flex flex-col',
            )}
        >
            <p className="shrink-0 text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                {page.eyebrow}
            </p>
            {isEditing ? (
                children
            ) : (
                <div className="mt-4">
                    <MarkdownRenderer markdown={markdown} />
                </div>
            )}
        </article>
    );
}

function MarkdownEditor({
    errors,
    markdown,
    onCancel,
    onChange,
    onSave,
    processing,
}: {
    errors: Partial<Record<'markdown', string>>;
    markdown: string;
    onCancel: () => void;
    onChange: (value: string) => void;
    onSave: () => void;
    processing: boolean;
}) {
    return (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <textarea
                className="min-h-0 flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/30 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-teal-200 dark:focus:ring-teal-200/30"
                onChange={(event) => onChange(event.currentTarget.value)}
                value={markdown}
            />
            <InputError className="mt-2" message={errors.markdown} />
            <div className="mt-4 flex shrink-0 justify-end gap-2">
                <Button
                    disabled={processing}
                    onClick={onCancel}
                    type="button"
                    variant="secondary"
                >
                    Cancel
                </Button>
                <Button disabled={processing} onClick={onSave} type="button">
                    Save
                </Button>
            </div>
        </div>
    );
}
