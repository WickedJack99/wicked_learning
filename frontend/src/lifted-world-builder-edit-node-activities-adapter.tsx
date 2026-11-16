import { useMemo, useState } from 'react';

import type { components } from './api/schema';
import { LiftedMarkdownActivityDocument } from './lifted-world-builder-edit-markdown-activity-adapter';
import { LiftedNpcDialogueDocument } from './lifted-world-builder-edit-npc-dialogue-adapter';
import EditNodeActivities from './lifted-world-builder-edit-node-activities';
import { adaptRustActivityEditorDocument } from './lifted-world-builder-activity-editor-adapter';
import type { ActivitySummary } from './lifted-world-builder-edit-node-activity-types';

type RustNodeDocument = components['schemas']['AdminEditableNode'];
type RustWorldGraph = components['schemas']['AdminWorldGraph'];

/**
 * Owns the selected-node boundary: Rust's scoped UUID document becomes the
 * source page props exactly once, while dedicated Markdown/NPC source routes
 * retain their own already-lifted documents.
 */
export function LiftedNodeActivityEditorDocument({
    document,
    onOpenMarkdown,
    onOpenNpcDialogue,
    onReload,
    worldGraph,
}: {
    document: RustNodeDocument;
    onOpenMarkdown?: (activityId: string) => void;
    onOpenNpcDialogue?: (activityId: string) => void;
    onReload: () => void;
    worldGraph: RustWorldGraph | null;
}) {
    const adapted = useMemo(
        () => adaptRustActivityEditorDocument(document, worldGraph),
        [document, worldGraph],
    );
    const [dedicatedActivity, setDedicatedActivity] =
        useState<ActivitySummary | null>(null);

    const closeDedicatedActivity = () => {
        setDedicatedActivity(null);
        onReload();
    };

    if (dedicatedActivity?.type === 'markdown') {
        return (
            <LiftedMarkdownActivityDocument
                activityId={dedicatedActivity.id}
                graph={document.activity_graph}
                onBack={closeDedicatedActivity}
                onUpdated={onReload}
            />
        );
    }

    if (dedicatedActivity?.type === 'npc_dialogue') {
        return (
            <LiftedNpcDialogueDocument
                activityId={dedicatedActivity.id}
                onBack={closeDedicatedActivity}
                onUpdated={() => undefined}
                tools={document.tools}
            />
        );
    }

    return (
        <EditNodeActivities
            activityGraph={adapted.activityGraph}
            embedded
            items={adapted.items}
            onOpenDedicatedActivity={(activity) => {
                if (activity.type === 'markdown' && onOpenMarkdown) {
                    onOpenMarkdown(activity.id);

                    return;
                }

                if (activity.type === 'npc_dialogue' && onOpenNpcDialogue) {
                    onOpenNpcDialogue(activity.id);

                    return;
                }

                setDedicatedActivity(activity);
            }}
            onReload={onReload}
            sounds={adapted.sounds}
            tools={adapted.tools}
            worldGraph={adapted.worldGraph}
        />
    );
}
