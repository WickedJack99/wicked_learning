import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bookmark,
    BookOpenText,
    Clock3,
    Compass,
    Pin,
} from 'lucide-react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { LearningDeskHeader } from './learning-desk-header';
import { LearningDeskSearch } from './learning-desk-search';
import type {
    LearningDeskBookmark,
    LearningDeskData,
    LearningDeskRoute,
} from './types';

export function LearningDesk({ desk }: { desk: LearningDeskData }) {
    const { auth, localization } = usePage().props;
    const t = usePlatformTranslation();
    const firstName = auth.user?.name.trim().split(/\s+/)[0] ?? '';

    return (
        <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <LearningDeskHeader />

            <div className="grid min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
                <div className="min-w-0 px-5 py-10 sm:px-8 lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]">
                    <div className="mx-auto max-w-4xl">
                        <section>
                            <p className="text-sm font-medium tracking-[0.16em] text-violet-600 uppercase dark:text-violet-400">
                                {t(
                                    'home.learning_desk.eyebrow',
                                    'Your learning desk',
                                )}
                            </p>
                            <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl lg:text-[2.75rem]">
                                {greeting(t)}, {firstName}.
                            </h1>
                            <p className="mt-2 text-lg text-slate-500 sm:text-xl dark:text-slate-400">
                                {t(
                                    'home.learning_desk.prompt',
                                    'What would you like to think about next?',
                                )}
                            </p>
                            <LearningDeskSearch />
                        </section>

                        {desk.recentRoutes.length > 0 ? (
                            <section
                                className="mt-14"
                                aria-labelledby="recent-heading"
                            >
                                <SectionHeading
                                    id="recent-heading"
                                    label={t(
                                        'home.learning_desk.recent.title',
                                        'Recent traces',
                                    )}
                                />
                                <div className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-white/10 dark:border-white/10">
                                    {desk.recentRoutes.map((route) => (
                                        <RecentRouteRow
                                            key={route.id}
                                            locale={localization.locale}
                                            route={route}
                                        />
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        <section
                            className="mt-14"
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
                                <div className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-white/10 dark:border-white/10">
                                    {desk.currentRoutes.map((route, index) => (
                                        <RouteRow
                                            key={route.id}
                                            locale={localization.locale}
                                            route={route}
                                            emphasized={index === 0}
                                        />
                                    ))}
                                </div>
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

                        <section
                            className="mt-14"
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
                                <div className="border-b border-slate-200 py-6 dark:border-white/10">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-lg sm:text-xl">
                                        {desk.connections.map(
                                            (connection, index) => (
                                                <div
                                                    className="flex items-center gap-4"
                                                    key={connection.id}
                                                >
                                                    {index > 0 ? (
                                                        <ArrowRight className="size-4 text-cyan-600 dark:text-cyan-400" />
                                                    ) : null}
                                                    <Link
                                                        className="underline decoration-transparent underline-offset-4 transition hover:text-violet-600 hover:decoration-violet-400 dark:hover:text-violet-300"
                                                        href={connection.href}
                                                    >
                                                        {connection.title}
                                                    </Link>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                    <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        {t(
                                            'home.learning_desk.connections.saved_reason',
                                            'Drawn from topics you saved for later. Tutor and AI suggestions can join this space as separate, clearly labelled sources.',
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <EmptyState
                                    body={t(
                                        'home.learning_desk.connections.empty_body',
                                        'Save interesting topics and this area can reveal useful paths between them.',
                                    )}
                                    href="/world"
                                    link={t(
                                        'home.learning_desk.connections.empty_action',
                                        'Explore the world',
                                    )}
                                    title={t(
                                        'home.learning_desk.connections.empty_title',
                                        'Connections need a little context',
                                    )}
                                />
                            )}
                        </section>
                    </div>
                </div>

                <LearningDeskRail desk={desk} />
            </div>
        </main>
    );
}

function LearningDeskRail({ desk }: { desk: LearningDeskData }) {
    const t = usePlatformTranslation();
    const featured = desk.featuredBookmark;

    return (
        <aside className="border-t border-slate-200 bg-slate-100/55 px-5 py-9 sm:px-8 lg:sticky lg:top-16 lg:h-[calc(100svh-4rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-7 dark:border-white/10 dark:bg-[#0b1521]">
            <p className="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase dark:text-slate-400">
                {t('home.learning_desk.rail.title', 'Pinned for later')}
            </p>

            {featured ? (
                <FeaturedBookmark bookmark={featured} />
            ) : (
                <div className="mt-7 border-y border-slate-200 py-6 dark:border-white/10">
                    <Pin className="size-5 text-cyan-600 dark:text-cyan-400" />
                    <p className="mt-4 font-medium">
                        {t(
                            'home.learning_desk.rail.empty_title',
                            'Pin a topic to your desk',
                        )}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'home.learning_desk.rail.empty_body',
                            'Your most recently visited bookmarked topic will appear here.',
                        )}
                    </p>
                </div>
            )}

            <div className="mt-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-400">
                    {t('home.learning_desk.bookmarks.title', 'Saved topics')}
                </p>
                <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
                    {desk.bookmarks.length > 0 ? (
                        desk.bookmarks.slice(0, 5).map((bookmark) => (
                            <Link
                                className="group flex items-start gap-3 py-4 text-sm"
                                href={bookmark.href}
                                key={bookmark.id}
                            >
                                <Bookmark className="mt-0.5 size-4 shrink-0 text-cyan-600 transition group-hover:fill-current dark:text-cyan-400" />
                                <span>
                                    <span className="block font-medium text-slate-800 group-hover:text-violet-700 dark:text-slate-200 dark:group-hover:text-violet-300">
                                        {bookmark.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-500">
                                        {bookmark.mapTitle}
                                    </span>
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="py-5 text-sm text-slate-500 dark:text-slate-400">
                            {t(
                                'home.learning_desk.bookmarks.empty',
                                'No saved topics yet.',
                            )}
                        </p>
                    )}
                </div>
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
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
        <article className="mt-7 border-b border-slate-200 pb-8 dark:border-white/10">
            {bookmark.imageUrl ? (
                <div className="mb-5 flex h-28 items-center justify-center overflow-hidden bg-slate-200/60 dark:bg-black/15">
                    <img
                        alt=""
                        className="h-full w-full object-contain"
                        src={bookmark.imageUrl}
                    />
                </div>
            ) : null}
            <p className="text-xs font-medium tracking-[0.16em] text-violet-600 uppercase dark:text-violet-400">
                {t('home.learning_desk.rail.featured', 'Pinned topic')}
            </p>
            <h2 className="mt-3 text-xl font-medium">{bookmark.title}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                {bookmark.mapTitle}
            </p>
            {bookmark.description ? (
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {bookmark.description}
                </p>
            ) : null}
            <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                href={bookmark.href}
            >
                {t('home.learning_desk.rail.open', 'Open topic')}
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
                <span className="absolute top-3 bottom-3 -left-4 w-0.5 bg-violet-500 sm:-left-6" />
            ) : null}
            <Link
                aria-label={route.routeLabel ?? route.nodeTitle}
                className="grid size-12 place-items-center border border-slate-200 text-violet-600 transition hover:border-violet-300 dark:border-white/10 dark:text-violet-300 dark:hover:border-violet-400/60"
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
                    className="block truncate text-lg font-medium hover:text-violet-700 dark:hover:text-violet-300"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">
                    {route.nodeTitle} ·{' '}
                    <Link
                        className="hover:text-cyan-700 hover:underline dark:hover:text-cyan-300"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
                {route.currentActivityTitle ? (
                    <span className="mt-2 block truncate text-xs font-medium text-cyan-700 dark:text-cyan-400">
                        {t('home.learning_desk.continue.next', 'Current step')}:{' '}
                        {route.currentActivityTitle}
                    </span>
                ) : null}
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastEnteredAt ? (
                    <span className="hidden items-center gap-1.5 text-xs text-slate-400 xl:flex">
                        <Clock3 className="size-3.5" />
                        {formatDate(route.lastEnteredAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"
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
                className="grid size-12 place-items-center border border-slate-200 text-cyan-600 hover:border-cyan-300 dark:border-white/10 dark:text-cyan-300 dark:hover:border-cyan-300/60"
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
                    className="block truncate text-base font-medium hover:text-violet-700 dark:hover:text-violet-300"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">
                    {route.nodeTitle} ·{' '}
                    <Link
                        className="hover:text-cyan-700 hover:underline dark:hover:text-cyan-300"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastCompletedAt ? (
                    <span className="hidden text-xs text-slate-400 xl:inline">
                        {formatDate(route.lastCompletedAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-300"
                    href={route.href}
                >
                    {t('home.learning_desk.recent.action', 'Revisit')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </div>
    );
}

function SectionHeading({ id, label }: { id: string; label: string }) {
    return (
        <div className="flex items-center gap-5 border-b border-slate-200 pb-3 dark:border-white/10">
            <h2
                className="shrink-0 text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase dark:text-slate-400"
                id={id}
            >
                {label}
            </h2>
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
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
        <div className="border-b border-slate-200 py-7 dark:border-white/10">
            <div className="flex items-start gap-4">
                <Compass className="mt-1 size-5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {body}
                    </p>
                    <Link
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-cyan-400"
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
