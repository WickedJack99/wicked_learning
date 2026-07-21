<?php

namespace App\Organizations\Actions;

use App\Models\OrganizationMessage;
use App\Models\User;

class HideOrganizationMessage
{
    public function handle(OrganizationMessage $message, User $admin): void
    {
        abort_unless($admin->isAdmin(), 403);

        $message->forceFill([
            'hidden_at' => now(),
            'hidden_by_user_id' => $admin->id,
        ])->save();
    }
}
