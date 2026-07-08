<?php

namespace App\Learning\Validation;

use App\Learning\ActivityTypeRegistry;
use App\Models\LearningActivity;
use App\Models\LearningNode;
use Illuminate\Validation\Rule;

class AdminActivityRules
{
    public function __construct(private readonly ActivityTypeRegistry $activityTypes) {}

    /**
     * @return array<string, mixed>
     */
    public function store(LearningNode $node): array
    {
        return [
            ...$this->activityContentRules($node),
            ...$this->portalRules(),
            'graph_position_x' => ['nullable', 'integer'],
            'graph_position_y' => ['nullable', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function update(LearningActivity $activity): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'slug' => [
                'sometimes',
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_activities', 'slug')
                    ->where('learning_node_id', $activity->learning_node_id)
                    ->ignore($activity->id),
            ],
            'type' => ['sometimes', 'required', 'string', Rule::in($this->activityTypes->typeKeys())],
            'introduction' => ['sometimes', 'nullable', 'string', 'max:1000'],
            ...$this->portalRules('sometimes'),
            'graph_position_x' => ['sometimes', 'required', 'integer'],
            'graph_position_y' => ['sometimes', 'required', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function start(): array
    {
        return ['activity_id' => ['required', 'integer']];
    }

    /**
     * @return array<string, mixed>
     */
    public function destroyStart(): array
    {
        return ['activity_id' => ['nullable', 'integer']];
    }

    /**
     * @return array<string, mixed>
     */
    public function startRoute(): array
    {
        return [
            'image_dark' => ['nullable', 'string', 'max:2048'],
            'image_light' => ['nullable', 'string', 'max:2048'],
            'button_color_dark' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_border_color_dark' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_color_light' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'button_border_color_light' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function transition(): array
    {
        return [
            'from_activity_id' => ['required', 'integer'],
            'to_activity_id' => ['nullable', 'integer'],
            'from_connector' => ['required', 'string', 'max:80'],
            'to_connector' => ['required', 'string', 'max:80'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function activityContentRules(LearningNode $node): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_activities', 'slug')->where('learning_node_id', $node->id),
            ],
            'type' => ['required', 'string', Rule::in($this->activityTypes->typeKeys())],
            'introduction' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function portalRules(string $modifier = 'nullable'): array
    {
        return [
            'portal_mode' => [$modifier, 'string', Rule::in(['input', 'output'])],
            'portal_background_dark' => [$modifier, 'string', 'max:2048'],
            'portal_background_light' => [$modifier, 'string', 'max:2048'],
            'portal_duration_seconds' => [$modifier, 'numeric', 'min:0.5', 'max:60'],
            'portal_foreground_dark' => [$modifier, 'string', 'max:2048'],
            'portal_foreground_light' => [$modifier, 'string', 'max:2048'],
            'portal_foreground_x' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'portal_foreground_y' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'portal_swirl_enabled' => [$modifier, 'boolean'],
            'target_portal_activity_id' => [$modifier, 'integer'],
        ];
    }
}
