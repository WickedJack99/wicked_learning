import { Map as MapIcon, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type SearchResult =
    | {
          id: string;
          kind: 'map';
          mapId: number;
          mapSlug: string;
          subtitle: string;
          title: string;
      }
    | {
          id: string;
          kind: 'node';
          mapId: number;
          mapSlug: string;
          nodeId: number;
          nodeSlug: string;
          subtitle: string;
          title: string;
      };

export type SearchResponse = {
    results: SearchResult[];
};

export function WorldSearch({
    isLoading,
    isMobilePanelOpen,
    onClear,
    onMobilePanelClose,
    onMobilePanelOpen,
    onSearchTermChange,
    onSelectResult,
    results,
    searchTerm,
}: {
    isLoading: boolean;
    isMobilePanelOpen: boolean;
    onClear: () => void;
    onMobilePanelClose: () => void;
    onMobilePanelOpen: () => void;
    onSearchTermChange: (value: string) => void;
    onSelectResult: (result: SearchResult) => void;
    results: SearchResult[];
    searchTerm: string;
}) {
    const t = usePlatformTranslation();
    const hasSearch = searchTerm.trim().length > 0;
    const searchLabel = t('world.search.label', 'Search maps and tiles');
    const renderSearchResults = () => {
        if (isLoading) {
            return (
                <p
                    className="px-3 py-4 text-sm"
                    style={{
                        color: 'var(--map-floating-muted-text-color)',
                    }}
                >
                    {t('world.search.loading', 'Searching...')}
                </p>
            );
        }

        if (results.length === 0) {
            return (
                <p
                    className="px-3 py-4 text-sm"
                    style={{
                        color: 'var(--map-floating-muted-text-color)',
                    }}
                >
                    {t('world.search.empty', 'No visible maps or tiles found.')}
                </p>
            );
        }

        return (
            <div className="grid gap-1">
                {results.map((result) => (
                    <button
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:hover:bg-teal-200/10 dark:focus-visible:ring-teal-200"
                        key={result.id}
                        onClick={() => onSelectResult(result)}
                        style={{
                            cursor: 'var(--platform-action-cursor)',
                        }}
                        type="button"
                    >
                        <span
                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/12 dark:text-teal-200"
                            style={{
                                color: 'var(--map-floating-accent-color)',
                            }}
                        >
                            {result.kind === 'map' ? (
                                <MapIcon className="size-4" />
                            ) : (
                                <MapPin className="size-4" />
                            )}
                        </span>
                        <span className="min-w-0">
                            <span
                                className="block truncate text-sm font-semibold"
                                style={{
                                    color: 'var(--map-floating-text-color)',
                                }}
                            >
                                {result.title}
                            </span>
                            <span
                                className="mt-0.5 block truncate text-xs"
                                style={{
                                    color: 'var(--map-floating-muted-text-color)',
                                }}
                            >
                                {result.subtitle}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        );
    };
    const renderSearchInput = (autoFocus = false) => (
        <div
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/92 p-2 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/86"
            style={{
                background: 'var(--map-floating-background)',
                borderColor: 'var(--map-floating-border-color)',
                color: 'var(--map-floating-text-color)',
            }}
        >
            <Search
                className="ml-2 size-4 shrink-0"
                style={{ color: 'var(--map-floating-muted-text-color)' }}
            />
            <Input
                aria-label={searchLabel}
                autoFocus={autoFocus}
                className="h-9 border-0 bg-transparent px-1 text-current shadow-none placeholder:text-current/60 focus-visible:ring-0"
                onChange={(event) =>
                    onSearchTermChange(event.currentTarget.value)
                }
                placeholder={searchLabel}
                style={{ cursor: 'var(--platform-text-cursor)' }}
                value={searchTerm}
            />
            {hasSearch ? (
                <Button
                    aria-label={t('world.search.clear', 'Clear search')}
                    onClick={onClear}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <X className="size-4" />
                </Button>
            ) : null}
        </div>
    );

    return (
        <>
            <div className="absolute bottom-5 left-5 z-20 hidden w-[min(24rem,calc(100%-2rem))] md:block">
                {hasSearch ? (
                    <div
                        className="mb-2 max-h-[42svh] overflow-y-auto rounded-xl border border-slate-200 bg-white/92 p-2 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/86"
                        style={{
                            background: 'var(--map-floating-background)',
                            borderColor: 'var(--map-floating-border-color)',
                            color: 'var(--map-floating-text-color)',
                        }}
                    >
                        {renderSearchResults()}
                    </div>
                ) : null}

                {renderSearchInput()}
            </div>

            <button
                aria-label={t('world.search.open', 'Open map search')}
                className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white/92 shadow-2xl backdrop-blur-md transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none md:hidden dark:border-white/10 dark:bg-slate-950/86 dark:focus-visible:ring-teal-200"
                onClick={onMobilePanelOpen}
                style={{
                    background: 'var(--map-floating-background)',
                    borderColor: 'var(--map-floating-border-color)',
                    color: 'var(--map-floating-text-color)',
                    cursor: 'var(--platform-action-cursor)',
                }}
                type="button"
            >
                <Search className="size-5" />
            </button>

            {isMobilePanelOpen ? (
                <div className="fixed inset-0 z-[80] md:hidden">
                    <button
                        aria-label={t('world.search.close', 'Close map search')}
                        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        onClick={onMobilePanelClose}
                        type="button"
                    />
                    <section
                        aria-label={t('world.search.title', 'Map search')}
                        className="absolute inset-x-4 top-4 bottom-4 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
                        style={{
                            background: 'var(--map-floating-background)',
                            borderColor: 'var(--map-floating-border-color)',
                            color: 'var(--map-floating-text-color)',
                        }}
                    >
                        <div
                            className="flex items-center justify-between gap-4 border-b px-4 py-3"
                            style={{
                                borderColor: 'var(--map-floating-border-color)',
                            }}
                        >
                            <div>
                                <p
                                    className="text-xs font-semibold tracking-[0.2em] uppercase"
                                    style={{
                                        color: 'var(--map-floating-accent-color)',
                                    }}
                                >
                                    {t('world.search.eyebrow', 'Search')}
                                </p>
                                <h2 className="text-lg font-semibold">
                                    {t('world.search.title', 'Map search')}
                                </h2>
                            </div>
                            <Button
                                aria-label={t(
                                    'world.search.close',
                                    'Close map search',
                                )}
                                onClick={onMobilePanelClose}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <X className="size-5" />
                            </Button>
                        </div>
                        <div className="p-4">{renderSearchInput(true)}</div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                            {hasSearch ? (
                                <div
                                    className="rounded-xl border p-2"
                                    style={{
                                        borderColor:
                                            'var(--map-floating-border-color)',
                                    }}
                                >
                                    {renderSearchResults()}
                                </div>
                            ) : (
                                <p
                                    className="rounded-xl border px-3 py-4 text-sm"
                                    style={{
                                        borderColor:
                                            'var(--map-floating-border-color)',
                                        color: 'var(--map-floating-muted-text-color)',
                                    }}
                                >
                                    {t(
                                        'world.search.mobile_prompt',
                                        'Enter a word to search visible maps and tiles.',
                                    )}
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            ) : null}
        </>
    );
}
