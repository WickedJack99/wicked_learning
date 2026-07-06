<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_portal_links', function (Blueprint $table): void {
            $table->foreignId('source_learning_activity_id')
                ->nullable()
                ->after('target_learning_node_id')
                ->constrained('learning_activities')
                ->nullOnDelete();
            $table->foreignId('target_learning_activity_id')
                ->nullable()
                ->after('source_learning_activity_id')
                ->constrained('learning_activities')
                ->nullOnDelete();

            $table->unique('source_learning_activity_id');
        });

        $this->backfillActivityReferences();
    }

    public function down(): void
    {
        Schema::table('learning_portal_links', function (Blueprint $table): void {
            $table->dropUnique(['source_learning_activity_id']);
            $table->dropConstrainedForeignId('source_learning_activity_id');
            $table->dropConstrainedForeignId('target_learning_activity_id');
        });
    }

    private function backfillActivityReferences(): void
    {
        DB::table('learning_portal_links')
            ->orderBy('id')
            ->each(function (object $link): void {
                $sourceActivityId = $this->firstPortalActivityId((int) $link->source_learning_node_id, 'output');
                $targetActivityId = $this->firstPortalActivityId((int) $link->target_learning_node_id, 'input');

                DB::table('learning_portal_links')
                    ->where('id', $link->id)
                    ->update([
                        'source_learning_activity_id' => $sourceActivityId,
                        'target_learning_activity_id' => $targetActivityId,
                    ]);
            });
    }

    private function firstPortalActivityId(int $nodeId, string $portalMode): ?int
    {
        $activity = DB::table('learning_activities')
            ->where('learning_node_id', $nodeId)
            ->where('type', 'portal')
            ->orderBy('sort_order')
            ->get(['id', 'config'])
            ->first(function (object $activity) use ($portalMode): bool {
                $config = json_decode((string) $activity->config, true);

                return is_array($config)
                    && ($config['portalMode'] ?? 'output') === $portalMode;
            });

        return $activity ? (int) $activity->id : null;
    }
};
