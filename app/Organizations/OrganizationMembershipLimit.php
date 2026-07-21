<?php

namespace App\Organizations;

use App\Models\OrganizationMembership;
use App\Models\PlatformOrganizationSetting;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class OrganizationMembershipLimit
{
    public function assertCanJoin(User $user): void
    {
        $limit = PlatformOrganizationSetting::current()->max_memberships_per_user;
        $count = OrganizationMembership::query()
            ->where('user_id', $user->id)
            ->count();

        if ($count >= $limit) {
            throw ValidationException::withMessages([
                'organization' => "You can be part of at most {$limit} organizations.",
            ]);
        }
    }
}
