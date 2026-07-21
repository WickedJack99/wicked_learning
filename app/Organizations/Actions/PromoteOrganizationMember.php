<?php

namespace App\Organizations\Actions;

use App\Models\OrganizationMembership;
use App\Models\User;
use App\Organizations\OrganizationGovernance;
use Illuminate\Validation\ValidationException;

class PromoteOrganizationMember
{
    public function __construct(private readonly OrganizationGovernance $governance) {}

    public function handle(OrganizationMembership $membership, User $leader): OrganizationMembership
    {
        $membership->loadMissing('organization');

        abort_unless(
            $membership->organization && $membership->organization->isLeader($leader),
            403,
        );

        if (! $this->governance->canPromoteManually($membership->organization)) {
            throw ValidationException::withMessages([
                'organization' => 'This organization type does not support manual leader promotion.',
            ]);
        }

        $membership->forceFill([
            'role' => OrganizationMembership::ROLE_LEADER,
        ])->save();

        return $membership;
    }
}
