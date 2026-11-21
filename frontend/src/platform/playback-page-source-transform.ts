/** Exact page-only transport/opaque identity seams; no source JSX changes. */
export function transformPlaybackPage(code: string): string {
    const reload = 'void router.reload({';
    const numericRoute = 'route.id > 0 && route.id !== playRouteId';
    const portalVisit = /router\.visit\(\s*`\/learning\/nodes\/\$\{(portalLink|destination\.portalLink)\.targetNodeId\}\/play\$\{activityQuery\}`,\s*\)/g;
    if (code.split(reload).length !== 2 || code.split(numericRoute).length !== 2 || code.match(portalVisit)?.length !== 2) throw new Error('The pinned player page seams changed.');
    return "import { reloadPlaybackCompanion } from '/src/platform/playback-page-api.ts';\n" +
        "import { navigatePlaybackPortal } from '/src/platform/playback-portal-api.ts';\n" +
        "import { isPlaybackIdentity } from '/src/platform/playback-context.ts';\n" +
        code.replace(reload, 'void reloadPlaybackCompanion(playRunId, requestedActivityId, {')
            .replace(numericRoute, 'isPlaybackIdentity(route.id) && route.id !== playRouteId')
            .replace(portalVisit, (_match, link) => `navigatePlaybackPortal(playRunId, ${link}, router.visit)`);
}

/** One source async portal action; errors go to the platform boundary. */
export function transformPortalAction(code: string): string {
    const action = 'void enterPortal()';
    if (code.split(action).length !== 2) throw new Error('The pinned portal action seam changed.');
    return "import { performPortalAction } from '/src/platform/playback-portal-api.ts';\n" +
        code.replace(action, 'void performPortalAction(node.id, activity.id, enterPortal)');
}
