<?php

namespace App\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationJoinRequest;
use App\Models\User;
use App\Organizations\OrganizationMembershipLimit;
use Illuminate\Validation\ValidationException;

class RequestOrganizationMembership
{
    public function __construct(private readonly OrganizationMembershipLimit $membershipLimit) {}

    public function handle(Organization $organization, User $user, ?string $message = null): OrganizationJoinRequest
    {
        if ($organization->isMember($user)) {
            throw ValidationException::withMessages([
                'organization' => 'You are already a member of this organization.',
            ]);
        }

        $this->membershipLimit->assertCanJoin($user);

        return OrganizationJoinRequest::query()->updateOrCreate(
            [
                'organization_id' => $organization->id,
                'user_id' => $user->id,
            ],
            [
                'status' => OrganizationJoinRequest::STATUS_PENDING,
                'message' => $message,
                'reviewed_by_user_id' => null,
                'reviewed_at' => null,
            ],
        );
    }
}
