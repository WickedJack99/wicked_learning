<?php

namespace App\Learning\Services;

use App\Models\LearnerRecallItem;
use App\Models\LearningQuestion;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Keeps learner-selected question recall items private and explicitly scoped. */
class LearnerRecallItemService
{
    /** @var list<int> */
    private const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

    public function __construct(private readonly LearnerActivityAccessService $activityAccess) {}

    public function queue(User $user, LearningQuestion $question): LearnerRecallItem
    {
        $question->loadMissing('activity.node.map');
        $this->assertCanUseQuestion($user, $question);

        $item = LearnerRecallItem::query()->firstOrCreate([
            'user_id' => $user->id,
            'learning_question_id' => $question->id,
        ], [
            'next_review_at' => Carbon::now(),
        ]);

        if ($item->next_review_at === null) {
            $item->forceFill(['next_review_at' => Carbon::now()])->save();
        }

        return $item;
    }

    public function remove(User $user, LearningQuestion $question): void
    {
        $question->loadMissing('activity.node.map');
        $this->assertCanUseQuestion($user, $question);

        LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->where('learning_question_id', $question->id)
            ->delete();
    }

    /**
     * Defer the next recall by one day without changing the learner's review
     * outcome or count.
     */
    public function postpone(User $user, LearningQuestion $question): LearnerRecallItem
    {
        $question->loadMissing('activity.node.map');
        $this->assertCanUseQuestion($user, $question);

        $item = LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->where('learning_question_id', $question->id)
            ->firstOrFail();
        $now = Carbon::now();
        $nextReviewAt = ($item->next_review_at?->greaterThan($now)
            ? $item->next_review_at
            : $now)->addDay();

        $item->forceFill(['next_review_at' => $nextReviewAt])->save();

        return $item;
    }

    public function updatePostFeedbackConfidence(
        User $user,
        LearningQuestion $question,
        ?string $confidence,
    ): bool {
        $question->loadMissing('activity.node.map');
        $this->assertCanUseQuestion($user, $question);

        $item = LearnerRecallItem::query()
            ->where('user_id', $user->id)
            ->where('learning_question_id', $question->id)
            ->first();

        if (! $item) {
            return false;
        }

        $item->forceFill([
            'last_confidence_after_feedback' => $confidence,
        ])->save();

        return true;
    }

    /**
     * @return array{intervalDays: int, nextReviewAt: string}|null
     */
    public function recordRecall(
        int $userId,
        LearningQuestion $question,
        bool $isCorrect,
        ?string $confidence,
    ): ?array {
        $item = LearnerRecallItem::query()
            ->where('user_id', $userId)
            ->where('learning_question_id', $question->id)
            ->first();

        if (! $item) {
            return null;
        }

        $reviewCount = (int) $item->review_count + 1;
        $intervalDays = $isCorrect
            ? self::REVIEW_INTERVALS[min($reviewCount - 1, count(self::REVIEW_INTERVALS) - 1)]
            : 1;
        $reviewedAt = Carbon::now();
        $nextReviewAt = $reviewedAt->copy()->addDays($intervalDays);

        $item->forceFill([
            'last_confidence' => $confidence,
            'last_outcome' => $isCorrect ? 'correct' : 'incorrect',
            'last_reviewed_at' => $reviewedAt,
            'next_review_at' => $nextReviewAt,
            'review_count' => $reviewCount,
        ])->save();

        return [
            'intervalDays' => $intervalDays,
            'nextReviewAt' => $nextReviewAt->toIso8601String(),
        ];
    }

    private function assertCanUseQuestion(User $user, LearningQuestion $question): void
    {
        $activity = $question->activity;
        abort_unless($activity !== null, 404);
        $this->activityAccess->assertCanPlay($user, $activity);
    }
}
