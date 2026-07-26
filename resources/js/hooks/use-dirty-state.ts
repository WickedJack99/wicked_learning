import { useMemo } from 'react';

export function useDirtyState(current: unknown, baseline: unknown): boolean {
    return useMemo(() => isDirtyState(current, baseline), [baseline, current]);
}

export function isDirtyState(current: unknown, baseline: unknown): boolean {
    return stableSerialize(current) !== stableSerialize(baseline);
}

function stableSerialize(value: unknown): string {
    return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
}
