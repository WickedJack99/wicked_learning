import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ChevronDown,
    Heart,
    Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AccentHeading } from '@/components/accent-heading';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { Button } from '@/components/ui/button';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { learningCheckInDirectionLabel } from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import {
    backgroundStars,
    buildCompetenceStarLayout,
    competenceStarMapSize,
    shootingStars,
} from './competence-star-layout';
import type {
    CompetenceMap,
    CompetenceCheckIn,
    CompetenceReviewAttempt,
    CompetenceTransition,
    PositionedTopic,
} from './competence-star-layout';

export default function CompetenceStarMap({
    competenceMap,
    selectedTopicSlug: initialTopicSlug,
    selectedTopic,
}: {
    competenceMap: CompetenceMap;
    selectedTopic?: {
        href: string;
        title: string;
    } | null;
    selectedTopicSlug?: string | null;
}) {
    const translate = usePlatformTranslation();
    const [hoveredTopicSlug, setHoveredTopicSlug] = useState<string | null>(
        null,
    );
    const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | null>(
        initialTopicSlug ?? null,
    );
    const positionedTopics = useMemo(
        () =>
            buildCompetenceStarLayout(
                competenceMap.topics,
                competenceMap.transitions,
            ),
        [competenceMap.topics, competenceMap.transitions],
    );
    const topicBySlug = new Map(
        positionedTopics.map((topic) => [topic.slug, topic]),
    );
    const activeTopicSlug = hoveredTopicSlug ?? selectedTopicSlug;
    const activeTopic = activeTopicSlug
        ? topicBySlug.get(activeTopicSlug)
        : undefined;
    const selectedTopicNotFound =
        selectedTopicSlug !== null && !topicBySlug.has(selectedTopicSlug);

    return (
        <>
            <Head title="Competence Star Map" />
            <main
                id="learner-main-content"
                tabIndex={-1}
                className="flex min-h-svh flex-col overflow-y-auto bg-black text-white focus:outline-none xl:h-svh xl:min-h-0 xl:overflow-hidden"
            >
                <LearningDeskHeader />
                <div className="flex min-h-0 flex-1 flex-col px-4 py-6 pb-14">
                    <AccentHeading
                        className="shrink-0"
                        action={
                            <div className="flex flex-wrap items-center gap-2">
                                <Button asChild variant="secondary">
                                    <Link href={selectedTopic?.href ?? '/home'}>
                                        <ArrowLeft className="size-4" />
                                        {selectedTopic
                                            ? `Back to ${selectedTopic.title}`
                                            : translate(
                                                  'competence.navigation.back_to_desk',
                                                  'Learning desk',
                                              )}
                                    </Link>
                                </Button>
                            </div>
                        }
                        accentColor="var(--map-floating-accent-color)"
                        description={
                            selectedTopic ? (
                                <>
                                    Viewing the learning trail around{' '}
                                    <Link
                                        className="font-medium text-cyan-300 underline decoration-cyan-300/40 underline-offset-4 transition hover:text-cyan-100"
                                        href={selectedTopic.href}
                                    >
                                        {selectedTopic.title}
                                    </Link>
                                    .
                                </>
                            ) : undefined
                        }
                        eyebrow="Competence"
                        icon={<Sparkles className="size-5" />}
                        title="Star Map"
                    />

                    <div className="mt-5 grid w-full gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <section className="relative min-h-[32rem] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl xl:h-full xl:min-h-0">
                            {positionedTopics.length === 0 ? (
                                <div className="grid h-full place-items-center p-6 text-center">
                                    <div>
                                        <Sparkles className="mx-auto size-12 text-cyan-200" />
                                        <h2 className="mt-4 text-3xl font-semibold">
                                            No stars yet
                                        </h2>
                                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                                            Complete route-play activities with
                                            configured competence topics and
                                            this map will begin reflecting your
                                            learning trail.
                                        </p>
                                        <div className="mt-5 flex flex-wrap justify-center gap-3 text-sm">
                                            <Link
                                                className="inline-flex items-center gap-2 rounded-md border border-cyan-200/30 bg-cyan-200/10 px-3 py-2 font-medium text-cyan-100 transition hover:border-cyan-100/60 hover:bg-cyan-100/20"
                                                href="/topics"
                                            >
                                                {translate(
                                                    'competence.empty.browse_topics',
                                                    'Browse topics',
                                                )}
                                                <ArrowRight className="size-4" />
                                            </Link>
                                            <Link
                                                className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 font-medium text-slate-200 transition hover:border-white/35 hover:bg-white/10"
                                                href="/home"
                                            >
                                                Learning desk
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <svg
                                    aria-label="Competence star map"
                                    className="competence-star-map h-full w-full"
                                    role="img"
                                    viewBox={`0 0 ${competenceStarMapSize.width} ${competenceStarMapSize.height}`}
                                >
                                    <style>{`
                                    @keyframes competence-flow {
                                        to { stroke-dashoffset: -72; }
                                    }
                                    @keyframes competence-twinkle {
                                        from {
                                            opacity: 0.68;
                                            transform: scale(0.92);
                                        }
                                        to {
                                            opacity: 1;
                                            transform: scale(1.16);
                                        }
                                    }
                                    @keyframes competence-halo {
                                        from {
                                            opacity: 0.2;
                                            transform: scale(0.94);
                                        }
                                        to {
                                            opacity: 0.68;
                                            transform: scale(1.1);
                                        }
                                    }
                                    @keyframes competence-flare-sway {
                                        from {
                                            transform: rotate(-15deg);
                                        }
                                        to {
                                            transform: rotate(15deg);
                                        }
                                    }
                                    @keyframes competence-spark {
                                        from {
                                            opacity: 0.18;
                                            transform: scale(0.74);
                                        }
                                        to {
                                            opacity: 0.92;
                                            transform: scale(1.24);
                                        }
                                    }
                                    @keyframes competence-background-star {
                                        0%, 100% { opacity: 0.22; }
                                        45% { opacity: 0.74; }
                                    }
                                    @keyframes competence-shooting-star-opacity {
                                        0%, 48%, 76%, 100% { opacity: 0; }
                                        52% { opacity: 0.84; }
                                        62% { opacity: 0.5; }
                                        72% { opacity: 0.08; }
                                    }
                                    @keyframes competence-shooting-star-travel {
                                        0%, 48% { transform: translateX(0); }
                                        76%, 100% { transform: translateX(var(--shooting-star-distance)); }
                                    }
                                    @media (prefers-reduced-motion: reduce) {
                                        .competence-star-map * {
                                            animation: none !important;
                                        }
                                    }
                                `}</style>
                                    <defs>
                                        <radialGradient id="competence-sky-vignette">
                                            <stop
                                                offset="0%"
                                                stopColor="#111827"
                                                stopOpacity="0.38"
                                            />
                                            <stop
                                                offset="55%"
                                                stopColor="#020617"
                                                stopOpacity="0.18"
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor="#000000"
                                                stopOpacity="1"
                                            />
                                        </radialGradient>
                                        <filter
                                            height="200%"
                                            id="competence-star-glow"
                                            width="200%"
                                            x="-50%"
                                            y="-50%"
                                        >
                                            <feGaussianBlur
                                                in="SourceGraphic"
                                                result="blur"
                                                stdDeviation="3"
                                            />
                                            <feMerge>
                                                <feMergeNode in="blur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                        <filter
                                            height="260%"
                                            id="competence-star-bloom"
                                            width="260%"
                                            x="-80%"
                                            y="-80%"
                                        >
                                            <feGaussianBlur
                                                in="SourceGraphic"
                                                result="soft"
                                                stdDeviation="7"
                                            />
                                            <feMerge>
                                                <feMergeNode in="soft" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <rect
                                        fill="url(#competence-sky-vignette)"
                                        height={competenceStarMapSize.height}
                                        width={competenceStarMapSize.width}
                                        x="0"
                                        y="0"
                                    />
                                    <g aria-hidden="true">
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
                                    </g>
                                    <g aria-hidden="true">
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
                                                <g
                                                    style={
                                                        {
                                                            '--shooting-star-distance': `${star.distance}px`,
                                                            animation: `competence-shooting-star-travel ${star.duration}s linear infinite`,
                                                            animationDelay: `${star.delay}s`,
                                                        } as CSSProperties &
                                                            Record<
                                                                '--shooting-star-distance',
                                                                string
                                                            >
                                                    }
                                                >
                                                    <defs>
                                                        <linearGradient
                                                            gradientUnits="userSpaceOnUse"
                                                            id={`competence-shooting-star-tail-${index}`}
                                                            x1={-star.length}
                                                            x2="0"
                                                            y1="0"
                                                            y2="0"
                                                        >
                                                            <stop
                                                                offset="0%"
                                                                stopColor="#bae6fd"
                                                                stopOpacity="0"
                                                            />
                                                            <stop
                                                                offset="35%"
                                                                stopColor="#bfdbfe"
                                                                stopOpacity="0.18"
                                                            />
                                                            <stop
                                                                offset="72%"
                                                                stopColor="#bfdbfe"
                                                                stopOpacity="0.7"
                                                            />
                                                            <stop
                                                                offset="100%"
                                                                stopColor="#ffffff"
                                                                stopOpacity="1"
                                                            />
                                                        </linearGradient>
                                                    </defs>
                                                    <line
                                                        stroke={`url(#competence-shooting-star-tail-${index})`}
                                                        strokeLinecap="round"
                                                        strokeOpacity={
                                                            star.opacity * 0.48
                                                        }
                                                        strokeWidth="9"
                                                        x1={-star.length}
                                                        x2="0"
                                                        y1="0"
                                                        y2="0"
                                                    />
                                                    <line
                                                        stroke={`url(#competence-shooting-star-tail-${index})`}
                                                        strokeLinecap="round"
                                                        strokeOpacity={
                                                            star.opacity
                                                        }
                                                        strokeWidth="2.1"
                                                        x1={-star.length * 0.92}
                                                        x2="0"
                                                        y1="0"
                                                        y2="0"
                                                    />
                                                    <circle
                                                        fill="#ffffff"
                                                        r="2.2"
                                                    />
                                                    <circle
                                                        fill="#93c5fd"
                                                        opacity="0.26"
                                                        r="7.5"
                                                    />
                                                </g>
                                            </g>
                                        ))}
                                    </g>
                                    <g>
                                        {competenceMap.transitions.map(
                                            (transition) => {
                                                const from = topicBySlug.get(
                                                    transition.fromTopicSlug,
                                                );
                                                const to = topicBySlug.get(
                                                    transition.toTopicSlug,
                                                );

                                                if (!from || !to) {
                                                    return null;
                                                }

                                                return (
                                                    <CompetencePath
                                                        from={from}
                                                        key={`${transition.fromTopicSlug}:${transition.toTopicSlug}`}
                                                        to={to}
                                                        transition={transition}
                                                    />
                                                );
                                            },
                                        )}
                                    </g>
                                    <g>
                                        {positionedTopics.map((topic) => (
                                            <CompetenceStar
                                                active={
                                                    activeTopicSlug ===
                                                    topic.slug
                                                }
                                                key={topic.slug}
                                                onActiveChange={
                                                    setHoveredTopicSlug
                                                }
                                                onSelect={() =>
                                                    setSelectedTopicSlug(
                                                        (current) =>
                                                            current ===
                                                            topic.slug
                                                                ? null
                                                                : topic.slug,
                                                    )
                                                }
                                                selected={
                                                    selectedTopicSlug ===
                                                    topic.slug
                                                }
                                                topic={topic}
                                            />
                                        ))}
                                    </g>
                                </svg>
                            )}
                            <CompetenceMapGuide
                                recentWindowDays={
                                    competenceMap.recentWindowDays
                                }
                            />
                            {activeTopic ? (
                                <CompetenceReading
                                    checkIns={competenceMap.checkIns}
                                    onClose={() => {
                                        setHoveredTopicSlug(null);
                                        setSelectedTopicSlug(null);
                                    }}
                                    topic={activeTopic}
                                />
                            ) : selectedTopicNotFound ? (
                                <UnseenCompetenceReading
                                    onClose={() => {
                                        setHoveredTopicSlug(null);
                                        setSelectedTopicSlug(null);
                                    }}
                                    topicHref={selectedTopic?.href ?? '/topics'}
                                    topicLinkLabel={
                                        selectedTopic
                                            ? translate(
                                                  'competence.reading.unseen.open_topic',
                                                  'Open topic',
                                              )
                                            : translate(
                                                  'competence.reading.unseen.browse_topics',
                                                  'Browse topics',
                                              )
                                    }
                                    topicTitle={
                                        selectedTopic?.title ??
                                        topicLabel(selectedTopicSlug ?? '')
                                    }
                                />
                            ) : null}
                        </section>
                        <LearningPulseTimeline
                            checkIns={competenceMap.checkIns}
                            reviewAttempts={competenceMap.reviewAttempts}
                            onTopicSelect={(slug) => {
                                setHoveredTopicSlug(null);
                                setSelectedTopicSlug(slug);
                            }}
                        />
                    </div>
                </div>
            </main>
        </>
    );
}

