<?php

namespace App\Learning\Services;

use App\Models\LearnerNodeDiscovery;
use App\Models\LearningNode;
use App\Models\NpcDialogueNode;
use App\Models\User;
use Illuminate\Support\Carbon;

class LearnerNodeAnswerEventService
{
    public function apply(User $user, NpcDialogueNode $answerNode): void
    {
        $config = is_array($answerNode->config) ? $answerNode->config : [];
        $events = is_array($config['events'] ?? null) ? $config['events'] : [];

        $this->applyNodeEvents(
            $user,
            $answerNode,
            $this->nodeIds($events['hideNodeIds'] ?? []),
            'hiddenAt',
        );

        $this->applyNodeEvents(
            $user,
            $answerNode,
            $this->nodeIds($events['unlockNodeIds'] ?? []),
            'unlockedAt',
        );
    }

    public function isHiddenForUser(LearningNode $node, ?int $userId): bool
    {
        return $userId !== null && $this->answerEventHasTimestamp($node, $userId, 'hiddenAt');
    }

    public function isUnlockedForUser(LearningNode $node, ?int $userId): bool
    {
        return $userId !== null && $this->answerEventHasTimestamp($node, $userId, 'unlockedAt');
    }

    /**
     * @param  array<int, int>  $nodeIds
     */
    private function applyNodeEvents(User $user, NpcDialogueNode $answerNode, array $nodeIds, string $eventKey): void
    {
        foreach ($nodeIds as $nodeId) {
            $node = LearningNode::query()->find($nodeId);

            if (! $node) {
                continue;
            }

            $discovery = LearnerNodeDiscovery::query()->firstOrNew([
                'user_id' => $user->id,
                'learning_node_id' => $node->id,
            ]);

            $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];
            $answerEvents = is_array($metadata['answerEvents'] ?? null) ? $metadata['answerEvents'] : [];
            $existingEvent = is_array($answerEvents[$eventKey] ?? null) ? $answerEvents[$eventKey] : [];

            $answerEvents[$eventKey] = [
                'activityId' => $answerNode->learning_activity_id,
                'answerNodeId' => $answerNode->id,
                'at' => $existingEvent['at'] ?? Carbon::now()->toIso8601String(),
            ];

            $metadata['answerEvents'] = $answerEvents;
            $discovery->discovered_at ??= Carbon::now();
            $discovery->metadata = $metadata;
            $discovery->save();
        }
    }

    private function answerEventHasTimestamp(LearningNode $node, int $userId, string $eventKey): bool
    {
        $node->loadMissing('discoveries');

        return $node->discoveries->contains(function (LearnerNodeDiscovery $discovery) use ($eventKey, $userId): bool {
            $metadata = is_array($discovery->metadata) ? $discovery->metadata : [];
            $answerEvents = is_array($metadata['answerEvents'] ?? null) ? $metadata['answerEvents'] : [];
            $event = is_array($answerEvents[$eventKey] ?? null) ? $answerEvents[$eventKey] : [];

            return $discovery->user_id === $userId && isset($event['at']);
        });
    }

    /**
     * @return array<int, int>
     */
    private function nodeIds(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return collect($value)
            ->map(fn (mixed $nodeId): int => (int) $nodeId)
            ->filter(fn (int $nodeId): bool => $nodeId > 0)
            ->unique()
            ->values()
            ->all();
    }
}
