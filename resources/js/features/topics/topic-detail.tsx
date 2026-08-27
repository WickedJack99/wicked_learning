import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenText,
    Map as MapIcon,
    Route,
} from 'lucide-react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import {
    competenceContextHref,
    competenceTopicHref,
} from '@/features/competence/competence-links';
import { MarkdownRenderer } from '@/features/platform-info/markdown-renderer';
import { learningIntentLabel } from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    TopicCompetence,
    TopicDetail as TopicDetailData,
    TopicLearningArea,
    TopicLearningPulse,
    TopicPath,
} from './types';

export function TopicDetail({ topic }: { topic: TopicDetailData }) {
    const t = usePlatformTranslation();

    return (
        <LearnerDocumentSurface>
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <Link
                    className="inline-flex items-center gap-2 text-sm text-[var(--learner-muted-text)] transition hover:text-[var(--learner-accent)]"
                    href={topic.parent?.href ?? '/topics'}
                >
                    <ArrowLeft className="size-4" />
                    {topic.parent?.title ?? t('topics.title', 'Topics')}
                </Link>

                <header className="mt-8 max-w-3xl border-b border-[var(--learner-border-color)] pb-8">
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                        {topic.area.title}
                    </p>
                    <h1 className="mt-3 text-3xl font-medium tracking-tight">
                        {topic.title}
                    </h1>
                    {topic.description ? (
                        <p className="mt-5 text-sm leading-6 text-[var(--learner-body-text)]">
                            {topic.description}
                        </p>
                    ) : null}
                </header>

                <TopicCompetenceCard
                    competence={topic.competence}
                    learningAreaSlugs={topic.learningAreas.map(
                        (area) => area.slug,
                    )}
                    subtopicCompetence={topic.subtopicCompetence}
                    topicSlug={topic.slug}
                />

                <TopicLearningAreas
                    areas={topic.learningAreas}
                    topicSlug={topic.slug}
                />

                <TopicLearningPulse entries={topic.learningPulse} />

                {topic.paths.length > 0 ? (
                    <section
                        aria-labelledby="topic-paths-heading"
                        className="mt-10 border-y border-[var(--learner-border-color)] py-7"
                    >
                        <div className="flex items-start gap-3">
                            <Route className="mt-0.5 size-5 shrink-0 text-[var(--learner-accent)]" />
                            <div>
                                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
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
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
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
                        className="mt-10 border-y border-[var(--learner-border-color)] py-7"
                    >
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
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
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'topics.detail.maps.description',
                                'Open a map to explore this topic through places, activities and connected paths.',
                            )}
                        </p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {topic.maps.map((map) => (
                                <Link
                                    className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
                                    href={map.href}
                                    key={map.id}
                                >
                                    <MapIcon className="mt-0.5 size-5 shrink-0 text-[var(--learner-action-accent)]" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium group-hover:text-[var(--learner-heading-text)]">
                                            {map.title}
                                        </span>
                                        {map.description ? (
                                            <span className="mt-1 line-clamp-2 block text-sm leading-5 text-[var(--learner-muted-text)]">
                                                {map.description}
                                            </span>
                                        ) : null}
                                        <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
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
                                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--learner-action-accent)] uppercase">
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
                            <div className="border-y border-[var(--learner-border-color)] py-7">
                                <BookOpenText className="size-5 text-[var(--learner-action-accent)]" />
                                <p className="mt-3 text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {t(
                                        'topics.detail.no_content',
                                        'This topic currently serves as an overview. Continue with one of its subtopics.',
                                    )}
                                </p>
                            </div>
                        )}
                    </article>

                    <aside>
                        <h2 className="border-b border-[var(--learner-border-color)] pb-3 text-xs font-semibold tracking-[0.18em] text-[var(--learner-muted-text)] uppercase">
                            {t('topics.detail.subtopics', 'Subtopics')}
                        </h2>
                        {topic.subtopics.length > 0 ? (
                            <div className="divide-y divide-[var(--learner-border-color)]">
                                {topic.subtopics.map((subtopic) => (
                                    <Link
                                        className="group flex items-start justify-between gap-4 py-4 text-sm"
                                        href={subtopic.href}
                                        key={subtopic.id}
                                    >
                                        <span>
                                            <span className="font-medium group-hover:text-[var(--learner-accent)]">
                                                {subtopic.title}
                                            </span>
                                            {subtopic.mapCount ? (
                                                <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
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
                                                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                                    {subtopic.description}
                                                </span>
                                            ) : null}
                                        </span>
                                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)]" />
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <p className="py-4 text-sm leading-6 text-[var(--learner-muted-text)]">
                                {t(
                                    'topics.detail.no_subtopics',
                                    'No subtopics have been published here yet.',
                                )}
                            </p>
                        )}
                    </aside>
                </div>
            </div>
        </LearnerDocumentSurface>
    );
}