function CompetenceMapGuide({
    recentWindowDays,
}: {
    recentWindowDays: number;
}) {
    const translate = usePlatformTranslation();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="absolute top-4 right-4 z-10 flex w-[min(36rem,calc(100%-2rem))] flex-col items-end text-slate-100">
            <Button
                aria-controls="competence-map-guide"
                aria-expanded={isOpen}
                className="border-cyan-200/20 bg-slate-950/85 text-xs font-semibold tracking-[0.14em] text-cyan-100 uppercase shadow-xl backdrop-blur hover:bg-slate-900"
                onClick={() => setIsOpen((open) => !open)}
                type="button"
                variant="outline"
            >
                How to read this map
                <ChevronDown
                    className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </Button>
            <div
                className="mt-2 grid max-h-[calc(100%-4.5rem)] w-full gap-3 overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/95 px-3 py-3 text-xs leading-5 text-slate-300 shadow-xl backdrop-blur"
                hidden={!isOpen}
                id="competence-map-guide"
            >
                <p>
                    Each light represents a competence area you have explored.
                    The map keeps long-term development distinct from recent
                    activity.
                </p>
                <dl className="grid gap-2">
                    <div>
                        <dt className="font-medium text-slate-100">Size</dt>
                        <dd>
                            How established the learning pattern is over time.
                            It grows on a stable, capped scale as the pattern
                            becomes more established.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-100">Glow</dt>
                        <dd>
                            How much learning activity was recorded during the
                            last {recentWindowDays} days. It changes brightness
                            while the established size remains steady.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-100">Halo</dt>
                        <dd>
                            A softer sense of recent presence, so a newly
                            revisited area can be noticed before its longer
                            pattern changes.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-medium text-slate-100">Paths</dt>
                        <dd>Topics you encountered together in a route.</dd>
                    </div>
                </dl>
                <p className="text-slate-400">
                    {translate(
                        'competence.guide.evidence_intro',
                        'Recent learning moments informing this light.',
                    )}
                </p>
            </div>
        </div>
    );
}

