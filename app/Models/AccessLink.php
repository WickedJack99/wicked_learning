<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

#[Fillable([
    'token_hash',
    'purpose',
    'usage_policy',
    'is_enabled',
    'payload',
    'note',
    'created_by_user_id',
    'redeemed_by_user_id',
    'redeemed_at',
    'expires_at',
])]
#[Hidden(['token_hash'])]
class AccessLink extends Model
{
    public const PURPOSE_GRANT_TOOL = 'grant_tool';

    public const PURPOSE_GRANT_ITEMS = 'grant_items';

    public const PURPOSE_REGISTRATION = 'registration';

    public const PURPOSE_TEMPORARY_LOGIN = 'temporary_login';

    public const USAGE_ONE_TIME = 'one_time';

    public const USAGE_MULTIPLE = 'multiple';

    public const USAGE_PER_USER = 'per_user';

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'is_enabled' => 'boolean',
            'redeemed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', trim($token));
    }

    /**
     * Create an access link and return its only plaintext token.
     *
     * New links use a 32-character hexadecimal suffix (128 bits of entropy).
     * Existing links with the previous longer format remain redeemable because
     * redemption hashes the opaque token without imposing a length.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function createFor(
        User $creator,
        string $purpose,
        array $payload,
        Carbon|string $expiresAt,
        ?string $note = null,
        string $usagePolicy = self::USAGE_ONE_TIME,
    ): string {
        $plainToken = bin2hex(random_bytes(16));

        static::query()->create([
            'token_hash' => static::hashToken($plainToken),
            'purpose' => $purpose,
            'usage_policy' => $usagePolicy,
            'is_enabled' => true,
            'payload' => $payload,
            'note' => $note,
            'created_by_user_id' => $creator->id,
            'expires_at' => $expiresAt,
        ]);

        return $plainToken;
    }

    public function canBeRedeemed(): bool
    {
        return $this->is_enabled
            && ($this->expires_at === null || $this->expires_at->isFuture())
            && ($this->usage_policy !== self::USAGE_ONE_TIME || $this->redeemed_at === null);
    }

    public function canBeRedeemedBy(User $user): bool
    {
        if (! $this->canBeRedeemed()) {
            return false;
        }

        return $this->usage_policy !== self::USAGE_PER_USER
            || ! $this->redemptions()->where('user_id', $user->id)->exists();
    }

    public function recordRedemption(User $user): void
    {
        $now = now();

        $this->redemptions()->create([
            'redeemed_at' => $now,
            'user_id' => $user->id,
        ]);

        if ($this->redeemed_at === null) {
            $this->forceFill([
                'redeemed_by_user_id' => $user->id,
                'redeemed_at' => $now,
            ])->save();
        }
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
    public function redeemedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'redeemed_by_user_id');
    }

    /**
     * @return HasMany<AccessLinkRedemption, $this>
     */
    public function redemptions(): HasMany
    {
        return $this->hasMany(AccessLinkRedemption::class);
    }
}
