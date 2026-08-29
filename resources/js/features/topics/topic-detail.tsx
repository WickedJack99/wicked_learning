import { Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BookOpenText,
    Map as MapIcon,
    Route,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
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
    TopicReflectionNarrative,
} from './types';

export function TopicDetail({ topic }: { topic: TopicDetailData }) {
    const t = usePlatformTranslation();
    const sections: { id: TopicSection; label: string }[] = [
        { id: 'trail', label: t('topics.detail.navigation.trail', 'Trail') },
        { id: 'routes', label: t('topics.detail.navigation.routes', 'Routes') },
        { id: 'maps', label: t('topics.detail.navigation.maps', 'Maps') },
        {
            id: 'overview',
            label: t('topics.detail.navigation.overview', 'Overview'),
        },
    ];
    const [activeSection, setActiveSection] = useState<TopicSection>(() =>
        topicSectionFromUrl(),
    );

    useEffect(() => {
        const handlePopState = () => {
            setActiveSection(topicSectionFromUrl());
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    function selectSection(section: TopicSection) {
        setActiveSection(section);

        const url = new URL(window.location.href);

        if (section === 'trail') {
            url.searchParams.delete('section');
        } else {
            url.searchParams.set('section', section);
        }

        window.history.pushState(window.history.state, '', url);
    }

    return (
        <LearnerDocumentSurface scrollable={false}>
            <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
                <Link
                    className="inline-flex items-center gap-2 text-sm text-[var(--learner-muted-text)] transition hover:text-[var(--learner-accent)]"
                    href={topic.parent?.href ?? '/topics'}
                >
                    <ArrowLeft className="size-4" />
                    {topic.parent?.title ?? t('topics.title', 'Topics')}
                </Link>

                <header className="mt-6 max-w-3xl shrink-0 border-b border-[var(--learner-border-color)] pb-6">
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

                <nav
                    aria-label={t(
                        'topics.detail.navigation.label',
                        'Topic sections',
                    )}
                    className="mt-5 flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--learner-border-color)] pb-px"
                    role="tablist"
                >
                    {sections.map((section, index) => (
                        <button
                            aria-controls={`topic-panel-${section.id}`}
                            aria-selected={activeSection === section.id}
                            className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] aria-selected:border-[var(--learner-accent)] aria-selected:text-[var(--learner-heading-text)]"
                            id={`topic-${section.id}-tab`}
                            key={section.id}
                            onClick={() => selectSection(section.id)}
                            onKeyDown={(event) => {
                                let nextIndex: number | null = null;

                                if (
                                    event.key === 'ArrowRight' ||
                                    event.key === 'ArrowDown'
                                ) {
                                    nextIndex = (index + 1) % sections.length;
                                } else if (
                                    event.key === 'ArrowLeft' ||
                                    event.key === 'ArrowUp'
                                ) {
                                    nextIndex =
                                        (index - 1 + sections.length) %
                                        sections.length;
                                } else if (event.key === 'Home') {
                                    nextIndex = 0;
                                } else if (event.key === 'End') {
                                    nextIndex = sections.length - 1;
                                }

                                if (nextIndex === null) {
                                    return;
                                }

                                event.preventDefault();
                                const nextSection = sections[nextIndex];
                                selectSection(nextSection.id);
                                window.setTimeout(
                                    () =>
                                        document
                                            .getElementById(
                                                `topic-${nextSection.id}-tab`,
                                            )
                                            ?.focus(),
                                    0,
                                );
                            }}
                            role="tab"
                            tabIndex={activeSection === section.id ? 0 : -1}
                            type="button"
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>

                <div className="min-h-0 flex-1 overflow-hidden pt-5">
                    {activeSection === 'trail' ? (
                        <TopicPanel id="trail">
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
                            <TopicReflectionComparison
                                narrative={topic.reflectionNarrative}
                            />
                        </TopicPanel>
                    ) : null}

                    {activeSection === 'routes' ? (
                        <TopicPanel id="routes">
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
                                    <div className="mt-5">
                                        <LearnerPaginatedItems
                                            items={topic.paths}
                                            pageSize={4}
                                            paginationLabel="Topic routes"
                                            renderItem={(path) => (
                                                <TopicPathCard
                                                    key={path.id}
                                                    path={path}
                                                />
                                            )}
                                        />
                                    </div>
                                </section>
                            ) : null}
                            {topic.paths.length === 0 ? (
                                <p className="mt-8 border-y border-[var(--learner-border-color)] py-7 text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {t(
                                        'topics.detail.paths.empty',
                                        'No routes are available yet.',
                                    )}
                                </p>
                            ) : null}
                        </TopicPanel>
                    ) : null}

                    {activeSection === 'maps' ? (
                        <TopicPanel id="maps">
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
                                        {t(
                                            'topics.detail.maps.title',
                                            'Map surfaces',
                                        )}
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {t(
                                            'topics.detail.maps.description',
                                            'Open a map to explore this topic through places, activities and connected paths.',
                                        )}
                                    </p>
                                    <div className="mt-5">
                                        <LearnerPaginatedItems
                                            items={topic.maps}
                                            pageSize={4}
                                            paginationLabel="Topic maps"
                                            renderItem={(map) => (
                                                <TopicMapCard
                                                    key={map.id}
                                                    map={map}
                                                />
                                            )}
                                        />
                                    </div>
                                </section>
                            ) : null}
                            {topic.maps.length === 0 ? (
                                <p className="mt-8 border-y border-[var(--learner-border-color)] py-7 text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {t(
                                        'topics.detail.maps.empty',
                                        'No maps are available yet.',
                                    )}
                                </p>
                            ) : null}
                        </TopicPanel>
                    ) : null}

                    {activeSection === 'overview' ? (
                        <TopicPanel id="overview">
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
                                        {t(
                                            'topics.detail.subtopics',
                                            'Subtopics',
                                        )}
                                    </h2>
                                    {topic.subtopics.length > 0 ? (
                                        <LearnerPaginatedItems
                                            className="divide-y divide-[var(--learner-border-color)]"
                                            items={topic.subtopics}
                                            pageSize={4}
                                            paginationLabel="Topic subtopics"
                                            renderItem={(subtopic) => (
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
                                                                {subtopic.mapCount ===
                                                                1
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
                                                                {
                                                                    subtopic.description
                                                                }
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)]" />
                                                </Link>
                                            )}
                                        />
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
                        </TopicPanel>
                    ) : null}
                </div>
            </div>
        </LearnerDocumentSurface>
    );
}

