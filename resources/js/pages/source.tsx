import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ExternalLink, Github } from 'lucide-react';
import { useAppearance, useAppearancePageSync } from '@/hooks/use-appearance';
import { getAuthTheme, getAuthThemeStyle } from '@/theme/platform-theme';
import {
    getPublicPresentationStyle,
    getPresentationBackgroundImage,
} from '@/theme/presentation';
import type { SourceLinkSettings } from '@/theme/presentation';

function visibleSourceLinks(
    links: SourceLinkSettings[] | undefined,
): SourceLinkSettings[] {
    return (links ?? []).filter((link) => link.label.trim() && link.url.trim());
}

export default function SourcePage() {
    const { auth, appearance, publicPresentation } = usePage().props;
    useAppearancePageSync(Boolean(auth.user), appearance);
    const { resolvedAppearance } = useAppearance();
    const backgroundImage = getPresentationBackgroundImage(
        publicPresentation,
        'welcome',
        resolvedAppearance,
    );
    const theme = {
        ...getAuthTheme('welcome', resolvedAppearance),
        ...(backgroundImage ? { backgroundImage } : {}),
    };
    const themeStyle = {
        ...getAuthThemeStyle(theme),
        ...getPublicPresentationStyle(publicPresentation, resolvedAppearance),
    };
    const origin = publicPresentation.sourceLinks.origin;
    const customLinks = visibleSourceLinks(
        publicPresentation.sourceLinks.custom,
    );
    const goBack = () => {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }

        window.location.href = '/';
    };

    return (
        <>
            <Head title="Source Code" />
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

                <section className="relative z-10 flex min-h-svh items-center justify-center px-6 py-16">
                    <div className="w-full max-w-2xl rounded-xl border border-[var(--auth-border-line-color,rgba(148,163,184,0.24))] bg-[var(--auth-panel-background,rgba(255,255,255,0.86))] p-6 shadow-2xl shadow-slate-950/15 backdrop-blur-md md:p-8 dark:shadow-black/30">
                        <button
                            className="mb-6 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition hover:bg-current/8"
                            onClick={goBack}
                            style={{ color: 'var(--public-control-text)' }}
                            type="button"
                        >
                            <ArrowLeft className="size-4" />
                            Back
                        </button>

                        <div className="flex items-start gap-4">
                            <span
                                className="grid size-11 shrink-0 place-items-center rounded-lg"
                                style={{
                                    background: 'var(--public-accent-text)',
                                    color: 'var(--auth-button-text-color)',
                                }}
                            >
                                <Github className="size-6" />
                            </span>
                            <div>
                                <p
                                    className="text-xs font-medium tracking-[0.18em] uppercase"
                                    style={{
                                        color: 'var(--public-accent-text)',
                                    }}
                                >
                                    Source availability
                                </p>
                                <h1
                                    className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl"
                                    style={{
                                        color: 'var(--public-heading-text)',
                                    }}
                                >
                                    Source code
                                </h1>
                                <p
                                    className="mt-4 text-sm leading-7 md:text-base"
                                    style={{ color: 'var(--public-body-text)' }}
                                >
                                    This page points to the source code for the
                                    original project and, when configured by a
                                    deployment, source locations for modified
                                    versions.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 grid gap-3">
                            <SourceButton link={origin} />
                            {customLinks.length ? (
                                <div className="grid gap-3 pt-3">
                                    <p
                                        className="text-xs font-medium tracking-[0.14em] uppercase"
                                        style={{
                                            color: 'var(--public-muted-text)',
                                        }}
                                    >
                                        Modified sources
                                    </p>
                                    {customLinks.map((link, index) => (
                                        <SourceButton
                                            key={`${link.url}-${index}`}
                                            link={link}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}

function SourceButton({ link }: { link: SourceLinkSettings }) {
    return (
        <a
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition hover:bg-current/8"
            href={link.url}
            rel="noreferrer"
            style={{
                borderColor: 'var(--public-control-border)',
                color: 'var(--public-control-text)',
            }}
            target="_blank"
        >
            <span>{link.label}</span>
            <ExternalLink className="size-4" />
        </a>
    );
}
