<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearnerReflection;
use App\Models\LearnerReviewAttempt;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;

class LearnerProgressService
{
    private const COMPANION_ASSISTANCE_KEY = 'companionAssistance';

    private const MAX_COMPANION_ASSISTANCE_RECORDS = 20;

    public function __construct(
        private readonly LearnerRouteProgressService $routeProgress,
        private readonly LearnerActivityPlayStateService $activityPlayState,
        private readonly LearnerCompetenceService $competence,
        private readonly ActivityFeedbackGuidanceConfiguration $feedbackGuidance,
    ) {}

    public function mark(
        int $userId,
        LearningActivity $activity,
        string $status,
        ?string $playRunId = null,
        ?bool $endsRoute = null,
        ?string $outcome = null,
        ?string $confidence = null,
        ?string $confidenceAfterFeedback = null,
        int $attemptNumber = 1,
        string $assistanceLevel = 'untracked',
        bool $isRevisit = false,
        ?string $calibration = null,
        array $observedCues = [],
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

        if ($status === 'completed') {
            $storedAssistance = $this->storedCompanionAssistanceLevel($progress, $playRunId);

            if ($storedAssistance !== null) {
                $assistanceLevel = $storedAssistance;
            }
        }

        $recordsReviewAttempt = $isRevisit
            && $status === 'completed'
            && $progress->status === 'completed'
            && in_array($progress->revisit_status, [
                LearnerActivityProgress::REVISIT_STATUS_PENDING,
                LearnerActivityProgress::REVISIT_STATUS_SNOOZED,
            ], true)
            && $progress->revisit_available_at !== null
            && $progress->revisit_available_at?->lessThanOrEqualTo($now);
        $revisitReason = $recordsReviewAttempt
            ? ($progress->revisit_status === LearnerActivityProgress::REVISIT_STATUS_SNOOZED
                ? 'later'
                : 'pause')
            : null;

        $progress->learning_node_id = $activity->learning_node_id;
        $progress->status = $status === 'completed' ? 'completed' : ($progress->status ?: 'reached');
        $progress->reached_at ??= $now;

        if ($status === 'completed') {
            $progress->completed_at ??= $now;
            if ($recordsReviewAttempt) {
                $progress->attempt_count = ((int) $progress->attempt_count) + 1;
            }

            $metadata = is_array($progress->metadata) ? $progress->metadata : [];
            unset($metadata['revisitInvitation']);
            $this->forgetCompanionAssistance($metadata, $playRunId);
            $progress->forceFill([
                'metadata' => $metadata,
                'revisit_status' => LearnerActivityProgress::REVISIT_STATUS_NONE,
                'revisit_available_at' => null,
            ]);
        }

        $progress->save();

        $evidenceAttemptNumber = $recordsReviewAttempt
            ? (int) $progress->attempt_count
            : $attemptNumber;
        $reviewObservedCues = $this->feedbackGuidance->observedCuesForActivity(
            $activity,
            $observedCues,
        );

        $routeUser = $playRunId
            ? User::query()->find($userId)
            : null;
        $runProgress = null;
        $latencySeconds = null;

        if ($routeUser && $status === 'completed') {
            $runProgress = $this->routeProgress->progressForRun($routeUser, $activity, $playRunId);

            $latencySeconds = $runProgress?->last_entered_at
                ? max(0, (int) $runProgress->last_entered_at->diffInSeconds($now))
                : null;
        }

        $reviewReflection = $recordsReviewAttempt && $playRunId !== null
            ? LearnerReflection::query()
                ->where('user_id', $userId)
                ->where('learning_activity_id', $activity->id)
                ->where('play_run_id', $playRunId)
                ->latest('id')
                ->first()
            : null;

        if ($recordsReviewAttempt) {
            LearnerReviewAttempt::query()->create([
                'user_id' => $userId,
                'learning_activity_id' => $activity->id,
                'learner_activity_progress_id' => $progress->id,
                'learner_reflection_id' => $reviewReflection?->id,
                'response_type' => $reviewReflection?->response_type,
                'attempt_number' => $progress->attempt_count,
                'source' => 'revisit',
                'outcome' => $outcome,
                'confidence' => $confidence,
                'confidence_after_feedback' => $confidenceAfterFeedback,
                'assistance_level' => $assistanceLevel,
                'observed_cues' => $reviewObservedCues === [] ? null : $reviewObservedCues,
                'metadata' => $revisitReason === null ? null : [
                    'revisitReason' => $revisitReason,
                ],
                'latency_seconds' => $latencySeconds,
                'attempted_at' => $now,
            ]);
        }

        if ($playRunId) {
            if ($routeUser) {
                if ($status === 'reached') {
                    $this->routeProgress->enterActivity($routeUser, $activity, $playRunId);
                }

                if ($status === 'completed') {
                    if ($runProgress) {
                        $this->competence->awardActivityCompletion(
                            $routeUser,
                            $activity,
                            $playRunId,
                            $outcome,
                            $confidence,
                            $evidenceAttemptNumber,
                            $assistanceLevel,
                            $latencySeconds,
                            $calibration,
                            $observedCues,
                            $confidenceAfterFeedback,
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

    public function recordCompanionAssistance(
        int $userId,
        LearningActivity $activity,
        string $assistanceLevel,
        ?string $playRunId = null,
    ): void {
        if (! in_array($assistanceLevel, ['hint', 'questions_only'], true)) {
            return;
        }

        $progress = LearnerActivityProgress::query()->firstOrCreate([
            'user_id' => $userId,
            'learning_activity_id' => $activity->id,
        ], [
            'learning_node_id' => $activity->learning_node_id,
            'status' => 'reached',
            'attempt_count' => 1,
            'reached_at' => Carbon::now(),
        ]);

        if ($progress->status === 'completed') {
            return;
        }

        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $records = is_array($metadata[self::COMPANION_ASSISTANCE_KEY] ?? null)
            ? $metadata[self::COMPANION_ASSISTANCE_KEY]
            : [];
        $recordKey = $playRunId ?? 'unbound';
        $existingLevel = is_array($records[$recordKey] ?? null)
            ? ($records[$recordKey]['level'] ?? null)
            : null;

        $records[$recordKey] = [
            'level' => $this->strongerCompanionAssistanceLevel($existingLevel, $assistanceLevel),
            'recordedAt' => Carbon::now()->toIso8601String(),
        ];
        $metadata[self::COMPANION_ASSISTANCE_KEY] = array_slice(
            $records,
            -self::MAX_COMPANION_ASSISTANCE_RECORDS,
            null,
            true,
        );
        $progress->metadata = $metadata;
        $progress->save();
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

    private function storedCompanionAssistanceLevel(
        LearnerActivityProgress $progress,
        ?string $playRunId,
    ): ?string {
        $metadata = is_array($progress->metadata) ? $progress->metadata : [];
        $records = is_array($metadata[self::COMPANION_ASSISTANCE_KEY] ?? null)
            ? $metadata[self::COMPANION_ASSISTANCE_KEY]
            : [];
        $record = $records[$playRunId ?? 'unbound'] ?? null;
        $level = is_array($record) ? ($record['level'] ?? null) : null;

        return in_array($level, ['hint', 'questions_only'], true) ? $level : null;
    }

    /** @param array<string, mixed> $metadata */
    private function forgetCompanionAssistance(array &$metadata, ?string $playRunId): void
    {
        $records = is_array($metadata[self::COMPANION_ASSISTANCE_KEY] ?? null)
            ? $metadata[self::COMPANION_ASSISTANCE_KEY]
            : [];
        $recordKey = $playRunId ?? 'unbound';

        unset($records[$recordKey]);

        if ($records === []) {
            unset($metadata[self::COMPANION_ASSISTANCE_KEY]);

            return;
        }

        $metadata[self::COMPANION_ASSISTANCE_KEY] = $records;
    }

    private function strongerCompanionAssistanceLevel(?string $current, string $incoming): string
    {
        return $current === 'hint' || $incoming === 'hint' ? 'hint' : 'questions_only';
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
