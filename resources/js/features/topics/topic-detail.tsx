import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenText,
    Map as MapIcon,
    Route,
    Sparkles,
} from 'lucide-react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { learningIntentLabel } from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    TopicCompetence,
    TopicDetail as TopicDetailData,
    TopicPath,
} from './types';

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
                    <h1 className="mt-3 text-3xl font-medium tracking-tight">
                        {topic.title}
                    </h1>
                    {topic.description ? (
                        <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {topic.description}
                        </p>
                    ) : null}
                    <Link
                        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-950 dark:text-cyan-300 dark:hover:text-cyan-100"
                        href="/competence"
                    >
                        <Sparkles className="size-4" />
                        {t(
                            'topics.detail.learning_trail.open',
                            'See your learning trail',
                        )}
                        <ArrowRight className="size-4" />
                    </Link>
                </header>

                <TopicCompetenceCard
                    competence={topic.competence}
                    topicSlug={topic.slug}
                />

                {topic.paths.length > 0 ? (
                    <section
                        aria-labelledby="topic-paths-heading"
                        className="mt-10 border-y border-slate-200 py-7 dark:border-white/10"
                    >
                        <div className="flex items-start gap-3">
                            <Route className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-400" />
                            <div>
                                <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                                    {t(
                                        'topics.detail.paths.eyebrow',
                                        'Optional ways in',
                                    )}
                                </p>
                                <h2
                                    className="mt-2 text-sm font-semibold"
                                    id="topic-paths-heading"
                                >
                                    {t(
                                        'topics.detail.paths.title',
                                        'Start with a route',
                                    )}
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'topics.detail.paths.description',
                                        'A route is a suggested beginning. You can follow it, pause, or explore the map in your own direction.',
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {topic.paths.map((path) => (
                                <TopicPathCard key={path.id} path={path} />
                            ))}
                        </div>
                    </section>
                ) : null}

                {topic.maps.length > 0 ? (
                    <section
                        aria-labelledby="topic-maps-heading"
                        className="mt-10 border-y border-slate-200 py-7 dark:border-white/10"
                    >
                        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase dark:text-cyan-400">
                            {t(
                                'topics.detail.maps.eyebrow',
                                'Explore this topic',
                            )}
                        </p>
                        <h2
                            className="mt-2 text-sm font-semibold"
                            id="topic-maps-heading"
                        >
                            {t('topics.detail.maps.title', 'Map surfaces')}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {t(
                                'topics.detail.maps.description',
                                'Open a map to explore this topic through places, activities and connected paths.',
                            )}
                        </p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {topic.maps.map((map) => (
                                <Link
                                    className="group flex items-start gap-3 border border-slate-200 bg-white/55 p-4 transition hover:border-cyan-400/60 hover:bg-cyan-50/50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-cyan-400/40 dark:hover:bg-cyan-400/[0.06]"
                                    href={map.href}
                                    key={map.id}
                                >
                                    <MapIcon className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-cyan-400" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium group-hover:text-cyan-800 dark:group-hover:text-cyan-200">
                                            {map.title}
                                        </span>
                                        {map.description ? (
                                            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-slate-500 dark:text-slate-400">
                                                {map.description}
                                            </span>
                                        ) : null}
                                        <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                                            {map.nodeCount === 1
                                                ? t(
                                                      'topics.detail.maps.place_count.one',
                                                      '1 place to explore',
                                                  )
                                                : t(
                                                      'topics.detail.maps.place_count.many',
                                                      ':count places to explore',
                                                      { count: map.nodeCount },
                                                  )}
                                        </span>
                                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-cyan-700 uppercase dark:text-cyan-400">
                                            {t(
                                                'topics.detail.maps.open',
                                                'Open map',
                                            )}
                                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                ) : null}

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
                                            {subtopic.mapCount ? (
                                                <span className="mt-1 block text-xs text-cyan-700 dark:text-cyan-300">
                                                    {subtopic.mapCount === 1
                                                        ? t(
                                                              'topics.detail.subtopics.map_count.one',
                                                              '1 map available',
                                                          )
                                                        : t(
                                                              'topics.detail.subtopics.map_count.many',
                                                              ':count maps available',
                                                              {
                                                                  count: subtopic.mapCount,
                                                              },
                                                          )}
                                                </span>
                                            ) : null}
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

function TopicCompetenceCard({
    competence,
    topicSlug,
}: {
    competence: TopicCompetence | null;
    topicSlug: string;
}) {
    const t = usePlatformTranslation();
    const starSize = competence
        ? 30 + Math.round(competence.visual.sizeRatio * 18)
        : 30;
    const glowSize = competence
        ? 14 + Math.round(competence.visual.auraRatio * 18)
        : 12;
    const glowOpacity = competence
        ? 0.35 + competence.visual.brightnessRatio * 0.55
        : 0.28;

    return (
        <section
            aria-labelledby="topic-learning-trail-heading"
            className="mt-8 border-y border-slate-200 py-7 dark:border-white/10"
        >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 rounded-full bg-cyan-300/10"
                        style={{
                            boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px rgba(103, 232, 249, ${glowOpacity})`,
                            height: starSize,
                            width: starSize,
                        }}
                    />
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-700 uppercase dark:text-cyan-400">
                            {t('topics.detail.competence.eyebrow', 'Learning trail')}
                        </p>
                        <h2
                            className="mt-2 text-sm font-semibold"
                            id="topic-learning-trail-heading"
                        >
                            {t(
                                'topics.detail.competence.title',
                                'Your trail in this topic',
                            )}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {competence
                                ? competence.visual.description
                                : t(
                                      'topics.detail.competence.empty',
                                      'A first light will appear here as you work with this topic.',
                                  )}
                        </p>
                    </div>
                </div>
                <Link
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-950 dark:text-cyan-300 dark:hover:text-cyan-100"
                    href={
                        competence
                            ? `/competence?topic=${encodeURIComponent(topicSlug)}`
                            : '/competence'
                    }
                >
                    {t(
                        competence
                            ? 'topics.detail.competence.open'
                            : 'topics.detail.competence.open_all',
                        competence ? 'Open focused map' : 'Open competence map',
                    )}
                    <ArrowRight className="size-4" />
                </Link>
            </div>

            {competence ? (
                <div className="mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2 dark:border-white/10">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                            {t(
                                'topics.detail.competence.ways',
                                'Ways you have been learning',
                            )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {competence.evidenceTypes.map((type) => (
                                <span
                                    className="border border-cyan-700/20 px-2.5 py-1 text-xs text-cyan-800 dark:border-cyan-300/20 dark:text-cyan-200"
                                    key={type}
                                >
                                    {evidenceTypeLabel(type, t)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                            {t(
                                'topics.detail.competence.recent',
                                'Recently',
                            )}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {competence.recentDescription}
                        </p>
                        {competence.learningPeriods.length > 0 ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {competence.learningPeriods.join(' · ')}
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {competence?.revisit ? (
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-700 transition hover:text-violet-950 dark:text-violet-300 dark:hover:text-violet-100"
                    href={competence.revisit.activityHref}
                >
                    {t('topics.detail.competence.revisit', 'Return to')}{' '}
                    {competence.revisit.activityTitle}
                    <ArrowRight className="size-4" />
                </Link>
            ) : null}
        </section>
    );
}

function evidenceTypeLabel(
    type: string,
    translate: (key: string, fallback?: string) => string,
): string {
    const label = learningIntentLabel(type, translate);

    return label ?? type;
}

function TopicPathCard({ path }: { path: TopicPath }) {
    const t = usePlatformTranslation();
    const isInProgress = path.progress?.status === 'in_progress';

    return (
        <article className="group flex items-start gap-3 border border-slate-200 bg-white/55 p-4 transition hover:border-violet-400/60 hover:bg-violet-50/50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-violet-400/40 dark:hover:bg-violet-400/[0.06]">
            <span className="grid size-10 shrink-0 place-items-center border border-violet-200 text-violet-700 dark:border-violet-300/20 dark:text-violet-300">
                {path.imageUrl ? (
                    <img
                        alt=""
                        className="size-8 object-contain"
                        src={path.imageUrl}
                    />
                ) : (
                    <Route className="size-4" />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block font-medium">{path.label}</span>
                {path.learningIntent ? (
                    <span className="mt-1 block text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        {learningIntentLabel(path.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                    <Link
                        className="underline decoration-slate-400/60 underline-offset-2 transition hover:text-cyan-700 dark:decoration-slate-500 dark:hover:text-cyan-300"
                        href={path.nodeHref}
                    >
                        {path.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="underline decoration-slate-400/60 underline-offset-2 transition hover:text-cyan-700 dark:decoration-slate-500 dark:hover:text-cyan-300"
                        href={path.mapHref}
                    >
                        {path.mapTitle}
                    </Link>
                </span>
                <Link
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-300"
                    href={path.href}
                >
                    {isInProgress
                        ? t('topics.detail.paths.continue', 'Continue')
                        : t('topics.detail.paths.enter', 'Enter route')}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </article>
    );
}
