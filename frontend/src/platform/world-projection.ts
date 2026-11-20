import type { components } from './api/schema';
import { toSourceGroupPage } from './world-groups';
import { registerBookmarkWorld } from './world-bookmarks';

type LearnerGroups = components['schemas']['LearnerGroupPage'];
type LearnerTranslations = components['schemas']['LearnerPlatformTranslationResponse'];
type LearnerWorldSnapshot = components['schemas']['LearnerWorldSnapshot'];
type CurrentUser = components['schemas']['CurrentUser'];
type LearnerSoundPreferences = components['schemas']['LearnerSoundPreferences'];

/**
 * Props consumed by the copied World page. The source still declares numeric
 * Laravel record IDs, while the Rust contract deliberately keeps UUIDs opaque.
 * Keep those UUIDs intact for source keys, comparisons, persisted continuation
 * and URLs. This adapter never converts them to fabricated numeric handles.
 */
export type WorldPageProps = {
    appearance: CurrentUser['appearance'];
    auth: { user: { subjectId: string } };
    bookmarkedNodeIds: string[];
    groups: ReturnType<typeof toSourceGroupPage>['groups'];
    groupsPagination: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
    localization: {
        locale: string;
        translations: Record<string, string>;
    };
    progress: unknown;
    soundPreferences: {
        ambienceVolume: number;
        effectsVolume: number;
        muted: boolean;
    };
    world: unknown;
};

export function toWorldPageProps(
    snapshot: LearnerWorldSnapshot,
    groups: LearnerGroups,
    currentUser: CurrentUser,
    translations: LearnerTranslations,
    soundPreferences: LearnerSoundPreferences,
): WorldPageProps {
    const nodeIds = new Map<string, string>();
    const progress: Record<string, { status: string }> = {};
    const graphMaps = new Map(snapshot.graph.maps.map((map) => [map.slug, map]));

    const world = {
        id: snapshot.graph.id,
        slug: snapshot.world.slug,
        title: snapshot.world.title,
        description: snapshot.world.description,
        themeConfig: snapshot.world.theme_config,
        maps: snapshot.world.maps.map((map) => {
            const graphMap = required(graphMaps.get(map.slug));
            const mapId = graphMap.id;
            const graphNodes = new Map(graphMap.nodes.map((node) => [node.slug, node]));
            const graphAssets = new Map(graphMap.assets.map((asset) => [asset.slug, asset]));
            const startsForMap = snapshot.start_routes.filter(
                (start) => start.map_slug === map.slug,
            );
            const nodes = map.nodes.map((node) => {
                const graphNode = required(graphNodes.get(node.slug));
                const nodeId = graphNode.id;
                const graphStarts = new Map(graphNode.starts.map((start) => [start.id, start]));
                const nodeKey = `${map.slug}:${node.slug}`;
                nodeIds.set(nodeKey, nodeId);
                const starts = startsForMap.filter(
                    (start) => start.node_slug === node.slug,
                );
                const activities = graphNode.activities.map((activity) => {
                    if (activity.status) progress[activity.id] = { status: activity.status };
                    return {
                        id: activity.id,
                        slug: activity.slug,
                        title: activity.title,
                        type: activity.activity_type,
                    };
                });
                if (graphNode.start_activity_id !== null) {
                    required(activities.find((activity) => activity.id === graphNode.start_activity_id));
                }

                return {
                    id: nodeId,
                    mapId,
                    mapSlug: map.slug,
                    mapTitle: map.title,
                    topic: map.topic
                        ? {
                            competenceHref: `/topics/${map.topic.slug}`,
                            href: `/topics/${map.topic.slug}`,
                            slug: map.topic.slug,
                            title: map.topic.title,
                        }
                        : null,
                    slug: node.slug,
                    title: node.title,
                    description: node.description,
                    position: { q: node.q, r: node.r },
                    state: node.state,
                    visualConfig: node.visual_config,
                    startActivityId: graphNode.start_activity_id,
                    startRoutes: starts.map((start) => {
                        const identity = required(graphStarts.get(start.start_id));
                        const activityId = required(activities.find(
                            (activity) => activity.id === identity.activity_id && activity.slug === start.activity_slug,
                        )).id;
                        const routeProgress = snapshot.route_progress.find(
                            (candidate) => candidate.start_id === start.start_id,
                        );

                        return {
                            activityId,
                            buttonBorderColorDark: start.button_border_color_dark,
                            buttonBorderColorLight: start.button_border_color_light,
                            buttonColorDark: start.button_color_dark,
                            buttonColorLight: start.button_color_light,
                            description: start.description,
                            id: start.start_id,
                            imageDark: start.image_dark,
                            imageLight: start.image_light,
                            label: start.label,
                            progress: routeProgress
                                ? {
                                    completionCount: routeProgress.completion_count,
                                    currentActivityId: identity.current_activity_id,
                                    lastCompletedAt: routeProgress.last_completed_at,
                                    lastEnteredAt: routeProgress.last_entered_at,
                                    playRunId: identity.play_run_id,
                                    status: routeProgress.status,
                                }
                                : null,
                            sortOrder: start.sort_order,
                        };
                    }),
                    activities,
                };
            });

            return {
                id: mapId,
                slug: map.slug,
                title: map.title,
                description: map.description,
                topic: map.topic
                    ? {
                        competenceHref: `/topics/${map.topic.slug}`,
                        href: `/topics/${map.topic.slug}`,
                        slug: map.topic.slug,
                        title: map.topic.title,
                    }
                    : null,
                backgroundConfig: map.background_config,
                gridConfig: map.grid_config,
                mapAssets: map.assets.map((asset) => ({
                    id: required(graphAssets.get(asset.slug)).id,
                    nodeId: nodeIds.get(
                        `${map.slug}:${map.nodes.find((node) => node.asset_slug === asset.slug)?.slug ?? ''}`,
                    ) ?? null,
                    imageUrl: asset.image_url,
                    text: asset.text,
                    x: asset.x,
                    y: asset.y,
                    z: asset.z,
                    width: asset.width,
                    opacity: asset.opacity,
                    locked: asset.locked,
                    focusable: asset.interaction_mode === 'focusable',
                    interactionMode: asset.interaction_mode,
                    interactionConfig: asset.interaction_config,
                    visualConfig: asset.visual_config,
                    soundConfig: asset.sound_config,
                })),
                mapAssetsLocked: map.map_assets_locked,
                nodes,
            };
        }),
    };

    registerBookmarkWorld(world, nodeIds);

    const bookmarkedNodeIds = snapshot.bookmarked_nodes.flatMap((bookmark) => {
        const nodeId = nodeIds.get(`${bookmark.map_slug}:${bookmark.node_slug}`);

        return nodeId ? [nodeId] : [];
    });
    const sourceGroups = toSourceGroupPage(groups);

    return {
        appearance: currentUser.appearance,
        auth: { user: { subjectId: currentUser.subject_id } },
        bookmarkedNodeIds,
        groups: sourceGroups.groups,
        groupsPagination: sourceGroups.pagination,
        localization: {
            locale: translations.locale,
            translations: translations.translations,
        },
        progress: { activities: progress },
        soundPreferences: {
            ambienceVolume: soundPreferences.ambience_volume,
            effectsVolume: soundPreferences.effects_volume,
            muted: soundPreferences.muted,
        },
        world,
    };
}

/** An incomplete server document must use the route's unavailable state. */
function required<T>(value: T | undefined): T {
    if (value === undefined) throw new Error('The World identity projection is incomplete.');
    return value;
}
