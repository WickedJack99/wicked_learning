<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->updatePortal('prepare-for-travel', [
            'portalMode' => 'output',
            'portalDurationSeconds' => 2.5,
        ]);

        $this->updatePortal('arrive-through-the-gate', [
            'portalMode' => 'input',
            'portalDurationSeconds' => 1.8,
        ]);
    }

    public function down(): void
    {
        DB::table('learning_activities')
            ->where('type', 'portal')
            ->whereIn('slug', ['prepare-for-travel', 'arrive-through-the-gate'])
            ->get()
            ->each(function (object $activity): void {
                $config = $this->decodeConfig($activity->config);

                foreach ([
                    'portalBackgroundDark',
                    'portalBackgroundLight',
                    'portalDurationSeconds',
                    'portalForegroundDark',
                    'portalForegroundLight',
                    'portalForegroundX',
                    'portalForegroundY',
                    'portalSwirlEnabled',
                ] as $key) {
                    unset($config[$key]);
                }

                DB::table('learning_activities')
                    ->where('id', $activity->id)
                    ->update([
                        'config' => json_encode($config, JSON_THROW_ON_ERROR),
                        'updated_at' => now(),
                    ]);
            });
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function updatePortal(string $slug, array $overrides): void
    {
        $activity = DB::table('learning_activities')
            ->where('type', 'portal')
            ->where('slug', $slug)
            ->first();

        if (! $activity) {
            return;
        }

        $config = [
            ...$this->decodeConfig($activity->config),
            'portalBackgroundDark' => '/images/portals/portal-travel-background.png',
            'portalBackgroundLight' => '/images/portals/portal-travel-background-light.png',
            'portalForegroundDark' => '/images/portals/portal-swirl.png',
            'portalForegroundLight' => '/images/portals/portal-swirl.png',
            'portalForegroundX' => 58,
            'portalForegroundY' => 45,
            'portalSwirlEnabled' => true,
            ...$overrides,
        ];

        DB::table('learning_activities')
            ->where('id', $activity->id)
            ->update([
                'config' => json_encode($config, JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeConfig(mixed $config): array
    {
        if (! is_string($config) || $config === '') {
            return [];
        }

        $decoded = json_decode($config, true);

        return is_array($decoded) ? $decoded : [];
    }
};
