<?php

namespace App\Organizations;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use Illuminate\Support\Facades\DB;

class OrganizationGovernance
{
    public function ensureCurrentLeadership(Organization $organization): Organization
    {
        if ($organization->governance_type === Organization::GOVERNANCE_ANARCHY) {
            OrganizationMembership::query()
                ->where('organization_id', $organization->id)
                ->where('role', '!=', OrganizationMembership::ROLE_LEADER)
                ->update(['role' => OrganizationMembership::ROLE_LEADER]);

            return $organization->refresh();
        }

        if (
            $organization->governance_type === Organization::GOVERNANCE_RANDOM
            && $this->shouldRotate($organization)
        ) {
            $this->rotateRandomLeader($organization);

            return $organization->refresh();
        }

        return $organization;
    }

    public function roleForNewMember(Organization $organization): string
    {
        return $organization->governance_type === Organization::GOVERNANCE_ANARCHY
            ? OrganizationMembership::ROLE_LEADER
            : OrganizationMembership::ROLE_MEMBER;
    }

    public function canPromoteManually(Organization $organization): bool
    {
        return $organization->governance_type === Organization::GOVERNANCE_MONARCHY;
    }

    public function rotateRandomLeader(Organization $organization): void
    {
        DB::transaction(function () use ($organization): void {
            $membershipQuery = OrganizationMembership::query()
                ->where('organization_id', $organization->id);

            $memberCount = (clone $membershipQuery)->count();

            if ($memberCount === 0) {
                return;
            }

            $currentLeaderIds = (clone $membershipQuery)
                ->where('role', OrganizationMembership::ROLE_LEADER)
                ->pluck('id');

            $candidateQuery = (clone $membershipQuery);

            if ($currentLeaderIds->count() < $memberCount) {
                $candidateQuery->whereNotIn('id', $currentLeaderIds);
            }

            $nextLeader = $candidateQuery->inRandomOrder()->first()
                ?? (clone $membershipQuery)->inRandomOrder()->first();

            if (! $nextLeader) {
                return;
            }

            (clone $membershipQuery)->update([
                'role' => OrganizationMembership::ROLE_MEMBER,
            ]);

            $nextLeader->forceFill([
                'role' => OrganizationMembership::ROLE_LEADER,
            ])->save();

            $organization->forceFill([
                'leadership_rotated_at' => now(),
            ])->save();
        });
    }

    private function shouldRotate(Organization $organization): bool
    {
        if ($this->leaderCount($organization) === 0) {
            return true;
        }

        return $organization->leadership_rotated_at === null
            || $organization->leadership_rotated_at->lt(now()->startOfMonth());
    }

    private function leaderCount(Organization $organization): int
    {
        return OrganizationMembership::query()
            ->where('organization_id', $organization->id)
            ->where('role', OrganizationMembership::ROLE_LEADER)
            ->count();
    }
}
