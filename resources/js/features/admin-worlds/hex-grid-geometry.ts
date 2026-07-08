export type Direction = {
    label: string;
    q: number;
    r: number;
    rotate: number;
};

export const directions: Direction[] = [
    { label: 'right', q: 1, r: 0, rotate: 0 },
    { label: 'upper right', q: 1, r: -1, rotate: -60 },
    { label: 'upper left', q: 0, r: -1, rotate: -120 },
    { label: 'left', q: -1, r: 0, rotate: 180 },
    { label: 'lower left', q: -1, r: 1, rotate: 120 },
    { label: 'lower right', q: 0, r: 1, rotate: 60 },
];

export const hexWidth = 120;
export const hexHeight = 104;
export const edgeGap = 90;
export const tileControlWidth = 220;
export const tileControlHeight = 202;
export const dragClickThreshold = 6;

const centerDistanceScale = (hexHeight + edgeGap) / hexHeight;
const horizontalStep = hexWidth * 0.75 * centerDistanceScale;
const verticalStep = hexHeight + edgeGap;
const tileCenter = {
    x: tileControlWidth / 2,
    y: tileControlHeight / 2,
};
const edgeControlOutset = 8;

export function coordinateKey(q: number, r: number): string {
    return `${q}:${r}`;
}

export function axialToPoint(q: number, r: number): { x: number; y: number } {
    return {
        x: q * horizontalStep,
        y: (r + q / 2) * verticalStep,
    };
}

export function edgeControlPosition(direction: Direction): {
    rotation: number;
    x: number;
    y: number;
} {
    const edge = edgeGeometryForDirection(direction);
    const normal = unitVectorForAngle(screenAngleForDirection(direction));

    return {
        rotation: screenAngleForDirection(direction),
        x: tileCenter.x + edge.center.x + normal.x * edgeControlOutset,
        y: tileCenter.y + edge.center.y + normal.y * edgeControlOutset,
    };
}

export function insertControlLine(direction: Direction): {
    end: { x: number; y: number };
    midpoint: { x: number; y: number };
    start: { x: number; y: number };
} {
    const sourceArrow = edgeControlPosition(direction);
    const neighborOffset = axialToPoint(direction.q, direction.r);
    const targetArrow = edgeControlPosition(oppositeDirection(direction));
    const end = {
        x: neighborOffset.x + targetArrow.x,
        y: neighborOffset.y + targetArrow.y,
    };
    const start = {
        x: sourceArrow.x,
        y: sourceArrow.y,
    };

    return {
        end,
        midpoint: {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
        },
        start,
    };
}

function oppositeDirection(direction: Direction): Direction {
    return (
        directions.find(
            (candidate) =>
                candidate.q === -direction.q && candidate.r === -direction.r,
        ) ?? direction
    );
}

function screenAngleForDirection(direction: Direction): number {
    const target = axialToPoint(direction.q, direction.r);

    return (Math.atan2(target.y, target.x) * 180) / Math.PI;
}

function unitVectorForAngle(angle: number): { x: number; y: number } {
    const radians = (angle * Math.PI) / 180;

    return {
        x: Math.cos(radians),
        y: Math.sin(radians),
    };
}

function edgeGeometryForDirection(direction: Direction): {
    center: { x: number; y: number };
} {
    switch (coordinateKey(direction.q, direction.r)) {
        case '1:0':
            return { center: { x: hexWidth * 0.375, y: hexHeight * 0.25 } };
        case '1:-1':
            return { center: { x: hexWidth * 0.375, y: -hexHeight * 0.25 } };
        case '0:-1':
            return { center: { x: 0, y: -hexHeight * 0.5 } };
        case '-1:0':
            return { center: { x: -hexWidth * 0.375, y: -hexHeight * 0.25 } };
        case '-1:1':
            return { center: { x: -hexWidth * 0.375, y: hexHeight * 0.25 } };
        case '0:1':
            return { center: { x: 0, y: hexHeight * 0.5 } };
        default:
            return { center: { x: 0, y: 0 } };
    }
}
