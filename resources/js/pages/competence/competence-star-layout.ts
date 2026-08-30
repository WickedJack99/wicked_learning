import type { LearningSourceReference } from '@/types/learning';

export type CompetenceTopic = {
    name: string;
    relatedTopic: {
        href: string;
        title: string;
    } | null;
    revisit: {
        activityHref: string;
        activityTitle: string;
        nodeHref: string;
        nodeTitle: string;
    } | null;
    slug: string;
    visual: {
        auraRatio: number;
        brightnessRatio: number;
        description: string;
        evidenceLedger: Array<{
            activityTitle: string | null;
            activityHref: string | null;
            evidenceClaim: string;
            evidenceCriterion: string | null;
            evidenceRubric: string[];
            observedCues: string[];
            evidenceType: string;
            sources: LearningSourceReference[];
            objective: string | null;
            concepts: string[];
            learningPurpose: string | null;
            confidence: string | null;
            outcome: string | null;
            assistanceLevel: string | null;
            id: number;
            attemptNumber: number;
            nodeHref: string | null;
            nodeTitle: string | null;
            recordedAt: string | null;
        }>;
        evidenceTypes: string[];
        learningPeriods: string[];
        recentDescription: string;
        sizeRatio: number;
        sizeTier: string;
    };
};

export type CompetenceTransition = {
    count: number;
    fromTopicName: string;
    fromTopicSlug: string;
    toTopicName: string;
    toTopicSlug: string;
};

export type CompetenceCheckIn = {
    activityId: number;
    activityHref: string;
    activityTitle: string;
    feeling: string | null;
    note: string | null;
    nextDirection: 'revisit' | 'related' | 'settle' | null;
    nodeTitle: string;
    nodeHref: string;
    recordedAt: string;
    topics: Array<{
        name: string;
        slug: string;
    }>;
};

export type CompetenceReviewAttempt = {
    activityHref: string | null;
    activityTitle: string | null;
    attemptedAt: string | null;
    attemptNumber: number;
    confidence: string | null;
    nodeTitle: string | null;
    outcome: string | null;
    assistanceLevel: string | null;
};

export type CompetenceMap = {
    checkIns: CompetenceCheckIn[];
    monthKey: string;
    recentWindowDays: number;
    reviewAttempts: CompetenceReviewAttempt[];
    topics: CompetenceTopic[];
    transitions: CompetenceTransition[];
};

export type SparklePoint = {
    delay: number;
    opacity: number;
    radius: number;
    size: number;
    x: number;
    y: number;
};

export type BackgroundStar = {
    delay: number;
    opacity: number;
    size: number;
    x: number;
    y: number;
};

export type ShootingStar = {
    angle: number;
    delay: number;
    distance: number;
    duration: number;
    length: number;
    opacity: number;
    x: number;
    y: number;
};

export type PositionedTopic = CompetenceTopic & {
    aura: number;
    auraRadius: number;
    brightness: number;
    clusterHiddenCount: number;
    color: string;
    collisionRadius: number;
    flareAngle: number;
    labelHeight: number;
    labelSide: 'above' | 'below';
    labelVisible: boolean;
    labelWidth: number;
    labelX: number;
    labelY: number;
    sparklePoints: SparklePoint[];
    size: number;
    twinkleDelay: number;
    twinkleDuration: number;
    x: number;
    y: number;
};

type LayoutNode = PositionedTopic & {
    priority: number;
};

type LayoutLink = {
    count: number;
    from: LayoutNode;
    strength: number;
    to: LayoutNode;
};

export const competenceStarMapSize = {
    height: 680,
    width: 1600,
} as const;

const layoutWidth = competenceStarMapSize.width;
const layoutHeight = competenceStarMapSize.height;
const layoutPaddingX = 88;
const layoutPaddingY = 48;
const labelPaddingX = 32;
const labelPaddingY = 16;
const topicSpreadX = layoutWidth * 0.36;
const topicSpreadY = layoutHeight * 0.34;
const starColors = ['#38bdf8', '#a78bfa', '#f0abfc', '#67e8f9'];

export const backgroundStars: BackgroundStar[] = Array.from(
    { length: 148 },
    (_, index) => {
        const seed = index + 1;

        return {
            delay: -pseudoRandom(seed, 11) * 4.8,
            opacity: 0.12 + pseudoRandom(seed, 17) * 0.38,
            size: 0.45 + pseudoRandom(seed, 23) * 1.15,
            x: 20 + pseudoRandom(seed, 31) * (layoutWidth - 40),
            y: 18 + pseudoRandom(seed, 43) * (layoutHeight - 36),
        };
    },
);

const shootingStarCycleDuration = 20;

