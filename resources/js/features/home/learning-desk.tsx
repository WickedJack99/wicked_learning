import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bookmark,
    BookOpenText,
    Clock3,
    Compass,
    Pin,
} from 'lucide-react';
import { useState } from 'react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { competenceTopicHref } from '@/features/competence/competence-links';
import { updateRevisitInvitation } from '@/features/journal/journal-client';
import { learningIntentLabel } from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { LearningDeskSearch } from './learning-desk-search';
import type {
    LearningDeskBookmark,
    LearningDeskData,
    LearningDeskRevisitInvitation,
    LearningDeskRoute,
} from './types';

type LearningDeskArea = 'connections' | 'revisit' | 'recent' | 'continue';

export function LearningDesk({ desk }: { desk: LearningDeskData }) {
    const { auth, localization } = usePage().props;
    const t = usePlatformTranslation();
    const firstName = auth.user?.name.trim().split(/\s+/)[0] ?? '';
    const [handledRevisitIds, setHandledRevisitIds] = useState<number[]>([]);
    const [updatingRevisitId, setUpdatingRevisitId] = useState<number | null>(
        null,
    );
    const [revisitError, setRevisitError] = useState(false);
    const revisitInvitations = desk.revisitInvitations.filter(
        (invitation) => !handledRevisitIds.includes(invitation.activityId),
    );
    const [activeArea, setActiveArea] = useState<LearningDeskArea>(
        desk.currentRoutes.length > 0 ? 'continue' : 'connections',
    );
    const deskAreas: { id: LearningDeskArea; label: string }[] = [
        {
            id: 'connections',
            label: t('home.learning_desk.sections.connections', 'Connections'),
        },
        ...(revisitInvitations.length > 0
            ? [
                  {
                      id: 'revisit' as const,
                      label: t(
                          'home.learning_desk.sections.revisit',
                          'Return when useful',
                      ),
                  },
              ]
            : []),
        ...(desk.recentRoutes.length > 0
            ? [
                  {
                      id: 'recent' as const,
                      label: t(
                          'home.learning_desk.sections.recent',
                          'Recent traces',
                      ),
                  },
              ]
            : []),
        {
            id: 'continue',
            label: t(
                'home.learning_desk.sections.continue',
                'Continue learning',
            ),
        },
    ];
    const visibleArea = deskAreas.some((area) => area.id === activeArea)
        ? activeArea
        : 'continue';

    async function handleRevisitUpdate(
        activityId: number,
        action: 'dismiss' | 'snooze',
    ) {
        if (updatingRevisitId !== null) {
            return;
        }

        setUpdatingRevisitId(activityId);
        setRevisitError(false);

        try {
            await updateRevisitInvitation(activityId, action);
            setHandledRevisitIds((current) => [...current, activityId]);
        } catch {
            setRevisitError(true);
        } finally {
            setUpdatingRevisitId(null);
        }
    }

    return (
        <LearnerDocumentSurface scrollable={false}>
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_25rem]">
                <div className="min-w-0 px-5 py-10 sm:px-8 lg:min-h-0 lg:overflow-hidden lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]">
                    <div className="mx-auto flex max-w-4xl flex-col lg:h-full lg:min-h-0">
                        <section>
                            <p className="text-sm font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                                {t(
                                    'home.learning_desk.eyebrow',
                                    'Your learning desk',
                                )}
                            </p>
                            <h1 className="mt-3 text-3xl font-medium tracking-tight">
                                {greeting(t)}, {firstName}.
                            </h1>
                            <p className="mt-2 text-sm text-[var(--learner-muted-text)]">
                                {t(
                                    'home.learning_desk.prompt',
                                    'What would you like to think about next?',
                                )}
                            </p>
                            <LearningDeskSearch />
                        </section>

                        <nav
                            aria-label={t(
                                'home.learning_desk.sections.label',
                                'Learning desk areas',
                            )}
                            className="mt-8 shrink-0 border-y border-[var(--learner-border-color)] py-3"
                        >
                            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-muted-text)] uppercase">
                                {t(
                                    'home.learning_desk.sections.label',
                                    'Learning desk areas',
                                )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {deskAreas.map((area) => (
                                    <button
                                        aria-pressed={visibleArea === area.id}
                                        className={[
                                            'min-h-10 rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none',
                                            visibleArea === area.id
                                                ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-heading-text)]'
                                                : 'border-[var(--learner-border-color)] text-[var(--learner-muted-text)] hover:border-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]',
                                        ].join(' ')}
                                        key={area.id}
                                        onClick={() => setActiveArea(area.id)}
                                        type="button"
                                    >
                                        {area.label}
                                    </button>
                                ))}
                            </div>
                        </nav>

                        <div className="min-h-0 flex-1">
                            {visibleArea === 'connections' ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="connections-heading"
                                >
                                    <SectionHeading
                                        id="connections-heading"
                                        label={t(
                                            'home.learning_desk.connections.title',
                                            'Possible connections',
                                        )}
                                    />
                                    {desk.connections.length > 0 ? (
                                        <div className="border-b border-[var(--learner-border-color)] py-6">
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
                                                {desk.connections.map(
                                                    (connection, index) => (
                                                        <div
                                                            className="flex items-center gap-4"
                                                            key={connection.id}
                                                        >
                                                            {index > 0 ? (
                                                                <ArrowRight className="size-4 text-[var(--learner-action-accent)]" />
                                                            ) : null}
                                                            <Link
                                                                className="underline decoration-transparent underline-offset-4 transition hover:text-[var(--learner-accent)] hover:decoration-[var(--learner-accent)]"
                                                                href={
                                                                    connection.href
                                                                }
                                                            >
                                                                {
                                                                    connection.title
                                                                }
                                                            </Link>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                                {t(
                                                    'home.learning_desk.connections.saved_reason',
                                                    'Drawn from places you saved for later. Tutor and AI suggestions can join this space as separate, clearly labelled sources.',
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        <EmptyState
                                            body={t(
                                                'home.learning_desk.connections.empty_body',
                                                'Save interesting places and this area can reveal useful paths between them.',
                                            )}
                                            href="/world"
                                            link={t(
                                                'home.learning_desk.connections.empty_action',
                                                'Open the map',
                                            )}
                                            title={t(
                                                'home.learning_desk.connections.empty_title',
                                                'Connections need a little context',
                                            )}
                                        />
                                    )}
                                </section>
                            ) : null}

                            {visibleArea === 'revisit' &&
                            revisitInvitations.length > 0 ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="revisit-heading"
                                >
                                    <SectionHeading
                                        id="revisit-heading"
                                        label={t(
                                            'home.learning_desk.revisit.title',
                                            'Return when useful',
                                        )}
                                    />
                                    <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.revisit.body',
                                            'These are places you chose to return to after some time away.',
                                        )}
                                    </p>
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={revisitInvitations}
                                        pageSize={2}
                                        paginationLabel={t(
                                            'home.learning_desk.revisit.pagination',
                                            'Revisit invitations',
                                        )}
                                        renderItem={(invitation) => (
                                            <RevisitInvitationRow
                                                invitation={invitation}
                                                key={invitation.activityId}
                                                locale={localization.locale}
                                                onUpdate={handleRevisitUpdate}
                                                updating={
                                                    updatingRevisitId ===
                                                    invitation.activityId
                                                }
                                            />
                                        )}
                                    />
                                    {revisitError ? (
                                        <p
                                            aria-live="polite"
                                            className="mt-3 text-sm text-red-300"
                                            role="status"
                                        >
                                            {t(
                                                'home.learning_desk.revisit.error',
                                                'That choice could not be saved. Try again.',
                                            )}
                                        </p>
                                    ) : null}
                                </section>
                            ) : null}

                            {visibleArea === 'recent' &&
                            desk.recentRoutes.length > 0 ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="recent-heading"
                                >
                                    <SectionHeading
                                        id="recent-heading"
                                        label={t(
                                            'home.learning_desk.recent.title',
                                            'Recent traces',
                                        )}
                                    />
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={desk.recentRoutes}
                                        pageSize={2}
                                        paginationLabel="Recent traces"
                                        renderItem={(route) => (
                                            <RecentRouteRow
                                                key={route.id}
                                                locale={localization.locale}
                                                route={route}
                                            />
                                        )}
                                    />
                                </section>
                            ) : null}

                            {visibleArea === 'continue' ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="continue-heading"
                                >
                                    <SectionHeading
                                        id="continue-heading"
                                        label={t(
                                            'home.learning_desk.continue.title',
                                            'Continue learning',
                                        )}
                                    />
                                    {desk.currentRoutes.length > 0 ? (
                                        <LearnerPaginatedItems
                                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                            items={desk.currentRoutes}
                                            pageSize={2}
                                            paginationLabel="Current routes"
                                            renderItem={(route) => (
                                                <RouteRow
                                                    key={route.id}
                                                    locale={localization.locale}
                                                    route={route}
                                                    emphasized={
                                                        route.id ===
                                                        desk.currentRoutes[0]
                                                            ?.id
                                                    }
                                                />
                                            )}
                                        />
                                    ) : (
                                        <EmptyState
                                            body={t(
                                                'home.learning_desk.continue.empty_body',
                                                'Start a learning route and it will wait for you here.',
                                            )}
                                            href="/topics"
                                            link={t(
                                                'home.learning_desk.continue.empty_action',
                                                'Browse topics',
                                            )}
                                            title={t(
                                                'home.learning_desk.continue.empty_title',
                                                'Nothing is currently in progress',
                                            )}
                                        />
                                    )}
                                </section>
                            ) : null}
                        </div>
                    </div>
                </div>

                <LearningDeskRail desk={desk} />
            </div>
        </LearnerDocumentSurface>
    );
}

