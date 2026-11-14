import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    Heart,
    LoaderCircle,
    Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import {
    backgroundStars,
    buildCompetenceStarLayout,
    competenceStarMapSize,
    shootingStars,
    type PositionedCompetenceTopic,
} from './original-competence-layout';
import { OriginalLearnerHeader } from './original-learner-header';
import { OriginalPaginatedItems } from './original-paginated-items';
import { usePlatformTranslation } from './original-platform-translation';

type CompetenceMap = components['schemas']['LearnerCompetenceMap'];
type CompetenceTopic = components['schemas']['LearnerCompetenceTopic'];
type TopicHeader = components['schemas']['LearnerTopicDetailHeader'];

const competenceStyle = {
    '--learner-accent': '#67e8f9',
    '--learner-action-accent': '#67e8f9',
    '--learner-border-color': 'rgba(165, 243, 252, 0.15)',
    '--learner-heading-text': '#f8fafc',
    '--learner-muted-text': '#cbd5e1',
    '--learner-panel-background': '#020617',
} as CSSProperties;

/**
 * Source-adapted from `pages/competence/index.tsx`. The read model remains
 * private to the learner. Historical controls open only through a
 * server-authorized opaque replay run, not a client-forged activity link.
 */
export function OriginalCompetencePage({
    isAuthenticationLoading,
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
    isAuthenticationLoading: boolean;
    isAuthenticated: boolean;
    onSignedOut: () => void;
    userEmail: string;
}) {
    const [competence, setCompetence] = useState<CompetenceMap | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
        'loading',
    );

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let current = true;
        void apiClient
            .GET('/learner/competence')
            .then(({ data, response }) => {
                if (!current) {
                    return;
                }

                if (response.ok && data) {
                    setCompetence(data);
                    setStatus('ready');
                    return;
                }

                setStatus('unavailable');
            })
            .catch(() => current && setStatus('unavailable'));

        return () => {
            current = false;
        };
    }, [isAuthenticated]);

    if (isAuthenticationLoading) {
        return <CompetenceStatus message="Loading competence map…" />;
    }

    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }

    if (status === 'unavailable') {
        return <CompetenceStatus message="The competence map is temporarily unavailable." />;
    }

    if (status === 'loading' || !competence) {
        return <CompetenceStatus message="Loading competence map…" />;
    }

    return (
        <CompetenceStarMap
            competenceMap={competence}
            onSignedOut={onSignedOut}
            userEmail={userEmail}
        />
    );
}

function CompetenceStatus({ message }: { message: string }) {
    return (
        <main className="grid min-h-svh place-items-center bg-black p-6 text-center text-white">
            <div>
                <LoaderCircle className="mx-auto size-5 animate-spin text-cyan-200" />
                <p className="mt-3 text-sm text-slate-300" role="alert">
                    {message}
                </p>
            </div>
        </main>
    );
}

