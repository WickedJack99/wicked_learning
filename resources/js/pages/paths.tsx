import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, Compass, Map as MapIcon, Route } from 'lucide-react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import { PaginationControls } from '@/components/pagination-controls';
import { competenceTopicHref } from '@/features/competence/competence-links';
import {
    LEARNING_INTENTS,
    learningIntentLabel,
} from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type LearningPath = {
    activityTitle: string;
    activityType: string;
    description: string | null;
    href: string;
    id: number;
    imageUrl: string | null;
    learningAreas: { name: string; slug: string }[];
    learningIntent: string | null;
    label: string;
    routeDescription: string | null;
    timeGuideMinutes: number | null;
    mapHref: string;
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    progress: {
        currentActivityTitle: string | null;
        lastEnteredAt: string | null;
        status: string;
    } | null;
    topic: { href: string; slug: string; title: string } | null;
};

type PathsPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

function pathsUrl(
    page: number,
    purpose: string | null,
    timeBudget: number | null,
): string {
    const params = new URLSearchParams({ page: String(page) });

    if (purpose) {
        params.set('purpose', purpose);
    }

    if (timeBudget !== null) {
        params.set('time', String(timeBudget));
    }

    return `/paths?${params.toString()}`;
}

export default function Paths({
    paths,
    pagination,
    selectedPurpose,
    selectedTimeBudget,
}: {
    paths: LearningPath[];
    pagination: PathsPagination;
    selectedPurpose: string | null;
    selectedTimeBudget: number | null;
}) {
    const t = usePlatformTranslation();
    const hasActiveFilter =
        selectedPurpose !== null || selectedTimeBudget !== null;

    return (
        <LearnerDocumentSurface>
            <Head title={t('paths.title', 'Paths')} />
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-accent)] uppercase">
                    {t('paths.eyebrow', 'Ways into the world')}
                </p>
                <h1 className="mt-3 text-3xl font-medium tracking-tight">
                    {t('paths.title', 'Paths')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                    {t(
                        'paths.description',
                        'Choose a prepared route into a place on the learning map. The route is a starting point; what you notice and where you go next can remain open.',
                    )}
                </p>

                {paths.length > 0 || hasActiveFilter ? (
                    <section className="mt-12" aria-labelledby="paths-heading">
                        <div className="flex flex-col gap-4 border-b border-[var(--learner-border-color)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex items-center gap-4">
                                <Route className="size-5 text-[var(--learner-action-accent)]" />
                                <h2
                                    className="text-xs font-semibold tracking-[0.2em] text-[var(--learner-muted-text)] uppercase"
                                    id="paths-heading"
                                >
                                    {t(
                                        'paths.available.title',
                                        'Available routes',
                                    )}
                                </h2>
                            </div>
                            <div className="grid w-full gap-3 sm:w-[32rem] sm:max-w-full sm:grid-cols-2">
                                <div>
                                    <label
                                        className="text-xs font-medium text-[var(--learner-muted-text)]"
                                        htmlFor="paths-purpose"
                                    >
                                        {t(
                                            'paths.filters.purpose.label',
                                            'Learning purpose',
                                        )}
                                    </label>
                                    <select
                                        className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                        id="paths-purpose"
                                        onChange={(event) =>
                                            router.visit(
                                                pathsUrl(
                                                    1,
                                                    event.target.value || null,
                                                    selectedTimeBudget,
                                                ),
                                                {
                                                    preserveScroll: true,
                                                    replace: true,
                                                },
                                            )
                                        }
                                        value={selectedPurpose ?? ''}
                                    >
                                        <option value="">
                                            {t(
                                                'paths.filters.purpose.any',
                                                'Any purpose',
                                            )}
                                        </option>
                                        {LEARNING_INTENTS.map((intent) => (
                                            <option key={intent} value={intent}>
                                                {learningIntentLabel(
                                                    intent,
                                                    t,
                                                ) ?? intent}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label
                                        className="text-xs font-medium text-[var(--learner-muted-text)]"
                                        htmlFor="paths-time"
                                    >
                                        {t(
                                            'paths.filters.time.label',
                                            'Available time',
                                        )}
                                    </label>
                                    <select
                                        className="mt-1 h-9 w-full rounded border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-2 text-sm text-[var(--learner-body-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                                        id="paths-time"
                                        onChange={(event) =>
                                            router.visit(
                                                pathsUrl(
                                                    1,
                                                    selectedPurpose,
                                                    event.target.value
                                                        ? Number(
                                                              event.target
                                                                  .value,
                                                          )
                                                        : null,
                                                ),
                                                {
                                                    preserveScroll: true,
                                                    replace: true,
                                                },
                                            )
                                        }
                                        value={selectedTimeBudget ?? ''}
                                    >
                                        <option value="">
                                            {t(
                                                'paths.filters.time.any',
                                                'Any time',
                                            )}
                                        </option>
                                        <option value="15">
                                            {t(
                                                'paths.filters.time.short',
                                                'Up to 15 minutes',
                                            )}
                                        </option>
                                        <option value="30">
                                            {t(
                                                'paths.filters.time.medium',
                                                'Up to 30 minutes',
                                            )}
                                        </option>
                                    </select>
                                </div>
                                <p className="text-xs text-[var(--learner-muted-text)] sm:col-span-2">
                                    {t(
                                        'paths.filters.description',
                                        'Narrow the starting points by purpose or the time you have available.',
                                    )}
                                </p>
                            </div>
                        </div>
                        {paths.length > 0 ? (
                            <>
                                <div className="mt-6 grid min-h-[89rem] gap-4 md:min-h-[44rem] md:grid-cols-2">
                                    {paths.map((path) => (
                                        <PathCard key={path.id} path={path} />
                                    ))}
                                </div>
                                <PaginationControls
                                    buttonClassName="text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]"
                                    className="mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3"
                                    currentPage={pagination.currentPage}
                                    label={t(
                                        'paths.pagination.label',
                                        'Learning paths',
                                    )}
                                    onPageChange={(page) =>
                                        router.visit(
                                            pathsUrl(
                                                page,
                                                selectedPurpose,
                                                selectedTimeBudget,
                                            ),
                                            {
                                                preserveScroll: true,
                                                replace: true,
                                            },
                                        )
                                    }
                                    pageCount={pagination.lastPage}
                                    textClassName="text-xs text-[var(--learner-muted-text)]"
                                />
                            </>
                        ) : (
                            <div className="border-b border-[var(--learner-border-color)] py-10">
                                <Compass className="size-7 text-[var(--learner-action-accent)]" />
                                <h3 className="mt-5 text-sm font-semibold">
                                    {t(
                                        'paths.filtered_empty.title',
                                        'No routes match this purpose yet',
                                    )}
                                </h3>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                    {t(
                                        'paths.filtered_empty.description',
                                        'Try another purpose or return to all available routes.',
                                    )}
                                </p>
                                <button
                                    className="mt-5 text-sm font-medium text-[var(--learner-action-accent)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)]"
                                    onClick={() =>
                                        router.visit(pathsUrl(1, null, null), {
                                            preserveScroll: true,
                                            replace: true,
                                        })
                                    }
                                    type="button"
                                >
                                    {t(
                                        'paths.filtered_empty.clear',
                                        'Show all routes',
                                    )}
                                </button>
                            </div>
                        )}
                    </section>
                ) : (
                    <section className="mt-12 border-y border-[var(--learner-border-color)] py-10">
                        <Compass className="size-7 text-[var(--learner-action-accent)]" />
                        <h2 className="mt-5 text-sm font-semibold">
                            {t(
                                'paths.empty.title',
                                'No routes are available yet',
                            )}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-muted-text)]">
                            {t(
                                'paths.empty.description',
                                'You can enter through a topic or open a map directly when a route is added.',
                            )}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
                            <Link
                                className="inline-flex items-center gap-2 text-[var(--learner-accent)]"
                                href="/topics"
                            >
                                {t('paths.empty.topics', 'Browse topics')}
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link
                                className="inline-flex items-center gap-2 text-[var(--learner-action-accent)]"
                                href="/world"
                            >
                                {t('paths.empty.world', 'Open the map')}
                                <ArrowRight className="size-4" />
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        </LearnerDocumentSurface>
    );
}

function PathCard({ path }: { path: LearningPath }) {
    const t = usePlatformTranslation();
    const isInProgress = path.progress?.status === 'in_progress';
    const wasExplored = path.progress?.status === 'completed';

    return (
        <article className="group flex min-h-56 flex-col border border-[var(--learner-border-color)] bg-[color-mix(in_srgb,var(--learner-panel-background)_60%,transparent)] p-5 transition hover:border-[color-mix(in_srgb,var(--learner-accent)_55%,var(--learner-border-color))] hover:bg-[var(--learner-panel-background)]">
            <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center border border-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_10%,transparent)] text-[var(--learner-action-accent)]">
                    {path.imageUrl ? (
                        <img
                            alt=""
                            className="size-10 object-contain"
                            src={path.imageUrl}
                        />
                    ) : (
                        <MapIcon className="size-5" />
                    )}
                </div>
                <div className="min-w-0">
                    {path.topic ? (
                        <Link
                            className="text-xs font-semibold tracking-[0.16em] text-[var(--learner-accent)] uppercase hover:text-[var(--learner-heading-text)]"
                            href={path.topic.href}
                        >
                            {path.topic.title}
                        </Link>
                    ) : null}
                    <h3 className="mt-2 text-sm font-semibold text-[var(--learner-heading-text)]">
                        {path.label}
                    </h3>
                    {path.learningIntent ? (
                        <p className="mt-1 text-xs font-medium text-[var(--learner-action-accent)]">
                            {learningIntentLabel(path.learningIntent, t)}
                        </p>
                    ) : null}
                    {path.timeGuideMinutes ? (
                        <p className="mt-1 text-xs text-[var(--learner-muted-text)]">
                            {t(
                                'learning.activity.time_guide',
                                'Suggested time: :minutes minutes',
                                { minutes: path.timeGuideMinutes },
                            )}
                        </p>
                    ) : null}
                    {path.learningAreas.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--learner-muted-text)]">
                            <span>Learning areas:</span>
                            {path.learningAreas.map((area) => (
                                <Link
                                    className="text-[var(--learner-action-accent)] underline decoration-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                                    href={competenceTopicHref(
                                        area.slug,
                                        path.topic?.slug,
                                    )}
                                    key={area.slug}
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {area.name}
                                </Link>
                            ))}
                        </div>
                    ) : null}
                    {path.routeDescription ? (
                        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--learner-body-text)]">
                            {path.routeDescription}
                        </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--learner-muted-text)]">
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
                    </p>
                </div>
            </div>
            {path.description ? (
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-[var(--learner-body-text)]">
                    {path.description}
                </p>
            ) : null}
            <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <div className="text-xs text-[var(--learner-muted-text)]">
                    {isInProgress ? (
                        <span className="font-medium text-[var(--learner-action-accent)]">
                            {t('paths.status.in_progress', 'In progress')}
                        </span>
                    ) : wasExplored ? (
                        <span>
                            {t('paths.status.explored', 'Previously explored')}
                        </span>
                    ) : (
                        <span>
                            {t('paths.status.new', 'A new starting point')}
                        </span>
                    )}
                    {isInProgress && path.progress?.currentActivityTitle ? (
                        <span className="mt-1 block">
                            {t('paths.status.current', 'Current step')}:{' '}
                            {path.progress.currentActivityTitle}
                        </span>
                    ) : null}
                </div>
                <Link
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={path.href}
                >
                    {isInProgress
                        ? t('paths.action.continue', 'Continue route')
                        : t('paths.action.enter', 'Enter route')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </div>
        </article>
    );
}