type TopicSection = 'maps' | 'overview' | 'routes' | 'trail';

function topicSectionFromUrl(): TopicSection {
    if (typeof window === 'undefined') {
        return 'trail';
    }

    const section = new URLSearchParams(window.location.search).get('section');

    return section === 'maps' || section === 'overview' || section === 'routes'
        ? section
        : 'trail';
}

function TopicPanel({
    children,
    id,
}: {
    children: ReactNode;
    id: TopicSection;
}) {
    return (
        <section
            aria-labelledby={`topic-${id}-tab`}
            className="h-full min-h-0 overflow-y-auto pr-1"
            id={`topic-panel-${id}`}
            role="tabpanel"
        >
            {children}
        </section>
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
            <div className="mt-5">
                <LearnerPaginatedItems
                    items={areas}
                    pageSize={4}
                    paginationLabel="Learning areas"
                    renderItem={(area) => (
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
                    )}
                />
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
            <div className="mt-4">
                <LearnerPaginatedItems
                    className="divide-y divide-[var(--learner-border-color)]"
                    items={entries}
                    pageSize={4}
                    paginationLabel="Recent reflections"
                    renderItem={(entry) => (
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
                    )}
                />
            </div>
        </section>
    );
}

function TopicReflectionComparison({
    narrative,
}: {
    narrative: TopicReflectionNarrative | null;
}) {
    const t = usePlatformTranslation();

    if (narrative === null) {
        return null;
    }

    return (
        <section
            aria-labelledby="topic-reflection-comparison-heading"
            className="mt-8 border-y border-[var(--learner-border-color)] py-7"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                        {t(
                            'topics.detail.reflection_comparison.eyebrow',
                            'Your reflections over time',
                        )}
                    </p>
                    <h2
                        className="mt-2 text-sm font-semibold"
                        id="topic-reflection-comparison-heading"
                    >
                        {t(
                            'topics.detail.reflection_comparison.title',
                            'Earlier and later',
                        )}
                    </h2>
                </div>
                <Link
                    className="shrink-0 text-sm font-medium text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                    href={narrative.later.journalHref}
                >
                    {t(
                        'topics.detail.reflection_comparison.open_journal',
                        'Open journal',
                    )}
                </Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <ReflectionSnapshot
                    label={t(
                        'topics.detail.reflection_comparison.earlier',
                        'Earlier',
                    )}
                    snapshot={narrative.earlier}
                />
                <ReflectionSnapshot
                    label={t(
                        'topics.detail.reflection_comparison.later',
                        'Later',
                    )}
                    snapshot={narrative.later}
                />
            </div>
            {narrative.entries.filter(
                (entry) =>
                    entry.id !== narrative.earlier.id &&
                    entry.id !== narrative.later.id,
            ).length > 0 ? (
                <div className="mt-6 border-t border-[var(--learner-border-color)] pt-5">
                    <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-muted-text)] uppercase">
                        {t(
                            'topics.detail.reflection_comparison.trail',
                            'Reflections along the way',
                        )}
                    </p>
                    <div className="mt-3">
                        <LearnerPaginatedItems
                            className="divide-y divide-[var(--learner-border-color)]"
                            items={narrative.entries.filter(
                                (entry) =>
                                    entry.id !== narrative.earlier.id &&
                                    entry.id !== narrative.later.id,
                            )}
                            pageSize={4}
                            paginationLabel="Reflections along the way"
                            renderItem={(entry) => (
                                <ReflectionTrailEntry
                                    entry={entry}
                                    key={entry.id}
                                />
                            )}
                        />
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function ReflectionTrailEntry({
    entry,
}: {
    entry: TopicReflectionNarrative['entries'][number];
}) {
    return (
        <article className="py-3">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    {entry.activityTitle ? (
                        <p className="truncate text-sm font-medium text-[var(--learner-body-text)]">
                            {entry.activityTitle}
                        </p>
                    ) : null}
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--learner-muted-text)]">
                        {entry.reflection}
                    </p>
                </div>
                {entry.createdAt ? (
                    <time
                        className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                        dateTime={entry.createdAt}
                    >
                        {formatTopicDate(entry.createdAt)}
                    </time>
                ) : null}
            </div>
        </article>
    );
}

