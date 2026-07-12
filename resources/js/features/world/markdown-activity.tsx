import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { useAppearance } from '@/hooks/use-appearance';
import type { ActivityTransition, LearningActivity } from '@/types';

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

type MarkdownPageTransition = {
    from: string;
    to: string;
};

export function MarkdownActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const pages = useMemo(
        () => markdownPages(activity.config.markdownPages),
        [activity.config.markdownPages],
    );
    const pageTransitions = useMemo(
        () => markdownTransitions(activity.config.markdownTransitions),
        [activity.config.markdownTransitions],
    );
    const firstPageId = firstPageFor(pageTransitions, pages);
    const [currentPageId, setCurrentPageId] = useState(firstPageId);
    const [history, setHistory] = useState<string[]>([]);
    const currentPage =
        pages.find((page) => page.id === currentPageId) ?? pages[0] ?? null;
    const nextPageId = currentPage
        ? nextPageFor(currentPage.id, pageTransitions, pages)
        : null;

    const complete = useCallback(async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    }, [activity, onComplete, onMoveToActivity, transition]);

    const goForward = useCallback(() => {
        if (!currentPage) {
            return;
        }

        if (!nextPageId) {
            void complete();

            return;
        }

        setHistory((current) => [...current, currentPage.id]);
        setCurrentPageId(nextPageId);
    }, [complete, currentPage, nextPageId]);

    const goBack = useCallback(() => {
        setHistory((current) => {
            const nextHistory = [...current];
            const previousPageId = nextHistory.pop();

            if (previousPageId) {
                setCurrentPageId(previousPageId);
            }

            return nextHistory;
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) {
                return;
            }

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
                    <p className="font-semibold">No markdown pages</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Add pages in the activity editor to make this readable.
                    </p>
                </div>
            </div>
        );
    }

    const visual = currentPage.visual;
    const isLight = resolvedAppearance === 'light';
    const pageStyle = {
        backgroundColor: isLight ? visual.pageColorLight : visual.pageColorDark,
        borderColor: isLight ? visual.borderColorLight : visual.borderColorDark,
        color: isLight ? visual.textColorLight : visual.textColorDark,
    };
    const headingColor = isLight
        ? visual.headingColorLight
        : visual.headingColorDark;

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <article
                className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto rounded-xl border-2 p-5 shadow-sm md:p-8"
                style={pageStyle}
            >
                <MarkdownRenderer
                    headingColor={headingColor}
                    inheritColor
                    markdown={currentPage.body}
                    style={{
                        color: pageStyle.color,
                    }}
                />
            </article>

            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
                <Button
                    disabled={history.length === 0}
                    onClick={goBack}
                    size="icon"
                    type="button"
                    variant="secondary"
                >
                    <ArrowLeft className="size-4" />
                </Button>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {pages.findIndex((page) => page.id === currentPage.id) + 1}{' '}
                    / {pages.length}
                </span>

                <Button onClick={goForward} type="button">
                    {nextPageId ? (
                        <ArrowRight className="size-4" />
                    ) : (
                        <>
                            Continue
                            <ArrowRight className="size-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

function markdownPages(value: unknown): MarkdownPage[] {
    if (!Array.isArray(value)) {
        return [];
    }

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
    if (!Array.isArray(value)) {
        return [];
    }

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
    const transition = transitions.find(
        (candidate) => candidate.from === pageId,
    );

    if (!transition || transition.to === 'end') {
        return null;
    }

    return pages.some((page) => page.id === transition.to)
        ? transition.to
        : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]'),
    );
}