function CompetenceStarMap({
    competenceMap,
    onSignedOut,
    userEmail,
}: {
    competenceMap: CompetenceMap;
    onSignedOut: () => void;
    userEmail: string;
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialTopicSlug = topicSlug(searchParams.get('topic'));
    const contextTopicSlug =
        topicSlug(searchParams.get('from')) ?? initialTopicSlug;
    const [hoveredTopicSlug, setHoveredTopicSlug] = useState<string | null>(
        null,
    );
    const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | null>(
        initialTopicSlug,
    );
    const [contextTopic, setContextTopic] = useState<TopicHeader | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<TopicHeader | null>(
        null,
    );
    const [openingActivitySlug, setOpeningActivitySlug] = useState<string | null>(
        null,
    );

    async function openHistoricalActivity(activitySlug: string): Promise<void> {
        if (openingActivitySlug !== null) {
            return;
        }

        setOpeningActivitySlug(activitySlug);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/activities/{activity_slug}/replay',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activitySlug },
                    },
                },
            );
            if (response.ok && data) {
                navigate(
                    `/learning/nodes/${encodeURIComponent(data.node_slug)}/play?run=${encodeURIComponent(data.play_run_id)}`,
                );
            }
        } catch {
            // Keep the source control available for a later retry.
        } finally {
            setOpeningActivitySlug(null);
        }
    }

    useEffect(() => {
        setSelectedTopicSlug(initialTopicSlug);
    }, [initialTopicSlug]);

    useEffect(() => {
        if (!contextTopicSlug) {
            setContextTopic(null);
            return;
        }

        let current = true;
        void apiClient
            .GET('/learner/topics/{topic_slug}/trail', {
                params: { path: { topic_slug: contextTopicSlug } },
            })
            .then(({ data, response }) => {
                if (current) {
                    setContextTopic(response.ok && data ? data.topic : null);
                }
            })
            .catch(() => current && setContextTopic(null));

        return () => {
            current = false;
        };
    }, [contextTopicSlug]);

    useEffect(() => {
        if (!initialTopicSlug) {
            setSelectedTopic(null);
            return;
        }

        let current = true;
        void apiClient
            .GET('/learner/topics/{topic_slug}/trail', {
                params: { path: { topic_slug: initialTopicSlug } },
            })
            .then(({ data, response }) => {
                if (current) {
                    setSelectedTopic(response.ok && data ? data.topic : null);
                }
            })
            .catch(() => current && setSelectedTopic(null));

        return () => {
            current = false;
        };
    }, [initialTopicSlug]);
    const positionedTopics = useMemo(
        () =>
            buildCompetenceStarLayout(
                competenceMap.topics.map((topic) => ({
                    name: topic.name,
                    slug: topic.slug,
                    visual: {
                        auraRatio: topic.visual.aura_ratio,
                        brightnessRatio: topic.visual.brightness_ratio,
                        sizeRatio: topic.visual.size_ratio,
                    },
                })),
                competenceMap.transitions.map((transition) => ({
                    count: transition.count,
                    fromTopicSlug: transition.from_topic_slug,
                    toTopicSlug: transition.to_topic_slug,
                })),
            ),
        [competenceMap.topics, competenceMap.transitions],
    );
    const topicsBySlug = useMemo(
        () => new Map(competenceMap.topics.map((topic) => [topic.slug, topic])),
        [competenceMap.topics],
    );
    const positionedBySlug = useMemo(
        () => new Map(positionedTopics.map((topic) => [topic.slug, topic])),
        [positionedTopics],
    );
    const activeTopicSlug = hoveredTopicSlug ?? selectedTopicSlug;
    const activeTopic = activeTopicSlug
        ? topicsBySlug.get(activeTopicSlug)
        : undefined;
    const activePosition = activeTopicSlug
        ? positionedBySlug.get(activeTopicSlug)
        : undefined;
    const selectedTopicNotFound =
        selectedTopicSlug !== null && !positionedBySlug.has(selectedTopicSlug);

    return (
        <main
            className="flex min-h-svh min-w-0 flex-col overflow-hidden bg-black text-white"
            data-wl-id="learner.competence.page"
            id="learner-main-content"
            style={competenceStyle}
            tabIndex={-1}
        >
            <OriginalLearnerHeader
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col px-4 py-6 pb-20">
                    <header className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                                <Sparkles className="size-5 text-cyan-200" />
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-200 uppercase">
                                    Competence
                                </p>
                            </div>
                            <h1 className="mt-2 text-3xl font-semibold">Star Map</h1>
                            {contextTopic ? (
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                    Viewing the learning trail around{' '}
                                    <Link
                                        className="font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
                                        to={`/topics/${encodeURIComponent(contextTopic.slug)}`}
                                    >
                                        {contextTopic.title}
                                    </Link>
                                    .
                                </p>
                            ) : null}
                        </div>
                        <Link
                            className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/15"
                            to={
                                contextTopic
                                    ? `/topics/${encodeURIComponent(contextTopic.slug)}`
                                    : '/home'
                            }
                        >
                            <ArrowLeft className="size-4" />
                            {contextTopic
                                ? `Back to ${contextTopic.title}`
                                : 'Learning desk'}
                        </Link>
                    </header>

                    <div className="mt-5 grid w-full gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <section className="relative min-h-[32rem] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl xl:h-full xl:min-h-0">
                            {positionedTopics.length === 0 ? (
                                <EmptyMap />
                            ) : (
                                <svg
                                    aria-label="Competence star map"
                                    className="competence-star-map h-full w-full"
                                    role="img"
                                    viewBox={`0 0 ${competenceStarMapSize.width} ${competenceStarMapSize.height}`}
                                >
                                    <StarMapStyle />
                                    <defs>
                                        <radialGradient id="competence-sky-vignette">
                                            <stop offset="0%" stopColor="#111827" stopOpacity="0.38" />
                                            <stop offset="55%" stopColor="#020617" stopOpacity="0.18" />
                                            <stop offset="100%" stopColor="#000000" stopOpacity="1" />
                                        </radialGradient>
                                        <filter height="200%" id="competence-star-glow" width="200%" x="-50%" y="-50%">
                                            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
                                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                        <filter height="260%" id="competence-star-bloom" width="260%" x="-80%" y="-80%">
                                            <feGaussianBlur in="SourceGraphic" result="soft" stdDeviation="7" />
                                            <feMerge><feMergeNode in="soft" /><feMergeNode in="SourceGraphic" /></feMerge>
                                        </filter>
                                    </defs>
                                    <rect
                                        fill="url(#competence-sky-vignette)"
                                        height={competenceStarMapSize.height}
                                        width={competenceStarMapSize.width}
                                    />
                                    {backgroundStars.map((star, index) => (
                                        <circle
                                            cx={star.x}
                                            cy={star.y}
                                            fill="#dbeafe"
                                            key={index}
                                            opacity={star.opacity}
                                            r={star.size}
                                            style={{
                                                animation: `competence-background-star ${3.4 + (index % 6) * 0.42}s ease-in-out infinite`,
                                                animationDelay: `${star.delay}s`,
                                            }}
                                        />
                                    ))}
                                    {shootingStars.map((star, index) => (
                                        <g
                                            key={index}
                                            opacity="0"
                                            style={{
                                                animation: `competence-shooting-star-opacity ${star.duration}s linear infinite`,
                                                animationDelay: `${star.delay}s`,
                                            }}
                                            transform={`translate(${star.x} ${star.y}) rotate(${star.angle})`}
                                        >
                                            <g style={{ '--shooting-star-distance': `${star.distance}px`, animation: `competence-shooting-star-travel ${star.duration}s linear infinite`, animationDelay: `${star.delay}s` } as CSSProperties}>
                                                <defs><linearGradient gradientUnits="userSpaceOnUse" id={`competence-shooting-star-tail-${index}`} x1={-star.length} x2="0" y1="0" y2="0"><stop offset="0%" stopColor="#bae6fd" stopOpacity="0" /><stop offset="35%" stopColor="#bfdbfe" stopOpacity="0.18" /><stop offset="72%" stopColor="#bfdbfe" stopOpacity="0.7" /><stop offset="100%" stopColor="#ffffff" stopOpacity="1" /></linearGradient></defs>
                                                <line stroke={`url(#competence-shooting-star-tail-${index})`} strokeLinecap="round" strokeOpacity={star.opacity * 0.48} strokeWidth="9" x1={-star.length} x2="0" y1="0" y2="0" />
                                                <line stroke={`url(#competence-shooting-star-tail-${index})`} strokeLinecap="round" strokeOpacity={star.opacity} strokeWidth="2.1" x1={-star.length * 0.92} x2="0" y1="0" y2="0" />
                                                <circle fill="#ffffff" r="2.2" />
                                                <circle fill="#93c5fd" opacity="0.26" r="7.5" />
                                            </g>
                                        </g>
                                    ))}
                                    <g>
                                        {competenceMap.transitions.map((transition) => {
                                            const from = positionedBySlug.get(transition.from_topic_slug);
                                            const to = positionedBySlug.get(transition.to_topic_slug);

                                            return from && to ? (
                                                <CompetencePath
                                                    from={from}
                                                    key={`${transition.from_topic_slug}:${transition.to_topic_slug}`}
                                                    to={to}
                                                    transition={transition}
                                                />
                                            ) : null;
                                        })}
                                    </g>
                                    <g>
                                        {positionedTopics.map((topic) => (
                                            <CompetenceStar
                                                active={activeTopicSlug === topic.slug}
                                                key={topic.slug}
                                                onActiveChange={setHoveredTopicSlug}
                                                onSelect={() =>
                                                    setSelectedTopicSlug((current) =>
                                                        current === topic.slug ? null : topic.slug,
                                                    )
                                                }
                                                selected={selectedTopicSlug === topic.slug}
                                                topic={topic}
                                                visual={topicsBySlug.get(topic.slug)?.visual}
                                            />
                                        ))}
                                    </g>
                                </svg>
                            )}
                            <CompetenceMapGuide
                                recentWindowDays={competenceMap.recent_window_days}
                            />
                            {activeTopic && activePosition ? (
                                <CompetenceReading
                                    checkIns={competenceMap.check_ins}
                                    onOpenActivity={openHistoricalActivity}
                                    onClose={() => {
                                        setHoveredTopicSlug(null);
                                        setSelectedTopicSlug(null);
                                    }}
                                    topic={activeTopic}
                                    position={activePosition}
                                    openingActivitySlug={openingActivitySlug}
                                />
                            ) : selectedTopicNotFound ? (
                                <UnseenCompetenceReading
                                    onClose={() => {
                                        setHoveredTopicSlug(null);
                                        setSelectedTopicSlug(null);
                                    }}
                                    topicHref={
                                        selectedTopic
                                            ? `/topics/${encodeURIComponent(selectedTopic.slug)}`
                                            : '/topics'
                                    }
                                    topicLinkLabel={
                                        selectedTopic ? 'Open topic' : 'Browse topics'
                                    }
                                    topicTitle={
                                        selectedTopic?.title ??
                                        topicLabel(selectedTopicSlug)
                                    }
                                />
                            ) : null}
                        </section>
                        <LearningPulseTimeline
                            checkIns={competenceMap.check_ins}
                            onOpenActivity={openHistoricalActivity}
                            reviewAttempts={competenceMap.review_attempts}
                            onTopicSelect={(slug) => {
                                setHoveredTopicSlug(null);
                                setSelectedTopicSlug(slug);
                            }}
                            openingActivitySlug={openingActivitySlug}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}

