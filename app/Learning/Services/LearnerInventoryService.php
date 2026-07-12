<?php

namespace App\Learning\Services;

use App\Models\LearningItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LearnerInventoryService
{
    /**
     * @param  list<array{itemId: int, quantity: int}>  $items
     * @return list<LearningItem>
     */
    public function grantItems(User $user, array $items): array
    {
        return DB::transaction(function () use ($user, $items): array {
            $granted = [];

            foreach ($items as $item) {
                $itemId = (int) $item['itemId'];
                $quantity = max(1, (int) $item['quantity']);
                $learningItem = LearningItem::query()->find($itemId);

                if (! $learningItem instanceof LearningItem) {
                    continue;
                }

                $pivot = DB::table('user_learning_items')
                    ->where('user_id', $user->id)
                    ->where('learning_item_id', $itemId)
                    ->lockForUpdate()
                    ->first();

                if ($pivot) {
                    DB::table('user_learning_items')
                        ->where('id', $pivot->id)
                        ->update([
                            'quantity' => ((int) $pivot->quantity) + $quantity,
                            'updated_at' => now(),
                        ]);
                } else {
                    DB::table('user_learning_items')->insert([
                        'user_id' => $user->id,
                        'learning_item_id' => $itemId,
                        'quantity' => $quantity,
                        'acquired_at' => now(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $granted[] = $learningItem;
            }

            return $granted;
        });
    }

    /**
     * Adds only the missing quantity for each item.
     *
     * This is used to reconcile older activity progress records that already
     * stored a successful item roll before inventory application was tracked.
     *
     * @param  list<array{itemId: int, quantity: int}>  $items
     * @return list<LearningItem>
     */
    public function grantMissingItems(User $user, array $items): array
    {
        return DB::transaction(function () use ($user, $items): array {
            $missingItems = [];

            foreach ($items as $item) {
                $itemId = (int) $item['itemId'];
                $quantity = max(1, (int) $item['quantity']);
                $pivot = DB::table('user_learning_items')
                    ->where('user_id', $user->id)
                    ->where('learning_item_id', $itemId)
                    ->lockForUpdate()
                    ->first();
                $currentQuantity = $pivot ? max(0, (int) $pivot->quantity) : 0;
                $missingQuantity = max(0, $quantity - $currentQuantity);

                if ($missingQuantity > 0) {
                    $missingItems[] = [
                        'itemId' => $itemId,
                        'quantity' => $missingQuantity,
                    ];
                }
            }

            return $this->grantItems($user, $missingItems);
        });
    }

    public function consumeItem(User $user, int $itemId, int $quantity = 1): LearningItem
    {
        return DB::transaction(function () use ($user, $itemId, $quantity): LearningItem {
            $learningItem = LearningItem::query()->find($itemId);

            if (! $learningItem instanceof LearningItem) {
                throw ValidationException::withMessages([
                    'item_id' => 'The selected item no longer exists.',
                ]);
            }

            $pivot = DB::table('user_learning_items')
                ->where('user_id', $user->id)
                ->where('learning_item_id', $itemId)
                ->lockForUpdate()
                ->first();

            if (! $pivot || (int) $pivot->quantity < $quantity) {
                throw ValidationException::withMessages([
                    'item_id' => 'That item is not available in your inventory.',
                ]);
            }

            DB::table('user_learning_items')
                ->where('id', $pivot->id)
                ->update([
                    'quantity' => max(0, ((int) $pivot->quantity) - $quantity),
                    'updated_at' => now(),
                ]);

            return $learningItem;
        });
    }
}
