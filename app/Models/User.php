<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Access\AccessLevel;
use App\Access\PermissionCatalog;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string|null $username
 * @property string|null $profile_image
 * @property string|null $avatar
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string $role
 * @property array<int, string>|null $roles
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $login_disabled_at
 * @property Carbon|null $banned_until
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'username', 'profile_image', 'email', 'password', 'role', 'roles', 'login_disabled_at', 'banned_until'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public const ROLE_ADMIN = 'admin';

    public const ROLE_USER = 'user';

    /**
     * @var list<string>
     */
    protected $appends = ['avatar'];

    /**
     * Lower numbers have fewer permissions.
     *
     * @return array<string, int>
     */
    public static function roleLevels(): array
    {
        if (Schema::hasTable('access_roles')) {
            return AccessRole::query()
                ->pluck('level', 'slug')
                ->map(fn (int|string $level): int => (int) $level)
                ->all();
        }

        return [
            self::ROLE_USER => 10,
            self::ROLE_ADMIN => 20,
        ];
    }

    /**
     * @return list<string>
     */
    public static function roles(): array
    {
        return array_keys(self::roleLevels());
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'roles' => 'array',
            'two_factor_confirmed_at' => 'datetime',
            'login_disabled_at' => 'datetime',
            'banned_until' => 'datetime',
        ];
    }

    public function getAvatarAttribute(): ?string
    {
        return $this->profile_image;
    }

    public function isAdmin(): bool
    {
        return $this->hasAccess(PermissionCatalog::USERS, AccessLevel::READ)
            || $this->hasRole(self::ROLE_ADMIN);
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->assignedRoles(), true);
    }

    /**
     * @return list<string>
     */
    public function assignedRoles(): array
    {
        $roleSlugs = [];

        if ($this->relationLoaded('accessRoles')) {
            $roleSlugs = $this->accessRoles
                ->pluck('slug')
                ->filter()
                ->values()
                ->all();
        } elseif ($this->exists && Schema::hasTable('access_role_user')) {
            $roleSlugs = $this->accessRoles()
                ->pluck('slug')
                ->filter()
                ->values()
                ->all();
        }

        return self::normalizeRoles([
            ...$roleSlugs,
            ...($this->roles ?? []),
            $this->role,
        ]);
    }

    /**
     * @return list<string>
     */
    public function assignableRoles(): array
    {
        return array_values(array_filter(
            self::roles(),
            fn (string $role): bool => $this->canAssignRole($role),
        ));
    }

    public function canAssignRole(string $role): bool
    {
        return $this->roleLevel($role) <= $this->highestRoleLevel();
    }

    public function hasAccess(string $resource, string $requiredLevel): bool
    {
        return AccessLevel::allows(
            $this->accessLevelFor($resource),
            $requiredLevel,
        );
    }

    public function accessLevelFor(string $resource): string
    {
        $highest = AccessLevel::NONE;

        foreach ($this->assignedRoles() as $roleSlug) {
            $role = $this->accessRoleForSlug($roleSlug);
            $level = $role?->permissionMap()[$resource] ?? AccessLevel::NONE;

            if (AccessLevel::allows($level, $highest)) {
                $highest = $level;
            }
        }

        return $highest;
    }

    /**
     * @param  list<string>|array<int, string>|string|null  $roles
     * @return list<string>
     */
    public static function normalizeRoles(array|string|null $roles): array
    {
        $roleList = is_array($roles) ? $roles : [$roles];
        $validRoles = array_values(array_filter(
            self::roles(),
            fn (string $role): bool => in_array($role, $roleList, true),
        ));

        return $validRoles === [] ? [self::ROLE_USER] : $validRoles;
    }

    /**
     * @param  list<string>|array<int, string>  $roles
     */
    public function setAssignedRoles(array $roles): void
    {
        $normalizedRoles = self::normalizeRoles($roles);
        $this->forceFill([
            'role' => $this->primaryRole($normalizedRoles),
            'roles' => $normalizedRoles,
        ]);

        if ($this->exists && Schema::hasTable('access_roles')) {
            $roleIds = AccessRole::query()
                ->whereIn('slug', $normalizedRoles)
                ->pluck('id')
                ->all();

            $this->accessRoles()->sync($roleIds);
        }
    }

    public function canLogIn(): bool
    {
        return $this->login_disabled_at === null && ! $this->isCurrentlyBanned();
    }

    public function isCurrentlyBanned(): bool
    {
        return $this->banned_until !== null && $this->banned_until->isFuture();
    }

    public function loginBlockMessage(): string
    {
        if ($this->login_disabled_at !== null) {
            return 'This account has been disabled.';
        }

        if ($this->isCurrentlyBanned()) {
            return 'This account is banned until '.$this->banned_until?->toDayDateTimeString().'.';
        }

        return 'This account cannot log in.';
    }

    private function roleLevel(string $role): int
    {
        if (Schema::hasTable('access_roles')) {
            return (int) (AccessRole::query()
                ->where('slug', $role)
                ->value('level') ?? 0);
        }

        return self::roleLevels()[$role] ?? 0;
    }

    private function highestRoleLevel(): int
    {
        $highestLevel = 0;

        foreach ($this->assignedRoles() as $role) {
            $highestLevel = max($highestLevel, $this->roleLevel($role));
        }

        return $highestLevel;
    }

    /**
     * @param  list<string>  $roles
     */
    private function primaryRole(array $roles): string
    {
        return array_reduce(
            $roles,
            fn (string $highestRole, string $role): string => $this->roleLevel($role) > $this->roleLevel($highestRole)
                ? $role
                : $highestRole,
            self::ROLE_USER,
        );
    }

    private function accessRoleForSlug(string $slug): ?AccessRole
    {
        if (! Schema::hasTable('access_roles')) {
            return null;
        }

        return AccessRole::query()
            ->with('permissions')
            ->where('slug', $slug)
            ->first();
    }

    /**
     * Dynamic roles assigned to this account.
     *
     * @return BelongsToMany<AccessRole, $this>
     */
    public function accessRoles(): BelongsToMany
    {
        return $this->belongsToMany(AccessRole::class, 'access_role_user')
            ->withTimestamps();
    }

    /**
     * Collaboration groups assigned to this account.
     *
     * @return BelongsToMany<LearningGroup, $this>
     */
    public function learningGroups(): BelongsToMany
    {
        return $this->belongsToMany(LearningGroup::class, 'learning_group_user')
            ->withPivot('joined_at')
            ->withTimestamps();
    }

    /**
     * Independent organizations this user has joined.
     *
     * @return HasMany<OrganizationMembership, $this>
     */
    public function organizationMemberships(): HasMany
    {
        return $this->hasMany(OrganizationMembership::class);
    }

    /**
     * Independent organizations created by this user.
     *
     * @return HasMany<Organization, $this>
     */
    public function createdOrganizations(): HasMany
    {
        return $this->hasMany(Organization::class, 'created_by_user_id');
    }

    public function hasGroupEditableMaps(): bool
    {
        return $this->learningGroups()
            ->whereHas('editableMaps')
            ->exists();
    }

    public function canEditLearningMap(LearningMap $map): bool
    {
        return $this->learningGroups()
            ->whereHas(
                'editableMaps',
                fn ($query) => $query->whereKey($map->id),
            )
            ->exists();
    }

    /**
     * Settings that should persist beyond one browser.
     *
     * @return HasOne<UserPreference, $this>
     */
    public function preference(): HasOne
    {
        return $this->hasOne(UserPreference::class);
    }

    /**
     * Tokens created by this user for inviting new people.
     *
     * @return HasMany<RegistrationToken, $this>
     */
    public function createdRegistrationTokens(): HasMany
    {
        return $this->hasMany(RegistrationToken::class, 'created_by_user_id');
    }

    /**
     * The one-use registration token consumed by this user.
     *
     * @return HasOne<RegistrationToken, $this>
     */
    public function registrationToken(): HasOne
    {
        return $this->hasOne(RegistrationToken::class, 'used_by_user_id');
    }

    /**
     * Personal places this user wants to revisit.
     *
     * @return HasMany<LearningNodeBookmark, $this>
     */
    public function learningNodeBookmarks(): HasMany
    {
        return $this->hasMany(LearningNodeBookmark::class);
    }

    /**
     * Hidden world-map nodes this learner has found.
     *
     * @return HasMany<LearnerNodeDiscovery, $this>
     */
    public function learningNodeDiscoveries(): HasMany
    {
        return $this->hasMany(LearnerNodeDiscovery::class);
    }

    /**
     * Tools this learner can equip during obstacle-style activities.
     *
     * @return BelongsToMany<LearningTool, $this>
     */
    public function learningTools(): BelongsToMany
    {
        return $this->belongsToMany(LearningTool::class, 'user_learning_tools')
            ->withPivot('acquired_at')
            ->withTimestamps()
            ->orderByPivot('acquired_at')
            ->orderBy('user_learning_tools.id');
    }

    /**
     * Consumable items this learner currently carries.
     *
     * @return BelongsToMany<LearningItem, $this>
     */
    public function learningItems(): BelongsToMany
    {
        return $this->belongsToMany(LearningItem::class, 'user_learning_items')
            ->withPivot('quantity', 'acquired_at')
            ->withTimestamps()
            ->wherePivot('quantity', '>', 0)
            ->orderByPivot('acquired_at')
            ->orderBy('user_learning_items.id');
    }

    /**
     * Private markdown pages that collect the learner's own reflections.
     *
     * @return HasMany<LearnerJournalPage, $this>
     */
    public function journalPages(): HasMany
    {
        return $this->hasMany(LearnerJournalPage::class);
    }

    /**
     * Individual, timestamped reflection entries written during learning.
     *
     * @return HasMany<LearnerReflection, $this>
     */
    public function learnerReflections(): HasMany
    {
        return $this->hasMany(LearnerReflection::class);
    }
}
