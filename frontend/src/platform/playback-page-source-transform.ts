/** Exact page-only transport/opaque identity seams; no source JSX changes. */
export function transformPlaybackPage(code: string): string {
    const reload = 'void router.reload({';
    const numericRoute = 'route.id > 0 && route.id !== playRouteId';
    if (code.split(reload).length !== 2 || code.split(numericRoute).length !== 2) throw new Error('The pinned player page seams changed.');
    return "import { reloadPlaybackCompanion } from '/src/platform/playback-page-api.ts';\n" +
        "import { isPlaybackIdentity } from '/src/platform/playback-context.ts';\n" +
        code.replace(reload, 'void reloadPlaybackCompanion(playRunId, requestedActivityId, {')
            .replace(numericRoute, 'isPlaybackIdentity(route.id) && route.id !== playRouteId');
}
