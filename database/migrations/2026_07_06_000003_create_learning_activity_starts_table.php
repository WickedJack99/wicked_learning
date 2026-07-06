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
        Schema::create('learning_activity_starts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_node_id')->constrained('learning_nodes')->cascadeOnDelete();
            $table->foreignId('learning_activity_id')->constrained('learning_activities')->cascadeOnDelete();
            $table->string('label')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['learning_node_id', 'learning_activity_id']);
        });

        DB::table('learning_nodes')
            ->whereNotNull('start_activity_id')
            ->orderBy('id')
            ->each(function (object $node): void {
                DB::table('learning_activity_starts')->insert([
                    'learning_node_id' => $node->id,
                    'learning_activity_id' => $node->start_activity_id,
                    'label' => null,
                    'sort_order' => 10,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_activity_starts');
    }
};