function ReflectionSnapshot({
    label,
    snapshot,
}: {
    label: string;
    snapshot: TopicReflectionNarrative['earlier'];
}) {
    return (
        <article className="border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4">
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-action-accent)] uppercase">
                    {label}
                </p>
                {snapshot.createdAt ? (
                    <time
                        className="shrink-0 text-xs text-[var(--learner-muted-text)]"
                        dateTime={snapshot.createdAt}
                    >
                        {formatTopicDate(snapshot.createdAt)}
                    </time>
                ) : null}
            </div>
            {snapshot.activityTitle ? (
                <p className="mt-3 text-xs text-[var(--learner-muted-text)]">
                    {snapshot.activityTitle}
                </p>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-[var(--learner-muted-text)] italic">
                {snapshot.question}
            </p>
            <p className="mt-2 line-clamp-6 text-sm leading-6 text-[var(--learner-body-text)]">
                {snapshot.reflection}
            </p>
        </article>
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

    return (
        <section
            aria-labelledby="topic-learning-trail-heading"
            className="mt-8 border-y border-[var(--learner-border-color)] py-7"
        >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
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
                            <LearnerPaginatedItems
                                className="mt-3 divide-y divide-[var(--learner-border-color)]"
                                items={competence.evidenceLedger}
                                pageSize={4}
                                paginationLabel="Recent competence moments"
                                renderItem={(entry) => {
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
                                                {entry.learningPurpose ? (
                                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                        Purpose:{' '}
                                                        {entry.learningPurpose}
                                                    </span>
                                                ) : null}
                                                {entry.evidenceCriterion ? (
                                                    <span className="mt-1 block text-xs text-[var(--learner-action-accent)]/80">
                                                        What to notice:{' '}
                                                        {entry.evidenceCriterion}
                                                    </span>
                                                ) : null}
                                                <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                                                    {evidenceClaimLabel(
                                                        entry.evidenceClaim,
                                                    )}
                                                </span>
                                                {entry.confidence ? (
                                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                                        Before answering:{' '}
                                                        {confidenceLabel(
                                                            entry.confidence,
                                                        )}
                                                        {entry.attemptNumber > 1
                                                            ? ` · attempt ${entry.attemptNumber}`
                                                            : ''}
                                                    </span>
                                                ) : null}
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
                                }}
                            />
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

function evidenceClaimLabel(claim: string): string {
    return (
        {
            application_attempt: 'An application attempt was recorded.',
            explanation_attempt: 'An explanation attempt was recorded.',
            independent_recall: 'Successful independent recall recorded.',
            learning_encounter: 'A learning encounter was recorded.',
            participation: 'Participation was recorded.',
            reflection: 'A reflection was recorded.',
            retrieval_attempt: 'A recall attempt was recorded.',
            review: 'A review was recorded.',
            transfer_attempt: 'A transfer attempt was recorded.',
        }[claim] ?? 'A learning encounter was recorded.'
    );
}

function confidenceLabel(confidence: string): string {
    return (
        {
            exploring: 'exploring',
            leaning: 'I have a hunch',
            settled: 'settled',
        }[confidence] ?? confidence
    );
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

function TopicMapCard({ map }: { map: TopicDetailData['maps'][number] }) {
    const t = usePlatformTranslation();

    return (
        <Link
            className="group flex items-start gap-3 border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_55%,transparent)] p-4 transition hover:border-[color-mix(in_srgb,var(--learner-action-accent)_60%,var(--learner-border-color))] hover:bg-[color-mix(in_srgb,var(--learner-action-accent)_8%,var(--learner-panel-background))]"
            href={map.href}
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
                    {t('topics.detail.maps.open', 'Open map')}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </span>
            </span>
        </Link>
    );
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
