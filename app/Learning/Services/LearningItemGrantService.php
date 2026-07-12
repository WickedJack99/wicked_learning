<?php

namespace App\Learning\Services;

use App\Models\LearnerActivityProgress;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LearningItemGrantService
{
    public function __construct(private readonly LearnerInventoryService $inventory) {}

    /**
     * @return array<string, mixed>
     */
    public function rollAndGrant(User $user, LearningActivity $activity): array
    {
        abort_unless($activity->type === 'item_grant', 404);

        return DB::transaction(function () use ($user, $activity): array {
            $progress = LearnerActivityProgress::query()
                ->where('user_id', $user->id)
                ->where('learning_activity_id', $activity->id)
                ->lockForUpdate()
                ->first();

            if (! $progress) {
                $progress = new LearnerActivityProgress([
                    'user_id' => $user->id,
                    'learning_node_id' => $activity->learning_node_id,
                    'learning_activity_id' => $activity->id,
                    'status' => 'completed',
                    'attempt_count' => 1,
                    'reached_at' => now(),
                    'completed_at' => now(),
                    'metadata' => [],
                ]);
            }

            $metadata = is_array($progress->metadata) ? $progress->metadata : [];
            $storedRoll = is_array($metadata['itemGrant'] ?? null) ? $metadata['itemGrant'] : null;

            if ($storedRoll) {
                return $storedRoll;
            }

            $config = is_array($activity->config) ? $activity->config : [];
            $chance = $this->chanceBasisPoints($config['probabilityPercent'] ?? 100);
            $roll = random_int(1, 10000);
            $success = $roll <= $chance;
            $items = $this->configuredItems($config);
            $granted = $success ? $this->inventory->grantItems($user, $items) : [];

            $result = [
                'rolledAt' => Carbon::now()->toIso8601String(),
                'roll' => $roll,
                'chanceBasisPoints' => $chance,
                'success' => $success,
                'items' => array_map(fn (array $item): array => [
                    'itemId' => $item['itemId'],
                    'quantity' => $item['quantity'],
                ], $items),
                'grantedItemIds' => array_map(fn ($item): int => (int) $item->id, $granted),
            ];

            $metadata['itemGrant'] = $result;
            $progress->metadata = $metadata;
            $progress->status = 'completed';
            $progress->reached_at ??= now();
            $progress->completed_at ??= now();
            $progress->save();

            return $result;
        });
    }

    /**
     * @param  array<string, mixed>  $config
     * @return list<array{itemId: int, quantity: int}>
     */
    private function configuredItems(array $config): array
    {
        $items = is_array($config['items'] ?? null) ? $config['items'] : [];

        return array_values(array_filter(array_map(
            fn (mixed $item): array => [
                'itemId' => is_array($item) ? (int) ($item['itemId'] ?? 0) : 0,
                'quantity' => max(1, is_array($item) ? (int) ($item['quantity'] ?? 1) : 1),
            ],
            $items,
        ), fn (array $item): bool => $item['itemId'] > 0));
    }

    private function chanceBasisPoints(mixed $value): int
    {
        $percent = is_numeric($value) ? (float) $value : 100.0;
        $percent = max(0.01, min(100.0, $percent));

        return (int) round($percent * 100);
    }
}
