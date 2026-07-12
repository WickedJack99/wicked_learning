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
            ...$this->itemGrantRules(),
            ...$this->itemObstacleRules(),
            ...$this->markdownRules(),
            ...$this->obstacleRules(),
            ...$this->portalRules(),
            ...$this->toolGrantRules(),
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
            ...$this->itemGrantRules('sometimes'),
            ...$this->itemObstacleRules('sometimes'),
            ...$this->markdownRules('sometimes'),
            ...$this->obstacleRules('sometimes'),
            ...$this->portalRules('sometimes'),
            ...$this->toolGrantRules('sometimes'),
            'graph_position_x' => ['sometimes', 'required', 'integer'],
            'graph_position_y' => ['sometimes', 'required', 'integer'],
            'return_to_markdown' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function specialGraphNodeLayout(): array
    {
        return [
            'node' => ['required', 'string', Rule::in(['start', 'end'])],
            'position' => ['required', 'array'],
            'position.x' => ['required', 'numeric'],
            'position.y' => ['required', 'numeric'],
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
            'portal_foreground_width' => [$modifier, 'numeric', 'min:1', 'max:100'],
            'portal_foreground_x' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'portal_foreground_y' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'portal_show_on_arrival' => [$modifier, 'boolean'],
            'portal_swirl_enabled' => [$modifier, 'boolean'],
            'portal_wait_for_enter' => [$modifier, 'boolean'],
            'target_portal_activity_id' => [$modifier, 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function itemGrantRules(string $modifier = 'nullable'): array
    {
        return [
            'item_grant_background_dark' => [$modifier, 'nullable', 'string', 'max:2048'],
            'item_grant_background_light' => [$modifier, 'nullable', 'string', 'max:2048'],
            'item_grant_items' => [$modifier, 'array'],
            'item_grant_items.*.itemId' => $this->optional($modifier, ['integer', 'exists:learning_items,id']),
            'item_grant_items.*.quantity' => $this->optional($modifier, ['integer', 'min:1', 'max:999']),
            'item_grant_probability_percent' => [$modifier, 'numeric', 'min:0.01', 'max:100'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function itemObstacleRules(string $modifier = 'nullable'): array
    {
        return [
            'item_obstacle_background_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_background_light' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_met_background_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_met_background_light' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_overlay_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_overlay_light' => $this->optional($modifier, ['string', 'max:2048']),
            'item_obstacle_overlay_x' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'item_obstacle_overlay_y' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'item_obstacle_overlay_width' => $this->optional($modifier, ['numeric', 'min:1', 'max:100']),
            'item_obstacle_slots' => [$modifier, 'array', 'max:10'],
            'item_obstacle_slots.*.itemId' => $this->optional($modifier, ['integer', 'exists:learning_items,id']),
            'item_obstacle_slots.*.x' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'item_obstacle_slots.*.y' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'item_obstacle_slots.*.width' => $this->optional($modifier, ['numeric', 'min:1', 'max:100']),
            'item_obstacle_lock_minutes' => [$modifier, 'integer', 'min:0', 'max:10080'],
            'item_obstacle_sound_not_met_enabled' => [$modifier, 'boolean'],
            'item_obstacle_sound_not_met_id' => [$modifier, 'nullable', 'integer', 'exists:learning_sounds,id'],
            'item_obstacle_sound_met_enabled' => [$modifier, 'boolean'],
            'item_obstacle_sound_met_id' => [$modifier, 'nullable', 'integer', 'exists:learning_sounds,id'],
            'item_obstacle_sound_transition_enabled' => [$modifier, 'boolean'],
            'item_obstacle_sound_transition_id' => [$modifier, 'nullable', 'integer', 'exists:learning_sounds,id'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function markdownRules(string $modifier = 'nullable'): array
    {
        return [
            'markdown_pages' => [$modifier, 'array'],
            'markdown_pages.*.id' => [$modifier, 'string', 'max:100'],
            'markdown_pages.*.title' => [$modifier, 'string', 'max:160'],
            'markdown_pages.*.body' => [$modifier, 'nullable', 'string', 'max:20000'],
            'markdown_pages.*.position.x' => [$modifier, 'numeric'],
            'markdown_pages.*.position.y' => [$modifier, 'numeric'],
            'markdown_pages.*.visual.pageColorDark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.pageColorLight' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.borderColorDark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.borderColorLight' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.headingColorDark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.headingColorLight' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.textColorDark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_pages.*.visual.textColorLight' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'markdown_transitions' => [$modifier, 'array'],
            'markdown_transitions.*.id' => [$modifier, 'string', 'max:140'],
            'markdown_transitions.*.from' => [$modifier, 'string', 'max:100'],
            'markdown_transitions.*.to' => [$modifier, 'string', 'max:100'],
            'markdown_graph_layout' => [$modifier, 'array'],
            'markdown_graph_layout.start' => ['sometimes', 'array'],
            'markdown_graph_layout.start.x' => ['sometimes', 'numeric'],
            'markdown_graph_layout.start.y' => ['sometimes', 'numeric'],
            'markdown_graph_layout.end' => ['sometimes', 'array'],
            'markdown_graph_layout.end.x' => ['sometimes', 'numeric'],
            'markdown_graph_layout.end.y' => ['sometimes', 'numeric'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function obstacleRules(string $modifier = 'nullable'): array
    {
        return [
            'obstacle_allowed_tool_ids' => [$modifier],
            'obstacle_background_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_background_light' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_bubble_border_color_dark' => $this->optional($modifier, ['string', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'obstacle_bubble_border_color_light' => $this->optional($modifier, ['string', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'obstacle_bubble_color_dark' => $this->optional($modifier, ['string', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'obstacle_bubble_color_light' => $this->optional($modifier, ['string', 'regex:/^#[0-9a-fA-F]{6}$/']),
            'obstacle_bubble_opacity_dark' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'obstacle_bubble_opacity_light' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'obstacle_image_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_image_light' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_persist_after_solved' => [$modifier, 'boolean'],
            'obstacle_prompt_text' => $this->optional($modifier, ['string', 'max:2000']),
            'obstacle_x' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'obstacle_y' => $this->optional($modifier, ['numeric', 'min:0', 'max:100']),
            'obstacle_width' => $this->optional($modifier, ['numeric', 'min:1', 'max:100']),
            'obstacle_revisit_background_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_revisit_background_light' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_revisit_image_dark' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_revisit_image_light' => $this->optional($modifier, ['string', 'max:2048']),
            'obstacle_revisit_text' => $this->optional($modifier, ['string', 'max:2000']),
            'obstacle_success_animation' => $this->optional($modifier, ['string', Rule::in(['none', 'zoom', 'shake', 'rotate'])]),
            'obstacle_success_text' => $this->optional($modifier, ['string', 'max:2000']),
            'obstacle_typing_speed' => $this->optional($modifier, ['numeric', 'min:1', 'max:250']),
        ];
    }

    /**
     * @param  list<mixed>  $rules
     * @return list<mixed>
     */
    private function optional(string $modifier, array $rules): array
    {
        return $modifier === 'sometimes'
            ? [$modifier, 'nullable', ...$rules]
            : [$modifier, ...$rules];
    }

    /**
     * @return array<string, mixed>
     */
    private function toolGrantRules(string $modifier = 'nullable'): array
    {
        return [
            'tool_grant_background_dark' => [$modifier, 'string', 'max:2048'],
            'tool_grant_background_light' => [$modifier, 'string', 'max:2048'],
            'tool_grant_bubble_border_color_dark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'tool_grant_bubble_border_color_light' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'tool_grant_bubble_color_dark' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'tool_grant_bubble_color_light' => [$modifier, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'tool_grant_bubble_opacity_dark' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'tool_grant_bubble_opacity_light' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'tool_grant_fade_duration_seconds' => [$modifier, 'numeric', 'min:0', 'max:30'],
            'tool_grant_slide_direction' => [$modifier, 'string', Rule::in(['left', 'right', 'top', 'bottom', 'none'])],
            'tool_grant_slide_duration_seconds' => [$modifier, 'numeric', 'min:0', 'max:30'],
            'tool_grant_text' => [$modifier, 'string', 'max:2000'],
            'tool_grant_tool_id' => [$modifier, 'integer', 'exists:learning_tools,id'],
            'tool_grant_tool_x' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'tool_grant_tool_y' => [$modifier, 'numeric', 'min:0', 'max:100'],
            'tool_grant_typing_speed' => [$modifier, 'numeric', 'min:1', 'max:250'],
        ];
    }
}
