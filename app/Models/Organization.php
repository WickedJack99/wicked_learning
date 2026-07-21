<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'created_by_user_id',
    'icon_set_by_user_id',
    'governance_type',
    'leadership_rotated_at',
    'name',
    'slug',
    'slogan',
    'description',
    'icon_url',
])]
class Organization extends Model
{
    public const GOVERNANCE_ANARCHY = 'anarchy';

    public const GOVERNANCE_MONARCHY = 'monarchy';

    public const GOVERNANCE_RANDOM = 'random';

    public const GOVERNANCE_TYPES = [
        self::GOVERNANCE_MONARCHY,
        self::GOVERNANCE_ANARCHY,
        self::GOVERNANCE_RANDOM,
    ];

    protected function casts(): array
    {
        return [
            'leadership_rotated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function iconSetter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'icon_set_by_user_id');
    }

    /**
     * @return HasMany<OrganizationMembership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(OrganizationMembership::class);
    }

    /**
     * @return HasMany<OrganizationJoinRequest, $this>
     */
    public function joinRequests(): HasMany
    {
        return $this->hasMany(OrganizationJoinRequest::class);
    }

    /**
     * @return HasMany<OrganizationMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(OrganizationMessage::class);
    }

    /**
     * @return HasMany<OrganizationIconReport, $this>
     */
    public function iconReports(): HasMany
    {
        return $this->hasMany(OrganizationIconReport::class);
    }

    public function isLeader(User $user): bool
    {
        return $this->memberships()
            ->where('user_id', $user->id)
            ->where('role', OrganizationMembership::ROLE_LEADER)
            ->exists();
    }

    public function isMember(User $user): bool
    {
        return $this->memberships()
            ->where('user_id', $user->id)
            ->exists();
    }
}
