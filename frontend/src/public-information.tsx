import { useEffect, useState } from 'react';
import { ArrowLeft, Compass, ExternalLink, Github } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { apiClient } from './api/client';
import { OriginalMarkdownRenderer } from './original-markdown';
import {
    publicPresentationStyle,
    type PublicPresentation,
} from './public-presentation';
import type { OriginalAppearance } from './original-appearance';

const pageLabels: Record<string, string> = {
    about: 'About',
    imprint: 'Imprint',
    'data-protection': 'Data protection',
};

type PageState =
    | { kind: 'loading' }
    | { kind: 'loaded'; body: string; title: string }
    | { kind: 'not-found' }
    | { kind: 'unavailable' };

type SourceLinksState =
    | { kind: 'loading' }
    | {
          kind: 'loaded';
          modifiedSources: Array<{ label: string; url: string }>;
          origin: { label: string; url: string };
      }
    | { kind: 'unavailable' };

export function PublicInformationPage({
    appearance,
    presentation,
    slug,
}: {
    appearance: OriginalAppearance;
    presentation: PublicPresentation;
    slug: string;
}) {
    const [page, setPage] = useState<PageState>({ kind: 'loading' });

    useEffect(() => {
        setPage({ kind: 'loading' });
        void apiClient
            .GET('/public/pages/{slug}', { params: { path: { slug } } })
            .then(({ data, response }) => {
                if (response.status === 404) {
                    setPage({ kind: 'not-found' });
                    return;
                }
                if (!data) {
                    setPage({ kind: 'unavailable' });
                    return;
                }

                setPage({ kind: 'loaded', body: data.body, title: data.title });
            })
            .catch(() => setPage({ kind: 'unavailable' }));
    }, [slug]);

    return (
        <PublicInformationSurface
            activeSlug={slug}
            appearance={appearance}
            presentation={presentation}
        >
            <section className="relative z-10 flex min-h-[calc(100svh-5rem)] items-center px-6 py-8 md:px-10">
                <div className="w-full max-w-3xl">
                    {page.kind === 'loading' ? (
                        <InformationCard>
                            <p
                                aria-live="polite"
                                className="m-0 text-sm leading-7"
                            >
                                Loading public information…
                            </p>
                        </InformationCard>
                    ) : null}
                    {page.kind === 'unavailable' ? (
                        <InformationCard>
                            <p className="m-0 text-sm leading-7" role="alert">
                                Public information is temporarily unavailable.
                            </p>
                        </InformationCard>
                    ) : null}
                    {page.kind === 'not-found' ? (
                        <InformationCard>
                            <h1 className="m-0 text-3xl font-semibold tracking-normal md:text-5xl">
                                Page not found
                            </h1>
                            <p className="mt-4 mb-0 text-sm leading-7 md:text-base">
                                The requested public information page is not
                                available.
                            </p>
                        </InformationCard>
                    ) : null}
                    {page.kind === 'loaded' ? (
                        <InformationCard>
                            <p
                                className="m-0 text-xs font-medium tracking-[0.18em] uppercase"
                                style={{ color: 'var(--public-accent)' }}
                            >
                                {pageLabels[slug] ?? page.title}
                            </p>
                            <div className="mt-4">
                                {hasDocumentTitle(page.body) ? null : (
                                    <h1
                                        className="text-3xl font-semibold tracking-normal md:text-5xl"
                                        style={{
                                            color: 'var(--public-heading-text)',
                                        }}
                                    >
                                        {page.title}
                                    </h1>
                                )}
                                <OriginalMarkdownRenderer
                                    headingColor="var(--public-heading-text)"
                                    inheritColor
                                    markdown={page.body}
                                    style={{ color: 'var(--public-body-text)' }}
                                />
                            </div>
                        </InformationCard>
                    ) : null}
                </div>
            </section>
        </PublicInformationSurface>
    );
}

