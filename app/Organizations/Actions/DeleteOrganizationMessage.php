<?php

namespace App\Organizations\Actions;

use App\Models\OrganizationMessage;
use App\Models\User;

class DeleteOrganizationMessage
{
    public function handle(OrganizationMessage $message, User $user): void
    {
        abort_unless(
            $message->user_id === $user->id && $message->hidden_at === null,
            403,
        );

        $message->delete();
    }
}