function StarMapStyle() {
    return (
        <style>{`
            @keyframes competence-flow { to { stroke-dashoffset: -72; } }
            @keyframes competence-twinkle { from { opacity: .68; transform: scale(.92); } to { opacity: 1; transform: scale(1.16); } }
            @keyframes competence-halo { from { opacity: .2; transform: scale(.94); } to { opacity: .68; transform: scale(1.1); } }
            @keyframes competence-flare-sway { from { transform: rotate(-15deg); } to { transform: rotate(15deg); } }
            @keyframes competence-spark { from { opacity: .18; transform: scale(.74); } to { opacity: .92; transform: scale(1.24); } }
            @keyframes competence-background-star { 50% { opacity: .9; } }
            @keyframes competence-shooting-star-opacity { 0%, 48%, 76%, 100% { opacity: 0; } 52% { opacity: .84; } 62% { opacity: .5; } 72% { opacity: .08; } }
            @keyframes competence-shooting-star-travel { 0%, 48% { transform: translateX(0); } 76%, 100% { transform: translateX(var(--shooting-star-distance)); } }
            @media (prefers-reduced-motion: reduce) { .competence-star-map * { animation: none !important; } }
        `}</style>
    );
}

function EmptyMap() {
    const t = usePlatformTranslation();

    return (
        <div className="grid h-full place-items-center p-6 text-center">
            <div>
                <Sparkles className="mx-auto size-12 text-cyan-200" />
                <h2 className="mt-4 text-3xl font-semibold">No stars yet</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                    Complete route-play activities with configured competence topics and this map will begin reflecting your learning trail.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
                    <Link className="inline-flex items-center gap-2 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 font-medium text-cyan-100 transition hover:border-cyan-100/60 hover:bg-cyan-100/20" to="/topics">
                        {t('competence.empty.browse_topics', 'Browse topics')}
                        <ArrowRight className="size-4" />
                    </Link>
                    <Link className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 font-medium text-slate-200 transition hover:border-white/35 hover:bg-white/10" to="/home">
                        Learning desk
                    </Link>
                </div>
            </div>
        </div>
    );
}

