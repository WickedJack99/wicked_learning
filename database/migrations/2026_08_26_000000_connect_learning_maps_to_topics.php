<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->foreignId('learning_topic_id')
                ->nullable()
                ->after('learning_world_id')
                ->constrained('learning_topics')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('learning_maps', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('learning_topic_id');
        });
    }
};
