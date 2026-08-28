<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('dialogue_stages');
    }

    public function down(): void
    {
        Schema::create('dialogue_stages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->string('stage_key');
            $table->string('speaker_name');
            $table->string('speaker_role')->nullable();
            $table->text('body');
            $table->string('portrait_url')->nullable();
            $table->string('image_alt')->nullable();
            $table->string('mood')->nullable();
            $table->json('visual_config')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['learning_activity_id', 'stage_key']);
        });
    }
};
