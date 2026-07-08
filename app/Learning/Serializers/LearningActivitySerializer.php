<?php

namespace App\Learning\Serializers;

use App\Models\ActivityTransition;
use App\Models\DialogueStage;
use App\Models\LearningActivity;
use App\Models\LearningQuestionOption;
use App\Models\NpcDialogueNode;
use App\Models\NpcDialogueTransition;

class LearningActivitySerializer
{
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
            'fromConnector' => $transition->from_connector ?? $transition->trigger,
            'toConnector' => $transition->to_connector ?? 'in',
            'trigger' => $transition->trigger,
            'triggerValue' => $transition->trigger_value,
            'label' => $transition->label,
        ];
    }
}
