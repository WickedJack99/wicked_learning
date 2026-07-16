<?php

namespace App\Localization\Services;

use App\Models\DialogueStage;
use App\Models\LearningActivity;
use App\Models\LearningQuestionOption;
use App\Models\NpcDialogueNode;

/**
 * Builds the editable learner-copy surface for one activity.
 * Deliberately excludes answer correctness, weights, outcomes and graph targets.
 */
class ActivityTranslationPayloadFactory
{
    /**
     * @return array<string, mixed>
     */
    public function make(LearningActivity $activity): array
    {
        $activity->loadMissing([
            'dialogueStages',
            'npcDialogueNodes',
            'question.options',
            'transitions',
        ]);

        return [
            'title' => $activity->title,
            'introduction' => $activity->introduction,
            'config' => $this->configurationCopy($activity),
            'dialogueStages' => $activity->dialogueStages
                ->mapWithKeys(fn (DialogueStage $stage): array => [$stage->id => [
                    'speakerName' => $stage->speaker_name,
                    'speakerRole' => $stage->speaker_role,
                    'body' => $stage->body,
                    'imageAlt' => $stage->image_alt,
                    'mood' => $stage->mood,
                ]])
                ->all(),
            'npcDialogueNodes' => $activity->npcDialogueNodes
                ->mapWithKeys(fn (NpcDialogueNode $node): array => [$node->id => [
                    'title' => $node->title,
                    'body' => $node->body,
                ]])
                ->all(),
            'question' => $activity->question ? [
                'prompt' => $activity->question->prompt,
                'options' => $activity->question->options
                    ->mapWithKeys(fn (LearningQuestionOption $option): array => [$option->id => [
                        'label' => $option->label,
                        'body' => $option->body,
                    ]])
                    ->all(),
            ] : null,
            'transitions' => $activity->transitions
                ->mapWithKeys(fn ($transition): array => [$transition->id => [
                    'label' => $transition->label,
                ]])
                ->all(),
        ];
    }

    /**
     * Return only learner-facing configuration copy.
     *
     * Configuration also carries behavior such as item IDs, required tools and
     * visual coordinates. Keeping those values out of the catalog prevents a
     * translation import from changing how an activity behaves.
     *
     * @return array<string, mixed>
     */
    private function configurationCopy(LearningActivity $activity): array
    {
        $config = is_array($activity->config) ? $activity->config : [];
        $copy = [];

        foreach (['promptText', 'successText', 'revisitText', 'text'] as $key) {
            if (array_key_exists($key, $config) && is_string($config[$key])) {
                $copy[$key] = $config[$key];
            }
        }

        $pages = is_array($config['markdownPages'] ?? null) ? $config['markdownPages'] : [];

        $copy['markdownPages'] = collect($pages)
            ->filter(fn (mixed $page): bool => is_array($page) && is_string($page['id'] ?? null))
            ->mapWithKeys(fn (array $page): array => [$page['id'] => [
                'title' => is_string($page['title'] ?? null) ? $page['title'] : '',
                'body' => is_string($page['body'] ?? null) ? $page['body'] : '',
            ]])
            ->all();

        return $copy;
    }
}
