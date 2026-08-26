<?php

namespace App\Learning\Actions;

use App\Learning\Services\LearningActivityReviewState;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;

class CreateNpcDialogueTransition
{
    public function __construct(private readonly LearningActivityReviewState $reviewState) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(LearningActivity $activity, array $data): NpcDialogueTransition
    {
        $fromNodeId = $this->validatedNodeId($activity, $data['from_dialogue_node_id'] ?? null, true);
        $toNodeId = $this->validatedNodeId($activity, $data['to_dialogue_node_id'] ?? null, false);

        $transition = NpcDialogueTransition::query()->firstOrCreate([
            'learning_activity_id' => $activity->id,
            'from_dialogue_node_id' => $fromNodeId,
            'to_dialogue_node_id' => $toNodeId,
            'from_connector' => $data['from_connector'] ?? 'out',
            'to_connector' => $data['to_connector'] ?? 'in',
        ]);

        if ($transition->wasRecentlyCreated) {
            $this->reviewState->markNeedsReview($activity);
        }

        return $transition;
    }

    private function validatedNodeId(LearningActivity $activity, mixed $nodeId, bool $nullable): ?int
    {
        if ($nodeId === null && $nullable) {
            return null;
        }

        return NpcDialogueNode::query()
            ->where('learning_activity_id', $activity->id)
            ->whereKey((int) $nodeId)
            ->firstOrFail()
            ->id;
    }
}
