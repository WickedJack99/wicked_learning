<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

#[Fillable([
    'token_hash',
    'purpose',
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

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'redeemed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', trim($token));
    }

    /**
     * Create a one-use link and return its only plaintext token.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function createFor(
        User $creator,
        string $purpose,
        array $payload,
        Carbon|string $expiresAt,
        ?string $note = null,
    ): string {
        $plainToken = bin2hex(random_bytes(32));

        static::query()->create([
            'token_hash' => static::hashToken($plainToken),
            'purpose' => $purpose,
            'payload' => $payload,
            'note' => $note,
            'created_by_user_id' => $creator->id,
            'expires_at' => $expiresAt,
        ]);

        return $plainToken;
    }

    public function canBeRedeemed(): bool
    {
        return $this->redeemed_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
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
}
