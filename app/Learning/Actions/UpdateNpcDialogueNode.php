<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Learning\Services\NpcDialogueConfiguration;
use App\Models\NpcDialogueNode;

class UpdateNpcDialogueNode
{
    public function __construct(
        private readonly NpcDialogueConfiguration $configuration,
        private readonly LearningActivityReviewState $reviewState,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(NpcDialogueNode $node, array $data): NpcDialogueNode
    {
        $updates = [];

        foreach (['type', 'title', 'body', 'graph_position_x', 'graph_position_y'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }

        if (array_key_exists('config', $data)) {
            $type = (string) ($updates['type'] ?? $node->type);

            $updates['config'] = $this->configuration->configFor(
                $type,
                $data,
                is_array($node->config) ? $node->config : [],
            );
        }

        $node->forceFill($updates);

        if ($node->isDirty()) {
            $contentChanged = $node->isDirty(['type', 'title', 'body', 'config']);
            $node->save();

            if ($contentChanged) {
                $this->reviewState->markNeedsReview($node->activity);
            }
        }

        return $node;
    }
}