function CompetenceMapGuide({ recentWindowDays }: { recentWindowDays: number }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="absolute top-4 right-4 z-10 flex w-[min(36rem,calc(100%-2rem))] flex-col items-end text-slate-100">
            <button aria-controls="competence-map-guide" aria-expanded={isOpen} className="inline-flex items-center gap-2 rounded-md border border-cyan-200/20 bg-slate-950/85 px-3 py-2 text-xs font-semibold tracking-[0.14em] text-cyan-100 uppercase shadow-xl backdrop-blur hover:bg-slate-900" onClick={() => setIsOpen((open) => !open)} type="button">
                How to read this map <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className="mt-2 grid max-h-[calc(100%-4.5rem)] w-full gap-3 overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/95 px-3 py-3 text-xs leading-5 text-slate-300 shadow-xl backdrop-blur" hidden={!isOpen} id="competence-map-guide">
                <p>Each light represents a competence area you have explored. The map keeps long-term development distinct from recent activity.</p>
                <dl className="grid gap-2">
                    <GuideTerm term="Size">How established the learning pattern is over time.</GuideTerm>
                    <GuideTerm term="Glow">How much learning activity was recorded during the last {recentWindowDays} days.</GuideTerm>
                    <GuideTerm term="Halo">A softer sense of recent presence, so a newly revisited area can be noticed.</GuideTerm>
                    <GuideTerm term="Paths">Topics you encountered together in a route.</GuideTerm>
                </dl>
                <p className="text-slate-400">Recent learning moments inform each light.</p>
            </div>
        </div>
    );
}

function GuideTerm({ children, term }: { children: ReactNode; term: string }) {
    return <div><dt className="font-medium text-slate-100">{term}</dt><dd>{children}</dd></div>;
}

