<?php

namespace App\Access\Actions;

use App\Models\AccessChangeEvent;
use App\Models\User;

class RecordAccessChange
{
    /** @param array<string, array{before: mixed, after: mixed}> $changes */
    public function handle(User $actor, User $target, array $changes): AccessChangeEvent
    {
        return AccessChangeEvent::query()->create([
            'action' => AccessChangeEvent::ACTION_ACCESS_UPDATED,
            'actor_user_id' => $actor->id,
            'changes' => $changes,
            'target_user_id' => $target->id,
        ]);
    }
}
