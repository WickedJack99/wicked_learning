import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, BookOpenText } from 'lucide-react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { TopicDetail as TopicDetailData } from './types';

export function TopicDetail({ topic }: { topic: TopicDetailData }) {
    const t = usePlatformTranslation();

    return (
        <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <LearningDeskHeader />
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <Link
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300"
                    href={topic.parent?.href ?? '/topics'}
                >
                    <ArrowLeft className="size-4" />
                    {topic.parent?.title ?? t('topics.title', 'Topics')}
                </Link>

                <header className="mt-8 max-w-3xl border-b border-slate-200 pb-8 dark:border-white/10">
                    <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                        {topic.area.title}
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">
                        {topic.title}
                    </h1>
                    {topic.description ? (
                        <p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">
                            {topic.description}
                        </p>
                    ) : null}
                </header>

                <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <article className="min-w-0">
                        {topic.content ? (
                            <MarkdownRenderer
                                className="max-w-3xl"
                                markdown={topic.content}
                            />
                        ) : (
                            <div className="border-y border-slate-200 py-7 dark:border-white/10">
                                <BookOpenText className="size-5 text-cyan-600 dark:text-cyan-400" />
                                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'topics.detail.no_content',
                                        'This topic currently serves as an overview. Continue with one of its subtopics.',
                                    )}
                                </p>
                            </div>
                        )}
                    </article>

                    <aside>
                        <h2 className="border-b border-slate-300 pb-3 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:border-white/20 dark:text-slate-400">
                            {t('topics.detail.subtopics', 'Subtopics')}
                        </h2>
                        {topic.subtopics.length > 0 ? (
                            <div className="divide-y divide-slate-200 dark:divide-white/8">
                                {topic.subtopics.map((subtopic) => (
                                    <Link
                                        className="group flex items-start justify-between gap-4 py-4 text-sm"
                                        href={subtopic.href}
                                        key={subtopic.id}
                                    >
                                        <span>
                                            <span className="font-medium group-hover:text-violet-700 dark:group-hover:text-violet-300">
                                                {subtopic.title}
                                            </span>
                                            {subtopic.description ? (
                                                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                    {subtopic.description}
                                                </span>
                                            ) : null}
                                        </span>
                                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="py-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                {t(
                                    'topics.detail.no_subtopics',
                                    'No subtopics have been published here yet.',
                                )}
                            </p>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}