function LearningPulseTimeline({
    checkIns,
    onOpenActivity,
    openingActivitySlug,
    reviewAttempts,
    onTopicSelect,
}: {
    checkIns: CompetenceMap['check_ins'];
    onOpenActivity: (activitySlug: string) => Promise<void>;
    openingActivitySlug: string | null;
    reviewAttempts: CompetenceMap['review_attempts'];
    onTopicSelect: (slug: string) => void;
}) {
    return (
        <aside className="rounded-2xl border border-cyan-200/15 bg-slate-950/80 p-5 shadow-2xl xl:h-full xl:min-h-0 xl:overflow-y-auto">
            <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-200/10 text-cyan-200"><Heart className="size-4" /></span><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">Your learning pulse</p><h2 className="mt-1 text-sm font-semibold text-white">Moments along the way</h2></div></div>
            <p className="mt-3 text-sm leading-6 text-slate-300">Your notes about how the activities felt, kept alongside your learning trail.</p>
            {checkIns.length ? <ol className="mt-5 grid gap-4">{checkIns.map((checkIn) => <li className="relative border-l border-cyan-200/25 pl-4" key={`${checkIn.activity_slug}:${checkIn.recorded_at}`}><span className="absolute top-1.5 -left-[0.3rem] size-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.8)]" /><time className="text-xs text-slate-500" dateTime={checkIn.recorded_at}>{formatDate(checkIn.recorded_at)}</time><p className="mt-1 text-sm font-medium text-slate-100">{checkInFeelingLabel(checkIn.feeling)}</p><p className="mt-1 text-xs leading-5 text-slate-400">{checkIn.activity_title} · {checkIn.node_title}</p>{checkIn.note ? <p className="mt-2 text-sm leading-5 text-slate-300">{checkIn.note}</p> : null}{checkIn.next_direction ? <p className="mt-2 text-xs text-cyan-200/80">Next direction: {directionLabel(checkIn.next_direction)}</p> : null}<button className="mt-2 inline-flex text-xs font-medium text-cyan-200 transition hover:text-white disabled:opacity-50" disabled={openingActivitySlug !== null} onClick={() => void onOpenActivity(checkIn.activity_slug)} type="button">Revisit this activity</button>{checkIn.topics.length ? <div className="mt-2 flex flex-wrap gap-1.5">{checkIn.topics.map((topic) => <button className="rounded-full border border-cyan-200/15 bg-cyan-200/5 px-2 py-0.5 text-left text-xs text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/15" key={topic.slug} onClick={() => onTopicSelect(topic.slug)} type="button">{topic.name}</button>)}</div> : null}</li>)}</ol> : <p className="mt-5 rounded-lg border border-dashed border-cyan-200/20 px-3 py-4 text-sm leading-6 text-slate-400">After an activity, you can leave a small note here for your future self.</p>}
            {reviewAttempts.length ? <section className="mt-6 border-t border-cyan-200/10 pt-5"><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">Review history</p><h2 className="mt-1 text-sm font-semibold text-white">Returns you chose to make</h2><p className="mt-2 text-sm leading-6 text-slate-400">A bounded record of revisits, kept separate from the learning pulse and any private journal writing.</p><OriginalPaginatedItems className="mt-4 grid gap-3" items={reviewAttempts} pageSize={2} paginationLabel="Review history" paginationButtonClassName="inline-flex items-center gap-1 text-xs text-cyan-200 transition hover:text-white disabled:pointer-events-none disabled:opacity-40" paginationClassName="mt-3 flex items-center justify-between border-t border-cyan-200/15 pt-3" paginationTextClassName="text-xs text-slate-500" renderItem={(attempt) => <button className="w-full rounded-lg border border-cyan-200/10 bg-cyan-200/5 p-3 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/10 disabled:opacity-50" disabled={openingActivitySlug !== null} key={`${attempt.activity_slug}:${attempt.attempted_at}`} onClick={() => void onOpenActivity(attempt.activity_slug)} type="button"><div className="flex items-start justify-between gap-3"><span><span className="block text-sm font-medium text-slate-100">{attempt.activity_title}</span><span className="mt-1 block text-xs text-slate-400">{attempt.node_title}{attempt.outcome ? ` · ${outcomeLabel(attempt.outcome)}` : ''}</span></span><time className="shrink-0 text-xs text-slate-500" dateTime={attempt.attempted_at}>{formatDate(attempt.attempted_at)}</time></div><span className="mt-2 block text-xs text-cyan-100/75">{attempt.confidence ? `Before guidance: ${confidenceLabel(attempt.confidence)}` : 'Review completed'}{attempt.confidence_after_feedback ? ` · After guidance: ${confidenceLabel(attempt.confidence_after_feedback)}` : ''}{attempt.observed_cues.length ? ` · Noticed: ${attempt.observed_cues.join(', ')}` : ''}{attempt.attempt_number > 1 ? ` · attempt ${attempt.attempt_number}` : ''}</span></button>} /></section> : null}
        </aside>
    );
}

function CompetencePath({ from, to, transition }: { from: PositionedCompetenceTopic; to: PositionedCompetenceTopic; transition: CompetenceMap['transitions'][number] }) {
    const strength = Math.min(1, transition.count / 20);
    const continuous = transition.count >= 20;

    return (
        <g>
            <line
                stroke="#67e8f9"
                strokeDasharray={continuous ? undefined : '18 18'}
                strokeLinecap="round"
                strokeOpacity={0.24 + strength * 0.68}
                strokeWidth={1.5 + strength * 5}
                style={continuous ? undefined : { animation: `competence-flow ${Math.max(0.8, 5 - transition.count * 0.18)}s linear infinite` }}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
            />
            <title>{transition.from_topic_name} and {transition.to_topic_name} are connected by learning encounters.</title>
        </g>
    );
}

function CompetenceStar({ active, onActiveChange, onSelect, selected, topic, visual }: { active: boolean; onActiveChange: (slug: string | null) => void; onSelect: () => void; selected: boolean; topic: PositionedCompetenceTopic; visual: CompetenceTopic['visual'] | undefined }) {
    const flareLength = topic.size * (2.8 + topic.brightness * 2.4);
    const flareWidth = Math.max(0.45, topic.size * 0.1);
    const diagonalFlareLength = flareLength * 0.46;
    const coreRadius = Math.max(1.6, topic.size * 0.26);

    return (
        <g aria-label={`${topic.name}: ${visual?.description ?? ''}`} aria-pressed={selected} className="group cursor-pointer outline-none" onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }} onPointerEnter={() => onActiveChange(topic.slug)} onPointerLeave={() => onActiveChange(null)} role="button" tabIndex={0} transform={`translate(${topic.x} ${topic.y})`}>
            <title>{topic.name}: {visual?.description}</title>
            <circle aria-hidden="true" className="fill-transparent stroke-transparent stroke-2 transition group-focus-visible:stroke-cyan-100" r={Math.max(topic.auraRadius + 8, topic.size + 12)} />
            <circle fill={topic.color} opacity={topic.aura} r={topic.auraRadius} style={{ animation: `competence-halo ${topic.twinkleDuration + 1.2}s cubic-bezier(0.45,0,0.55,1) infinite alternate`, animationDelay: `${topic.twinkleDelay}s`, transformBox: 'fill-box', transformOrigin: 'center' }} />
            <circle fill={topic.color} filter="url(#competence-star-bloom)" opacity={topic.brightness * 0.28} r={topic.size * 1.9} />
            <g filter="url(#competence-star-glow)" style={{ animation: `competence-twinkle ${topic.twinkleDuration}s cubic-bezier(0.45,0,0.55,1) infinite alternate`, animationDelay: `${topic.twinkleDelay}s`, transformBox: 'fill-box', transformOrigin: 'center' }}>
                <g transform={`rotate(${topic.flareAngle})`}>
                    <g style={{ animation: `competence-flare-sway ${topic.twinkleDuration + 1.4}s cubic-bezier(0.45,0,0.55,1) infinite alternate`, animationDelay: `${topic.twinkleDelay * 0.7}s`, transformBox: 'fill-box', transformOrigin: 'center' }}>
                        <line stroke="#ffffff" strokeLinecap="round" strokeOpacity={topic.brightness * 0.76} strokeWidth={flareWidth} x1={-flareLength} x2={flareLength} y1="0" y2="0" />
                        <line stroke="#bae6fd" strokeLinecap="round" strokeOpacity={topic.brightness * 0.62} strokeWidth={flareWidth * 0.78} x1="0" x2="0" y1={-flareLength} y2={flareLength} />
                        <line stroke="#f5d0fe" strokeLinecap="round" strokeOpacity={topic.brightness * 0.32} strokeWidth={flareWidth * 0.58} x1={-diagonalFlareLength} x2={diagonalFlareLength} y1={-diagonalFlareLength} y2={diagonalFlareLength} />
                        <line stroke="#93c5fd" strokeLinecap="round" strokeOpacity={topic.brightness * 0.26} strokeWidth={flareWidth * 0.5} x1={-diagonalFlareLength} x2={diagonalFlareLength} y1={diagonalFlareLength} y2={-diagonalFlareLength} />
                    </g>
                </g>
                <circle fill="#fff7ed" opacity={0.62 + topic.brightness * 0.38} r={topic.size * 0.62} />
                <circle fill="#ffffff" opacity={0.82 + topic.brightness * 0.18} r={coreRadius} />
                {topic.sparklePoints.map((sparkle, index) => <circle cx={sparkle.x} cy={sparkle.y} fill={index % 2 === 0 ? '#e0f2fe' : '#f5d0fe'} key={index} opacity={sparkle.opacity} r={sparkle.size} style={{ animation: `competence-spark ${topic.twinkleDuration + sparkle.radius * 0.08}s cubic-bezier(0.45,0,0.55,1) infinite alternate`, animationDelay: `${topic.twinkleDelay + sparkle.delay}s`, transformBox: 'fill-box', transformOrigin: 'center' }} />)}
            </g>
            {(topic.labelVisible || active) ? <g opacity="0.92" pointerEvents="none" transform={`translate(${-topic.x} ${-topic.y})`}><text fill="#f8fafc" fontSize="13" fontWeight="700" textAnchor="middle" x={topic.labelX} y={topic.labelY}>{topic.name}</text>{topic.clusterHiddenCount > 0 ? <text fill="#ccfbf1" fontSize="10" fontWeight="800" opacity="0.82" textAnchor="start" x={topic.labelX + topic.labelWidth / 2 + 8} y={topic.labelY}>+{topic.clusterHiddenCount}</text> : null}</g> : null}
        </g>
    );
}

