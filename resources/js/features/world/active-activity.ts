import type { LearningActivity, LearningNode } from '@/types';
import { worldHref } from './types';

const activeActivityStorageKey = 'learning.activeActivity';

export type ActiveActivity = {
    activityId: number;
    activityTitle: string;
    mapSlug?: string;
    nodeSlug?: string;
    nodeTitle: string;
    playHref?: string;
    worldHref?: string;
};

type ActiveActivityOptions = {
    routeId?: number | null;
    useCleanPlayHref?: boolean;
};

export function readPersistedActiveActivity(): ActiveActivity | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const stored = window.localStorage.getItem(activeActivityStorageKey);

    if (!stored) {
        return null;
    }

    try {
        return JSON.parse(stored) as ActiveActivity;
    } catch {
        return null;
    }
}

export function persistActiveActivity(
    node: LearningNode,
    activity: LearningActivity | null,
    options: ActiveActivityOptions = {},
): void {
    if (!activity || typeof window === 'undefined') {
        return;
    }

    const playHref = options.useCleanPlayHref
        ? `/learning/nodes/${node.id}/play`
        : playHrefFor(node, activity, options.routeId);

    window.localStorage.setItem(
        activeActivityStorageKey,
        JSON.stringify({
            activityId: activity.id,
            activityTitle: activity.title,
            mapSlug: node.mapSlug,
            nodeSlug: node.slug,
            nodeTitle: node.title,
            playHref,
            worldHref: `${worldHref}?map=${encodeURIComponent(node.mapSlug)}&focused=${encodeURIComponent(node.slug)}`,
        }),
    );
    window.dispatchEvent(new Event('learning:active-activity-changed'));
}

export function clearPersistedActiveActivity(): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.removeItem(activeActivityStorageKey);
    window.dispatchEvent(new Event('learning:active-activity-changed'));
}

function playHrefFor(
    node: LearningNode,
    activity: LearningActivity,
    routeId?: number | null,
): string {
    const query = new URLSearchParams({
        activity: activity.id.toString(),
    });

    if (routeId) {
        query.set('route', routeId.toString());
    }

    return `/learning/nodes/${node.id}/play?${query.toString()}`;
}
