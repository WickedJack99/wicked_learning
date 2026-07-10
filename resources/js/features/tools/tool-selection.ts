import { useMemo, useSyncExternalStore } from 'react';
import type { LearningTool } from '@/types';

let selectedTool: LearningTool | null = null;
let grantedTools: LearningTool[] = [];
let version = 0;
const listeners = new Set<() => void>();

export function selectedLearningTool(): LearningTool | null {
    return selectedTool;
}

export function selectLearningTool(tool: LearningTool | null): void {
    selectedTool = tool;
    version += 1;
    listeners.forEach((listener) => listener());
}

export function addGrantedLearningTool(tool: LearningTool): void {
    if (!grantedTools.some((current) => current.id === tool.id)) {
        grantedTools = [...grantedTools, tool];
    }

    selectedTool = tool;
    version += 1;
    listeners.forEach((listener) => listener());
}

export function useAvailableLearningTools(
    baseTools: LearningTool[],
): LearningTool[] {
    const currentVersion = useSyncExternalStore(
        subscribe,
        currentToolStoreVersion,
        () => 0,
    );

    return useMemo(() => {
        void currentVersion;

        return mergedTools(baseTools);
    }, [baseTools, currentVersion]);
}

export function useSelectedLearningTool(): LearningTool | null {
    return useSyncExternalStore(subscribe, selectedLearningTool, () => null);
}

function mergedTools(baseTools: LearningTool[]): LearningTool[] {
    const seen = new Set(baseTools.map((tool) => tool.id));
    const newTools = grantedTools.filter((tool) => !seen.has(tool.id));

    return [...baseTools, ...newTools];
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function currentToolStoreVersion(): number {
    return version;
}
