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
        Schema::create('learning_dialogue_sound_sets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->json('tags')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('learning_dialogue_sounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('learning_dialogue_sound_set_id')
                ->constrained('learning_dialogue_sound_sets')
                ->cascadeOnDelete();
            $table->char('letter', 1);
            $table->text('url');
            $table->unsignedTinyInteger('volume')->default(70);
            $table->timestamps();
            $table->unique(['learning_dialogue_sound_set_id', 'letter']);
        });

        $setId = DB::table('learning_dialogue_sound_sets')->insertGetId([
            'name' => 'Curious double blip',
            'slug' => 'curious-double-blip',
            'tags' => json_encode(['dialogue', 'typing'], JSON_THROW_ON_ERROR),
            'is_default' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $now = now();
        $sounds = [];

        foreach (range('a', 'z') as $letter) {
            $sounds[] = [
                'learning_dialogue_sound_set_id' => $setId,
                'letter' => $letter,
                'url' => "/sounds/dialogue-typing/letter-keyed/curious-double-blip-keyed-{$letter}.wav",
                'volume' => 70,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('learning_dialogue_sounds')->insert($sounds);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('learning_dialogue_sounds');
        Schema::dropIfExists('learning_dialogue_sound_sets');
    }
};