function LearningPulseTimeline({
    checkIns,
    reviewAttempts,
    onTopicSelect,
}: {
    checkIns: CompetenceCheckIn[];
    reviewAttempts: CompetenceReviewAttempt[];
    onTopicSelect: (slug: string) => void;
}) {
    const translate = usePlatformTranslation();

    return (
        <aside className="rounded-2xl border border-cyan-200/15 bg-slate-950/80 p-5 shadow-2xl xl:h-full xl:min-h-0 xl:overflow-y-auto">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-200/10 text-cyan-200">
                    <Heart className="size-4" />
                </span>
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                        Your learning pulse
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-white">
                        Moments along the way
                    </h2>
                </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
                {translate(
                    'competence.pulse.description',
                    'Your notes about how the activities felt, kept alongside your learning trail.',
                )}
            </p>

            {checkIns.length > 0 ? (
                <ol className="mt-5 grid gap-4">
                    {checkIns.map((checkIn) => (
                        <li
                            className="relative border-l border-cyan-200/25 pl-4"
                            key={`${checkIn.activityId}:${checkIn.recordedAt}`}
                        >
                            <span className="absolute top-1.5 -left-[0.3rem] size-2 rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(165,243,252,0.8)]" />
                            <time
                                className="text-xs text-slate-500 dark:text-slate-400"
                                dateTime={checkIn.recordedAt}
                            >
                                {formatCheckInDate(checkIn.recordedAt)}
                            </time>
                            <p className="mt-1 text-sm font-medium text-slate-100">
                                {checkInFeelingLabel(checkIn.feeling)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                                {checkIn.activityTitle} · {checkIn.nodeTitle}
                            </p>
                            {checkIn.note ? (
                                <p className="mt-2 text-sm leading-5 text-slate-300">
                                    {checkIn.note}
                                </p>
                            ) : null}
                            {checkIn.nextDirection ? (
                                <p className="mt-2 text-xs text-cyan-200/80">
                                    Next direction:{' '}
                                    {learningCheckInDirectionLabel(
                                        checkIn.nextDirection,
                                    )}
                                </p>
                            ) : null}
                            <Link
                                className="mt-2 inline-flex text-xs font-medium text-cyan-200 transition hover:text-white"
                                href={checkIn.activityHref}
                            >
                                {translate(
                                    'competence.pulse.revisit_activity',
                                    'Revisit this activity',
                                )}
                            </Link>
                            {checkIn.topics.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="sr-only">
                                        Connected lights:
                                    </span>
                                    {checkIn.topics.map((topic) => (
                                        <button
                                            className="rounded-full border border-cyan-200/15 bg-cyan-200/5 px-2 py-0.5 text-left text-xs text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-200/15"
                                            key={topic.slug}
                                            onClick={() =>
                                                onTopicSelect(topic.slug)
                                            }
                                            type="button"
                                        >
                                            {topic.name}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="mt-5 rounded-lg border border-dashed border-cyan-200/20 px-3 py-4 text-sm leading-6 text-slate-400">
                    After an activity, you can leave a small note here for your
                    future self.
                </p>
            )}

            {reviewAttempts.length > 0 ? (
                <section
                    aria-labelledby="competence-review-history-heading"
                    className="mt-6 border-t border-cyan-200/10 pt-5"
                >
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                        Review history
                    </p>
                    <h2
                        className="mt-1 text-sm font-semibold text-white"
                        id="competence-review-history-heading"
                    >
                        Returns you chose to make
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                        A bounded record of revisits, kept separate from the
                        learning pulse and any private journal writing.
                    </p>
                    <LearnerPaginatedItems
                        className="mt-4 grid gap-3"
                        items={reviewAttempts}
                        pageSize={2}
                        paginationLabel="Review history"
                        renderItem={(attempt) => {
                            const content = (
                                <span className="block">
                                    <span className="flex items-start justify-between gap-3">
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium text-slate-100">
                                                {attempt.activityTitle ??
                                                    'Learning activity'}
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-400">
                                                {attempt.nodeTitle ??
                                                    'Learning place'}
                                                {attempt.outcome
                                                    ? ` · ${reviewOutcomeLabel(attempt.outcome, translate)}`
                                                    : ''}
                                            </span>
                                        </span>
                                        {attempt.attemptedAt ? (
                                            <time
                                                className="shrink-0 text-xs text-slate-500"
                                                dateTime={attempt.attemptedAt}
                                            >
                                                {formatCheckInDate(
                                                    attempt.attemptedAt,
                                                )}
                                            </time>
                                        ) : null}
                                    </span>
                                    <span className="mt-2 block text-xs text-cyan-100/75">
                                        {attempt.confidence
                                            ? `Confidence: ${confidenceLabel(attempt.confidence)}`
                                            : 'Review completed'}
                                        {attempt.attemptNumber > 1
                                            ? ` · attempt ${attempt.attemptNumber}`
                                            : ''}
                                    </span>
                                </span>
                            );

                            return attempt.activityHref ? (
                                <Link
                                    className="rounded-lg border border-cyan-200/10 bg-cyan-200/5 p-3 transition hover:border-cyan-200/30 hover:bg-cyan-200/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                                    href={attempt.activityHref}
                                    key={`${attempt.activityHref}:${attempt.attemptedAt}`}
                                >
                                    {content}
                                </Link>
                            ) : (
                                <div
                                    className="rounded-lg border border-cyan-200/10 bg-cyan-200/5 p-3"
                                    key={`${attempt.activityTitle}:${attempt.attemptedAt}`}
                                >
                                    {content}
                                </div>
                            );
                        }}
                    />
                </section>
            ) : null}
        </aside>
    );
}

function checkInFeelingLabel(feeling: string | null): string {
    return (
        {
            clearer: 'Something clicked',
            forming: 'Still taking shape',
            stretched: 'It stretched me',
            stuck: 'I got stuck',
        }[feeling ?? ''] ?? 'A reflection'
    );
}

function reviewOutcomeLabel(
    outcome: string,
    translate: ReturnType<typeof usePlatformTranslation>,
): string {
    return translate(
        `learning.review.outcome_${outcome}`,
        {
            clearer: 'Clearer now',
            connected: 'More connected',
            open: 'Still open',
            correct: 'Useful clue found',
            incorrect: 'Adjust the hypothesis',
        }[outcome] ?? 'Review completed',
    );
}

function formatCheckInDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}

function CompetencePath({
    from,
    to,
    transition,
}: {
    from: PositionedTopic;
    to: PositionedTopic;
    transition: CompetenceTransition;
}) {
    const strength = Math.min(1, transition.count / 20);
    const continuous = transition.count >= 20;
    const width = 1.5 + strength * 5;
    const opacity = 0.24 + strength * 0.68;
    const duration = Math.max(0.8, 5 - transition.count * 0.18);

    return (
        <g>
            <line
                stroke="#67e8f9"
                strokeDasharray={continuous ? undefined : '18 18'}
                strokeLinecap="round"
                strokeOpacity={opacity}
                strokeWidth={width}
                style={
                    continuous
                        ? undefined
                        : {
                              animation: `competence-flow ${duration}s linear infinite`,
                          }
                }
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
            />
            <title>
                {transition.fromTopicName} and {transition.toTopicName} are
                connected by learning encounters.
            </title>
        </g>
    );
}

function CompetenceReading({
    checkIns,
    onClose,
    topic,
}: {
    checkIns: CompetenceCheckIn[];
    onClose: () => void;
    topic: PositionedTopic;
}) {
    const translate = usePlatformTranslation();
    const relatedCheckIns = checkIns
        .filter((checkIn) =>
            checkIn.topics.some(
                (relatedTopic) => relatedTopic.slug === topic.slug,
            ),
        )
        .slice(0, 3);

    return (
        <aside
            aria-live="polite"
            className="absolute bottom-4 left-4 max-h-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-slate-100 shadow-xl backdrop-blur"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                        Reading this light
                    </p>
                    <h2 className="mt-1 text-sm font-semibold">{topic.name}</h2>
                </div>
                <button
                    aria-label="Close competence reading"
                    className="rounded-md px-2 py-1 text-sm leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
                    onClick={onClose}
                    type="button"
                >
                    ×
                </button>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">
                {topic.visual.description}
            </p>
            {topic.relatedTopic ? (
                <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">
                        {translate(
                            'competence.reading.topic_context',
                            'Topic context',
                        )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                        {topic.relatedTopic.title}
                    </p>
                    <Link
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-white"
                        href={topic.relatedTopic.href}
                    >
                        {translate(
                            'competence.reading.open_topic',
                            'Open topic',
                        )}
                        <ArrowRight className="size-3.5" />
                    </Link>
                </div>
            ) : null}
            <div className="mt-3 rounded-lg border border-cyan-200/10 bg-cyan-200/5 px-3 py-2">
                <p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">
                    Recent rhythm
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                    {topic.visual.recentDescription}
                </p>
            </div>
            <div className="mt-3">
                <p className="text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">
                    Learning trail
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {topic.visual.learningPeriods.map((period) => (
                        <span
                            className="rounded-full border border-cyan-200/15 bg-cyan-200/5 px-2 py-1 text-xs text-cyan-100"
                            key={period}
                        >
                            {period}
                        </span>
                    ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                    Each marker is a month in which this area appeared in your
                    learning trail.
                </p>
            </div>
            {relatedCheckIns.length > 0 ? (
                <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">
                        Your notes about this light
                    </p>
                    <div className="mt-2 grid gap-2">
                        {relatedCheckIns.map((checkIn) => (
                            <div
                                className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
                                key={`${checkIn.activityId}:${checkIn.recordedAt}:${checkIn.feeling}`}
                            >
                                <p className="text-xs font-medium text-slate-200">
                                    {checkInFeelingLabel(checkIn.feeling)}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">
                                    {checkIn.activityTitle} ·{' '}
                                    {formatCheckInDate(checkIn.recordedAt)}
                                </p>
                                {checkIn.note ? (
                                    <p className="mt-2 text-xs leading-5 text-slate-300">
                                        {checkIn.note}
                                    </p>
                                ) : null}
                                {checkIn.nextDirection ? (
                                    <p className="mt-2 text-xs text-cyan-200/80">
                                        Next direction:{' '}
                                        {learningCheckInDirectionLabel(
                                            checkIn.nextDirection,
                                        )}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                        Your observations appear alongside this learning area.
                    </p>
                </div>
            ) : null}
            {topic.revisit ? (
                <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-100/75 uppercase">
                        Return if you want to
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                        {topic.revisit.activityTitle} ·{' '}
                        {topic.revisit.nodeTitle}
                    </p>
                    <Link
                        className="mt-2 inline-flex text-xs font-medium text-cyan-200 transition hover:text-white"
                        href={topic.revisit.activityHref}
                    >
                        Revisit this activity
                    </Link>
                </div>
            ) : null}
            <p className="mt-3 text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">
                Learning moments represented here
            </p>
            <div className="mt-2 grid gap-2">
                {topic.visual.evidenceTypes.length > 0 ? (
                    topic.visual.evidenceTypes.map((type) => (
                        <div
                            className="flex items-start gap-2 text-xs leading-5"
                            key={type}
                        >
                            <span className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-cyan-100">
                                {evidenceTypeLabel(type)}
                            </span>
                            <span className="pt-1 text-slate-400">
                                {evidenceTypeDescription(type)}
                            </span>
                        </div>
                    ))
                ) : (
                    <span className="text-sm text-slate-400">
                        Learning moments will appear here as you work with this
                        area.
                    </span>
                )}
            </div>
            {topic.visual.evidenceLedger.length > 0 ? (
                <details className="mt-4 rounded-lg border border-cyan-200/15 bg-cyan-200/5 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium tracking-[0.14em] text-cyan-100/80 uppercase outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70">
                        Evidence ledger
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                        Recent learning moments informing this light.
                    </p>
                    <LearnerPaginatedItems
                        className="mt-3 grid gap-2"
                        items={topic.visual.evidenceLedger}
                        pageSize={3}
                        paginationLabel="Evidence ledger"
                        renderItem={(evidence) => {
                            const content = (
                                <span className="flex items-start justify-between gap-3">
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium text-slate-200">
                                            {evidence.activityTitle ??
                                                'Learning moment'}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-400">
                                            {evidenceTypeLabel(
                                                evidence.evidenceType,
                                            )}
                                            {evidence.nodeTitle
                                                ? ` · ${evidence.nodeTitle}`
                                                : ''}
                                        </span>
                                        <span className="mt-1 block text-xs text-cyan-100/80">
                                            {evidenceClaimLabel(
                                                evidence.evidenceClaim,
                                            )}
                                        </span>
                                        {evidence.outcome ? (
                                            <span className="mt-1 block text-xs text-cyan-100/70">
                                                {translate(
                                                    'learning.review.outcome_signal',
                                                    'Review signal',
                                                )}
                                                :{' '}
                                                {reviewOutcomeLabel(
                                                    evidence.outcome,
                                                    translate,
                                                )}
                                            </span>
                                        ) : null}
                                        {evidence.objective ? (
                                            <span className="mt-1 block text-xs text-cyan-100/70">
                                                Objective: {evidence.objective}
                                            </span>
                                        ) : null}
                                        {evidence.concepts.length > 0 ? (
                                            <span className="mt-1 block text-xs text-cyan-100/70">
                                                Concepts:{' '}
                                                {evidence.concepts.join(' · ')}
                                            </span>
                                        ) : null}
                                        {evidence.learningPurpose ? (
                                            <span className="mt-1 block text-xs text-slate-500">
                                                Purpose:{' '}
                                                {evidence.learningPurpose}
                                            </span>
                                        ) : null}
                                        {evidence.evidenceCriterion ? (
                                            <span className="mt-1 block text-xs text-cyan-100/70">
                                                What to notice:{' '}
                                                {evidence.evidenceCriterion}
                                            </span>
                                        ) : null}
                                        {evidence.evidenceRubric.length > 0 ? (
                                            <span className="mt-1 block text-xs text-cyan-100/70">
                                                Cues:{' '}
                                                {evidence.evidenceRubric.join(
                                                    ' · ',
                                                )}
                                            </span>
                                        ) : null}
                                        {evidence.confidence ? (
                                            <span className="mt-1 block text-xs text-slate-500">
                                                Before answering:{' '}
                                                {confidenceLabel(
                                                    evidence.confidence,
                                                )}
                                                {evidence.attemptNumber > 1
                                                    ? ` · attempt ${evidence.attemptNumber}`
                                                    : ''}
                                            </span>
                                        ) : null}
                                    </span>
                                    {evidence.recordedAt ? (
                                        <span className="shrink-0 text-xs text-slate-500">
                                            {formatCheckInDate(
                                                evidence.recordedAt,
                                            )}
                                        </span>
                                    ) : null}
                                </span>
                            );

                            const evidenceHref =
                                evidence.activityHref ?? evidence.nodeHref;
                            const sourceLinks =
                                evidence.sources.length > 0 ? (
                                    <div className="border-t border-cyan-200/10 px-2.5 pt-2 pb-2 text-xs text-slate-500">
                                        <span className="mr-1 text-slate-400">
                                            {translate(
                                                'competence.evidence.sources',
                                                'Sources',
                                            )}
                                            :
                                        </span>
                                        {evidence.sources.map(
                                            (source, index) => (
                                                <span
                                                    key={`${source.url}-${index}`}
                                                >
                                                    {index > 0 ? ', ' : null}
                                                    <a
                                                        className="text-cyan-200 underline decoration-cyan-200/30 underline-offset-2 transition hover:text-white"
                                                        href={source.url}
                                                        rel="noreferrer"
                                                        target="_blank"
                                                    >
                                                        {source.title}
                                                    </a>
                                                </span>
                                            ),
                                        )}
                                    </div>
                                ) : null;

                            return evidenceHref ? (
                                <div
                                    className="rounded-md border border-white/10 bg-black/20 transition hover:border-cyan-200/35 hover:bg-cyan-200/10"
                                    key={evidence.id}
                                >
                                    <Link
                                        className="block px-2.5 py-2"
                                        href={evidenceHref}
                                    >
                                        {content}
                                    </Link>
                                    {sourceLinks}
                                </div>
                            ) : (
                                <div
                                    className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2"
                                    key={evidence.id}
                                >
                                    {content}
                                    {sourceLinks}
                                </div>
                            );
                        }}
                        paginationClassName="mt-3 flex items-center justify-between border-t border-cyan-200/15 pt-3"
                        paginationButtonClassName="inline-flex items-center gap-1 text-xs text-cyan-200 transition hover:text-white disabled:pointer-events-none disabled:opacity-40"
                        paginationTextClassName="text-xs text-slate-500"
                    />
                </details>
            ) : null}
        </aside>
    );
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
    const translate = usePlatformTranslation();

    return (
        <aside
            aria-live="polite"
            className="absolute bottom-4 left-4 max-h-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-slate-100 shadow-xl backdrop-blur"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                        {translate(
                            'competence.reading.unseen.eyebrow',
                            'Not on your map yet',
                        )}
                    </p>
                    <h2 className="mt-1 text-sm font-semibold">{topicTitle}</h2>
                </div>
                <button
                    aria-label="Close competence reading"
                    className="rounded-md px-2 py-1 text-sm leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
                    onClick={onClose}
                    type="button"
                >
                    ×
                </button>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">
                {translate(
                    'competence.reading.unseen.description',
                    'There is no learning moment for this area on your trail yet. Explore an activity connected to it, and this map can begin reflecting what you notice over time.',
                )}
            </p>
            <div className="mt-3">
                <Link
                    className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 transition hover:text-white"
                    href={topicHref}
                >
                    {topicLinkLabel}
                    <ArrowRight className="size-3.5" />
                </Link>
            </div>
        </aside>
    );
}

function topicLabel(slug: string): string {
    return slug
        .replaceAll('-', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceTypeLabel(type: string): string {
    return (
        {
            apply: 'applying',
            explain: 'explaining',
            participate: 'participating',
            reflect: 'reflecting',
            retrieve: 'retrieving',
            review: 'reviewing',
            transfer: 'transferring',
        }[type] ?? type
    );
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

function evidenceTypeDescription(type: string): string {
    return (
        {
            apply: 'using an idea in a situation',
            explain: 'putting an idea into your own words',
            participate: 'taking part in a learning activity',
            reflect: 'noticing understanding, uncertainty or connections',
            retrieve: 'bringing an idea back from memory',
            review: 'returning to earlier material and noticing what changed',
            transfer: 'using an idea in a new context',
        }[type] ?? 'engaging with this learning area'
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

function CompetenceStar({
    active,
    onActiveChange,
    onSelect,
    selected,
    topic,
}: {
    active: boolean;
    onActiveChange: (slug: string | null) => void;
    onSelect: () => void;
    selected: boolean;
    topic: PositionedTopic;
}) {
    const flareLength = topic.size * (2.8 + topic.brightness * 2.4);
    const flareWidth = Math.max(0.45, topic.size * 0.1);
    const diagonalFlareLength = flareLength * 0.46;
    const coreRadius = Math.max(1.6, topic.size * 0.26);
    const showLabel = topic.labelVisible || active;

    return (
        <g
            aria-label={`${topic.name}: ${topic.visual.description}`}
            aria-pressed={selected}
            className="group cursor-pointer outline-none"
            onClick={onSelect}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }

                event.preventDefault();
                onSelect();
            }}
            onPointerEnter={() => onActiveChange(topic.slug)}
            onPointerLeave={() => onActiveChange(null)}
            role="button"
            tabIndex={0}
            transform={`translate(${topic.x} ${topic.y})`}
        >
            <title>
                {topic.name}: {topic.visual.description}
            </title>
            <circle
                aria-hidden="true"
                className="fill-transparent stroke-transparent stroke-2 transition group-focus-visible:stroke-cyan-100"
                r={Math.max(topic.auraRadius + 8, topic.size + 12)}
            />
            <circle
                fill={topic.color}
                opacity={topic.aura}
                r={topic.auraRadius}
                style={{
                    animation: `competence-halo ${topic.twinkleDuration + 1.2}s cubic-bezier(0.45,0,0.55,1) infinite alternate`,
                    animationDelay: `${topic.twinkleDelay}s`,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                }}
            />
            <circle
                fill={topic.color}
                filter="url(#competence-star-bloom)"
                opacity={topic.brightness * 0.28}
                r={topic.size * 1.9}
            />
            <g
                filter="url(#competence-star-glow)"
                style={{
                    animation: `competence-twinkle ${topic.twinkleDuration}s cubic-bezier(0.45,0,0.55,1) infinite alternate`,
                    animationDelay: `${topic.twinkleDelay}s`,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                }}
            >
                <g transform={`rotate(${topic.flareAngle})`}>
                    <g
                        style={{
                            animation: `competence-flare-sway ${topic.twinkleDuration + 1.4}s cubic-bezier(0.45,0,0.55,1) infinite alternate`,
                            animationDelay: `${topic.twinkleDelay * 0.7}s`,
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                        }}
                    >
                        <line
                            stroke="#ffffff"
                            strokeLinecap="round"
                            strokeOpacity={topic.brightness * 0.76}
                            strokeWidth={flareWidth}
                            x1={-flareLength}
                            x2={flareLength}
                            y1="0"
                            y2="0"
                        />
                        <line
                            stroke="#bae6fd"
                            strokeLinecap="round"
                            strokeOpacity={topic.brightness * 0.62}
                            strokeWidth={flareWidth * 0.78}
                            x1="0"
                            x2="0"
                            y1={-flareLength}
                            y2={flareLength}
                        />
                        <line
                            stroke="#f5d0fe"
                            strokeLinecap="round"
                            strokeOpacity={topic.brightness * 0.32}
                            strokeWidth={flareWidth * 0.58}
                            x1={-diagonalFlareLength}
                            x2={diagonalFlareLength}
                            y1={-diagonalFlareLength}
                            y2={diagonalFlareLength}
                        />
                        <line
                            stroke="#93c5fd"
                            strokeLinecap="round"
                            strokeOpacity={topic.brightness * 0.26}
                            strokeWidth={flareWidth * 0.5}
                            x1={-diagonalFlareLength}
                            x2={diagonalFlareLength}
                            y1={diagonalFlareLength}
                            y2={-diagonalFlareLength}
                        />
                    </g>
                </g>
                <circle
                    fill="#fff7ed"
                    opacity={0.62 + topic.brightness * 0.38}
                    r={topic.size * 0.62}
                />
                <circle
                    fill="#ffffff"
                    opacity={0.82 + topic.brightness * 0.18}
                    r={coreRadius}
                />
                {topic.sparklePoints.map((sparkle, index) => (
                    <circle
                        cx={sparkle.x}
                        cy={sparkle.y}
                        fill={index % 2 === 0 ? '#e0f2fe' : '#f5d0fe'}
                        key={index}
                        opacity={sparkle.opacity}
                        r={sparkle.size}
                        style={{
                            animation: `competence-spark ${topic.twinkleDuration + sparkle.radius * 0.08}s cubic-bezier(0.45,0,0.55,1) infinite alternate`,
                            animationDelay: `${topic.twinkleDelay + sparkle.delay}s`,
                            transformBox: 'fill-box',
                            transformOrigin: 'center',
                        }}
                    />
                ))}
            </g>
            {showLabel ? (
                <g
                    opacity="0.92"
                    pointerEvents="none"
                    transform={`translate(${-topic.x} ${-topic.y})`}
                >
                    {!topic.labelVisible ? (
                        <line
                            stroke="#bae6fd"
                            strokeDasharray="2 5"
                            strokeLinecap="round"
                            strokeOpacity="0.48"
                            strokeWidth="1"
                            x1={topic.x}
                            x2={topic.labelX}
                            y1={
                                topic.y +
                                (topic.labelSide === 'below'
                                    ? topic.size + 9
                                    : -topic.size - 9)
                            }
                            y2={topic.labelY - 11}
                        />
                    ) : null}
                    <text
                        fill="#f8fafc"
                        fontSize="13"
                        fontWeight="700"
                        textAnchor="middle"
                        x={topic.labelX}
                        y={topic.labelY}
                    >
                        {topic.name}
                    </text>
                    {topic.clusterHiddenCount > 0 ? (
                        <text
                            fill="#ccfbf1"
                            fontSize="10"
                            fontWeight="800"
                            opacity="0.82"
                            textAnchor="start"
                            x={topic.labelX + topic.labelWidth / 2 + 8}
                            y={topic.labelY}
                        >
                            +{topic.clusterHiddenCount}
                        </text>
                    ) : null}
                </g>
            ) : null}
        </g>
    );
}
