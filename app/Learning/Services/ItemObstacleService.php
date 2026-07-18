<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ItemObstacleService
{
    public function __construct(private readonly LearnerInventoryService $inventory) {}

    /**
     * @return array<string, mixed>
     */
    public function placeItem(User $user, LearningActivity $activity, int $slotIndex, int $itemId): array
    {
        abort_unless($activity->type === 'item_obstacle', 404);

        return DB::transaction(function () use ($user, $activity, $slotIndex, $itemId): array {
            $progress = $this->progressFor($user, $activity);
            $metadata = $this->metadataFor($progress);
            $state = $this->stateFrom($metadata);
            $this->assertNotLocked($state);

            $slot = $this->slotAt($activity, $slotIndex);

            if ((int) $slot['itemId'] !== $itemId) {
                throw ValidationException::withMessages([
                    'item_id' => 'This item does not fit this slot.',
                ]);
            }

            $filledSlots = is_array($state['filledSlots'] ?? null) ? $state['filledSlots'] : [];
            if (! array_key_exists((string) $slotIndex, $filledSlots)) {
                $this->inventory->consumeItem($user, $itemId);
            }

            $filledSlots[(string) $slotIndex] = [
                'itemId' => $itemId,
                'filledAt' => Carbon::now()->toIso8601String(),
            ];

            $state['filledSlots'] = $filledSlots;
            $state['conditionsMet'] = $this->conditionsMet($activity, $filledSlots);
            $metadata['itemObstacle'] = $state;
            $progress->metadata = $metadata;
            $progress->save();

            return $state;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function continue(User $user, LearningActivity $activity): array
    {
        abort_unless($activity->type === 'item_obstacle', 404);

        return DB::transaction(function () use ($user, $activity): array {
            $progress = $this->progressFor($user, $activity);
            $metadata = $this->metadataFor($progress);
            $state = $this->stateFrom($metadata);
            $this->assertNotLocked($state);

            if ((bool) ($state['conditionsMet'] ?? false)) {
                $progress->status = 'completed';
                $progress->completed_at ??= now();

                if ($this->consumeOnEachEntry($activity)) {
                    $state = $this->emptyState();
                }

                $metadata['itemObstacle'] = $state;
                $progress->metadata = $metadata;
                $progress->save();

                return [
                    ...$state,
                    'canContinue' => true,
                ];
            }

            $lockMinutes = $this->lockMinutes($activity);

            if ($lockMinutes > 0) {
                $state['lockedUntil'] = Carbon::now()
                    ->addMinutes($lockMinutes)
                    ->toIso8601String();
            }

            $state['failedAttempts'] = ((int) ($state['failedAttempts'] ?? 0)) + 1;
            $metadata['itemObstacle'] = $state;
            $progress->metadata = $metadata;
            $progress->save();

            return [
                ...$state,
                'canContinue' => false,
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function state(User $user, LearningActivity $activity): array
    {
        abort_unless($activity->type === 'item_obstacle', 404);

        $progress = $this->progressFor($user, $activity);

        return $this->stateFrom($this->metadataFor($progress));
    }

    private function progressFor(User $user, LearningActivity $activity): LearnerActivityProgress
    {
        return LearnerActivityProgress::query()->firstOrCreate(
            [
                'user_id' => $user->id,
                'learning_activity_id' => $activity->id,
            ],
            [
                'learning_node_id' => $activity->learning_node_id,
                'status' => 'reached',
                'attempt_count' => 1,
                'reached_at' => now(),
                'metadata' => [],
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function metadataFor(LearnerActivityProgress $progress): array
    {
        return is_array($progress->metadata) ? $progress->metadata : [];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function stateFrom(array $metadata): array
    {
        $state = is_array($metadata['itemObstacle'] ?? null) ? $metadata['itemObstacle'] : [];

        return [
            ...$this->emptyState(),
            'filledSlots' => is_array($state['filledSlots'] ?? null) ? $state['filledSlots'] : [],
            'conditionsMet' => (bool) ($state['conditionsMet'] ?? false),
            'failedAttempts' => (int) ($state['failedAttempts'] ?? 0),
            'lockedUntil' => $state['lockedUntil'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyState(): array
    {
        return [
            'filledSlots' => [],
            'conditionsMet' => false,
            'failedAttempts' => 0,
            'lockedUntil' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function slotAt(LearningActivity $activity, int $slotIndex): array
    {
        $slots = is_array(($activity->config ?? [])['slots'] ?? null)
            ? $activity->config['slots']
            : [];

        $slot = $slots[$slotIndex] ?? null;

        if (! is_array($slot) || (int) ($slot['itemId'] ?? 0) <= 0) {
            throw ValidationException::withMessages([
                'slot_index' => 'That item slot is not configured.',
            ]);
        }

        return $slot;
    }

    /**
     * @param  array<string, mixed>  $filledSlots
     */
    private function conditionsMet(LearningActivity $activity, array $filledSlots): bool
    {
        $slots = is_array(($activity->config ?? [])['slots'] ?? null)
            ? $activity->config['slots']
            : [];

        foreach ($slots as $index => $slot) {
            if (is_array($slot) && (int) ($slot['itemId'] ?? 0) > 0 && ! isset($filledSlots[(string) $index])) {
                return false;
            }
        }

        return $slots !== [];
    }

    private function lockMinutes(LearningActivity $activity): int
    {
        $value = ($activity->config ?? [])['lockMinutes'] ?? 0;

        return is_numeric($value) ? max(0, (int) $value) : 0;
    }

    private function consumeOnEachEntry(LearningActivity $activity): bool
    {
        return filter_var(($activity->config ?? [])['consumeOnEachEntry'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function assertNotLocked(array $state): void
    {
        $lockedUntil = is_string($state['lockedUntil'] ?? null)
            ? Carbon::parse($state['lockedUntil'])
            : null;

        if ($lockedUntil?->isFuture()) {
            throw ValidationException::withMessages([
                'locked_until' => 'This obstacle is locked until '.$lockedUntil->toDateTimeString().'.',
            ]);
        }
    }
}