function LearningDeskRail({ desk }: { desk: LearningDeskData }) {
    const t = usePlatformTranslation();
    const featured = desk.featuredBookmark;

    return (
        <aside className="border-t border-[var(--learner-border-color)] bg-[var(--learner-panel-muted-background)] px-5 py-9 sm:px-8 lg:h-full lg:border-t-0 lg:border-l lg:px-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase">
                {t('home.learning_desk.rail.title', 'Pinned for later')}
            </p>

            {featured ? (
                <FeaturedBookmark bookmark={featured} />
            ) : (
                <div className="mt-7 border-y border-[var(--learner-border-color)] py-6">
                    <Pin className="size-5 text-[var(--learner-action-accent)]" />
                    <p className="mt-4 font-medium">
                        {t(
                            'home.learning_desk.rail.empty_title',
                            'Pin a place to your desk',
                        )}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                        {t(
                            'home.learning_desk.rail.empty_body',
                            'Your most recently visited bookmarked place will appear here.',
                        )}
                    </p>
                </div>
            )}

            <div className="mt-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-action-accent)] uppercase">
                    {t('home.learning_desk.bookmarks.title', 'Saved places')}
                </p>
                <div className="mt-4 divide-y divide-[var(--learner-border-color)] border-y border-[var(--learner-border-color)]">
                    {desk.bookmarks.length > 0 ? (
                        desk.bookmarks.slice(0, 5).map((bookmark) => (
                            <Link
                                className="group flex items-start gap-3 py-4 text-sm"
                                href={bookmark.href}
                                key={bookmark.id}
                            >
                                <Bookmark className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition group-hover:fill-current" />
                                <span>
                                    <span className="block font-medium text-[var(--learner-heading-text)] group-hover:text-[var(--learner-accent)]">
                                        {bookmark.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                        {bookmark.mapTitle}
                                    </span>
                                    {bookmark.topic ? (
                                        <span className="mt-1 block text-xs text-[var(--learner-accent)]">
                                            {bookmark.topic.title}
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="py-5 text-sm text-[var(--learner-muted-text)]">
                            {t(
                                'home.learning_desk.bookmarks.empty',
                                'No saved places yet.',
                            )}
                        </p>
                    )}
                </div>
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                    href="/bookmarks"
                >
                    {t(
                        'home.learning_desk.bookmarks.all',
                        'View all bookmarks',
                    )}
                    <ArrowRight className="size-4" />
                </Link>
            </div>
        </aside>
    );
}

function FeaturedBookmark({ bookmark }: { bookmark: LearningDeskBookmark }) {
    const t = usePlatformTranslation();

    return (
        <article className="mt-7 border-b border-[var(--learner-border-color)] pb-8">
            {bookmark.imageUrl ? (
                <div className="mb-5 flex h-28 items-center justify-center overflow-hidden bg-[var(--learner-panel-background)]">
                    <img
                        alt=""
                        className="h-full w-full object-contain"
                        src={bookmark.imageUrl}
                    />
                </div>
            ) : null}
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                {t('home.learning_desk.rail.featured', 'Pinned place')}
            </p>
            <h2 className="mt-3 text-sm font-semibold">{bookmark.title}</h2>
            <p className="mt-1 text-xs text-[var(--learner-muted-text)]">
                {bookmark.mapTitle}
            </p>
            {bookmark.topic ? (
                <Link
                    className="mt-1 inline-flex text-xs text-[var(--learner-accent)] underline decoration-[color-mix(in_srgb,var(--learner-accent)_60%,transparent)] underline-offset-4 hover:text-[var(--learner-heading-text)]"
                    href={bookmark.topic.href}
                >
                    {bookmark.topic.title}
                </Link>
            ) : null}
            {bookmark.description ? (
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-[var(--learner-body-text)]">
                    {bookmark.description}
                </p>
            ) : null}
            <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)] hover:text-[var(--learner-heading-text)]"
                href={bookmark.href}
            >
                {t('home.learning_desk.rail.open', 'Open place')}
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function RouteRow({
    emphasized,
    locale,
    route,
}: {
    emphasized: boolean;
    locale: string;
    route: LearningDeskRoute;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group relative grid gap-4 py-6 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            {emphasized ? (
                <span className="absolute top-3 bottom-3 -left-4 w-0.5 bg-[var(--learner-accent)] sm:-left-6" />
            ) : null}
            <Link
                aria-label={route.routeLabel ?? route.nodeTitle}
                className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-accent)] transition hover:border-[color-mix(in_srgb,var(--learner-accent)_55%,var(--learner-border-color))]"
                href={route.href}
            >
                {route.imageUrl ? (
                    <img
                        alt=""
                        className="size-10 object-contain"
                        src={route.imageUrl}
                    />
                ) : (
                    <BookOpenText className="size-5" />
                )}
            </Link>
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                {route.learningIntent ? (
                    <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                        {learningIntentLabel(route.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.nodeHref}
                    >
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas route={route} />
                {route.currentActivityTitle ? (
                    <span className="mt-2 block truncate text-xs font-medium text-[var(--learner-action-accent)]">
                        {t('home.learning_desk.continue.next', 'Current step')}:{' '}
                        {route.currentActivityTitle}
                    </span>
                ) : null}
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastEnteredAt ? (
                    <span className="hidden items-center gap-1.5 text-xs text-[var(--learner-muted-text)] xl:flex">
                        <Clock3 className="size-3.5" />
                        {formatDate(route.lastEnteredAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {t('common.continue', 'Continue')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </div>
    );
}

function RecentRouteRow({
    locale,
    route,
}: {
    locale: string;
    route: LearningDeskRoute;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <Link
                aria-label={route.routeLabel ?? route.nodeTitle}
                className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-action-accent)] hover:border-[color-mix(in_srgb,var(--learner-action-accent)_55%,var(--learner-border-color))]"
                href={route.href}
            >
                {route.imageUrl ? (
                    <img
                        alt=""
                        className="size-10 object-contain"
                        src={route.imageUrl}
                    />
                ) : (
                    <Clock3 className="size-5" />
                )}
            </Link>
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                {route.learningIntent ? (
                    <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                        {learningIntentLabel(route.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.nodeHref}
                    >
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas route={route} />
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastCompletedAt ? (
                    <span className="hidden text-xs text-[var(--learner-muted-text)] xl:inline">
                        {formatDate(route.lastCompletedAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)]"
                    href={route.href}
                >
                    {t('home.learning_desk.recent.action', 'Revisit')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </div>
    );
}

function RevisitInvitationRow({
    invitation,
    locale,
    onUpdate,
    updating,
}: {
    invitation: LearningDeskRevisitInvitation;
    locale: string;
    onUpdate: (
        activityId: number,
        action: 'dismiss' | 'snooze',
    ) => Promise<void>;
    updating: boolean;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <Clock3
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={invitation.activityHref}
                >
                    {invitation.activityTitle}
                </Link>
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={invitation.nodeHref}
                    >
                        {invitation.nodeTitle}
                    </Link>{' '}
                    · {invitation.mapTitle}
                </span>
                <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                    {t('home.learning_desk.revisit.ready', 'Ready since')}{' '}
                    {formatDate(invitation.availableAt, locale)}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                    {invitation.revisitReason === 'later'
                        ? t(
                              'home.learning_desk.revisit.snoozed',
                              'You chose to wait longer before returning.',
                          )
                        : t(
                              'home.learning_desk.revisit.due',
                              'Ready after :days days away.',
                              { days: invitation.availableAfterDays },
                          )}
                </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Link
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={invitation.activityHref}
                >
                    {t('home.learning_desk.revisit.action', 'Open activity')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-action-accent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() =>
                        void onUpdate(invitation.activityId, 'snooze')
                    }
                    type="button"
                >
                    {t('home.learning_desk.revisit.later', 'Later')}
                </button>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-muted-text)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() =>
                        void onUpdate(invitation.activityId, 'dismiss')
                    }
                    type="button"
                >
                    {t('home.learning_desk.revisit.hide', 'Hide')}
                </button>
            </span>
        </div>
    );
}

function RouteLearningAreas({ route }: { route: LearningDeskRoute }) {
    if (route.learningAreas.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--learner-muted-text)]">
            <span>Learning areas:</span>
            {route.learningAreas.map((area) => (
                <Link
                    className="text-[var(--learner-action-accent)] underline decoration-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                    href={competenceTopicHref(area.slug, route.topic?.slug)}
                    key={area.slug}
                >
                    {area.name}
                </Link>
            ))}
        </div>
    );
}

function SectionHeading({ id, label }: { id: string; label: string }) {
    return (
        <div className="flex items-center gap-5 border-b border-[var(--learner-border-color)] pb-3">
            <h2
                className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase"
                id={id}
            >
                {label}
            </h2>
            <span className="h-px flex-1 bg-[var(--learner-border-color)]" />
        </div>
    );
}

function EmptyState({
    body,
    href,
    link,
    title,
}: {
    body: string;
    href: string;
    link: string;
    title: string;
}) {
    return (
        <div className="border-b border-[var(--learner-border-color)] py-7">
            <div className="flex items-start gap-4">
                <Compass className="mt-1 size-5 shrink-0 text-[var(--learner-action-accent)]" />
                <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--learner-muted-text)]">
                        {body}
                    </p>
                    <Link
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)]"
                        href={href}
                    >
                        {link}
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function greeting(t: ReturnType<typeof usePlatformTranslation>): string {
    const hour = new Date().getHours();

    if (hour < 12) {
        return t('home.learning_desk.greeting.morning', 'Good morning');
    }

    if (hour < 18) {
        return t('home.learning_desk.greeting.afternoon', 'Good afternoon');
    }

    return t('home.learning_desk.greeting.evening', 'Good evening');
}

function formatDate(value: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    }).format(new Date(value));
}
