<?php

namespace App\Settings\Services;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Http\Request;

/** Stores the low-pressure reminder state without coupling it to learning evidence. */
class PlatformFeedbackPrompt
{
    public const STATUS_ENABLED = 'enabled';

    public const STATUS_SNOOZED = 'snoozed';

    public const STATUS_DECLINED = 'declined';

    public function status(?UserPreference $preference): string
    {
        $prompt = $this->settings($preference)['feedback_prompt'] ?? null;
        $status = is_array($prompt) ? ($prompt['status'] ?? null) : null;

        return in_array($status, [
            self::STATUS_ENABLED,
            self::STATUS_SNOOZED,
            self::STATUS_DECLINED,
        ], true) ? $status : self::STATUS_ENABLED;
    }

    public function shouldShow(User $user, Request $request): bool
    {
        if (
            $request->is('settings*')
            || $request->is('feedback')
            || $request->session()->get('platform_feedback_prompt_shown', false)
            || $this->status($user->preference) === self::STATUS_DECLINED
        ) {
            return false;
        }

        $prompt = $this->settings($user->preference)['feedback_prompt'] ?? null;
        $snoozedUntil = is_array($prompt) ? ($prompt['snoozed_until'] ?? null) : null;

        if (is_string($snoozedUntil) && now()->isBefore($snoozedUntil)) {
            return false;
        }

        $request->session()->put('platform_feedback_prompt_shown', true);

        return true;
    }

    public function update(User $user, string $action): void
    {
        $preference = $user->preference()->firstOrNew(['user_id' => $user->id]);
        $settings = $this->settings($preference);
        $settings['feedback_prompt'] = match ($action) {
            'dismiss' => [
                'status' => self::STATUS_SNOOZED,
                'snoozed_until' => now()->addDays(14)->toIso8601String(),
            ],
            'decline' => [
                'status' => self::STATUS_DECLINED,
                'snoozed_until' => null,
            ],
            'enable' => [
                'status' => self::STATUS_ENABLED,
                'snoozed_until' => null,
            ],
            default => throw new \InvalidArgumentException('Unknown feedback prompt action.'),
        };

        $preference->settings = $settings;
        $preference->save();
        $user->setRelation('preference', $preference);

        request()->session()->forget('platform_feedback_prompt_shown');
    }

    /** @return array<string, mixed> */
    private function settings(?UserPreference $preference): array
    {
        return is_array($preference?->settings) ? $preference->settings : [];
    }
}
