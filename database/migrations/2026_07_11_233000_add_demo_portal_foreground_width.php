<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('learning_activities')
            ->where('type', 'portal')
            ->whereIn('slug', ['prepare-for-travel', 'arrive-through-the-gate'])
            ->orderBy('id')
            ->eachById(function (object $activity): void {
                $config = json_decode($activity->config ?? '[]', true);

                if (! is_array($config)) {
                    $config = [];
                }

                $config['portalForegroundWidth'] ??= 28;

                DB::table('learning_activities')
                    ->where('id', $activity->id)
                    ->update([
                        'config' => json_encode($config),
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('learning_activities')
            ->where('type', 'portal')
            ->whereIn('slug', ['prepare-for-travel', 'arrive-through-the-gate'])
            ->orderBy('id')
            ->eachById(function (object $activity): void {
                $config = json_decode($activity->config ?? '[]', true);

                if (! is_array($config)) {
                    return;
                }

                unset($config['portalForegroundWidth']);

                DB::table('learning_activities')
                    ->where('id', $activity->id)
                    ->update([
                        'config' => json_encode($config),
                        'updated_at' => now(),
                    ]);
            });
    }
};
