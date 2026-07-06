<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('learning_activity_starts', function (Blueprint $table) {
            $table->string('image_dark')->nullable()->after('label');
            $table->string('image_light')->nullable()->after('image_dark');
        });

        DB::table('learning_activity_starts')
            ->join('learning_nodes', 'learning_nodes.id', '=', 'learning_activity_starts.learning_node_id')
            ->where('learning_nodes.slug', 'signal-gate')
            ->update([
                'image_dark' => '/images/routes/signal-route-dark.svg',
                'image_light' => '/images/routes/signal-route-light.svg',
            ]);

        DB::table('learning_activity_starts')
            ->join('learning_nodes', 'learning_nodes.id', '=', 'learning_activity_starts.learning_node_id')
            ->where('learning_nodes.slug', 'portal-foundation')
            ->update([
                'image_dark' => '/images/routes/portal-route-dark.svg',
                'image_light' => '/images/routes/portal-route-light.svg',
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learning_activity_starts', function (Blueprint $table) {
            $table->dropColumn(['image_dark', 'image_light']);
        });
    }
};