const shootingStarSlots: Omit<ShootingStar, 'delay' | 'duration'>[] = [
    { angle: -28, distance: 300, length: 82, opacity: 0.7, x: -170, y: 90 },
    { angle: 24, distance: 270, length: 68, opacity: 0.58, x: 1250, y: 70 },
    { angle: -14, distance: 330, length: 94, opacity: 0.76, x: 120, y: 470 },
    { angle: 36, distance: 250, length: 74, opacity: 0.62, x: 1320, y: 360 },
    { angle: -34, distance: 290, length: 86, opacity: 0.68, x: 700, y: 165 },
];

export const shootingStars: ShootingStar[] = shootingStarSlots.map(
    (star, index) => ({
        ...star,
        delay: -index * 4,
        duration: shootingStarCycleDuration,
    }),
);

export function buildCompetenceStarLayout(
    topics: CompetenceTopic[],
    transitions: CompetenceTransition[],
): PositionedTopic[] {
    const nodes = topics.map(toLayoutNode);
    const nodeBySlug = new Map(nodes.map((node) => [node.slug, node]));
    const links = aggregateLinks(transitions, nodeBySlug);

    settleNodes(nodes, links);
    placeLabels(nodes);

    return nodes.map((node) => {
        const { priority, ...positioned } = node;

        void priority;

        return positioned;
    });
}

function toLayoutNode(topic: CompetenceTopic, index: number): LayoutNode {
    const seed = hashString(topic.slug);
    const growthRatio = topic.visual.sizeRatio;
    const emittanceRatio = topic.visual.brightnessRatio;
    const auraRatio = topic.visual.auraRatio;
    const size = 3.5 + growthRatio * 16;
    const auraRadius = size * (2.05 + auraRatio * 1.45);
    const labelWidth = Math.min(
        220,
        Math.max(72, topic.name.length * 7.4 + 22),
    );
    const labelHeight = 24;
    const stableAngle = seeded(seed, 1) * Math.PI * 2;
    const stableRadius = 0.34 + seeded(seed, 2) * 0.66;

    return {
        ...topic,
        aura: 0.06 + auraRatio * 0.48,
        auraRadius,
        brightness: 0.38 + emittanceRatio * 0.62,
        clusterHiddenCount: 0,
        collisionRadius: Math.max(auraRadius * 0.72, size * 2.8) + 20,
        color: starColors[Math.floor(seeded(seed, 3) * starColors.length)],
        flareAngle: Math.round(seeded(seed, 4) * 52 - 26),
        labelHeight,
        labelSide: 'below',
        labelVisible: false,
        labelWidth,
        labelX: 0,
        labelY: 0,
        priority: growthRatio * 2 + auraRatio + index * 0.001,
        size,
        sparklePoints: sparklePointsFor(seed, 3 + (seed % 3)),
        twinkleDelay: -seeded(seed, 5) * 2.8,
        twinkleDuration: 2.7 + seeded(seed, 6) * 1.9,
        x:
            layoutWidth / 2 +
            Math.cos(stableAngle) * topicSpreadX * stableRadius,
        y:
            layoutHeight / 2 +
            Math.sin(stableAngle) * topicSpreadY * stableRadius,
    };
}

function aggregateLinks(
    transitions: CompetenceTransition[],
    nodeBySlug: Map<string, LayoutNode>,
): LayoutLink[] {
    const counts = new Map<string, number>();

    for (const transition of transitions) {
        if (transition.fromTopicSlug === transition.toTopicSlug) {
            continue;
        }

        const ordered = [
            transition.fromTopicSlug,
            transition.toTopicSlug,
        ].sort();
        const key = ordered.join(':');

        counts.set(key, (counts.get(key) ?? 0) + transition.count);
    }

    const maxLogCount = Math.max(
        1,
        ...Array.from(counts.values()).map((count) => Math.log1p(count)),
    );

    return Array.from(counts.entries())
        .map(([key, count]) => {
            const [fromSlug, toSlug] = key.split(':');
            const from = nodeBySlug.get(fromSlug);
            const to = nodeBySlug.get(toSlug);

            if (!from || !to) {
                return null;
            }

            return {
                count,
                from,
                strength: Math.log1p(count) / maxLogCount,
                to,
            };
        })
        .filter((link): link is LayoutLink => link !== null);
}

function settleNodes(nodes: LayoutNode[], links: LayoutLink[]): void {
    for (let iteration = 0; iteration < 150; iteration += 1) {
        for (const link of links) {
            const distance = distanceBetween(link.from, link.to);
            const targetDistance =
                link.from.collisionRadius +
                link.to.collisionRadius +
                95 -
                link.strength * 62;

            if (distance <= targetDistance) {
                continue;
            }

            const pull = (distance - targetDistance) * 0.012 * link.strength;
            movePair(link.from, link.to, pull);
        }

        for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < nodes.length;
                rightIndex += 1
            ) {
                separateNodes(nodes[leftIndex], nodes[rightIndex]);
            }
        }

        for (const node of nodes) {
            node.x += (layoutWidth / 2 - node.x) * 0.002;
            node.y += (layoutHeight / 2 - node.y) * 0.002;
            clampNode(node);
        }
    }
}

