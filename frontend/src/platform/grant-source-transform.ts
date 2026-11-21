/** Build-time identity/transport seams only. Callers select exact pinned files;
 * every replacement is guarded and leaves the complete presentation intact. */
export function transformGrantSource(code: string, kind: 'items' | 'tool'): string {
    const replace = (pattern: RegExp, value: string) => {
        if (code.match(pattern)?.length !== 1) throw new Error('The pinned grant identity/transport seam changed.');
        code = code.replace(pattern, value);
    };
    if (kind === 'items') {
        replace(/const itemId =\s*typeof rawItemId === 'number' \? rawItemId : Number\(rawItemId\);/g, 'const itemId = rawItemId;');
        replace(/Number\.isInteger\(itemId\)/g, 'isPlaybackIdentity(itemId)');
    } else {
        replace(/configuredToolId > 0/g, 'isPlaybackIdentity(configuredToolId)');
        replace(/(`\/learning\/activities\/\$\{activity\.id\}\/grant-tool`,\s*)\{\}/g, '$1{ play_run_id: props.playRunId }');
    }
    return `import { isPlaybackIdentity } from '/src/platform/playback-context.ts';\n${code}`;
}
