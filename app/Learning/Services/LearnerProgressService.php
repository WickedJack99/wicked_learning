<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;

class LearnerProgressService
{
    public function __construct(
        private readonly LearnerRouteProgressService $routeProgress,
        private readonly LearnerActivityPlayStateService $activityPlayState,
        private readonly LearnerCompetenceService $competence,
    ) {}

    public function mark(
        int $userId,
        LearningActivity $activity,
        string $status,
        ?string $playRunId = null,
        ?bool $endsRoute = null,
        ?string $outcome = null,
        ?string $confidence = null,
        int $attemptNumber = 1,
        string $assistanceLevel = 'untracked',
    ): LearnerActivityProgress {
        $now = Carbon::now();
        $progress = LearnerActivityProgress::query()->firstOrCreate([
            'user_id' => $userId,
            'learning_activity_id' => $activity->id,
        ], [
            'learning_node_id' => $activity->learning_node_id,
            'status' => 'reached',
            'attempt_count' => 1,
            'reached_at' => $now,
        ]);

        $progress->learning_node_id = $activity->learning_node_id;
        $progress->status = $status === 'completed' ? 'completed' : ($progress->status ?: 'reached');
        $progress->reached_at ??= $now;

        if ($status === 'completed') {
            $progress->completed_at ??= $now;

            $metadata = is_array($progress->metadata) ? $progress->metadata : [];
            unset($metadata['revisitInvitation']);
            $progress->forceFill([
                'metadata' => $metadata,
                'revisit_status' => LearnerActivityProgress::REVISIT_STATUS_NONE,
                'revisit_available_at' => null,
            ]);
        }

        $progress->save();

        if ($playRunId) {
            $routeUser = User::query()->find($userId);

            if ($routeUser) {
                if ($status === 'reached') {
                    $this->routeProgress->enterActivity($routeUser, $activity, $playRunId);
                }

                if ($status === 'completed') {
                    $runProgress = $this->routeProgress->progressForRun($routeUser, $activity, $playRunId);

                    if ($runProgress) {
                        $latencySeconds = $runProgress->last_entered_at
                            ? max(0, (int) $runProgress->last_entered_at->diffInSeconds($now))
                            : null;

                        $this->competence->awardActivityCompletion(
                            $routeUser,
                            $activity,
                            $playRunId,
                            $outcome,
                            $confidence,
                            $attemptNumber,
                            $assistanceLevel,
                            $latencySeconds,
                        );
                    }

                    $this->routeProgress->exitActivity($routeUser, $activity, $playRunId);
                    $this->activityPlayState->clearActivityState($routeUser, $activity, $playRunId);
                    $this->routeProgress->completeRouteIfTerminal($routeUser, $activity, $playRunId, $endsRoute);
                }
            }
        }

        return $progress;
    }

    public function markObstacleDestroyed(int $userId, LearningActivity $activity): LearnerActivityProgress
    {
        $progress = $this->mark($userId, $activity, 'reached');
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $obstacle = is_array($metadata['obstacle'] ?? null) ? $metadata['obstacle'] : [];

        $obstacle['destroyedAt'] ??= Carbon::now()->toIso8601String();
        $metadata['obstacle'] = $obstacle;
        $progress->metadata = $metadata;
        $progress->save();

        return $progress;
    }

    public function recordCheckIn(
        int $userId,
        LearningActivity $activity,
        ?string $feeling,
        ?string $note = null,
        ?string $nextDirection = null,
    ): LearnerActivityProgress {
        $progress = LearnerActivityProgress::query()
            ->where('user_id', $userId)
            ->where('learning_activity_id', $activity->id)
            ->first();

        if (! $progress || $progress->status !== 'completed') {
            throw (new ModelNotFoundException)->setModel(LearnerActivityProgress::class);
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $recordedAt = Carbon::now();
        $checkIn = [
            'feeling' => $feeling,
            'recordedAt' => $recordedAt->toIso8601String(),
        ];

        if ($note !== null && $note !== '') {
            $checkIn['note'] = $note;
        }
        if ($nextDirection !== null && $nextDirection !== '') {
            $checkIn['nextDirection'] = $nextDirection;
        }
        unset($metadata['revisitInvitation']);
        $history = is_array($metadata['learningCheckIns'] ?? null)
            ? $metadata['learningCheckIns']
            : [];
        $history[] = $checkIn;

        $metadata['learningCheckIns'] = array_values(array_slice($history, -30));
        $metadata['learningCheckIn'] = $checkIn;

        $progress->forceFill([
            'metadata' => $metadata,
            'revisit_status' => $nextDirection === 'revisit'
                ? LearnerActivityProgress::REVISIT_STATUS_PENDING
                : LearnerActivityProgress::REVISIT_STATUS_NONE,
            'revisit_available_at' => $nextDirection === 'revisit'
                ? $recordedAt->copy()->addDays(LearnerActivityProgress::REVISIT_AVAILABLE_AFTER_DAYS)
                : null,
        ])->save();

        return $progress;
    }

    public function updateRevisitInvitation(
        int $userId,
        LearningActivity $activity,
        string $action,
    ): LearnerActivityProgress {
        $progress = LearnerActivityProgress::query()
            ->where('user_id', $userId)
            ->where('learning_activity_id', $activity->id)
            ->first();

        if (! $progress || $progress->status !== 'completed') {
            throw (new ModelNotFoundException)->setModel(LearnerActivityProgress::class);
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $updatedAt = Carbon::now();
        $isSnoozed = $action === 'snooze';
        $availableAt = $isSnoozed
            ? $updatedAt->copy()->addDays(LearnerActivityProgress::REVISIT_SNOOZE_DAYS)
            : null;
        $invitation = [
            'status' => $action === 'dismiss' ? 'dismissed' : 'snoozed',
            'updatedAt' => $updatedAt->toIso8601String(),
        ];

        if ($isSnoozed) {
            $invitation['until'] = $availableAt?->toIso8601String();
        }

        $metadata['revisitInvitation'] = $invitation;
        $progress->forceFill([
            'metadata' => $metadata,
            'revisit_status' => $isSnoozed
                ? LearnerActivityProgress::REVISIT_STATUS_SNOOZED
                : LearnerActivityProgress::REVISIT_STATUS_DISMISSED,
            'revisit_available_at' => $availableAt,
        ])->save();

        return $progress;
    }
}