function hasDocumentTitle(markdown: string): boolean {
    return markdown.split(/\r?\n/).some((line) => /^#\s+/.test(line));
}

export function PublicSourceCodePage({
    appearance,
    presentation,
}: {
    appearance: OriginalAppearance;
    presentation: PublicPresentation;
}) {
    const navigate = useNavigate();
    const [links, setLinks] = useState<SourceLinksState>({ kind: 'loading' });

    useEffect(() => {
        void apiClient
            .GET('/public/source-links')
            .then(({ data, response }) => {
                if (!response.ok || !data) {
                    setLinks({ kind: 'unavailable' });
                    return;
                }

                setLinks({
                    kind: 'loaded',
                    modifiedSources: data.modified_sources,
                    origin: data.origin,
                });
            })
            .catch(() => setLinks({ kind: 'unavailable' }));
    }, []);

    return (
        <main
            className="platform-shell relative min-h-svh overflow-hidden bg-[var(--auth-background-color)]"
            data-wl-id="public.source-code"
            style={publicPresentationStyle(presentation, appearance, 'welcome')}
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
                <article className="w-full max-w-2xl rounded-xl border border-[var(--auth-border-line-color,rgba(148,163,184,0.24))] bg-[var(--auth-panel-background,rgba(255,255,255,0.86))] p-6 shadow-2xl shadow-slate-950/15 backdrop-blur-md md:p-8 dark:shadow-black/30">
                    <button
                        className="mb-6 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium transition hover:bg-current/8"
                        onClick={() => {
                            if (window.history.length > 1) {
                                navigate(-1);
                                return;
                            }

                            navigate('/');
                        }}
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
                                background: 'var(--public-accent)',
                                color: 'var(--auth-button-text-color)',
                            }}
                        >
                            <Github className="size-6" />
                        </span>
                        <div>
                            <p
                                className="m-0 text-xs font-medium tracking-[0.18em] uppercase"
                                style={{ color: 'var(--public-accent)' }}
                            >
                                Source availability
                            </p>
                            <h1
                                className="mt-2 mb-0 text-3xl font-semibold tracking-normal md:text-5xl"
                                style={{ color: 'var(--public-heading-text)' }}
                            >
                                Source code
                            </h1>
                            <p
                                className="mt-4 mb-0 text-sm leading-7 md:text-base"
                                style={{ color: 'var(--public-body-text)' }}
                            >
                                This page points to the source code for the
                                original project and, when configured by a
                                deployment, source locations for modified
                                versions.
                            </p>
                        </div>
                    </div>
                    {links.kind === 'loading' ? (
                        <p
                            aria-live="polite"
                            className="mt-8 mb-0 text-sm"
                            style={{ color: 'var(--public-body-text)' }}
                        >
                            Loading source-code links…
                        </p>
                    ) : null}
                    {links.kind === 'unavailable' ? (
                        <p
                            className="mt-8 mb-0 text-sm"
                            role="alert"
                            style={{ color: 'var(--public-body-text)' }}
                        >
                            Source-code links are temporarily unavailable.
                        </p>
                    ) : null}
                    {links.kind === 'loaded' ? (
                        <div className="mt-8 grid gap-3">
                            <SourceButton link={links.origin} />
                            {links.modifiedSources.length ? (
                                <div className="grid gap-3 pt-3">
                                    <p
                                        className="m-0 text-xs font-medium tracking-[0.14em] uppercase"
                                        style={{
                                            color: 'var(--public-muted-text)',
                                        }}
                                    >
                                        Modified sources
                                    </p>
                                    {links.modifiedSources.map((link) => (
                                        <SourceButton
                                            key={link.url}
                                            link={link}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </article>
            </section>
        </main>
    );
}

function PublicInformationSurface({
    activeSlug,
    appearance,
    children,
    presentation,
}: {
    activeSlug?: string;
    appearance: OriginalAppearance;
    children: React.ReactNode;
    presentation: PublicPresentation;
}) {
    return (
        <main
            className="platform-shell relative min-h-svh overflow-hidden bg-[var(--auth-background-color)]"
            data-wl-id="public.information"
            style={publicPresentationStyle(presentation, appearance, 'welcome')}
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
                    to="/"
                >
                    <span
                        className="flex size-9 items-center justify-center rounded-md"
                        style={{
                            background: 'var(--public-accent)',
                            color: 'var(--auth-button-text-color)',
                        }}
                    >
                        <Compass className="size-5" />
                    </span>
                    <span
                        className="hidden sm:inline"
                        style={{ color: 'var(--public-heading-text)' }}
                    >
                        Learning Worlds
                    </span>
                </Link>
                <nav
                    className="flex items-center gap-2"
                    aria-label="Public information"
                >
                    <Link
                        className="rounded-md px-3 py-2 text-sm font-medium transition hover:bg-white/10"
                        style={{ color: 'var(--public-control-text)' }}
                        to="/"
                    >
                        Home
                    </Link>
                    {Object.entries(pageLabels).map(([slug, label]) => (
                        <Link
                            className="rounded-md px-3 py-2 text-sm font-medium transition hover:bg-white/10"
                            key={slug}
                            style={{
                                color:
                                    slug === activeSlug
                                        ? 'var(--public-accent)'
                                        : 'var(--public-control-text)',
                            }}
                            to={`/${slug}`}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>
            {children}
        </main>
    );
}

function InformationCard({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <article
            className={`rounded-xl border border-[var(--auth-border-line-color,rgba(148,163,184,0.24))] bg-[var(--auth-panel-background,rgba(255,255,255,0.86))] p-6 shadow-2xl shadow-slate-950/15 backdrop-blur-md md:p-8 dark:shadow-black/30 ${className}`}
        >
            {children}
        </article>
    );
}

function SourceButton({ link }: { link: { label: string; url: string } }) {
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
