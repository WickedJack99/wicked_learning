<?php

namespace App\Learning\Services;

use App\Learning\Validation\LearningCompanionDialogueGraphValidator;
use App\Models\LearningActivity;
use App\Models\LearningCompanionDialogueAssignment;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformCompanionSetting;
use Illuminate\Validation\ValidationException;

class LearningCompanionConfigurationResolver
{
    public const DEFAULT_AVATAR_POSITION_X = 50;

    public const DEFAULT_AVATAR_POSITION_Y = 50;

    public const DEFAULT_AVATAR_SCALE = 100;

    public const DEFAULT_AVATAR_COLOR = '#5eead4';

    public function __construct(private LearningCompanionDialogueGraphValidator $graphValidator) {}

    /** @return array<string, mixed> */
    public function resolve(
        PlatformCompanionSetting $setting,
        ?LearningWorld $world = null,
        ?LearningMap $map = null,
        ?LearningNode $node = null,
        ?LearningActivity $activity = null,
    ): array {
        $configuration = [
            'enabled' => (bool) $setting->enabled,
            'displayName' => $setting->display_name,
            'avatarUrl' => $setting->avatar_url,
            'avatarColor' => self::DEFAULT_AVATAR_COLOR,
            'avatarPositionX' => self::DEFAULT_AVATAR_POSITION_X,
            'avatarPositionY' => self::DEFAULT_AVATAR_POSITION_Y,
            'avatarScale' => self::DEFAULT_AVATAR_SCALE,
            'message' => $setting->welcome_message,
            'mode' => 'scripted',
            'dialogue' => null,
            'ai' => [
                'enabled' => false,
                'templateId' => null,
                'capabilities' => [],
            ],
            'sourceScope' => 'platform',
        ];

        $scopes = [
            'platform' => $setting->companion_config,
            'world' => $world?->companion_config,
            'map' => $map?->companion_config,
            'node' => $node?->companion_config,
            'activity' => $activity?->companion_config,
        ];
        $assignedGraphs = $this->assignedGraphs($world, $map, $node, $activity);

        foreach ($scopes as $scope => $scopeConfig) {
            if (isset($assignedGraphs[$scope])) {
                $scopeConfig = [
                    ...(is_array($scopeConfig) ? $scopeConfig : []),
                    'dialogue_graph' => $assignedGraphs[$scope],
                ];
            }

            if (! is_array($scopeConfig) || $scopeConfig === []) {
                continue;
            }

            if ($this->applyScope($configuration, $scopeConfig)) {
                $configuration['sourceScope'] = $scope;
            }
        }

        return $configuration;
    }

    /**
     * Load all applicable assignments in one query so an activity page does
     * not perform one relationship lookup for every inherited scope.
     *
     * @return array<string, array<string, mixed>>
     */
    private function assignedGraphs(
        ?LearningWorld $world,
        ?LearningMap $map,
        ?LearningNode $node,
        ?LearningActivity $activity,
    ): array {
        $targets = array_filter([
            'world' => $world?->id,
            'map' => $map?->id,
            'node' => $node?->id,
            'activity' => $activity?->id,
        ], static fn (?int $id): bool => $id !== null);

        if ($targets === []) {
            return [];
        }

        $assignments = LearningCompanionDialogueAssignment::query()
            ->with('dialogue')
            ->where(function ($query) use ($targets): void {
                foreach ($targets as $scopeType => $scopeId) {
                    $query->orWhere(function ($query) use ($scopeType, $scopeId): void {
                        $query->where('scope_type', $scopeType)->where('scope_id', $scopeId);
                    });
                }
            })
            ->get();

        $graphs = [];
        foreach ($assignments as $assignment) {
            $graph = $assignment->dialogue?->dialogue_graph;
            if (is_array($graph)) {
                $graphs[$assignment->scope_type] = $graph;
            }
        }

        return $graphs;
    }

    /** @param array<string, mixed> $configuration @param array<string, mixed> $scopeConfig */
    private function applyScope(array &$configuration, array $scopeConfig): bool
    {
        $changed = false;
        $scalarKeys = [
            'enabled' => 'enabled',
            'display_name' => 'displayName',
            'avatar_url' => 'avatarUrl',
            'avatar_color' => 'avatarColor',
            'avatar_position_x' => 'avatarPositionX',
            'avatar_position_y' => 'avatarPositionY',
            'avatar_scale' => 'avatarScale',
            'welcome_message' => 'message',
        ];

        foreach ($scalarKeys as $key => $outputKey) {
            if (! array_key_exists($key, $scopeConfig)) {
                continue;
            }

            if ($key === 'enabled' && is_bool($scopeConfig[$key])) {
                $configuration[$outputKey] = $scopeConfig[$key];
                $changed = true;
            } elseif ($key === 'avatar_color' && $this->isHexColor($scopeConfig[$key])) {
                $configuration[$outputKey] = $scopeConfig[$key];
                $changed = true;
            } elseif ($key === 'avatar_position_x' && $this->isBoundedInteger($scopeConfig[$key], 0, 100)) {
                $configuration[$outputKey] = (int) $scopeConfig[$key];
                $changed = true;
            } elseif ($key === 'avatar_position_y' && $this->isBoundedInteger($scopeConfig[$key], 0, 100)) {
                $configuration[$outputKey] = (int) $scopeConfig[$key];
                $changed = true;
            } elseif ($key === 'avatar_scale' && $this->isBoundedInteger($scopeConfig[$key], 80, 200)) {
                $configuration[$outputKey] = (int) $scopeConfig[$key];
                $changed = true;
            } elseif (! in_array($key, [
                'enabled',
                'avatar_color',
                'avatar_position_x',
                'avatar_position_y',
                'avatar_scale',
            ], true) && is_string($scopeConfig[$key])) {
                $configuration[$outputKey] = $scopeConfig[$key];
                $changed = true;
            }
        }

        if (isset($scopeConfig['mode']) && in_array($scopeConfig['mode'], ['scripted', 'guided_ai', 'open_ai'], true)) {
            $configuration['mode'] = $scopeConfig['mode'];
            $changed = true;
        }

        if (array_key_exists('dialogue_graph', $scopeConfig)) {
            try {
                $configuration['dialogue'] = $this->graphValidator->validate($scopeConfig['dialogue_graph']);
                $changed = true;
            } catch (ValidationException) {
                // Invalid authoring must never break the learner surface.
            }
        }

        if (is_array($scopeConfig['ai'] ?? null)) {
            $ai = $scopeConfig['ai'];
            if (is_bool($ai['enabled'] ?? null)) {
                $configuration['ai']['enabled'] = $ai['enabled'];
                $changed = true;
            }
            if (is_int($ai['template_id'] ?? null) && $ai['template_id'] > 0) {
                $configuration['ai']['templateId'] = $ai['template_id'];
                $changed = true;
            }
            if (is_array($ai['capabilities'] ?? null)) {
                $capabilities = array_values(array_intersect(
                    array_map('strval', $ai['capabilities']),
                    $this->graphValidator->aiCapabilities(),
                ));
                $configuration['ai']['capabilities'] = array_slice($capabilities, 0, 3);
                $changed = true;
            }
        }

        return $changed;
    }

    private function isHexColor(mixed $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/', $value) === 1;
    }

    private function isBoundedInteger(mixed $value, int $minimum, int $maximum): bool
    {
        return is_int($value) && $value >= $minimum && $value <= $maximum;
    }
}
