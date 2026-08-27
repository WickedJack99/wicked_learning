<?php

namespace App\Learning\Services;

use App\Learning\Queries\LoadCompetenceTopicDefinitions;
use App\Models\LearningActivity;
use App\Models\NpcDialogueNode;

class ActivityReviewContext
{
    public function __construct(
        private readonly ActivityCompetenceConfiguration $competence,
        private readonly LoadCompetenceTopicDefinitions $competenceTopics,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidance,
    ) {}

    /** @return array<string, mixed> */
    public function for(LearningActivity $activity): array
    {
        $activity->loadMissing([
            'node.map',
            'transitions.toActivity',
            'npcDialogueNodes',
        ]);

        return [
            'map' => [
                'title' => $activity->node->map->title,
            ],
            'node' => [
                'title' => $activity->node->title,
                'description' => $activity->node->description,
            ],
            'activity' => [
                'title' => $activity->title,
                'type' => $activity->type,
                'introduction' => $activity->introduction,
                'learningIntent' => $this->competence->learningIntentForActivity($activity),
                'competenceTopics' => $this->competence->topicsForActivity($activity),
                'feedbackGuidance' => $this->feedbackGuidance->forActivity($activity),
                'content' => $this->content($activity),
            ],
            'availableCompetenceTopics' => $this->competenceTopics->names(),
            'nearbyActivities' => $this->nearbyActivities($activity),
        ];
    }

    /** @return array<string, mixed> */
    private function content(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        return match ($activity->type) {
            'markdown' => [
                'pages' => collect(is_array($config['markdownPages'] ?? null) ? $config['markdownPages'] : [])
                    ->map(fn (mixed $page): array => [
                        'title' => is_array($page) ? (string) ($page['title'] ?? '') : '',
                        'body' => is_array($page) ? $this->limit((string) ($page['body'] ?? ''), 5000) : '',
                    ])
                    ->values()
                    ->all(),
            ],
            'reflection' => [
                'prompt' => $this->limit((string) ($config['prompt'] ?? ''), 2000),
                'note' => $this->limit((string) ($config['note'] ?? ''), 1200),
                'topic' => (string) ($config['topic'] ?? ''),
            ],
            'message_prompt', 'message_wall' => [
                'prompt' => $this->limit((string) ($config['messagePrompt'] ?? ''), 2000),
                'inputLabel' => (string) ($config['messageInputLabel'] ?? ''),
            ],
            'obstacle', 'item_obstacle', 'tool_obstacle' => [
                'prompt' => $this->limit((string) ($config['promptText'] ?? ''), 2000),
                'successText' => $this->limit((string) ($config['successText'] ?? ''), 1200),
                'revisitText' => $this->limit((string) ($config['revisitText'] ?? ''), 1200),
            ],
            'shared_task' => [
                'prompt' => $this->limit((string) ($config['prompt'] ?? ''), 2000),
                'instructions' => $this->limit((string) ($config['instructions'] ?? ''), 2000),
                'inputLabel' => (string) ($config['inputLabel'] ?? ''),
            ],
            'npc_dialogue' => [
                'nodes' => $activity->npcDialogueNodes
                    ->take(12)
                    ->map(fn (NpcDialogueNode $node): array => [
                        'type' => $node->type,
                        'title' => $node->title,
                        'body' => $this->limit((string) ($node->body ?? ''), 2500),
                    ])
                    ->values()
                    ->all(),
            ],
            default => [],
        };
    }

    /** @return list<array<string, mixed>> */
    private function nearbyActivities(LearningActivity $activity): array
    {
        $incoming = $activity->node->activities()
            ->whereHas('transitions', fn ($query) => $query->where('to_activity_id', $activity->id))
            ->get();
        $outgoing = $activity->transitions
            ->filter(fn ($transition): bool => $transition->toActivity !== null)
            ->pluck('toActivity');

        return array_values($incoming
            ->concat($outgoing)
            ->unique('id')
            ->reject(fn (LearningActivity $neighbor): bool => $neighbor->id === $activity->id)
            ->take(6)
            ->map(fn (LearningActivity $neighbor): array => [
                'title' => $neighbor->title,
                'type' => $neighbor->type,
                'learningIntent' => $this->competence->learningIntentForActivity($neighbor),
            ])
            ->values()
            ->all());
    }

    private function limit(string $value, int $limit): string
    {
        return mb_substr($value, 0, $limit);
    }
}
