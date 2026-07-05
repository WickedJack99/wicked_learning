<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
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
#[Fillable(['name', 'email', 'password', 'role', 'roles', 'login_disabled_at', 'banned_until'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public const ROLE_ADMIN = 'admin';

    public const ROLE_USER = 'user';

    /**
     * Lower numbers have fewer permissions.
     *
     * @return array<string, int>
     */
    public static function roleLevels(): array
    {
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

    public function isAdmin(): bool
    {
        return $this->hasRole(self::ROLE_ADMIN);
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
        return self::normalizeRoles([
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
}
