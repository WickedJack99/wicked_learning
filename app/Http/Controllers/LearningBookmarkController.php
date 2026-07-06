<?php

namespace App\Http\Controllers;

use App\Models\LearningNode;
use App\Models\LearningNodeBookmark;
use App\Models\LearningWorld;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningBookmarkController extends Controller
{
    public function index(Request $request): Response
    {
        $world = $this->worldQuery()
            ->with([
                'maps.nodes',
            ])
            ->first();
        $templateMap = $world?->maps->first();
        $bookmarks = LearningNodeBookmark::query()
            ->with(['node.map.world'])
            ->where('user_id', $request->user()->id)
            ->oldest()
            ->get()
            ->filter(fn (LearningNodeBookmark $bookmark): bool => $this->isVisibleNode($bookmark->node))
            ->values();

        return Inertia::render('bookmarks', [
            'bookmarkMap' => [
                'id' => 0,
                'slug' => 'bookmarks',
                'title' => 'Bookmarked Places',
                'description' => 'A personal map of places you marked for returning later.',
                'backgroundConfig' => $templateMap?->background_config ?? [],
                'gridConfig' => $templateMap?->grid_config ?? [],
                'nodes' => $bookmarks
                    ->map(fn (LearningNodeBookmark $bookmark, int $index): array => $this->serializeBookmarkNode(
                        $bookmark->node,
                        $this->spiralPosition($index),
                    ))
                    ->all(),
            ],
        ]);
    }

    public function store(Request $request, LearningNode $node): JsonResponse
    {
        if (! $this->isVisibleNode($node)) {
            abort(404);
        }

        LearningNodeBookmark::query()->firstOrCreate([
            'user_id' => $request->user()->id,
            'learning_node_id' => $node->id,
        ]);

        return response()->json([
            'bookmarked' => true,
            'bookmarkedNodeIds' => $this->bookmarkedNodeIds($request),
        ]);
    }

    public function destroy(Request $request, LearningNode $node): JsonResponse
    {
        LearningNodeBookmark::query()
            ->where('user_id', $request->user()->id)
            ->where('learning_node_id', $node->id)
            ->delete();

        return response()->json([
            'bookmarked' => false,
            'bookmarkedNodeIds' => $this->bookmarkedNodeIds($request),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeBookmarkNode(LearningNode $node, array $position): array
    {
        return [
            'id' => $node->id,
            'mapId' => $node->map->id,
            'mapSlug' => $node->map->slug,
            'mapTitle' => $node->map->title,
            'slug' => $node->slug,
            'title' => $node->title,
            'description' => $node->description,
            'position' => $position,
            'state' => $node->state,
            'visualConfig' => $node->visual_config ?? [],
            'outgoingPortalLinks' => [],
            'startActivityId' => null,
            'activities' => [],
        ];
    }

    private function isVisibleNode(LearningNode $node): bool
    {
        if ($node->state === 'hidden') {
            return false;
        }

        $visualConfig = $node->visual_config ?? [];

        return ($visualConfig['hideEmptySpace'] ?? false) !== true;
    }

    /**
     * @return array<int, int>
     */
    private function bookmarkedNodeIds(Request $request): array
    {
        return LearningNodeBookmark::query()
            ->where('user_id', $request->user()->id)
            ->pluck('learning_node_id')
            ->map(fn (int $nodeId): int => $nodeId)
            ->all();
    }

    /**
     * @return array{q: int, r: int}
     */
    private function spiralPosition(int $index): array
    {
        if ($index === 0) {
            return ['q' => 0, 'r' => 0];
        }

        $directions = [
            [1, 0],
            [1, -1],
            [0, -1],
            [-1, 0],
            [-1, 1],
            [0, 1],
        ];
        $q = 0;
        $r = 0;
        $currentIndex = 0;

        for ($radius = 1; true; $radius++) {
            $q = -$radius;
            $r = $radius;

            foreach ($directions as [$directionQ, $directionR]) {
                for ($step = 0; $step < $radius; $step++) {
                    $currentIndex++;

                    if ($currentIndex === $index) {
                        return ['q' => $q, 'r' => $r];
                    }

                    $q += $directionQ;
                    $r += $directionR;
                }
            }
        }
    }

    /**
     * @return Builder<LearningWorld>
     */
    private function worldQuery(): Builder
    {
        return LearningWorld::query()->where('slug', 'demo-cybersecurity');
    }
}
