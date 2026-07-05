<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A one-use invite token required to create a new account.
 */
#[Fillable(['token_hash', 'role', 'roles', 'created_by_user_id', 'used_by_user_id', 'used_at', 'expires_at'])]
#[Hidden(['token_hash'])]
class RegistrationToken extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'roles' => 'array',
            'used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', trim($token));
    }

    /**
     * Create a token and return the only plaintext copy.
     *
     * @param  array<int, string>|string  $roles
     */
    public static function createFor(
        User $creator,
        array|string $roles = [User::ROLE_USER],
        Carbon|string|null $expiresAt = null,
    ): string {
        $plainToken = Str::random(40);
        $normalizedRoles = User::normalizeRoles($roles);

        static::query()->create([
            'token_hash' => static::hashToken($plainToken),
            'role' => self::primaryRole($normalizedRoles),
            'roles' => $normalizedRoles,
            'created_by_user_id' => $creator->id,
            'expires_at' => $expiresAt,
        ]);

        return $plainToken;
    }

    public function canBeUsed(): bool
    {
        return $this->used_at === null && ! $this->isExpired();
    }

    public function isExpired(): bool
    {
        if ($this->expires_at === null) {
            return false;
        }

        return $this->asDateTime($this->expires_at)->isPast();
    }

    /**
     * @return list<string>
     */
    public function grantedRoles(): array
    {
        return User::normalizeRoles($this->roles ?? [$this->role]);
    }

    /**
     * @param  list<string>  $roles
     */
    private static function primaryRole(array $roles): string
    {
        return array_reduce(
            $roles,
            fn (string $highestRole, string $role): string => (User::roleLevels()[$role] ?? 0) > (User::roleLevels()[$highestRole] ?? 0)
                ? $role
                : $highestRole,
            User::ROLE_USER,
        );
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function usedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'used_by_user_id');
    }
}
