<?php

namespace App\Learning\Validation;

use App\Learning\MapAssetInteractionMode;
use App\Models\AccessRole;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminWorldRules
{
    /**
     * @return array<string, mixed>
     */
    public function storeMap(LearningWorld $world): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_maps', 'slug')->where('learning_world_id', $world->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function portalLink(): array
    {
        return [
            'source_learning_node_id' => ['required', 'integer', 'different:target_learning_node_id'],
            'target_learning_node_id' => ['required', 'integer'],
            'label' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function uploadNodeImage(): array
    {
        return [
            'image' => ['required', 'file', 'max:51200'],
            'map_id' => ['nullable', 'integer', 'exists:learning_maps,id'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function node(Request $request, LearningMap $map, ?LearningNode $node = null): array
    {
        return [
            ...$this->nodeContent($map, $node),
            'position_q' => [
                'required',
                'integer',
                Rule::unique('learning_nodes', 'position_q')
                    ->where('learning_map_id', $map->id)
                    ->where('position_r', $request->integer('position_r'))
                    ->ignore($node?->id),
            ],
            'position_r' => ['required', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function nodeInsert(LearningMap $map): array
    {
        return [
            ...$this->nodeContent($map),
            ...$this->direction(),
        ];
    }

    /**
     * Reject unlock configurations that are enabled but cannot ever pass.
     *
     * @param  array<string, mixed>  $data
     */
    public function validateNodeUnlock(array $data, ?LearningNode $node = null): void
    {
        $unlock = data_get($data, 'visual_config.unlock', []);

        if (! is_array($unlock) || ! filter_var($unlock['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $errors = [];
        $requiredNodeIds = is_array($unlock['requiredNodeIds'] ?? null)
            ? $unlock['requiredNodeIds']
            : [];
        $rules = is_array($unlock['rules'] ?? null) ? $unlock['rules'] : [];
        $tool = is_array($unlock['tool'] ?? null) ? $unlock['tool'] : [];
        $toolEnabled = filter_var($tool['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $toolId = (int) ($tool['toolId'] ?? 0);
        $roleSlug = trim((string) ($unlock['roleSlug'] ?? ''));
        $schedule = data_get($data, 'visual_config.schedule', []);
        $schedule = is_array($schedule) ? $schedule : [];

        if ($node && in_array($node->id, array_map('intval', $requiredNodeIds), true)) {
            $errors['visual_config.unlock.requiredNodeIds.0'] = 'A node cannot require itself to be completed.';
        }

        if ($toolEnabled && $toolId <= 0) {
            $errors['visual_config.unlock.tool.toolId'] = 'Choose a tool for this unlock condition.';
        }

        if ($roleSlug !== '' && ! AccessRole::query()->where('slug', $roleSlug)->exists()) {
            $errors['visual_config.unlock.roleSlug'] = 'Choose an existing role for this unlock condition.';
        }

        if (($schedule['unlockAt'] ?? null) && ($schedule['lockAt'] ?? null)) {
            $unlockAt = Carbon::parse($schedule['unlockAt']);
            $lockAt = Carbon::parse($schedule['lockAt']);

            if ($unlockAt->greaterThanOrEqualTo($lockAt)) {
                $errors['visual_config.schedule.lockAt'] = 'The lock time must be after the unlock time.';
            }
        }

        if ($requiredNodeIds === [] && $rules === [] && ! $toolEnabled && $roleSlug === '' && ! ($schedule['unlockAt'] ?? null)) {
            $errors['visual_config.unlock.enabled'] = 'Add at least one unlock condition or turn unlock rules off.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function direction(): array
    {
        return [
            'direction_q' => ['required', 'integer'],
            'direction_r' => ['required', 'integer'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function mapVisual(): array
    {
        $rules = [];
        $colorFields = [
            'accentColor',
            'overlay',
            'pageBackground',
            'panelBackground',
            'panelBorderColor',
            'panelMutedTextColor',
            'panelTextColor',
            'sideControlActiveBackground',
            'sideControlActiveIconColor',
            'sideControlActiveTextColor',
            'sideControlBackground',
            'sideControlBorderColor',
            'sideControlIconColor',
            'sideControlTextColor',
            'sidePanelBackground',
            'sidePanelBorderColor',
            'sidePanelHeadingColor',
            'sidePanelMutedTextColor',
            'sidePanelTextColor',
        ];

        foreach (['dark.', 'light.'] as $prefix) {
            foreach ($colorFields as $field) {
                $rules["background_config.{$prefix}{$field}"] = ['nullable', 'string', 'max:255'];
            }

            $rules["background_config.{$prefix}imageUrl"] = ['nullable', 'string', 'max:2048'];
            $rules["background_config.{$prefix}completedDimOpacity"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules["background_config.{$prefix}assets"] = ['nullable', 'array'];
            $rules["background_config.{$prefix}assets.*.id"] = ['nullable', 'string', 'max:80'];
            $rules["background_config.{$prefix}assets.*.imageUrl"] = ['nullable', 'string', 'max:2048'];
            $rules["background_config.{$prefix}assets.*.x"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules["background_config.{$prefix}assets.*.y"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules["background_config.{$prefix}assets.*.width"] = ['nullable', 'numeric', 'min:1', 'max:200'];
            $rules["background_config.{$prefix}assets.*.opacity"] = ['nullable', 'numeric', 'min:0', 'max:100'];
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    public function mapDetails(): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'topic_id' => ['nullable', 'integer', 'exists:learning_topics,id'],
            'map_assets_locked' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<string, mixed> */
    public function mapAsset(LearningMap $map, ?int $assetId = null): array
    {
        return [
            'image_url' => ['nullable', 'string', 'max:2048'],
            'text' => ['nullable', 'string', 'max:255'],
            'position_x' => ['required', 'numeric', 'min:0', 'max:100'],
            'position_y' => ['required', 'numeric', 'min:0', 'max:100'],
            'position_z' => ['required', 'integer', 'min:-10000', 'max:10000'],
            'width' => ['required', 'numeric', 'min:1', 'max:100'],
            'opacity' => ['required', 'numeric', 'min:0', 'max:1'],
            'locked' => ['sometimes', 'boolean'],
            'focusable' => ['sometimes', 'boolean'],
            'interaction_mode' => ['sometimes', 'string', Rule::in(MapAssetInteractionMode::values())],
            'interaction_config' => ['nullable', 'array'],
            'interaction_config.states' => ['required_if:interaction_mode,toggle', 'array'],
            'visual_config' => ['nullable', 'array'],
            'visual_config.imageFit' => ['nullable', 'string', Rule::in(['contain', 'cover'])],
            'visual_config.imagePosition' => ['nullable', 'string', Rule::in(['center', 'top', 'right', 'bottom', 'left'])],
            'sound_config' => ['nullable', 'array'],
            ...$this->mapAssetStateRules('first'),
            ...$this->mapAssetStateRules('second'),
        ];
    }

    /** @return array<string, mixed> */
    private function mapAssetStateRules(string $state): array
    {
        $prefix = "interaction_config.states.{$state}";

        return [
            "{$prefix}.imageUrl" => ['required_if:interaction_mode,toggle', 'nullable', 'string', 'max:2048'],
            "{$prefix}.x" => ['required_if:interaction_mode,toggle', 'nullable', 'numeric', 'min:0', 'max:100'],
            "{$prefix}.y" => ['required_if:interaction_mode,toggle', 'nullable', 'numeric', 'min:0', 'max:100'],
            "{$prefix}.width" => ['required_if:interaction_mode,toggle', 'nullable', 'numeric', 'min:1', 'max:100'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function mapAccess(): array
    {
        return [
            'access_roles' => ['required', 'array', 'min:1'],
            'access_roles.*' => [
                'string',
                Rule::in([
                    'public',
                    ...AccessRole::query()->pluck('slug')->all(),
                ]),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function mapEditingGroups(): array
    {
        return [
            'group_ids' => ['present', 'array'],
            'group_ids.*' => ['integer', 'exists:learning_groups,id'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeContent(LearningMap $map, ?LearningNode $node = null): array
    {
        return [
            ...$this->nodeTextRules($map, $node),
            ...$this->nodeVisualRules(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeTextRules(LearningMap $map, ?LearningNode $node): array
    {
        return [
            'title' => ['required', 'string', 'max:120'],
            'slug' => [
                'nullable',
                'string',
                'max:140',
                Rule::unique('learning_nodes', 'slug')
                    ->where('learning_map_id', $map->id)
                    ->ignore($node?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'state' => ['required', 'string', Rule::in(['active', 'available', 'completed', 'hidden', 'hinted', 'locked', 'recommended'])],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nodeVisualRules(): array
    {
        $rules = [
            'visual_config.label' => ['nullable', 'string', 'max:80'],
            'visual_config.hideEmptySpace' => ['nullable', 'boolean'],
            'visual_config.hideImage' => ['nullable', 'boolean'],
            'visual_config.hideLabel' => ['nullable', 'boolean'],
            'visual_config.reveal.enabled' => ['nullable', 'boolean'],
            'visual_config.reveal.toolId' => ['nullable', 'integer', 'exists:learning_tools,id'],
            'visual_config.tooltip' => ['nullable', 'string', 'max:255'],
            'visual_config.schedule.unlockAt' => ['nullable', 'date'],
            'visual_config.schedule.lockAt' => ['nullable', 'date'],
            'visual_config.unlock.enabled' => ['nullable', 'boolean'],
            'visual_config.unlock.topOperator' => ['nullable', 'string', Rule::in(['and', 'or'])],
            'visual_config.unlock.nodeOperator' => ['nullable', 'string', Rule::in(['and', 'or'])],
            'visual_config.unlock.requiredNodeIds' => ['nullable', 'array'],
            'visual_config.unlock.requiredNodeIds.*' => ['integer', 'exists:learning_nodes,id'],
            'visual_config.unlock.tool.enabled' => ['nullable', 'boolean'],
            'visual_config.unlock.tool.toolId' => ['nullable', 'integer', 'exists:learning_tools,id'],
            'visual_config.unlock.roleSlug' => ['nullable', 'string', 'max:80', 'exists:access_roles,slug'],
            'visual_config.unlock.rules' => ['nullable', 'array'],
        ];

        foreach (['mouseEnter', 'click', 'mouseLeave', 'unlock'] as $trigger) {
            $rules["visual_config.sounds.{$trigger}.enabled"] = ['nullable', 'boolean'];
            $rules["visual_config.sounds.{$trigger}.url"] = ['nullable', 'string', 'max:2048'];
        }

        foreach (['dark', 'light'] as $mode) {
            $rules["visual_config.{$mode}.tileColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.foregroundColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.labelColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.highlightColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.borderColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.highlightBorderColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.highlightedLabelColor"] = ['nullable', 'string', 'max:40'];
            $rules["visual_config.{$mode}.imageUrl"] = ['nullable', 'string', 'max:2048'];
            $rules["visual_config.{$mode}.imageRotation"] = ['nullable', 'numeric', 'min:-360', 'max:360'];
            $rules["visual_config.{$mode}.imageWidth"] = ['nullable', 'numeric', 'min:10', 'max:200'];
            $rules["visual_config.{$mode}.imageX"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules["visual_config.{$mode}.imageY"] = ['nullable', 'numeric', 'min:0', 'max:100'];

            foreach (['tileOpacity', 'foregroundOpacity', 'labelOpacity', 'highlightOpacity', 'borderOpacity', 'highlightBorderOpacity', 'highlightedLabelOpacity'] as $field) {
                $rules["visual_config.{$mode}.{$field}"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            }
        }

        return $rules;
    }
}
