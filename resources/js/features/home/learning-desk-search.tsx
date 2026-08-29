import { router } from '@inertiajs/react';
import {
    ArrowRight,
    BookOpenText,
    LoaderCircle,
    Map,
    Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getJson } from '@/features/world/api';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { LearningSearchResult } from './types';

type SearchResponse = {
    results: LearningSearchResult[];
};

const SEARCH_PAGE_SIZE = 5;

export function LearningDeskSearch() {
    const t = usePlatformTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LearningSearchResult[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const requestId = useRef(0);

    useEffect(() => {
        const term = query.trim();

        if (term.length < 2) {
            return;
        }

        const id = ++requestId.current;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
            setLoading(true);
            void getJson<SearchResponse>(
                `/learning/search?query=${encodeURIComponent(term)}`,
                controller.signal,
            )
                .then((response) => {
                    if (id === requestId.current) {
                        setResults(response.results);
                        setPage(1);
                        setOpen(true);
                    }
                })
                .catch(() => {
                    if (
                        !controller.signal.aborted &&
                        id === requestId.current
                    ) {
                        setResults([]);
                    }
                })
                .finally(() => {
                    if (id === requestId.current) {
                        setLoading(false);
                    }
                });
        }, 260);

        return () => {
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [query]);

    const visit = (result: LearningSearchResult) => {
        router.visit(result.href);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (results[0]) {
            visit(results[0]);
        } else if (query.trim()) {
            setOpen(true);
        }
    };

    const totalPages = Math.max(
        1,
        Math.ceil(results.length / SEARCH_PAGE_SIZE),
    );
    const visibleResults = results.slice(
        (page - 1) * SEARCH_PAGE_SIZE,
        page * SEARCH_PAGE_SIZE,
    );

    return (
        <div className="relative mt-7">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">
                        {t(
                            'home.learning_desk.search.label',
                            'Search learning content',
                        )}
                    </span>
                    <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-slate-400" />
                    <input
                        autoComplete="off"
                        className="h-14 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-13 text-sm text-slate-950 transition outline-none placeholder:text-slate-400 focus:border-[var(--learner-action-accent)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--learner-action-accent)_15%,transparent)] dark:border-white/12 dark:bg-[#0d1825] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[var(--learner-action-accent)]"
                        onChange={(event) => {
                            const value = event.target.value;

                            setQuery(value);

                            if (value.trim().length < 2) {
                                requestId.current++;
                                setResults([]);
                                setPage(1);
                                setLoading(false);
                                setOpen(false);
                            }
                        }}
                        onFocus={() => setOpen(true)}
                        placeholder={t(
                            'home.learning_desk.search.placeholder',
                            'Enter a question, topic or thought…',
                        )}
                        value={query}
                    />
                    {loading ? (
                        <LoaderCircle className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-[var(--learner-action-accent)]" />
                    ) : null}
                </label>
                <button
                    className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--learner-action-accent)_70%,transparent)] px-6 text-sm font-semibold text-[var(--learner-action-accent)] transition hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_srgb,var(--learner-action-accent)_20%,transparent)] focus-visible:outline-none"
                    type="submit"
                >
                    {t('home.learning_desk.search.action', 'Search')}
                    <ArrowRight className="size-4" />
                </button>
            </form>

            {open && query.trim().length >= 2 && !loading ? (
                <div className="absolute top-[calc(100%+0.6rem)] right-0 left-0 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:right-auto sm:w-[calc(100%-8.75rem)] dark:border-white/12 dark:bg-[#0d1825]">
                    {results.length > 0 ? (
                        <>
                            <ul className="p-2">
                                {visibleResults.map((result) => (
                                    <li key={result.id}>
                                        <button
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,transparent)]"
                                            onClick={() => visit(result)}
                                            type="button"
                                        >
                                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] text-[var(--learner-action-accent)]">
                                                {result.kind === 'topic' ? (
                                                    <BookOpenText className="size-4" />
                                                ) : (
                                                    <Map className="size-4" />
                                                )}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                                                    {result.title}
                                                </span>
                                                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                                    {result.subtitle}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {totalPages > 1 ? (
                                <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs dark:border-white/10">
                                    <button
                                        className="rounded px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white"
                                        disabled={page === 1}
                                        onClick={() =>
                                            setPage((value) => value - 1)
                                        }
                                        type="button"
                                    >
                                        {t('common.previous', 'Previous')}
                                    </button>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        {page} / {totalPages}
                                    </span>
                                    <button
                                        className="rounded px-2 py-1 text-[var(--learner-action-accent)] transition hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                                        disabled={page === totalPages}
                                        onClick={() =>
                                            setPage((value) => value + 1)
                                        }
                                        type="button"
                                    >
                                        {t('common.next', 'Next')}
                                    </button>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <p className="px-4 py-5 text-sm text-slate-500 dark:text-slate-400">
                            {t(
                                'home.learning_desk.search.empty',
                                'No existing learning content matches this thought yet.',
                            )}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
}
