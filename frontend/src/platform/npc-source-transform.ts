/** Exact identity/transport substitutions in the whole pinned NPC module. */
export function transformNpcSource(code: string): string {
    const replace = (pattern: RegExp, value: string) => {
        if (code.match(pattern)?.length !== 1) throw new Error('The pinned NPC identity/transport seam changed.');
        code = code.replace(pattern, value);
    };
    replace(/numericConfig\(\s*currentNode\?\.config\.typingSoundSetId,\s*0,?\s*\)/g, 'npcReference(currentNode?.config.typingSoundSetId)');
    replace(/numericConfig\(currentNode\.config\.toolId, 0\)/g, 'npcReference(currentNode.config.toolId)');
    replace(/numericConfig\(state\.currentNodeId, 0\)/g, 'npcReference(state.currentNodeId)');
    replace(/numericConfig\(nodeId, 0\)/g, 'npcReference(nodeId)');
    const urls = /`\/learning\/(?:activities\/\$\{activity\.id\}\/npc-dialogue-state|npc-dialogue-nodes\/\$\{currentNode\.id\}\/(?:grant-tool|answer|reflection))`/g;
    if (code.match(urls)?.length !== 4) throw new Error('The pinned NPC URLs changed.');
    return "import { npcReference, scopedNpcUrl } from '/src/platform/playback-npc-api.ts';\n" +
        code.replace(urls, (url) => `scopedNpcUrl(${url}, activity.id, playRunId)`);
}
