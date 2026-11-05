import { useEffect, useState } from 'react';
import { ArrowLeft, Compass, ExternalLink, Github } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { apiClient } from './api/client';
import { OriginalMarkdownRenderer } from './original-markdown';

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

export function PublicInformationPage({ slug }: { slug: string }) {
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
        <PublicInformationSurface activeSlug={slug}>
            <section className="relative z-10 flex min-h-[calc(100svh-5rem)] items-center px-6 py-8 md:px-10">
                <div className="w-full max-w-3xl">
                    {page.kind === 'loading' ? (
                        <InformationCard>
                            <p aria-live="polite" className="m-0 text-sm leading-7">
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
                                The requested public information page is not available.
                            </p>
                        </InformationCard>
                    ) : null}
                    {page.kind === 'loaded' ? (
                        <InformationCard>
                            <p className="m-0 text-xs font-medium tracking-[0.18em] uppercase text-teal-300">
                                {pageLabels[slug] ?? page.title}
                            </p>
                            <div className="mt-4">
                                {hasDocumentTitle(page.body) ? null : (
                                    <h1 className="text-3xl font-semibold tracking-normal text-slate-50 md:text-5xl">
                                        {page.title}
                                    </h1>
                                )}
                                <OriginalMarkdownRenderer
                                    headingColor="#f8fafc"
                                    inheritColor
                                    markdown={page.body}
                                    style={{ color: '#e2e8f0' }}
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

export function PublicSourceCodePage() {
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
        <PublicInformationSurface>
            <section className="relative z-10 flex min-h-svh items-center justify-center px-6 py-16">
                <InformationCard className="w-full max-w-2xl">
                    <button
                        className="mb-6 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-slate-100 no-underline transition hover:bg-white/10"
                        onClick={() => {
                            if (window.history.length > 1) {
                                navigate(-1);
                                return;
                            }

                            navigate('/');
                        }}
                        type="button"
                    >
                        <ArrowLeft className="size-4" />
                        Back
                    </button>
                    <div className="flex items-start gap-4">
                        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-300 text-slate-950">
                            <Github className="size-6" />
                        </span>
                        <div>
                            <p className="m-0 text-xs font-medium tracking-[0.18em] uppercase text-teal-300">
                                Source availability
                            </p>
                            <h1 className="mt-2 mb-0 text-3xl font-semibold tracking-normal md:text-5xl">
                                Source code
                            </h1>
                            <p className="mt-4 mb-0 text-sm leading-7 text-slate-200 md:text-base">
                                This page points to the source code for the original project and, when configured by a deployment, source locations for modified versions.
                            </p>
                        </div>
                    </div>
                    {links.kind === 'loading' ? (
                        <p aria-live="polite" className="mt-8 mb-0 text-sm text-slate-200">
                            Loading source-code links…
                        </p>
                    ) : null}
                    {links.kind === 'unavailable' ? (
                        <p className="mt-8 mb-0 text-sm text-slate-200" role="alert">
                            Source-code links are temporarily unavailable.
                        </p>
                    ) : null}
                    {links.kind === 'loaded' ? (
                        <div className="mt-8 grid gap-3">
                            <SourceButton link={links.origin} />
                            {links.modifiedSources.length ? (
                                <div className="grid gap-3 pt-3">
                                    <p className="m-0 text-xs font-medium tracking-[0.14em] uppercase text-slate-300">
                                        Modified sources
                                    </p>
                                    {links.modifiedSources.map((link) => (
                                        <SourceButton key={link.url} link={link} />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </InformationCard>
            </section>
        </PublicInformationSurface>
    );
}

function PublicInformationSurface({
    activeSlug,
    children,
}: {
    activeSlug?: string;
    children: React.ReactNode;
}) {
    return (
        <main
            className="public-information relative min-h-svh overflow-hidden bg-[#07111f] text-slate-100"
            data-wl-id="public.information"
        >
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        'linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))',
                }}
            />
            <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
                <Link className="flex items-center gap-3 text-sm font-semibold text-slate-100 no-underline" to="/">
                    <span className="flex size-9 items-center justify-center rounded-md bg-teal-300 text-slate-950">
                        <Compass className="size-5" />
                    </span>
                    <span className="hidden sm:inline">Learning Worlds</span>
                </Link>
                <nav className="flex items-center gap-2" aria-label="Public information">
                    <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-100 no-underline transition hover:bg-white/10" to="/">
                        Home
                    </Link>
                    {Object.entries(pageLabels).map(([slug, label]) => (
                        <Link
                            className="rounded-md px-3 py-2 text-sm font-medium no-underline transition hover:bg-white/10"
                            key={slug}
                            style={{ color: slug === activeSlug ? '#5eead4' : '#f8fafc' }}
                            to={`/${slug}`}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>
            {children}
            <Link
                aria-label="Source code"
                className="fixed right-6 bottom-6 z-[80] grid size-6 place-items-center text-slate-200 opacity-80 transition hover:-translate-y-0.5 hover:opacity-100"
                title="Source code"
                to="/source"
            >
                <Github className="size-5" />
            </Link>
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
        <article className={`rounded-xl border border-white/15 bg-slate-950/72 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-md md:p-8 ${className}`}>
            {children}
        </article>
    );
}

function SourceButton({ link }: { link: { label: string; url: string } }) {
    return (
        <a
            className="flex items-center justify-between gap-3 rounded-lg border border-white/15 px-4 py-3 text-sm font-semibold text-slate-100 no-underline transition hover:bg-white/10"
            href={link.url}
            rel="noreferrer"
            target="_blank"
        >
            <span>{link.label}</span>
            <ExternalLink className="size-4" />
        </a>
    );
}
