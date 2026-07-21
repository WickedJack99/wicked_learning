<?php

namespace App\Organizations\Actions;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Organizations\OrganizationGovernance;
use Illuminate\Validation\ValidationException;

class LeaveOrganization
{
    public function __construct(private readonly OrganizationGovernance $governance) {}

    public function handle(Organization $organization, User $user): void
    {
        $membership = OrganizationMembership::query()
            ->where('organization_id', $organization->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership) {
            return;
        }

        if (
            $membership->role === OrganizationMembership::ROLE_LEADER
            && $this->leaderCount($organization) <= 1
            && ! $this->canRandomOrganizationChooseReplacement($organization)
        ) {
            throw ValidationException::withMessages([
                'organization' => 'The last leader must delete the organization instead of leaving it.',
            ]);
        }

        $membership->delete();

        $this->governance->ensureCurrentLeadership($organization);
    }

    private function canRandomOrganizationChooseReplacement(Organization $organization): bool
    {
        return $organization->governance_type === Organization::GOVERNANCE_RANDOM
            && $organization->memberships()->count() > 1;
    }

    private function leaderCount(Organization $organization): int
    {
        return OrganizationMembership::query()
            ->where('organization_id', $organization->id)
            ->where('role', OrganizationMembership::ROLE_LEADER)
            ->count();
    }
}
