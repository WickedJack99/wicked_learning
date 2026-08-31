<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property array<string, mixed>|null $metadata
 * @property Carbon|null $revisit_available_at
 * @property-read LearningActivity|null $activity
 */
#[Fillable([
    'user_id',
    'learning_node_id',
    'learning_activity_id',
    'status',
    'attempt_count',
    'reached_at',
    'completed_at',
    'revisit_status',
    'revisit_available_at',
    'metadata',
])]
class LearnerActivityProgress extends Model
{
    public const REVISIT_STATUS_NONE = 'none';

    public const REVISIT_STATUS_PENDING = 'pending';

    public const REVISIT_STATUS_SNOOZED = 'snoozed';

    public const REVISIT_STATUS_DISMISSED = 'dismissed';

    public const REVISIT_AVAILABLE_AFTER_DAYS = 3;

    public const REVISIT_SNOOZE_DAYS = 7;

    protected $table = 'learner_activity_progress';

    protected static function booted(): void
    {
        static::saving(function (self $progress): void {
            if (! $progress->isDirty('metadata')
                || $progress->isDirty('revisit_status')
                || $progress->isDirty('revisit_available_at')) {
                return;
            }

            [$status, $availableAt] = $progress->revisitScheduleFromMetadata();
            $progress->revisit_status = $status;
            $progress->revisit_available_at = $availableAt;
        });
    }

    /** @return BelongsTo<LearningActivity, $this> */
    public function activity(): BelongsTo
    {
        return $this->belongsTo(LearningActivity::class, 'learning_activity_id');
    }

    /** @return HasMany<LearnerReviewAttempt, $this> */
    public function reviewAttempts(): HasMany
    {
        return $this->hasMany(LearnerReviewAttempt::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reached_at' => 'datetime',
            'completed_at' => 'datetime',
            'revisit_available_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    /**
     * @return array{0: string, 1: Carbon|null}
     */
    private function revisitScheduleFromMetadata(): array
    {
        $metadata = is_array($this->metadata) ? $this->metadata : [];
        $invitation = is_array($metadata['revisitInvitation'] ?? null)
            ? $metadata['revisitInvitation']
            : [];

        if (($invitation['status'] ?? null) === self::REVISIT_STATUS_DISMISSED) {
            return [self::REVISIT_STATUS_DISMISSED, null];
        }

        $history = is_array($metadata['learningCheckIns'] ?? null)
            ? $metadata['learningCheckIns']
            : [$metadata['learningCheckIn'] ?? null];

        foreach (array_reverse($history) as $checkIn) {
            if (! is_array($checkIn) || ! is_string($checkIn['recordedAt'] ?? null)) {
                continue;
            }

            if (($checkIn['nextDirection'] ?? null) !== 'revisit') {
                return [self::REVISIT_STATUS_NONE, null];
            }

            $recordedAt = $this->dateFrom($checkIn['recordedAt']);

            if ($recordedAt === null) {
                return [self::REVISIT_STATUS_NONE, null];
            }

            if (($invitation['status'] ?? null) === self::REVISIT_STATUS_SNOOZED) {
                return [
                    self::REVISIT_STATUS_SNOOZED,
                    $this->dateFrom($invitation['until'] ?? null)
                        ?? $recordedAt->copy()->addDays(self::REVISIT_AVAILABLE_AFTER_DAYS),
                ];
            }

            return [
                self::REVISIT_STATUS_PENDING,
                $recordedAt->copy()->addDays(self::REVISIT_AVAILABLE_AFTER_DAYS),
            ];
        }

        return [self::REVISIT_STATUS_NONE, null];
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
