import { Link, router } from '@inertiajs/react';
import { ArrowRight, FolderTree, Settings2 } from 'lucide-react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { TopicArea, TopicAreaOption } from './types';

export function TopicDirectory({
    areaOptions,
    canManageTopics,
    pagination,
    selectedArea,
}: {
    areaOptions: TopicAreaOption[];
    canManageTopics: boolean;
    pagination: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
    selectedArea: TopicArea | null;
}) {
    const t = usePlatformTranslation();

    function visitTopics(area: string, page = 1) {
        const params = new URLSearchParams({ area });

        if (page > 1) {
            params.set('page', String(page));
        }

        router.visit(`/topics?${params.toString()}`, {
            preserveScroll: true,
            replace: true,
        });
    }

    return (
        <LearnerDocumentSurface>
            <div className="px-5 py-10 sm:px-8 lg:px-14 lg:py-14">
                <header className="mx-auto flex max-w-7xl items-end justify-between gap-6 border-b border-[var(--learner-border-color)] pb-7">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                            {t('topics.eyebrow', 'Knowledge directory')}
                        </p>
                        <h1 className="mt-3 text-3xl font-medium tracking-tight">
                            {t('topics.title', 'Topics')}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'topics.description',
                                'Browse broad areas and open a topic to continue into its subtopics and learning material.',
                            )}
                        </p>
                    </div>
                    {canManageTopics ? (
                        <Link
                            className="hidden shrink-0 items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--learner-accent)_40%,transparent)] px-4 py-2.5 text-sm font-medium text-[var(--learner-accent)] transition hover:bg-[color-mix(in_srgb,var(--learner-accent)_8%,transparent)] sm:inline-flex"
                            href="/admin/topics"
                        >
                            <Settings2 className="size-4" />
                            {t('topics.manage', 'Manage topics')}
                        </Link>
                    ) : null}
                </header>

                {selectedArea ? (
                    <section
                        className="mx-auto mt-9 max-w-3xl"
                        data-wl-id="topics-directory"
                    >
                        <div className="max-w-xl">
                            <label
                                className="text-sm font-medium text-[var(--learner-body-text)]"
                                htmlFor="topics-area"
                            >
                                {t('topics.area.label', 'Topic area')}
                            </label>
                            <select
                                className="mt-2 h-10 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-3 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                data-wl-id="topics-area-selector"
                                id="topics-area"
                                onChange={(event) =>
                                    visitTopics(event.target.value)
                                }
                                value={selectedArea.slug}
                            >
                                {areaOptions.map((area) => (
                                    <option key={area.id} value={area.slug}>
                                        {area.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-10 border-b border-[var(--learner-border-color)] pb-3">
                            <h2 className="text-sm font-semibold">
                                {selectedArea.title}
                            </h2>
                            {selectedArea.description ? (
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {selectedArea.description}
                                </p>
                            ) : null}
                        </div>
                        <LearnerPaginatedItems
                            className="divide-y divide-[color-mix(in_srgb,var(--learner-border-color)_70%,transparent)]"
                            items={selectedArea.topics}
                            onPageChange={(page) =>
                                visitTopics(selectedArea.slug, page)
                            }
                            pageSize={pagination.perPage}
                            pagination={pagination}
                            paginationLabel={`${selectedArea.title} topics`}
                            renderItem={(topic) => (
                                <Link
                                    className="group flex items-center justify-between gap-4 py-4 pl-0.5 text-sm text-[var(--learner-body-text)] transition hover:text-[var(--learner-accent)]"
                                    href={topic.href}
                                    key={topic.id}
                                >
                                    <span>
                                        <span>{topic.title}</span>
                                        {topic.mapCount ? (
                                            <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                                                {topic.mapCount === 1
                                                    ? t(
                                                          'topics.directory.map_count.one',
                                                          '1 map available',
                                                      )
                                                    : t(
                                                          'topics.directory.map_count.many',
                                                          ':count maps available',
                                                          {
                                                              count: topic.mapCount,
                                                          },
                                                      )}
                                            </span>
                                        ) : null}
                                    </span>
                                    <ArrowRight className="size-4 shrink-0 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                                </Link>
                            )}
                        />
                    </section>
                ) : (
                    <div className="mx-auto grid min-h-[50svh] max-w-lg place-items-center text-center">
                        <div>
                            <FolderTree className="mx-auto size-8 text-[var(--learner-action-accent)]" />
                            <h2 className="mt-5 text-sm font-semibold">
                                {t(
                                    'topics.empty.title',
                                    'No topics have been published yet',
                                )}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                                {t(
                                    'topics.empty.description',
                                    'Topic areas will appear here as soon as an administrator adds their first published topic.',
                                )}
                            </p>
                            {canManageTopics ? (
                                <Link
                                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)]"
                                    href="/admin/topics"
                                >
                                    {t(
                                        'topics.empty.action',
                                        'Create the first topic area',
                                    )}
                                    <ArrowRight className="size-4" />
                                </Link>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </LearnerDocumentSurface>
    );
}