function TopicLearningAreas({
    areas,
    topicSlug,
}: {
    areas: TopicLearningArea[];
    topicSlug: string;
}) {
    const t = usePlatformTranslation();

    if (areas.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="topic-learning-areas-heading"
            className="mt-8 border-y border-[var(--learner-border-color)] py-7"
        >
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
                {t('topics.detail.learning_areas.eyebrow', 'Learning areas')}
            </p>
            <h2
                className="mt-2 text-sm font-semibold"
                id="topic-learning-areas-heading"
            >
                {t(
                    'topics.detail.learning_areas.title',
                    'What you can practice here',
                )}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {areas.map((area) => (
                    <Link
                        className="group flex items-start justify-between gap-4 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
                        href={competenceTopicHref(area.slug, topicSlug)}
                        key={area.slug}
                    >
                        <span className="min-w-0">
                            <span className="block font-medium group-hover:text-[var(--learner-heading-text)]">
                                {area.name}
                            </span>
                            <span className="mt-2 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                {area.learningIntents
                                    .map((intent) =>
                                        learningIntentLabel(intent, t),
                                    )
                                    .join(' · ')}
                            </span>
                        </span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition-transform group-hover:translate-x-1" />
                    </Link>
                ))}
            </div>
        </section>
    );
}

function TopicLearningPulse({ entries }: { entries: TopicLearningPulse[] }) {
    const t = usePlatformTranslation();

    if (entries.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="topic-learning-pulse-heading"
            className="mt-8 border-y border-[var(--learner-border-color)] py-7"
        >
            <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                {t(
                    'topics.detail.learning_pulse.eyebrow',
                    'Recent reflections',
                )}
            </p>
            <h2
                className="mt-2 text-sm font-semibold"
                id="topic-learning-pulse-heading"
            >
                {t(
                    'topics.detail.learning_pulse.title',
                    'Moments you chose to keep',
                )}
            </h2>
            <div className="mt-4 divide-y divide-[var(--learner-border-color)]">
                {entries.map((entry) => (
                    <Link
                        className="group flex items-start justify-between gap-4 py-3 transition hover:text-[var(--learner-accent)]"
                        href={entry.activityHref}
                        key={`${entry.activityId}:${entry.recordedAt}`}
                    >
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                                {entry.activityTitle}
                            </span>
                            <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                {learningPulseLabel(entry.feeling)} ·{' '}
                                {entry.nodeTitle}
                            </span>
                            {entry.note ? (
                                <span className="mt-1 block text-xs leading-5 text-[var(--learner-body-text)]">
                                    {entry.note}
                                </span>
                            ) : null}
                        </span>
                        <time
                            className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                            dateTime={entry.recordedAt}
                        >
                            {formatTopicDate(entry.recordedAt)}
                        </time>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function learningPulseLabel(feeling: string | null): string {
    return (
        {
            clearer: 'Something clicked',
            forming: 'Still taking shape',
            stretched: 'It stretched me',
            stuck: 'I got stuck',
        }[feeling ?? ''] ?? 'A reflection'
    );
}

function TopicCompetenceCard({
    competence,
    learningAreaSlugs,
    subtopicCompetence,
    topicSlug,
}: {
    competence: TopicCompetence | null;
    learningAreaSlugs: string[];
    subtopicCompetence: TopicCompetence[];
    topicSlug: string;
}) {
    const t = usePlatformTranslation();
    const distinctSubtopicCompetence = subtopicCompetence.filter(
        (area) => !learningAreaSlugs.includes(area.slug),
    );
    const relatedSubtopicTopics = distinctSubtopicCompetence.filter(
        (area) => area.topic,
    );
    const firstTrail = competence ?? subtopicCompetence[0] ?? null;
    const focusedSlug = competence ? topicSlug : firstTrail?.slug;
    const competenceHref = focusedSlug
        ? competenceTopicHref(focusedSlug, topicSlug)
        : competenceContextHref(topicSlug);
    const starSize = firstTrail
        ? 30 + Math.round(firstTrail.visual.sizeRatio * 18)
        : 30;
    const glowSize = firstTrail
        ? 14 + Math.round(firstTrail.visual.auraRatio * 18)
        : 12;
    const glowOpacity = firstTrail
        ? 0.35 + firstTrail.visual.brightnessRatio * 0.55
        : 0.28;

    return (
        <section
            aria-labelledby="topic-learning-trail-heading"
            className="mt-8 border-y border-[var(--learner-border-color)] py-7"
        >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                    <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)]"
                        style={{
                            boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px rgba(103, 232, 249, ${glowOpacity})`,
                            height: starSize,
                            width: starSize,
                        }}
                    />
                    <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-action-accent)] uppercase">
                            {t(
                                'topics.detail.competence.eyebrow',
                                'Learning trail',
                            )}
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
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {competence
                                ? competence.visual.description
                                : subtopicCompetence.length > 0
                                  ? t(
                                        'topics.detail.competence.subtopic_summary',
                                        'Learning is unfolding across connected areas.',
                                    )
                                  : t(
                                        'topics.detail.competence.empty',
                                        'A first light will appear here as you work with this topic.',
                                    )}
                        </p>
                    </div>
                </div>
                <Link
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                    href={competenceHref}
                >
                    {t(
                        focusedSlug
                            ? 'topics.detail.competence.open'
                            : 'topics.detail.competence.open_all',
                        focusedSlug
                            ? 'Open focused map'
                            : 'Open competence map',
                    )}
                    <ArrowRight className="size-4" />
                </Link>
            </div>

            {distinctSubtopicCompetence.length > 0 ? (
                <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.competence.connected_areas',
                            'Connected learning areas',
                        )}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {distinctSubtopicCompetence.map((area) => (
                            <Link
                                className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_45%,transparent)] p-3 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
                                href={competenceTopicHref(area.slug, topicSlug)}
                                key={area.slug}
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-1 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--learner-action-accent)_20%,transparent)]"
                                    style={{
                                        boxShadow: `0 0 ${8 + Math.round(area.visual.auraRatio * 10)}px ${4 + Math.round(area.visual.auraRatio * 5)}px rgba(103, 232, 249, ${0.2 + area.visual.brightnessRatio * 0.45})`,
                                        height:
                                            16 +
                                            Math.round(
                                                area.visual.sizeRatio * 8,
                                            ),
                                        width:
                                            16 +
                                            Math.round(
                                                area.visual.sizeRatio * 8,
                                            ),
                                    }}
                                />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium group-hover:text-[var(--learner-heading-text)]">
                                        {area.name}
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 text-[var(--learner-muted-text)]">
                                        {area.visual.description}
                                    </span>
                                    {area.evidenceTypes.length > 0 ? (
                                        <span className="mt-2 block text-xs text-[var(--learner-action-accent)]">
                                            {area.evidenceTypes
                                                .map((type) =>
                                                    evidenceTypeLabel(type, t),
                                                )
                                                .join(' · ')}
                                        </span>
                                    ) : null}
                                </span>
                                <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition-transform group-hover:translate-x-1" />
                            </Link>
                        ))}
                    </div>
                </div>
            ) : null}

            {competence ? (
                <>
                    <div className="mt-6 grid gap-5 border-t border-[var(--learner-border-color)] pt-5 sm:grid-cols-2">
                        <div>
                            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                                {t(
                                    'topics.detail.competence.ways',
                                    'Ways you have been learning',
                                )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {competence.evidenceTypes.map((type) => (
                                    <span
                                        className="border border-[color-mix(in_srgb,var(--learner-action-accent)_20%,transparent)] px-2.5 py-1 text-xs text-[var(--learner-action-accent)]"
                                        key={type}
                                    >
                                        {evidenceTypeLabel(type, t)}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                                {t(
                                    'topics.detail.competence.recent',
                                    'Recently',
                                )}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-[var(--learner-body-text)]">
                                {competence.recentDescription}
                            </p>
                            {competence.learningPeriods.length > 0 ? (
                                <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                                    {competence.learningPeriods.join(' · ')}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    {competence.evidenceLedger.length > 0 ? (
                        <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                                {t(
                                    'topics.detail.competence.moments',
                                    'Recent moments',
                                )}
                            </p>
                            <div className="mt-3 divide-y divide-[var(--learner-border-color)]">
                                {competence.evidenceLedger.map((entry) => {
                                    const content = (
                                        <span className="flex min-w-0 items-start justify-between gap-4">
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium">
                                                    {entry.activityTitle ??
                                                        'Learning moment'}
                                                </span>
                                                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                    {evidenceTypeLabel(
                                                        entry.evidenceType,
                                                        t,
                                                    )}
                                                    {entry.nodeTitle
                                                        ? ` · ${entry.nodeTitle}`
                                                        : ''}
                                                </span>
                                            </span>
                                            {entry.recordedAt ? (
                                                <time
                                                    className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                                                    dateTime={entry.recordedAt}
                                                >
                                                    {formatTopicDate(
                                                        entry.recordedAt,
                                                    )}
                                                </time>
                                            ) : null}
                                        </span>
                                    );

                                    return entry.activityHref ? (
                                        <Link
                                            className="block py-3 transition hover:text-[var(--learner-action-accent)]"
                                            href={entry.activityHref}
                                            key={entry.id}
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div className="py-3" key={entry.id}>
                                            {content}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </>
            ) : null}

            {competence?.revisit ? (
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)] transition hover:text-[var(--learner-heading-text)]"
                    href={competence.revisit.activityHref}
                >
                    {t('topics.detail.competence.revisit', 'Return to')}{' '}
                    {competence.revisit.activityTitle}
                    <ArrowRight className="size-4" />
                </Link>
            ) : null}

            {relatedSubtopicTopics.length > 0 ? (
                <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.competence.related_topics',
                            'Related topics',
                        )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {relatedSubtopicTopics.map((area) => (
                            <Link
                                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                                href={area.topic!.href}
                                key={area.topic!.href}
                            >
                                {area.topic!.title}
                                <ArrowRight className="size-3.5" />
                            </Link>
                        ))}
                    </div>
                </div>
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

function formatTopicDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}

function TopicPathCard({ path }: { path: TopicPath }) {
    const t = usePlatformTranslation();
    const isInProgress = path.progress?.status === 'in_progress';

    return (
        <article className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-accent)_8%,var(--learner-panel-background))]">
            <span className="grid size-10 shrink-0 place-items-center border border-[color-mix(in_srgb,var(--learner-accent)_25%,transparent)] text-[var(--learner-accent)]">
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
                    <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                        {learningIntentLabel(path.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-xs text-[var(--learner-muted-text)]">
                    <Link
                        className="underline decoration-[color-mix(in_srgb,var(--learner-muted-text)_60%,transparent)] underline-offset-2 transition hover:text-[var(--learner-action-accent)]"
                        href={path.nodeHref}
                    >
                        {path.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="underline decoration-[color-mix(in_srgb,var(--learner-muted-text)_60%,transparent)] underline-offset-2 transition hover:text-[var(--learner-action-accent)]"
                        href={path.mapHref}
                    >
                        {path.mapTitle}
                    </Link>
                </span>
                <Link
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-[var(--learner-accent)] uppercase"
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
