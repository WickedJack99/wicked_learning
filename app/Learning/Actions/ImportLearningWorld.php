<?php

namespace App\Learning\Actions;

use App\Models\LearningMap;
use App\Models\LearningWorld;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ImportLearningWorld
{
    public function __construct(private readonly ImportLearningMap $mapImporter) {}

    /**
     * Import all validated maps in a world bundle as fresh authored maps.
     *
     * @param  array<string, mixed>  $payload
     * @return list<LearningMap>
     */
    public function handle(array $payload, LearningWorld $world, User $creator): array
    {
        $mapPayloads = is_array($payload['maps'] ?? null) ? $payload['maps'] : [];

        return DB::transaction(function () use ($creator, $mapPayloads, $world): array {
            $destinationMaps = [];
            $sourcePayloads = [];
            $mapSlugMap = [];

            foreach ($mapPayloads as $mapPayload) {
                if (! is_array($mapPayload)) {
                    continue;
                }

                $sourceSlug = (string) data_get($mapPayload, 'map.slug', '');
                $title = trim((string) data_get($mapPayload, 'map.title', ''));
                $destination = $this->mapImporter->createDestinationMap(
                    $mapPayload,
                    $world,
                    ['title' => $title !== '' ? $title : $sourceSlug],
                    $creator,
                );

                $destinationMaps[] = $destination;
                $sourcePayloads[] = [$mapPayload, $sourceSlug, $destination];
                $mapSlugMap[$sourceSlug] = $destination->slug;
            }

            $importContexts = [];
            foreach ($sourcePayloads as [$mapPayload, , $destination]) {
                $context = $this->mapImporter->populateMap(
                    $mapPayload,
                    $world,
                    $destination,
                    $mapSlugMap,
                    false,
                );
                $importContexts[] = [$mapPayload, $destination, $context];
            }

            foreach ($importContexts as [$mapPayload, $destination, $context]) {
                $this->mapImporter->populatePortals(
                    $mapPayload,
                    $world,
                    $destination,
                    $context['nodeIds'],
                    $context['activityIds'],
                    $mapSlugMap,
                );
            }

            return array_map(
                static fn (LearningMap $map): LearningMap => $map->refresh(),
                $destinationMaps,
            );
        });
    }
}
