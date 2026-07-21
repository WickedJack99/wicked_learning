<?php

namespace App\Organizations\Actions;

use App\Learning\Support\UniqueSlugGenerator;
use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use App\Organizations\OrganizationMembershipLimit;
use Illuminate\Support\Facades\DB;

class SaveOrganization
{
    public function __construct(
        private readonly UniqueSlugGenerator $slugGenerator,
        private readonly OrganizationMembershipLimit $membershipLimit,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(User $user, array $data, ?Organization $organization = null): Organization
    {
        return DB::transaction(function () use ($data, $organization, $user): Organization {
            $isNew = $organization === null;
            $organization ??= new Organization;

            if ($isNew) {
                $this->membershipLimit->assertCanJoin($user);
                $organization->created_by_user_id = $user->id;
            }

            $name = trim((string) $data['name']);

            $organization->fill([
                ...($isNew ? [
                    'governance_type' => $data['governance_type'] ?? Organization::GOVERNANCE_MONARCHY,
                    'leadership_rotated_at' => ($data['governance_type'] ?? Organization::GOVERNANCE_MONARCHY) === Organization::GOVERNANCE_RANDOM
                        ? now()
                        : null,
                ] : []),
                'name' => $name,
                'slug' => $organization->slug ?: $this->slugGenerator->forOrganization($name, $organization),
                'slogan' => $data['slogan'] ?? null,
                'description' => $data['description'] ?? null,
            ]);

            $organization->save();

            if ($isNew) {
                $organization->memberships()->create([
                    'user_id' => $user->id,
                    'role' => OrganizationMembership::ROLE_LEADER,
                    'joined_at' => now(),
                ]);
            }

            return $organization->refresh();
        });
    }
}
