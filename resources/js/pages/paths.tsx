import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Compass, Map as MapIcon, Route } from 'lucide-react';
import { competenceTopicHref } from '@/features/competence/competence-links';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { learningIntentLabel } from '@/features/world/activity-utils';
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

export default function Paths({ paths }: { paths: LearningPath[] }) {
    const t = usePlatformTranslation();

    return (
        <main className="h-full overflow-y-auto bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100">
            <Head title={t('paths.title', 'Paths')} />
            <LearningDeskHeader />
            <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
                <p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">
                    {t('paths.eyebrow', 'Ways into the world')}
                </p>
                <h1 className="mt-3 text-3xl font-medium tracking-tight">
                    {t('paths.title', 'Paths')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'paths.description',
                        'Choose a prepared route into a place on the learning map. The route is a starting point; what you notice and where you go next can remain open.',
                    )}
                </p>

                {paths.length > 0 ? (
                    <section className="mt-12" aria-labelledby="paths-heading">
                        <div className="flex items-center gap-4 border-b border-slate-200 pb-3 dark:border-white/10">
                            <Route className="size-5 text-cyan-600 dark:text-cyan-400" />
                            <h2
                                className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-400"
                                id="paths-heading"
                            >
                                {t('paths.available.title', 'Available routes')}
                            </h2>
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {paths.map((path) => (
                                <PathCard key={path.id} path={path} />
                            ))}
                        </div>
                    </section>
                ) : (
                    <section className="mt-12 border-y border-slate-200 py-10 dark:border-white/10">
                        <Compass className="size-7 text-cyan-600 dark:text-cyan-400" />
                        <h2 className="mt-5 text-sm font-semibold">
                            {t(
                                'paths.empty.title',
                                'No routes are available yet',
                            )}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {t(
                                'paths.empty.description',
                                'You can enter through a topic or open a map directly when a route is added.',
                            )}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
                            <Link
                                className="inline-flex items-center gap-2 text-violet-700 dark:text-violet-300"
                                href="/topics"
                            >
                                {t('paths.empty.topics', 'Browse topics')}
                                <ArrowRight className="size-4" />
                            </Link>
                            <Link
                                className="inline-flex items-center gap-2 text-cyan-700 dark:text-cyan-400"
                                href="/world"
                            >
                                {t('paths.empty.world', 'Open the map')}
                                <ArrowRight className="size-4" />
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

function PathCard({ path }: { path: LearningPath }) {
    const t = usePlatformTranslation();
    const isInProgress = path.progress?.status === 'in_progress';
    const wasExplored = path.progress?.status === 'completed';

    return (
        <article className="group flex min-h-56 flex-col border border-slate-200 bg-white/60 p-5 transition hover:border-violet-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-violet-400/50 dark:hover:bg-white/[0.05]">
            <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center border border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-300">
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
                            className="text-xs font-semibold tracking-[0.16em] text-violet-600 uppercase hover:text-violet-500 dark:text-violet-300"
                            href={path.topic.href}
                        >
                            {path.topic.title}
                        </Link>
                    ) : null}
                    <h3 className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {path.label}
                    </h3>
                    {path.learningIntent ? (
                        <p className="mt-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                            {learningIntentLabel(path.learningIntent, t)}
                        </p>
                    ) : null}
                    {path.learningAreas.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>Learning areas:</span>
                            {path.learningAreas.map((area) => (
                                <Link
                                    className="text-cyan-700 underline decoration-cyan-700/30 underline-offset-2 transition hover:text-cyan-950 dark:text-cyan-300 dark:hover:text-cyan-100"
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
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
                    </p>
                </div>
            </div>
            {path.description ? (
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {path.description}
                </p>
            ) : null}
            <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isInProgress ? (
                        <span className="font-medium text-cyan-700 dark:text-cyan-300">
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
                    className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"
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
