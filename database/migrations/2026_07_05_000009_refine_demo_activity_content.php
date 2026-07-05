<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('learning_nodes')
            ->where('slug', 'field-notes')
            ->update(['description' => 'A quiet place for learner-owned notes and recall prompts.']);
        $this->updateNodeTooltip('field-notes', 'Personal notes without public scoring.');

        DB::table('learning_activities')
            ->where('slug', 'field-notes-preview')
            ->update([
                'slug' => 'write-a-field-note',
                'type' => 'reflection',
                'title' => 'Write a field note',
                'introduction' => 'Capture one observation in your own words.',
                'config' => json_encode([
                    'prompt' => 'What is one idea from this map that you want to remember or question later?',
                    'note' => 'Field notes are for orientation, not for ranking.',
                ], JSON_THROW_ON_ERROR),
            ]);

        DB::table('learning_nodes')
            ->where('slug', 'portal-foundation')
            ->update(['description' => 'A travel point that connects this map with another learning space.']);
        $this->updateNodeTooltip('portal-foundation', 'Use this path to move between connected maps.');

        DB::table('learning_activities')
            ->where('slug', 'portal-preview')
            ->update([
                'slug' => 'prepare-for-travel',
                'title' => 'Prepare for travel',
                'introduction' => 'This route links the current map with a related learning space.',
                'config' => json_encode([
                    'nextStep' => 'The connected map is visible in the world graph. Travel behavior can be configured as the portal system grows.',
                ], JSON_THROW_ON_ERROR),
            ]);

        DB::table('learning_maps')
            ->where('slug', 'signal-archive')
            ->update([
                'description' => 'A connected map for archived signal-reading practice.',
            ]);

        $this->updateNodeTooltip('return-gate', 'Return toward the first sector.');

        DB::table('learning_portal_links')
            ->where('label', 'First Sector to Signal Archive')
            ->update([
                'description' => 'Portal pair connecting the first map to the signal archive.',
            ]);

        $this->updateTransitionConnectors();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }

    private function updateTransitionConnectors(): void
    {
        $activityIds = DB::table('learning_activities')
            ->whereIn('slug', [
                'meet-mira',
                'read-the-first-signal',
                'review-source-distribution',
                'pattern-reflection',
            ])
            ->pluck('id', 'slug');

        $meetMira = $activityIds['meet-mira'] ?? null;
        $question = $activityIds['read-the-first-signal'] ?? null;
        $review = $activityIds['review-source-distribution'] ?? null;
        $reflection = $activityIds['pattern-reflection'] ?? null;

        if ($meetMira && $question) {
            DB::table('activity_transitions')
                ->where('from_activity_id', $meetMira)
                ->where('to_activity_id', $question)
                ->update(['from_connector' => 'completed', 'to_connector' => 'in']);
        }

        if ($question && $reflection) {
            DB::table('activity_transitions')
                ->where('from_activity_id', $question)
                ->where('to_activity_id', $reflection)
                ->update(['from_connector' => 'correct', 'to_connector' => 'in']);
        }

        if ($question && $review) {
            DB::table('activity_transitions')
                ->where('from_activity_id', $question)
                ->where('to_activity_id', $review)
                ->update(['from_connector' => 'incorrect', 'to_connector' => 'in']);
        }

        if ($review && $question) {
            DB::table('activity_transitions')
                ->where('from_activity_id', $review)
                ->where('to_activity_id', $question)
                ->update(['from_connector' => 'completed', 'to_connector' => 'in']);
        }
    }

    private function updateNodeTooltip(string $slug, string $tooltip): void
    {
        $node = DB::table('learning_nodes')
            ->where('slug', $slug)
            ->first(['id', 'visual_config']);

        if (! $node) {
            return;
        }

        $visualConfig = json_decode((string) $node->visual_config, true);
        $visualConfig = is_array($visualConfig) ? $visualConfig : [];
        $visualConfig['tooltip'] = $tooltip;

        DB::table('learning_nodes')
            ->where('id', $node->id)
            ->update([
                'visual_config' => json_encode($visualConfig, JSON_THROW_ON_ERROR),
            ]);
    }
};
