import type { ActivityForm } from './edit-node-activity-types';

export type ActivityTemplateReference = 'message_topic' | 'portal_destination';

export type ActivityTemplateContext = {
    references: ActivityTemplateReference[];
    scope: 'current_map_asset';
};

/**
 * Identifies references that need a tutor's attention before reuse expands
 * beyond the current MapAsset.
 */
export function activityTemplateContext(
    form: Pick<
        ActivityForm,
        'message_topic_id' | 'target_portal_activity_id' | 'type'
    >,
): ActivityTemplateContext {
    const references: ActivityTemplateReference[] = [];

    if (
        (form.type === 'message_prompt' || form.type === 'message_wall') &&
        form.message_topic_id.trim() !== ''
    ) {
        references.push('message_topic');
    }

    if (
        form.type === 'portal' &&
        form.target_portal_activity_id.trim() !== ''
    ) {
        references.push('portal_destination');
    }

    return {
        references,
        scope: 'current_map_asset',
    };
}
