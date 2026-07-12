<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $hasNeutralWorld = DB::table('learning_worlds')
            ->where('slug', 'demo-learning-world')
            ->exists();

        $world = DB::table('learning_worlds')
            ->where('slug', 'demo-cybersecurity')
            ->first();

        if ($world !== null) {
            $themeConfig = json_decode((string) $world->theme_config, true);
            $themeConfig = is_array($themeConfig) ? $themeConfig : [];
            $themeConfig['storyTone'] = 'calm exploration';

            $worldUpdate = [
                'title' => 'Learning Grove',
                'theme_config' => json_encode($themeConfig),
            ];

            if (! $hasNeutralWorld) {
                $worldUpdate['slug'] = 'demo-learning-world';
            }

            DB::table('learning_worlds')
                ->where('id', $world->id)
                ->update($worldUpdate);
        }

        DB::table('learning_maps')
            ->where('slug', 'first-sector')
            ->update([
                'title' => 'First Clearing',
                'description' => 'A tiny learning landscape where each node is a place for active practice.',
            ]);
        $this->replaceJsonValue(
            'learning_maps',
            'background_config',
            'imageUrl',
            '/images/themes/cyber-map-background.svg',
            '/images/themes/abstract-map-background.svg',
        );

        DB::table('learning_maps')
            ->where('slug', 'signal-archive')
            ->update([
                'title' => 'Quiet Library',
                'description' => 'A connected map for calm pattern-practice.',
            ]);

        $this->updateNodeVisuals('signal-gate', [
            'title' => 'Pattern Gate',
            'description' => 'Meet the guide and practice noticing a meaningful pattern.',
        ], [
            'label' => 'Pattern Gate',
        ]);

        $this->updateNodeVisuals('return-gate', [
            'title' => 'Return Path',
            'description' => 'The sibling portal back toward the first clearing.',
        ], [
            'label' => 'Return Path',
            'tooltip' => 'Return toward the first clearing.',
        ]);

        DB::table('dialogue_stages')
            ->where('speaker_name', 'Mira')
            ->update(['speaker_role' => 'Learning Guide']);

        DB::table('dialogue_stages')->where('stage_key', 'arrival')->update([
            'body' => 'Welcome to the Learning Grove. Nothing here asks you to chase points. We look for patterns, test ideas, and keep what becomes useful.',
        ]);
        DB::table('dialogue_stages')->where('stage_key', 'question-setup')->update([
            'body' => 'A small observation just arrived. Read it like an explorer: what detail changes the story?',
        ]);
        DB::table('dialogue_stages')->where('stage_key', 'review')->update([
            'body' => 'Try comparing the focus clue with the spread clue. One focus point tells us where attention gathered; many starting points tell us how the pattern behaved.',
        ]);

        DB::table('learning_activities')->where('slug', 'guided-signal-dialogue')->update(['title' => 'Guided pattern dialogue']);
        DB::table('learning_activities')->where('slug', 'read-the-first-signal')->update(['title' => 'Read the first pattern']);
        DB::table('learning_activities')->where('slug', 'review-source-distribution')->update(['title' => 'Review the pattern spread']);
        DB::table('learning_activities')
            ->whereIn('slug', ['clear-the-static-gate', 'clear-the-noisy-gate'])
            ->update([
                'slug' => 'clear-the-noisy-gate',
                'title' => 'Clear the noisy gate',
            ]);
        DB::table('learning_activity_starts')->where('label', 'Clear static gate')->update(['label' => 'Clear noisy gate']);

        $this->replaceJsonValue(
            'learning_activities',
            'config',
            'obstacleImageDark',
            '/images/obstacles/static-gate-dark.svg',
            '/images/obstacles/noisy-gate-dark.svg',
        );
        $this->replaceJsonValue(
            'learning_activities',
            'config',
            'obstacleImageLight',
            '/images/obstacles/static-gate-light.svg',
            '/images/obstacles/noisy-gate-light.svg',
        );

        DB::table('learning_tools')
            ->whereIn('slug', ['signal-lens', 'pattern-lens'])
            ->update([
                'slug' => 'pattern-lens',
                'title' => 'Pattern lens',
                'description' => 'A small lens for resolving noisy learning barriers.',
                'image_dark' => '/images/tools/pattern-lens-dark.svg',
                'image_light' => '/images/tools/pattern-lens-light.svg',
            ]);

        DB::table('learning_portal_links')
            ->whereIn('label', ['First Sector to Signal Archive', 'First Clearing to Quiet Library'])
            ->update([
                'label' => 'First Clearing to Quiet Library',
                'description' => 'Portal pair connecting the first map to a related learning space.',
            ]);
    }

    public function down(): void
    {
        //
    }

    /**
     * @param  array<string, string>  $nodeUpdates
     * @param  array<string, string>  $visualUpdates
     */
    private function updateNodeVisuals(string $slug, array $nodeUpdates, array $visualUpdates): void
    {
        $node = DB::table('learning_nodes')
            ->where('slug', $slug)
            ->first();

        if ($node === null) {
            return;
        }

        $visualConfig = json_decode((string) $node->visual_config, true);
        $visualConfig = is_array($visualConfig) ? $visualConfig : [];

        DB::table('learning_nodes')
            ->where('id', $node->id)
            ->update([
                ...$nodeUpdates,
                'visual_config' => json_encode([
                    ...$visualConfig,
                    ...$visualUpdates,
                ]),
            ]);
    }

    private function replaceJsonValue(
        string $table,
        string $column,
        string $key,
        string $oldValue,
        string $newValue,
    ): void {
        DB::table($table)
            ->get(['id', $column])
            ->each(function (object $record) use ($table, $column, $key, $oldValue, $newValue): void {
                $config = json_decode((string) $record->{$column}, true);

                if (! is_array($config) || ($config[$key] ?? null) !== $oldValue) {
                    return;
                }

                $config[$key] = $newValue;

                DB::table($table)
                    ->where('id', $record->id)
                    ->update([$column => json_encode($config)]);
            });
    }
};
