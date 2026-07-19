<?php

namespace App\Settings\Actions;

use App\Models\User;

class UpdateSoundPreferences
{
    /**
     * @param  array{muted: bool, effectsVolume: int, ambienceVolume: int}  $data
     */
    public function handle(User $user, array $data): void
    {
        $preference = $user->preference()->firstOrNew(['user_id' => $user->id]);
        $settings = is_array($preference->settings) ? $preference->settings : [];

        $settings['sound'] = [
            'muted' => (bool) $data['muted'],
            'effectsVolume' => $this->volume($data['effectsVolume']),
            'ambienceVolume' => $this->volume($data['ambienceVolume']),
        ];

        $preference->settings = $settings;
        $preference->save();
    }

    private function volume(mixed $value): int
    {
        return max(0, min(100, (int) $value));
    }
}
