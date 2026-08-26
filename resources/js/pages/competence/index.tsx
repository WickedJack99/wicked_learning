import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AccentHeading } from '@/components/accent-heading';
import { Button } from '@/components/ui/button';
import {
    backgroundStars,
    buildCompetenceStarLayout,
    competenceStarMapSize,
    shootingStars,
} from './competence-star-layout';
import type {
    CompetenceMap,
    CompetenceTransition,
    PositionedTopic,
} from './competence-star-layout';

export default function CompetenceStarMap({
    competenceMap,
}: {
    competenceMap: CompetenceMap;
}) {
    const [hoveredTopicSlug, setHoveredTopicSlug] = useState<string | null>(
        null,
    );
    const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | null>(
        null,
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

    return (
        <>
            <Head title="Competence Star Map" />
            <main className="min-h-svh overflow-hidden bg-black px-4 py-6 pb-24 text-white">
                <div className="grid h-[calc(100svh-7rem)] w-full grid-rows-[auto_minmax(0,1fr)] gap-5">
                    <AccentHeading
                        action={
                            <Button asChild variant="secondary">
                                <Link href="/world">
                                    <ArrowLeft className="size-4" />
                                    Back to world
                                </Link>
                            </Button>
                        }
                        accentColor="var(--map-floating-accent-color)"
                        eyebrow="Competence"
                        icon={<Sparkles className="size-5" />}
                        title="Star Map"
                    />

                    <section className="relative min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                        {positionedTopics.length === 0 ? (
                            <div className="grid h-full place-items-center p-6 text-center">
                                <div>
                                    <Sparkles className="mx-auto size-12 text-cyan-200" />
                                    <h2 className="mt-4 text-2xl font-semibold">
                                        No stars yet
                                    </h2>
                                    <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">
                                        Complete route-play activities with
                                        configured competence topics to light up
                                        this map.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <svg
                                aria-label="Competence star map"
                                className="h-full w-full"
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
                                                    strokeOpacity={star.opacity}
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
                                                activeTopicSlug === topic.slug
                                            }
                                            key={topic.slug}
                                            onActiveChange={setHoveredTopicSlug}
                                            onSelect={() =>
                                                setSelectedTopicSlug(
                                                    (current) =>
                                                        current === topic.slug
                                                            ? null
                                                            : topic.slug,
                                                )
                                            }
                                            topic={topic}
                                        />
                                    ))}
                                </g>
                            </svg>
                        )}
                        {activeTopic ? (
                            <CompetenceReading
                                onClose={() => {
                                    setHoveredTopicSlug(null);
                                    setSelectedTopicSlug(null);
                                }}
                                topic={activeTopic}
                            />
                        ) : null}
                    </section>
                </div>
            </main>
        </>
    );
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
                {transition.fromTopicName} to {transition.toTopicName}:{' '}
                {transition.count}
            </title>
        </g>
    );
}

function CompetenceReading({
    onClose,
    topic,
}: {
    onClose: () => void;
    topic: PositionedTopic;
}) {
    return (
        <aside
            aria-live="polite"
            className="absolute bottom-4 left-4 max-w-sm rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-slate-100 shadow-xl backdrop-blur"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold tracking-[0.18em] text-cyan-200/80 uppercase">
                        Reading this light
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{topic.name}</h2>
                </div>
                <button
                    aria-label="Close competence reading"
                    className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
                    onClick={onClose}
                    type="button"
                >
                    ×
                </button>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-300">
                {topic.visual.description}
            </p>
            <p className="mt-3 text-xs font-medium tracking-[0.14em] text-slate-400 uppercase">
                Ways you have engaged here
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {topic.visual.evidenceTypes.length > 0 ? (
                    topic.visual.evidenceTypes.map((type) => (
                        <span
                            className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-xs text-cyan-100"
                            key={type}
                        >
                            {evidenceTypeLabel(type)}
                        </span>
                    ))
                ) : (
                    <span className="text-sm text-slate-400">
                        No evidence pattern yet.
                    </span>
                )}
            </div>
        </aside>
    );
}

function evidenceTypeLabel(type: string): string {
    return (
        {
            apply: 'applying',
            explain: 'explaining',
            participate: 'participating',
            reflect: 'reflecting',
            retrieve: 'retrieving',
            transfer: 'transferring',
        }[type] ?? type
    );
}

function CompetenceStar({
    active,
    onActiveChange,
    onSelect,
    topic,
}: {
    active: boolean;
    onActiveChange: (slug: string | null) => void;
    onSelect: () => void;
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
            aria-pressed={active}
            className="cursor-pointer outline-none"
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
