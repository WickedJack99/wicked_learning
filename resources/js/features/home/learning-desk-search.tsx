import { router } from '@inertiajs/react';
import { ArrowRight, LoaderCircle, Map, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getJson } from '@/features/world/api';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { LearningSearchResult } from './types';

type SearchResponse = {
    results: LearningSearchResult[];
};

export function LearningDeskSearch() {
    const t = usePlatformTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LearningSearchResult[]>([]);
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
        const parameters = new URLSearchParams({ map: result.mapSlug });

        if (result.nodeSlug) {
            parameters.set('focused', result.nodeSlug);
        }

        router.visit(`/world?${parameters.toString()}`);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (results[0]) {
            visit(results[0]);
        } else if (query.trim()) {
            setOpen(true);
        }
    };

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
                        className="h-14 w-full rounded-xl border border-slate-300 bg-white pr-12 pl-13 text-sm text-slate-950 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-3 focus:ring-cyan-500/15 dark:border-white/12 dark:bg-[#0d1825] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400"
                        onChange={(event) => {
                            const value = event.target.value;

                            setQuery(value);

                            if (value.trim().length < 2) {
                                requestId.current++;
                                setResults([]);
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
                        <LoaderCircle className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-cyan-500" />
                    ) : null}
                </label>
                <button
                    className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-500/70 px-6 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-500/10 focus-visible:ring-3 focus-visible:ring-cyan-500/20 focus-visible:outline-none dark:text-cyan-300"
                    type="submit"
                >
                    {t('home.learning_desk.search.action', 'Search')}
                    <ArrowRight className="size-4" />
                </button>
            </form>

            {open && query.trim().length >= 2 && !loading ? (
                <div className="absolute top-[calc(100%+0.6rem)] right-0 left-0 z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:right-auto sm:w-[calc(100%-8.75rem)] dark:border-white/12 dark:bg-[#0d1825]">
                    {results.length > 0 ? (
                        <ul className="max-h-80 overflow-y-auto p-2">
                            {results.map((result) => (
                                <li key={result.id}>
                                    <button
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-white/6"
                                        onClick={() => visit(result)}
                                        type="button"
                                    >
                                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                                            <Map className="size-4" />
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
