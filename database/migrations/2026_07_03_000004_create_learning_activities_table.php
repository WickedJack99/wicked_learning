<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('learning_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_node_id')->constrained()->cascadeOnDelete();
            $table->string('slug');
            $table->string('type');
            $table->string('title');
            $table->text('introduction')->nullable();
            $table->json('config')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['learning_node_id', 'slug']);
        });

        Schema::table('learning_nodes', function (Blueprint $table) {
            $table->foreign('start_activity_id')
                ->references('id')
                ->on('learning_activities')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learning_nodes', function (Blueprint $table) {
            $table->dropForeign(['start_activity_id']);
        });

        Schema::dropIfExists('learning_activities');
    }
};
