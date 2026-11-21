/** Exact pinned-component identity/transport seams; never replace scene JSX. */
export function transformObstacleSource(code: string, kind: 'items' | 'tool'): string {
    const replace = (pattern: RegExp, value: string) => {
        if (code.match(pattern)?.length !== 1) throw new Error('The pinned obstacle identity/transport seam changed.');
        code = code.replace(pattern, value);
    };
    replace(/const \{ resolvedAppearance \} = useAppearance\(\);/g, 'const { props } = usePage();\n    const { resolvedAppearance } = useAppearance();');
    if (kind === 'items') {
        replace(/const itemId = Number\(\s*event\.dataTransfer\.getData\('application\/learning-item-id'\),?\s*\);/g, "const itemId = event.dataTransfer.getData('application/learning-item-id');");
        replace(/if \(!itemId\)/g, 'if (!isPlaybackIdentity(itemId))');
        replace(/itemId: numericConfig\(slot\.itemId, 0\)/g, 'itemId: slot.itemId');
        replace(/\.filter\(\(slot\) => slot\.itemId > 0\)/g, '.filter((slot) => isPlaybackIdentity(slot.itemId))');
        replace(/const soundId = numericConfig\(soundConfig\.soundId, 0\);/g, 'const soundId = soundConfig.soundId;');
        replace(/(item-obstacle-slot`, \{)/g, '$1\n                play_run_id: props.playRunId,');
        replace(/(`\/learning\/activities\/\$\{activity\.id\}\/item-obstacle-continue`,\s*)\{\}/g, '$1{ play_run_id: props.playRunId }');
    } else {
        replace(/(obstacle-tool`, \{)/g, '$1\n                play_run_id: props.playRunId,');
    }
    return `import { usePage } from '@inertiajs/react';\n${kind === 'items' ? "import { isPlaybackIdentity } from '/src/platform/playback-context.ts';\n" : ''}${code}`;
}
