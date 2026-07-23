import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AccentHeading } from '@/components/accent-heading';
import { Button } from '@/components/ui/button';

type CompetenceTopic = {
    auraThreshold: number;
    emittanceThreshold: number;
    growthThreshold: number;
    monthlyPoints: number;
    name: string;
    slug: string;
    totalPoints: number;
};

type CompetenceTransition = {
    count: number;
    fromTopicName: string;
    fromTopicSlug: string;
    toTopicName: string;
    toTopicSlug: string;
};

type CompetenceMap = {
    monthKey: string;
    topics: CompetenceTopic[];
    transitions: CompetenceTransition[];
};

type PositionedTopic = CompetenceTopic & {
    aura: number;
    brightness: number;
    size: number;
    twinkleDelay: number;
    twinkleDuration: number;
    x: number;
    y: number;
};

export default function CompetenceStarMap({
    competenceMap,
}: {
    competenceMap: CompetenceMap;
}) {
    const positionedTopics = positionTopics(competenceMap.topics);
    const topicBySlug = new Map(
        positionedTopics.map((topic) => [topic.slug, topic]),
    );

    return (
        <>
            <Head title="Competence Star Map" />
            <main className="min-h-svh overflow-hidden bg-black px-4 py-6 pb-24 text-white">
                <div className="mx-auto grid h-[calc(100svh-7rem)] max-w-7xl grid-rows-[auto_minmax(0,1fr)] gap-5">
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
                        description={`Current monthly aura window: ${competenceMap.monthKey}`}
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
                                viewBox="0 0 1000 680"
                            >
                                <style>{`
                                    @keyframes competence-flow {
                                        to { stroke-dashoffset: -72; }
                                    }
                                    @keyframes competence-twinkle {
                                        0%, 100% {
                                            opacity: 0.72;
                                            transform: scale(0.94);
                                        }
                                        42% {
                                            opacity: 1;
                                            transform: scale(1.08);
                                        }
                                        62% {
                                            opacity: 0.82;
                                            transform: scale(0.98);
                                        }
                                    }
                                    @keyframes competence-halo {
                                        0%, 100% { opacity: 0.32; }
                                        50% { opacity: 0.78; }
                                    }
                                `}</style>
                                <defs>
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
                                </defs>
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
                                            key={topic.slug}
                                            topic={topic}
                                        />
                                    ))}
                                </g>
                            </svg>
                        )}
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

function CompetenceStar({ topic }: { topic: PositionedTopic }) {
    return (
        <g transform={`translate(${topic.x} ${topic.y})`}>
            <circle
                fill="#22d3ee"
                opacity={topic.aura}
                r={topic.size * (1.7 + topic.monthlyPoints / 18)}
                style={{
                    animation: `competence-halo ${topic.twinkleDuration + 1.2}s ease-in-out infinite`,
                    animationDelay: `${topic.twinkleDelay}s`,
                }}
            />
            <circle
                fill="#bfdbfe"
                opacity={topic.brightness * 0.2}
                r={topic.size * 2.4}
            />
            <g
                filter="url(#competence-star-glow)"
                style={{
                    animation: `competence-twinkle ${topic.twinkleDuration}s ease-in-out infinite`,
                    animationDelay: `${topic.twinkleDelay}s`,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                }}
            >
                <line
                    stroke="#e0f2fe"
                    strokeLinecap="round"
                    strokeOpacity={topic.brightness * 0.42}
                    strokeWidth={Math.max(0.5, topic.size * 0.08)}
                    x1={-topic.size * 1.6}
                    x2={topic.size * 1.6}
                    y1="0"
                    y2="0"
                />
                <line
                    stroke="#e0f2fe"
                    strokeLinecap="round"
                    strokeOpacity={topic.brightness * 0.3}
                    strokeWidth={Math.max(0.4, topic.size * 0.06)}
                    x1="0"
                    x2="0"
                    y1={-topic.size * 1.6}
                    y2={topic.size * 1.6}
                />
                <circle
                    fill="#fff7ed"
                    opacity={0.62 + topic.brightness * 0.38}
                    r={topic.size}
                />
                <circle
                    fill="#ffffff"
                    opacity={0.82 + topic.brightness * 0.18}
                    r={Math.max(1.5, topic.size * 0.22)}
                />
            </g>
            <text
                fill="#f8fafc"
                fontSize="16"
                fontWeight="700"
                textAnchor="middle"
                y={topic.size + 28}
            >
                {topic.name}
            </text>
        </g>
    );
}

function positionTopics(topics: CompetenceTopic[]): PositionedTopic[] {
    return topics.map((topic, index) => {
        const angle =
            topics.length === 1 ? 0 : (Math.PI * 2 * index) / topics.length;
        const ring = topics.length <= 6 ? 220 : 180 + (index % 2) * 92;
        const growthRatio = thresholdRatio(
            topic.totalPoints,
            topic.growthThreshold,
        );
        const emittanceRatio = thresholdRatio(
            topic.totalPoints,
            topic.emittanceThreshold,
        );
        const auraRatio = thresholdRatio(
            topic.monthlyPoints,
            topic.auraThreshold,
        );

        return {
            ...topic,
            aura: 0.06 + auraRatio * 0.48,
            brightness: 0.38 + emittanceRatio * 0.62,
            size: 3.5 + growthRatio * 16,
            twinkleDelay: (index % 7) * -0.43,
            twinkleDuration: 2.8 + (index % 5) * 0.36,
            x: 500 + Math.cos(angle - Math.PI / 2) * ring,
            y: 340 + Math.sin(angle - Math.PI / 2) * ring,
        };
    });
}

function thresholdRatio(points: number, threshold: number): number {
    if (!Number.isFinite(points) || !Number.isFinite(threshold) || threshold <= 0) {
        return 0;
    }

    return Math.min(1, points / threshold);
}
