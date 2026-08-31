<?php

namespace App\Http\Controllers;

use App\Learning\Queries\LoadLearnerBookmarks;
use App\Learning\Serializers\BookmarkMapSerializer;
use App\Learning\Services\LearnerActivityAccessService;
use App\Learning\Services\LearningBookmarkService;
use App\Models\LearningNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LearningBookmarkController extends Controller
{
    public function __construct(
        private readonly LoadLearnerBookmarks $loadLearnerBookmarks,
        private readonly BookmarkMapSerializer $bookmarkMapSerializer,
        private readonly LearningBookmarkService $bookmarkService,
        private readonly LearnerActivityAccessService $activityAccess,
    ) {}

    public function index(Request $request): Response
    {
        $bookmarks = $this->loadLearnerBookmarks->visibleForUser($request->user());

        return Inertia::render('bookmarks', [
            'bookmarkMap' => $this->bookmarkMapSerializer->serialize(
                $bookmarks,
                $this->loadLearnerBookmarks->templateMap(),
            ),
        ]);
    }

    public function store(Request $request, LearningNode $node): JsonResponse
    {
        $this->activityAccess->assertCanViewNode($request->user(), $node);
        $userId = $request->user()->id;
        $this->bookmarkService->bookmark($userId, $node);

        return response()->json([
            'bookmarked' => true,
            'bookmarkedNodeIds' => $this->bookmarkService->bookmarkedNodeIds($request->user()),
        ]);
    }

    public function destroy(Request $request, LearningNode $node): JsonResponse
    {
        $userId = $request->user()->id;
        $this->bookmarkService->unbookmark($userId, $node);

        return response()->json([
            'bookmarked' => false,
            'bookmarkedNodeIds' => $this->bookmarkService->bookmarkedNodeIds($request->user()),
        ]);
    }
}
