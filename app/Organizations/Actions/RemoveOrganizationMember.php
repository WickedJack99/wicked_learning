<?php

namespace App\Organizations\Actions;

use App\Models\OrganizationMembership;
use App\Models\User;
use App\Organizations\OrganizationGovernance;
use Illuminate\Validation\ValidationException;

class RemoveOrganizationMember
{
    public function __construct(private readonly OrganizationGovernance $governance) {}

    public function handle(OrganizationMembership $membership, User $leader): void
    {
        $membership->loadMissing('organization');

        abort_unless(
            $membership->organization && $membership->organization->isLeader($leader),
            403,
        );

        if ($membership->user_id === $leader->id) {
            throw ValidationException::withMessages([
                'organization' => 'Use the leave action to leave this organization.',
            ]);
        }

        $organization = $membership->organization;
        $membership->delete();

        $this->governance->ensureCurrentLeadership($organization);
    }
}
