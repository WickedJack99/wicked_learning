<?php

namespace App\Learning\Serializers;

use App\Models\ActivityTransition;
use App\Models\DialogueStage;
use App\Models\LearningActivity;
use App\Models\LearningItem;
use App\Models\LearningQuestionOption;
use App\Models\LearningSound;
use App\Models\LearningTool;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;

class LearningActivitySerializer
{
    public function __construct(
        private readonly LearningToolSerializer $toolSerializer,
        private readonly LearningItemSerializer $itemSerializer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function serialize(LearningActivity $activity): array
    {
        return [
            'id' => $activity->id,
            'slug' => $activity->slug,
            'type' => $activity->type,
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $activity->config ?? [],
            'configuredItems' => $this->configuredItems($activity),
            'configuredSounds' => $this->configuredSounds($activity),
            'configuredTool' => $this->configuredTool($activity),
            'dialogueStages' => $activity->dialogueStages
                ->map(fn (DialogueStage $stage): array => $this->dialogueStage($stage))
                ->values(),
            'npcDialogueNodes' => $activity->npcDialogueNodes
                ->map(fn (NpcDialogueNode $node): array => $this->npcDialogueNode($node))
                ->values(),
            'npcDialogueTransitions' => $activity->npcDialogueTransitions
                ->map(fn (NpcDialogueTransition $transition): array => $this->npcDialogueTransition($transition))
                ->values(),
            'question' => $this->question($activity),
            'transitions' => $activity->transitions
                ->map(fn (ActivityTransition $transition): array => $this->transition($transition))
                ->values(),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function configuredSounds(LearningActivity $activity): array
    {
        if ($activity->type !== 'item_obstacle') {
            return [];
        }

        $config = is_array($activity->config) ? $activity->config : [];
        $sounds = is_array($config['sounds'] ?? null) ? $config['sounds'] : [];
        $ids = collect($sounds)
            ->filter(fn (mixed $sound): bool => is_array($sound))
            ->map(fn (mixed $sound): int => (int) ($sound['soundId'] ?? 0))
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return LearningSound::query()
            ->whereIn('id', $ids->all())
            ->get()
            ->map(fn (LearningSound $sound): array => [
                'id' => $sound->id,
                'name' => $sound->name,
                'slug' => $sound->slug,
                'icon' => $sound->icon,
                'url' => $sound->url,
                'volume' => $sound->volume,
                'playSeconds' => $sound->play_seconds,
                'loop' => $sound->loop,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function configuredItems(LearningActivity $activity): array
    {
        if (! in_array($activity->type, ['item_grant', 'item_obstacle'], true)) {
            return [];
        }

        $ids = collect($this->configuredItemIds($activity))->unique()->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return LearningItem::query()
            ->whereIn('id', $ids->all())
            ->get()
            ->map(fn (LearningItem $item): array => $this->itemSerializer->serialize($item))
            ->values()
            ->all();
    }

    /**
     * @return list<int>
     */
    private function configuredItemIds(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];

        if ($activity->type === 'item_grant') {
            $items = is_array($config['items'] ?? null) ? $config['items'] : [];

            return array_values(array_filter(array_map(
                fn (mixed $item): int => is_array($item) ? (int) ($item['itemId'] ?? 0) : 0,
                $items,
            )));
        }

        $slots = is_array($config['slots'] ?? null) ? $config['slots'] : [];

        return array_values(array_filter(array_map(
            fn (mixed $slot): int => is_array($slot) ? (int) ($slot['itemId'] ?? 0) : 0,
            $slots,
        )));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function configuredTool(LearningActivity $activity): ?array
    {
        if ($activity->type !== 'tool_grant') {
            return null;
        }

        $config = is_array($activity->config) ? $activity->config : [];
        $toolId = is_numeric($config['toolId'] ?? null) ? (int) $config['toolId'] : 0;

        if ($toolId <= 0) {
            return null;
        }

        $tool = LearningTool::query()->find($toolId);

        return $tool instanceof LearningTool
            ? $this->toolSerializer->serialize($tool)
            : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function npcDialogueNode(NpcDialogueNode $node): array
    {
        return [
            'id' => $node->id,
            'type' => $node->type,
            'title' => $node->title,
            'body' => $node->body,
            'config' => $node->config ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function npcDialogueTransition(NpcDialogueTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'fromNodeId' => $transition->from_dialogue_node_id,
            'toNodeId' => $transition->to_dialogue_node_id,
            'fromConnector' => $transition->from_connector,
            'toConnector' => $transition->to_connector,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function dialogueStage(DialogueStage $stage): array
    {
        return [
            'id' => $stage->id,
            'key' => $stage->stage_key,
            'speakerName' => $stage->speaker_name,
            'speakerRole' => $stage->speaker_role,
            'body' => $stage->body,
            'portraitUrl' => $stage->portrait_url,
            'imageAlt' => $stage->image_alt,
            'mood' => $stage->mood,
            'visualConfig' => $stage->visual_config ?? [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function question(LearningActivity $activity): ?array
    {
        if (! $activity->question) {
            return null;
        }

        return [
            'id' => $activity->question->id,
            'prompt' => $activity->question->prompt,
            'allowMultiple' => $activity->question->allow_multiple,
            'options' => $activity->question->options
                ->map(fn (LearningQuestionOption $option): array => $this->questionOption($option))
                ->values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function questionOption(LearningQuestionOption $option): array
    {
        return [
            'id' => $option->id,
            'label' => $option->label,
            'body' => $option->body,
            'outcomeKey' => $option->outcome_key,
            'weights' => $option->weights ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transition(ActivityTransition $transition): array
    {
        return [
            'id' => $transition->id,
            'toActivityId' => $transition->to_activity_id,
            'fromConnector' => $transition->from_connector ?? $transition->trigger ?? 'completed',
            'toConnector' => $transition->to_connector ?? 'in',
            'trigger' => $transition->trigger,
            'triggerValue' => $transition->trigger_value,
            'label' => $transition->label,
        ];
    }
}
