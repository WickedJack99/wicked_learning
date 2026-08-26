import { Link } from '@inertiajs/react';
import { ArrowRight, FolderTree, Settings2 } from 'lucide-react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { TopicArea } from './types';

export function TopicDirectory({
    areas,
    canManageTopics,
}: {
    areas: TopicArea[];
    canManageTopics: boolean;
}) {
    const t = usePlatformTranslation();

    return (
        <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <LearningDeskHeader />
            <div className="px-5 py-10 sm:px-8 lg:px-14 lg:py-14">
                <header className="mx-auto flex max-w-7xl items-end justify-between gap-6 border-b border-slate-200 pb-7 dark:border-white/10">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                            {t('topics.eyebrow', 'Knowledge directory')}
                        </p>
                        <h1 className="mt-3 text-3xl font-medium tracking-tight">
                            {t('topics.title', 'Topics')}
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {t(
                                'topics.description',
                                'Browse broad areas and open a topic to continue into its subtopics and learning material.',
                            )}
                        </p>
                    </div>
                    {canManageTopics ? (
                        <Link
                            className="hidden shrink-0 items-center gap-2 rounded-lg border border-violet-400/40 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:bg-violet-500/8 sm:inline-flex dark:text-violet-300"
                            href="/admin/topics"
                        >
                            <Settings2 className="size-4" />
                            {t('topics.manage', 'Manage topics')}
                        </Link>
                    ) : null}
                </header>

                {areas.length > 0 ? (
                    <div className="mx-auto mt-9 max-w-7xl columns-1 gap-x-20 lg:columns-2">
                        {areas.map((area) => (
                            <section
                                className="mb-10 break-inside-avoid"
                                key={area.id}
                            >
                                <div className="border-b border-slate-300 pb-3 dark:border-white/28">
                                    <h2 className="text-sm font-semibold">
                                        {area.title}
                                    </h2>
                                    {area.description ? (
                                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                            {area.description}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="divide-y divide-slate-200/70 dark:divide-white/6">
                                    {area.topics.map((topic) => (
                                        <Link
                                            className="group flex items-center justify-between gap-4 py-4 pl-0.5 text-sm text-slate-600 transition hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300"
                                            href={topic.href}
                                            key={topic.id}
                                        >
                                            <span>
                                                <span>{topic.title}</span>
                                                {topic.mapCount ? (
                                                    <span className="mt-1 block text-xs text-cyan-700 dark:text-cyan-300">
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
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="mx-auto grid min-h-[50svh] max-w-lg place-items-center text-center">
                        <div>
                            <FolderTree className="mx-auto size-8 text-cyan-600 dark:text-cyan-400" />
                            <h2 className="mt-5 text-sm font-semibold">
                                {t(
                                    'topics.empty.title',
                                    'No topics have been published yet',
                                )}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {t(
                                    'topics.empty.description',
                                    'Topic areas will appear here as soon as an administrator adds their first published topic.',
                                )}
                            </p>
                            {canManageTopics ? (
                                <Link
                                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"
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
        </main>
    );
}
