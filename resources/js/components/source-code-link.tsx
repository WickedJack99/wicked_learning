import { Github } from 'lucide-react';

export function SourceCodeLink() {
    const path = typeof window === 'undefined' ? '/' : window.location.pathname;
    const isPublicSurface =
        path === '/' ||
        path === '/about' ||
        path === '/imprint' ||
        path === '/data-protection' ||
        path === '/source';

    return (
        <a
            aria-label="Source code"
            className="fixed right-6 z-[80] grid size-6 place-items-center text-slate-700 opacity-80 transition hover:-translate-y-0.5 hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none dark:text-slate-200"
            href="/source"
            style={{
                bottom: isPublicSurface ? '1.55rem' : '1rem',
                color: 'var(--public-control-text, currentColor)',
                outlineColor: 'var(--public-accent, #5eead4)',
            }}
            title="Source code"
        >
            <Github className="size-5" />
        </a>
    );
}
