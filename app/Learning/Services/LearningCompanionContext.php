<?php

namespace App\Learning\Services;

use App\Models\LearningActivity;
use App\Models\LearningActivityStart;
use App\Models\LearningMap;
use App\Models\LearningNode;
use App\Models\LearningWorld;
use App\Models\PlatformCompanionSetting;

/** Builds a small, deterministic context for the learner companion. */
class LearningCompanionContext
{
    public function __construct(private LearningCompanionConfigurationResolver $configurationResolver) {}

    /** @return array<string, mixed>|null */
    public function forDesk(): ?array
    {
        $setting = PlatformCompanionSetting::current();

        $configuration = $this->configurationResolver->resolve($setting);
        if (! $configuration['enabled']) {
            return null;
        }

        return $this->payload($configuration, [
            'surface' => 'desk',
            'world' => null,
            'map' => null,
            'node' => null,
            'activity' => null,
            'route' => null,
            'topic' => null,
            'playRunId' => null,
            'actions' => [
                [
                    'key' => 'topics',
                    'label' => 'Explore topics',
                    'href' => route('topics.index', [], false),
                    'reason' => 'Browse learning areas and choose where to go next.',
                ],
                [
                    'key' => 'current-map',
                    'label' => 'Open current map',
                    'href' => route('world', [], false),
                    'reason' => 'Return to the map and continue exploring.',
                ],
            ],
        ]);
    }

    /** @return array<string, mixed>|null */
    public function forWorld(LearningWorld $world, ?LearningMap $map): ?array
    {
        $setting = PlatformCompanionSetting::current();
        $map?->loadMissing('world', 'topic');

        $configuration = $this->configurationResolver->resolve($setting, $world, $map);
        if (! $configuration['enabled']) {
            return null;
        }

        return $this->payload($configuration, [
            'surface' => 'world',
            'world' => $this->reference($world->id, $world->title),
            'map' => $map ? $this->reference($map->id, $map->title) : null,
            'node' => null,
            'activity' => null,
            'route' => null,
            'topic' => $map?->topic ? $this->reference($map->topic->id, $map->topic->title) : null,
            'playRunId' => null,
            'actions' => array_values(array_filter([
                [
                    'key' => 'learning-desk',
                    'label' => 'Open learning desk',
                    'href' => route('home', [], false),
                    'reason' => 'Review recent learning and choose what to revisit.',
                ],
                $map ? [
                    'key' => 'current-map',
                    'label' => 'Stay on this map',
                    'href' => route('world', ['map' => $map->slug], false),
                    'reason' => 'Continue exploring the current learning space.',
                ] : null,
            ])),
        ]);
    }

    /** @return array<string, mixed>|null */
    public function forActivity(
        LearningNode $node,
        ?LearningActivity $activity,
        ?LearningActivityStart $routeStart,
        ?string $playRunId,
    ): ?array {
        $setting = PlatformCompanionSetting::current();

        $node->loadMissing('map.world', 'map.topic');
        $map = $node->map;
        $world = $map?->world;
        $topic = $map?->topic;
        $configuration = $this->configurationResolver->resolve($setting, $world, $map, $node, $activity);

        if (! $configuration['enabled']) {
            return null;
        }

        $mapHref = $map
            ? route('world', ['map' => $map->slug, 'focused' => $node->slug], false)
            : route('world', [], false);

        return $this->payload($configuration, [
            'surface' => 'activity',
            'world' => $world ? $this->reference($world->id, $world->title) : null,
            'map' => $map ? $this->reference($map->id, $map->title) : null,
            'node' => $this->reference($node->id, $node->title),
            'activity' => $activity ? $this->reference($activity->id, $activity->title) : null,
            'route' => $routeStart
                ? $this->reference($routeStart->id, $routeStart->label ?: 'Current route')
                : null,
            'topic' => $topic ? $this->reference($topic->id, $topic->title) : null,
            'playRunId' => $playRunId,
            'actions' => [
                [
                    'key' => 'current-map',
                    'label' => 'Return to the map',
                    'href' => $mapHref,
                    'reason' => 'Step back and choose another place when that feels useful.',
                ],
                [
                    'key' => 'learning-desk',
                    'label' => 'Open learning desk',
                    'href' => route('home', [], false),
                    'reason' => 'See your recent learning moments and available directions.',
                ],
            ],
        ]);
    }

    /** @param array<string, mixed> $context @return array<string, mixed> */
    private function payload(array $configuration, array $context): array
    {
        return [
            'enabled' => true,
            'displayName' => $configuration['displayName'],
            'avatarUrl' => $configuration['avatarUrl'],
            'avatarColor' => $configuration['avatarColor'],
            'message' => $configuration['message'],
            'configuration' => [
                'mode' => $configuration['mode'],
                'sourceScope' => $configuration['sourceScope'],
                'aiEnabled' => $configuration['ai']['enabled']
                    && in_array($configuration['mode'], ['guided_ai', 'open_ai'], true),
            ],
            'dialogue' => $configuration['dialogue'],
            'context' => $context,
        ];
    }

    /** @return array{id: int, title: string} */
    private function reference(int $id, string $title): array
    {
        return ['id' => $id, 'title' => $title];
    }
}
