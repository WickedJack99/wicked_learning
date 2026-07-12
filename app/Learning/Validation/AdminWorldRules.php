<?php

namespace App\Learning\Validation;

use App\Models\AccessRole;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
        return ['image' => ['required', 'file', 'max:51200']];
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
            'bottomNavActiveBackground',
            'bottomNavActiveIconColor',
            'bottomNavActiveTextColor',
            'bottomNavBackground',
            'bottomNavBorderColor',
            'bottomNavExitIconColor',
            'bottomNavIconColor',
            'bottomNavTextColor',
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
            $rules["visual_config.{$mode}.imageUrl"] = ['nullable', 'string', 'max:2048'];
            $rules["visual_config.{$mode}.imageRotation"] = ['nullable', 'numeric', 'min:-360', 'max:360'];
            $rules["visual_config.{$mode}.imageWidth"] = ['nullable', 'numeric', 'min:10', 'max:200'];
            $rules["visual_config.{$mode}.imageX"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            $rules["visual_config.{$mode}.imageY"] = ['nullable', 'numeric', 'min:0', 'max:100'];

            foreach (['tileOpacity', 'foregroundOpacity', 'labelOpacity', 'highlightOpacity'] as $field) {
                $rules["visual_config.{$mode}.{$field}"] = ['nullable', 'numeric', 'min:0', 'max:100'];
            }
        }

        return $rules;
    }
}
