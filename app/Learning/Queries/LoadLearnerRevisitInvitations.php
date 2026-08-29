<?php

namespace App\Learning\Queries;

use App\Learning\Services\LearningMapAccessService;
use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Loads learner-chosen activities that are ready to revisit after a pause. */
class LoadLearnerRevisitInvitations
{
    private const MAX_DUE_CANDIDATES = 48;

    public function __construct(private readonly LearningMapAccessService $mapAccess) {}

    /**
     * @return list<array{activityHref: string, activityId: int, activityTitle: string, availableAfterDays: int, availableSince: string, mapTitle: string, nodeHref: string, nodeTitle: string}>
     */
    public function handle(User $user): array
    {
        $now = Carbon::now();

        return LearnerActivityProgress::query()
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->whereIn('revisit_status', [
                LearnerActivityProgress::REVISIT_STATUS_PENDING,
                LearnerActivityProgress::REVISIT_STATUS_SNOOZED,
            ])
            ->whereNotNull('revisit_available_at')
            ->where('revisit_available_at', '<=', $now)
            ->with('activity.node.map')
            ->orderByDesc('revisit_available_at')
            ->latest('updated_at')
            ->limit(self::MAX_DUE_CANDIDATES)
            ->get()
            ->map(function (LearnerActivityProgress $progress) use ($user): ?array {
                $activity = $progress->activity;
                $node = $activity?->node;
                $map = $node?->map;

                if (! $activity instanceof LearningActivity
                    || $node === null
                    || $map === null
                    || ! $this->mapAccess->canViewMap($map, $user)) {
                    return null;
                }

                $metadata = is_array($progress->metadata) ? $progress->metadata : [];
                $invitation = is_array($metadata['revisitInvitation'] ?? null)
                    ? $metadata['revisitInvitation']
                    : [];

                if (($invitation['status'] ?? null) === 'dismissed') {
                    return null;
                }

                $checkIn = $this->latestRevisitCheckIn($metadata);
                $recordedAt = $this->dateFrom($checkIn['recordedAt'] ?? null);

                if ($recordedAt === null) {
                    return null;
                }

                return [
                    'activityHref' => route('learning.nodes.play', [
                        'activity_id' => $activity->id,
                        'node' => $node,
                    ], false),
                    'activityId' => $activity->id,
                    'activityTitle' => $activity->title,
                    'availableAfterDays' => LearnerActivityProgress::REVISIT_AVAILABLE_AFTER_DAYS,
                    'availableSince' => $recordedAt->toIso8601String(),
                    'mapTitle' => $map->title,
                    'nodeHref' => route('world', [
                        'map' => $map->slug,
                        'focused' => $node->slug,
                    ], false),
                    'nodeTitle' => $node->title,
                ];
            })
            ->filter()
            ->unique('activityId')
            ->values()
            ->take(12)
            ->all();
    }

    /** @return array{recordedAt: string}|null */
    private function latestRevisitCheckIn(array $metadata): ?array
    {
        $history = is_array($metadata['learningCheckIns'] ?? null)
            ? $metadata['learningCheckIns']
            : [$metadata['learningCheckIn'] ?? null];

        foreach (array_reverse($history) as $checkIn) {
            if (! is_array($checkIn) || ! is_string($checkIn['recordedAt'] ?? null)) {
                continue;
            }

            return ($checkIn['nextDirection'] ?? null) === 'revisit'
                ? ['recordedAt' => $checkIn['recordedAt']]
                : null;
        }

        return null;
    }

    private function dateFrom(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