function separateNodes(left: LayoutNode, right: LayoutNode): void {
    const distance = distanceBetween(left, right);
    const minDistance = left.collisionRadius + right.collisionRadius;

    if (distance >= minDistance) {
        return;
    }

    const overlap = minDistance - distance;
    movePair(left, right, -overlap * 0.58);
}

function movePair(left: LayoutNode, right: LayoutNode, amount: number): void {
    const dx = right.x - left.x || 0.01;
    const dy = right.y - left.y || 0.01;
    const distance = Math.hypot(dx, dy) || 1;
    const moveX = (dx / distance) * amount * 0.5;
    const moveY = (dy / distance) * amount * 0.5;

    left.x += moveX;
    left.y += moveY;
    right.x -= moveX;
    right.y -= moveY;
}

function clampNode(node: LayoutNode): void {
    const radius = node.collisionRadius;

    node.x = clamp(
        node.x,
        layoutPaddingX + radius,
        layoutWidth - layoutPaddingX - radius,
    );
    node.y = clamp(
        node.y,
        layoutPaddingY + radius,
        layoutHeight - layoutPaddingY - radius - node.labelHeight,
    );
}

function placeLabels(nodes: LayoutNode[]): void {
    const placedLabels: Array<{
        height: number;
        width: number;
        x: number;
        y: number;
    }> = [];

    const rankedNodes = [...nodes].sort((left, right) => {
        if (right.priority !== left.priority) {
            return right.priority - left.priority;
        }

        return left.name.localeCompare(right.name);
    });

    for (const [rank, node] of rankedNodes.entries()) {
        const preferred = labelRectFor(node, 'below');
        const fallback = labelRectFor(node, 'above');
        const rect =
            preferred.y + preferred.height < layoutHeight - labelPaddingY
                ? preferred
                : fallback;
        const overlaps = placedLabels.some((placed) =>
            rectsOverlap(rect, placed, 8),
        );
        const important = rank < 7 || node.visual.auraRatio >= 1;

        node.labelVisible = !overlaps && (important || rank < 12);
        node.labelSide = rect.side;
        node.labelX = rect.x + rect.width / 2;
        node.labelY =
            rect.side === 'below'
                ? rect.y + rect.height - 7
                : rect.y + rect.height - 8;

        if (node.labelVisible) {
            placedLabels.push(rect);
        }
    }

    for (const node of nodes) {
        if (!node.labelVisible) {
            continue;
        }

        node.clusterHiddenCount = nodes.filter(
            (candidate) =>
                !candidate.labelVisible &&
                distanceBetween(node, candidate) < node.collisionRadius + 130,
        ).length;
    }
}

function labelRectFor(node: LayoutNode, side: 'above' | 'below') {
    const y =
        side === 'below'
            ? node.y + node.size + 24
            : node.y - node.size - node.labelHeight - 22;
    const x = clamp(
        node.x - node.labelWidth / 2,
        labelPaddingX,
        layoutWidth - node.labelWidth - labelPaddingX,
    );

    return {
        height: node.labelHeight,
        side,
        width: node.labelWidth,
        x,
        y: clamp(
            y,
            labelPaddingY,
            layoutHeight - node.labelHeight - labelPaddingY,
        ),
    };
}

function rectsOverlap(
    left: { height: number; width: number; x: number; y: number },
    right: { height: number; width: number; x: number; y: number },
    padding: number,
): boolean {
    return !(
        left.x + left.width + padding < right.x ||
        right.x + right.width + padding < left.x ||
        left.y + left.height + padding < right.y ||
        right.y + right.height + padding < left.y
    );
}

function sparklePointsFor(seed: number, count: number): SparklePoint[] {
    return Array.from({ length: count }, (_, index) => {
        const angle = seeded(seed, index + 7) * Math.PI * 2;
        const radius = 13 + seeded(seed, index + 11) * 23;

        return {
            delay: -seeded(seed, index + 17) * 2.6,
            opacity: 0.38 + seeded(seed, index + 23) * 0.5,
            radius,
            size: 0.8 + seeded(seed, index + 29) * 1.1,
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    });
}

function distanceBetween(
    left: { x: number; y: number },
    right: { x: number; y: number },
): number {
    return Math.hypot(right.x - left.x, right.y - left.y) || 1;
}

function hashString(value: string): number {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function pseudoRandom(seed: number, salt: number): number {
    const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;

    return value - Math.floor(value);
}

function seeded(seed: number, salt: number): number {
    return pseudoRandom(seed || 1, salt);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
