<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningDeskPlanningPreference;
use App\Learning\Services\LearningMapAccessService;
use App\Models\LearnerMessageResponse;
use App\Models\LearnerRouteProgress;
use App\Models\LearningNodeBookmark;
use App\Models\User;
use Illuminate\Support\Collection;

class LoadLearningDesk
{
    public function __construct(
        private readonly LoadLearnerBookmarks $bookmarks,
        private readonly LoadLearnerActivityCheckIns $checkIns,
        private readonly LoadLearnerRecallItems $recallItems,
        private readonly LoadLearnerRevisitInvitations $revisitInvitations,
        private readonly LoadLearnerSupportResponses $supportResponses,
        private readonly LearningDeskPlanningPreference $planningPreference,
        private readonly LearningMapAccessService $mapAccess,
    ) {}

    /**
     * @return array{
     *     bookmarks: Collection<int, LearningNodeBookmark>,
     *     currentRoutes: Collection<int, LearnerRouteProgress>,
     *     checkIns: list<array<string, mixed>>,
     *     recallItems: list<array<string, mixed>>,
     *     recentRoutes: Collection<int, LearnerRouteProgress>,
     *     revisitInvitations: list<array<string, mixed>>,
     *     supportResponses: Collection<int, LearnerMessageResponse>,
     *     featuredBookmark: LearningNodeBookmark|null,
     *     planningPreference: array{purposeFilter: string, timeBudget: int|string, isSaved: bool}
     * }
     */
    public function handle(User $user): array
    {
        $currentRoutes = $this->routeProgressFor($user, 'in_progress', 'last_entered_at');
        $recentRoutes = $this->routeProgressFor($user, 'completed', 'last_completed_at');

        $bookmarks = $this->bookmarks
            ->visibleForUser($user->id)
            ->sortByDesc('created_at')
            ->take(8)
            ->values();

        $featuredBookmark = $currentRoutes
            ->map(fn (LearnerRouteProgress $progress): ?LearningNodeBookmark => $bookmarks
                ->firstWhere('learning_node_id', $progress->learning_node_id))
            ->filter()
            ->first()
            ?? $bookmarks->first();

        return [
            'bookmarks' => $bookmarks,
            'checkIns' => $this->checkIns->handle($user),
            'recallItems' => $this->recallItems->handle($user),
            'currentRoutes' => $currentRoutes,
            'recentRoutes' => $recentRoutes,
            'revisitInvitations' => $this->revisitInvitations->handle($user),
            'supportResponses' => $this->supportResponses->handle($user),
            'featuredBookmark' => $featuredBookmark,
            'planningPreference' => $this->planningPreference->forUser($user),
        ];
    }

    /** @return Collection<int, LearnerRouteProgress> */
    private function routeProgressFor(User $user, string $status, string $orderBy): Collection
    {
        return LearnerRouteProgress::query()
            ->with([
                'activityStart.activity',
                'currentActivity',
                'node.map.topic',
                'node.mapAsset',
            ])
            ->where('user_id', $user->id)
            ->where('status', $status)
            ->whereHas('node.map')
            ->latest($orderBy)
            ->latest('id')
            ->limit(12)
            ->get()
            ->filter(fn (LearnerRouteProgress $progress): bool => $progress->node !== null
                && $progress->node->map !== null
                && $this->mapAccess->canViewMap($progress->node->map, $user)
                && ($progress->node->visual_config['hideEmptySpace'] ?? false) !== true)
            ->take(3)
            ->values();
    }
}