function CompetenceReading({ checkIns, onClose, onOpenActivity, openingActivitySlug, position, topic }: { checkIns: CompetenceMap['check_ins']; onClose: () => void; onOpenActivity: (activitySlug: string) => Promise<void>; openingActivitySlug: string | null; position: PositionedCompetenceTopic; topic: CompetenceTopic }) {
    const relatedCheckIns = checkIns.filter((checkIn) => checkIn.topics.some((relatedTopic) => relatedTopic.slug === topic.slug)).slice(0, 3);

    return (
        <aside aria-live="polite" className="absolute bottom-4 left-4 max-h-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-slate-100 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">Reading this light</p><h2 className="mt-1 text-sm font-semibold">{topic.name}</h2></div><button aria-label="Close competence reading" className="rounded-md px-2 py-1 text-sm leading-none text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={onClose} type="button">×</button></div>
            <p className="mt-2 text-sm leading-5 text-slate-300">{topic.visual.description}</p>
            {topic.related_topic ? <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2"><p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">Topic context</p><p className="mt-1 text-xs leading-5 text-slate-300">{topic.related_topic.title}</p><Link className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-white" to={`/topics/${encodeURIComponent(topic.related_topic.slug)}`}>Open topic <ArrowRight className="size-3.5" /></Link></div> : null}
            <div className="mt-3 rounded-lg border border-cyan-200/10 bg-cyan-200/5 px-3 py-2"><p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">Recent rhythm</p><p className="mt-1 text-xs leading-5 text-slate-300">{topic.visual.recent_description}</p></div>
            <div className="mt-3"><p className="text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">Learning trail</p><div className="mt-2 flex flex-wrap gap-1.5">{topic.visual.learning_periods.map((period) => <span className="rounded-full border border-cyan-200/15 bg-cyan-200/5 px-2 py-1 text-xs text-cyan-100" key={period}>{period}</span>)}</div><p className="mt-2 text-xs leading-5 text-slate-400">Each marker is a month in which this area appeared in your learning trail.</p></div>
            {relatedCheckIns.length ? <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2"><p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">Your notes about this light</p><div className="mt-2 grid gap-2">{relatedCheckIns.map((checkIn) => <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2" key={`${checkIn.activity_slug}:${checkIn.recorded_at}`}><p className="text-xs font-medium text-slate-200">{checkInFeelingLabel(checkIn.feeling)}</p><p className="mt-1 text-xs leading-5 text-slate-400">{checkIn.activity_title} · {formatDate(checkIn.recorded_at)}</p>{checkIn.note ? <p className="mt-2 text-xs leading-5 text-slate-300">{checkIn.note}</p> : null}</div>)}</div></div> : null}
            {topic.revisit ? <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2"><p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">Return if you want to</p><p className="mt-1 text-xs leading-5 text-slate-300">{topic.revisit.activity_title} · {topic.revisit.node_title}</p><button className="mt-2 inline-flex text-xs font-medium text-cyan-200 transition hover:text-white disabled:opacity-50" disabled={openingActivitySlug !== null} onClick={() => void onOpenActivity(topic.revisit!.activity_slug)} type="button">Revisit this activity</button></div> : null}
            <p className="mt-3 text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">Learning moments represented here</p>
            <div className="mt-2 grid gap-2">{topic.visual.evidence_types.length ? topic.visual.evidence_types.map((type) => <div className="flex items-start gap-2 text-xs leading-5" key={type}><span className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-cyan-100">{evidenceTypeLabel(type)}</span><span className="pt-1 text-slate-400">{evidenceTypeDescription(type)}</span></div>) : <span className="text-sm text-slate-400">Learning moments will appear here as you work with this area.</span>}</div>
            {topic.visual.evidence_ledger.length ? <details className="mt-4 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2"><summary className="cursor-pointer text-xs font-medium tracking-[0.14em] text-cyan-100/80 uppercase">Evidence ledger</summary><p className="mt-2 text-xs leading-5 text-slate-400">Recent learning moments informing this light.</p><OriginalPaginatedItems className="mt-3 grid gap-2" items={topic.visual.evidence_ledger} pageSize={3} paginationLabel="Evidence ledger" paginationButtonClassName="inline-flex items-center gap-1 text-xs text-cyan-200 transition hover:text-white disabled:pointer-events-none disabled:opacity-40" paginationClassName="mt-3 flex items-center justify-between border-t border-cyan-200/15 pt-3" paginationTextClassName="text-xs text-slate-500" renderItem={(evidence) => <EvidenceEntry evidence={evidence} key={evidence.id} />} /></details> : null}
            <span className="sr-only">Visual star size: {Math.round(position.size)}</span>
        </aside>
    );
}

function EvidenceEntry({ evidence }: { evidence: CompetenceTopic['visual']['evidence_ledger'][number] }) {
    return <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"><div className="flex items-start justify-between gap-3"><span><span className="block text-xs font-medium text-slate-200">{evidence.activity_title}</span><span className="mt-1 block text-xs text-slate-400">{evidenceTypeLabel(evidence.evidence_type)}{evidence.node_title ? ` · ${evidence.node_title}` : ''}</span><span className="mt-1 block text-xs text-cyan-100/80">{evidenceClaimLabel(evidence.evidence_claim)}</span>{evidence.objective ? <span className="mt-1 block text-xs text-cyan-100/70">Objective: {evidence.objective}</span> : null}{evidence.concepts.length ? <span className="mt-1 block text-xs text-cyan-100/70">Concepts: {evidence.concepts.join(' · ')}</span> : null}{evidence.observed_cues.length ? <span className="mt-1 block text-xs text-cyan-100/70">Noticed: {evidence.observed_cues.join(' · ')}</span> : null}{evidence.confidence ? <span className="mt-1 block text-xs text-slate-500">Before: {confidenceLabel(evidence.confidence)}</span> : null}</span><time className="shrink-0 text-xs text-slate-500" dateTime={evidence.recorded_at}>{formatDate(evidence.recorded_at)}</time></div>{evidence.sources.length ? <div className="mt-2 border-t border-cyan-200/10 pt-2 text-xs text-slate-500">Sources: {evidence.sources.map((source, index) => <span key={`${source.url}:${index}`}>{index ? ', ' : ''}<a className="text-cyan-200 underline decoration-cyan-200/30 underline-offset-2 transition hover:text-white" href={source.url} rel="noreferrer" target="_blank">{source.title}</a></span>)}</div> : null}</div>;
}

function UnseenCompetenceReading({
    onClose,
    topicHref,
    topicLinkLabel,
    topicTitle,
}: {
    onClose: () => void;
    topicHref: string;
    topicLinkLabel: string;
    topicTitle: string;
}) {
    return (
        <aside aria-live="polite" className="absolute bottom-4 left-4 max-h-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-slate-100 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">Not on your map yet</p>
                    <h2 className="mt-1 text-sm font-semibold">{topicTitle}</h2>
                </div>
                <button aria-label="Close competence reading" className="rounded-md px-2 py-1 text-sm leading-none text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={onClose} type="button">×</button>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">There is no learning moment for this area on your trail yet. Explore an activity connected to it, and this map can begin reflecting what you notice over time.</p>
            <div className="mt-3"><Link className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-white" to={topicHref}>{topicLinkLabel}<ArrowRight className="size-3.5" /></Link></div>
        </aside>
    );
}

function topicSlug(value: string | null): string | null {
    return value && /^[a-z0-9-]{1,80}$/.test(value) ? value : null;
}

function topicLabel(slug: string): string {
    return slug
        .replaceAll('-', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function checkInFeelingLabel(feeling: string | null): string { return ({ clearer: 'Something clicked', forming: 'Still taking shape', stretched: 'It stretched me', stuck: 'I got stuck' }[feeling ?? ''] ?? 'A reflection'); }
function directionLabel(direction: string): string { return ({ revisit: 'Return to this later', related: 'Follow a related direction', settle: 'Let this settle' }[direction] ?? direction); }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function confidenceLabel(confidence: string): string { return ({ exploring: 'exploring', leaning: 'I have a hunch', settled: 'settled' }[confidence] ?? confidence); }
function outcomeLabel(outcome: string): string { return ({ completed: 'Completed', correct: 'Correct', incorrect: 'Not correct', clearer: 'Clearer', connected: 'Connected', open: 'Still open' }[outcome] ?? outcome); }
function evidenceTypeLabel(type: string): string { return ({ apply: 'applying', explain: 'explaining', participate: 'participating', reflect: 'reflecting', retrieve: 'retrieving', review: 'reviewing', transfer: 'transferring' }[type] ?? type); }
function evidenceClaimLabel(claim: string): string { return ({ application_attempt: 'An application attempt was recorded.', explanation_attempt: 'An explanation attempt was recorded.', independent_explanation_attempt: 'A fresh independent explanation attempt was recorded.', independent_recall: 'Successful independent recall recorded.', learning_encounter: 'A learning encounter was recorded.', participation: 'Participation was recorded.', reflection: 'A reflection was recorded.', retrieval_attempt: 'A recall attempt was recorded.', review: 'A review was recorded.', transfer_attempt: 'A transfer attempt was recorded.', independent_transfer_attempt: 'A fresh independent transfer attempt was recorded.' }[claim] ?? 'A learning encounter was recorded.'); }
function evidenceTypeDescription(type: string): string { return ({ apply: 'using an idea in a situation', explain: 'putting an idea into your own words', participate: 'taking part in a learning activity', reflect: 'noticing understanding, uncertainty or connections', retrieve: 'bringing an idea back from memory', review: 'returning to earlier material and noticing what changed', transfer: 'using an idea in a new context' }[type] ?? 'engaging with this learning area'); }
