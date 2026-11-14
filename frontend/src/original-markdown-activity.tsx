import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { components } from './api/schema';
import { OriginalMarkdownRenderer } from './original-markdown';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];

type MarkdownPage = {
    body: string;
    id: string;
    title: string;
    visual: {
        borderColorDark: string;
        borderColorLight: string;
        headingColorDark: string;
        headingColorLight: string;
        pageColorDark: string;
        pageColorLight: string;
        textColorDark: string;
        textColorLight: string;
    };
};

type MarkdownPageTransition = { from: string; to: string };

/**
 * Source-adapted from `features/world/markdown-activity.tsx`. The authored
 * page graph remains browser navigation only; Rust authorizes the active
 * activity and owns its final completion/transition.
 */
export function OriginalMarkdownActivity({
    activity,
    appearance,
    onComplete,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
}) {
    const config = activity.config as Record<string, unknown>;
    const t = usePlatformTranslation();
    const pages = useMemo(
        () => markdownPages(config.markdownPages),
        [config.markdownPages],
    );
    const pageTransitions = useMemo(
        () => markdownTransitions(config.markdownTransitions),
        [config.markdownTransitions],
    );
    const firstPageId = firstPageFor(pageTransitions, pages);
    const [currentPageId, setCurrentPageId] = useState(firstPageId);
    const [history, setHistory] = useState<string[]>([]);
    const [completing, setCompleting] = useState(false);
    const currentPage =
        pages.find((page) => page.id === currentPageId) ?? pages[0] ?? null;
    const nextPageId = currentPage
        ? nextPageFor(currentPage.id, pageTransitions, pages)
        : null;

    const complete = useCallback(async () => {
        if (completing) return;
        setCompleting(true);
        try {
            await onComplete();
        } finally {
            setCompleting(false);
        }
    }, [completing, onComplete]);

    const goForward = useCallback(() => {
        if (!currentPage || completing) return;
        if (!nextPageId) {
            void complete();
            return;
        }
        setHistory((current) => [...current, currentPage.id]);
        setCurrentPageId(nextPageId);
    }, [complete, completing, currentPage, nextPageId]);

    const goBack = useCallback(() => {
        if (completing) return;
        setHistory((current) => {
            const nextHistory = [...current];
            const previousPageId = nextHistory.pop();
            if (previousPageId) setCurrentPageId(previousPageId);
            return nextHistory;
        });
    }, [completing]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goBack();
            }
            if (event.key === 'ArrowRight' || event.key === ' ') {
                event.preventDefault();
                goForward();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goBack, goForward]);

    if (!currentPage) {
        return (
            <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-white/15 dark:bg-white/6">
                <div>
                    <p className="font-semibold">
                        {t('learning.markdown.empty.title', 'No markdown pages')}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {t(
                            'learning.markdown.empty.body',
                            'Add pages in the activity editor to make this readable.',
                        )}
                    </p>
                </div>
            </div>
        );
    }

    const visual = currentPage.visual;
    const isLight = appearance === 'light';
    const pageStyle = {
        backgroundColor: isLight ? visual.pageColorLight : visual.pageColorDark,
        borderColor: isLight ? visual.borderColorLight : visual.borderColorDark,
        color: isLight ? visual.textColorLight : visual.textColorDark,
    };
    const headingColor = isLight
        ? visual.headingColorLight
        : visual.headingColorDark;

    return (
        <div
            className="flex min-h-0 flex-1 flex-col gap-4"
            data-wl-id="learner.activity.markdown"
        >
            <article
                className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto rounded-xl border-2 p-5 shadow-sm md:p-8"
                style={pageStyle}
            >
                <OriginalMarkdownRenderer
                    headingColor={headingColor}
                    inheritColor
                    markdown={currentPage.body}
                    style={{ color: pageStyle.color }}
                />
            </article>
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
                <button
                    aria-label={t(
                        'learning.markdown.previous_page',
                        'Previous page',
                    )}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-950 transition hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    disabled={history.length === 0 || completing}
                    onClick={goBack}
                    type="button"
                >
                    <ArrowLeft className="size-4" />
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pages.findIndex((page) => page.id === currentPage.id) + 1} /{' '}
                    {pages.length}
                </span>
                <button
                    className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                    disabled={completing}
                    onClick={goForward}
                    type="button"
                >
                    {nextPageId ? (
                        <ArrowRight className="size-4" />
                    ) : (
                        <>
                            {activity.completion.label?.trim() ||
                                t('common.continue', 'Continue')}
                            <ArrowRight className="ml-2 size-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function markdownPages(value: unknown): MarkdownPage[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord).map((page, index): MarkdownPage => {
        const visual = isRecord(page.visual) ? page.visual : {};
        return {
            body: stringValue(page.body, ''),
            id: stringValue(page.id, `page-${index + 1}`),
            title: stringValue(page.title, `Page ${index + 1}`),
            visual: {
                borderColorDark: stringValue(visual.borderColorDark, '#2dd4bf'),
                borderColorLight: stringValue(
                    visual.borderColorLight,
                    '#0891b2',
                ),
                headingColorDark: stringValue(
                    visual.headingColorDark,
                    '#67e8f9',
                ),
                headingColorLight: stringValue(
                    visual.headingColorLight,
                    '#0e7490',
                ),
                pageColorDark: stringValue(visual.pageColorDark, '#0f172a'),
                pageColorLight: stringValue(visual.pageColorLight, '#ffffff'),
                textColorDark: stringValue(visual.textColorDark, '#f8fafc'),
                textColorLight: stringValue(visual.textColorLight, '#0f172a'),
            },
        };
    });
}

function markdownTransitions(value: unknown): MarkdownPageTransition[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord).map((transition) => ({
        from: stringValue(transition.from, ''),
        to: stringValue(transition.to, ''),
    }));
}

function firstPageFor(
    transitions: MarkdownPageTransition[],
    pages: MarkdownPage[],
): string | null {
    const first = transitions.find((transition) => transition.from === 'start');
    return pages.some((page) => page.id === first?.to)
        ? (first?.to ?? null)
        : (pages[0]?.id ?? null);
}

function nextPageFor(
    pageId: string,
    transitions: MarkdownPageTransition[],
    pages: MarkdownPage[],
): string | null {
    const transition = transitions.find((candidate) => candidate.from === pageId);
    if (!transition || transition.to === 'end') return null;
    return pages.some((page) => page.id === transition.to) ? transition.to : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function isEditableTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        Boolean(
            target.closest('input, textarea, select, [contenteditable="true"]'),
        )
    );
}
