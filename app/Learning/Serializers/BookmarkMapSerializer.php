<?php

namespace App\Learning\Serializers;

use App\Models\LearningMap;
use App\Models\LearningNodeBookmark;
use Illuminate\Support\Collection;

class BookmarkMapSerializer
{
    public function __construct(private readonly LearningNodeSerializer $nodeSerializer) {}

    /**
     * @param  Collection<int, LearningNodeBookmark>  $bookmarks
     * @return array<string, mixed>
     */
    public function serialize(Collection $bookmarks, ?LearningMap $templateMap): array
    {
        return [
            'id' => 0,
            'slug' => 'bookmarks',
            'title' => 'Bookmarked Places',
            'description' => 'A personal map of places you marked for returning later.',
            'backgroundConfig' => $this->backgroundConfig($templateMap),
            'gridConfig' => $this->gridConfig($templateMap),
            'nodes' => $bookmarks
                ->map(fn (LearningNodeBookmark $bookmark, int $index): array => $this->nodeSerializer->serializeBookmarkNode(
                    $bookmark->node,
                    $this->spiralPosition($index),
                ))
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function backgroundConfig(?LearningMap $map): array
    {
        if (! $map) {
            return [];
        }

        return $map->background_config ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    private function gridConfig(?LearningMap $map): array
    {
        if (! $map) {
            return [];
        }

        return $map->grid_config ?? [];
    }

    /**
     * @return array{q: int, r: int}
     */
    private function spiralPosition(int $index): array
    {
        if ($index === 0) {
            return ['q' => 0, 'r' => 0];
        }

        return $this->walkSpiral($index);
    }

    /**
     * @return array{q: int, r: int}
     */
    private function walkSpiral(int $targetIndex): array
    {
        $directions = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
        $currentIndex = 0;

        for ($radius = 1; true; $radius++) {
            $q = -$radius;
            $r = $radius;

            foreach ($directions as [$directionQ, $directionR]) {
                for ($step = 0; $step < $radius; $step++) {
                    $currentIndex++;

                    if ($currentIndex === $targetIndex) {
                        return ['q' => $q, 'r' => $r];
                    }

                    $q += $directionQ;
                    $r += $directionR;
                }
            }
        }
    }
}
