<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learning_concepts', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 140)->unique();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        if (! Schema::hasTable('learning_activities')) {
            return;
        }

        $concepts = [];

        DB::table('learning_activities')
            ->select(['config'])
            ->whereNotNull('config')
            ->orderBy('id')
            ->each(function (object $activity) use (&$concepts): void {
                $config = is_string($activity->config)
                    ? json_decode($activity->config, true)
                    : $activity->config;
                $config = is_array($config) ? $config : [];

                foreach ((array) ($config['evidenceConcepts'] ?? []) as $name) {
                    $name = trim((string) $name);
                    $slug = trim((string) preg_replace('/[^a-z0-9]+/i', '-', strtolower($name)), '-');

                    if ($name === '' || $slug === '') {
                        continue;
                    }

                    $concepts[$slug] = mb_substr($name, 0, 120);
                }
            });

        foreach ($concepts as $slug => $name) {
            DB::table('learning_concepts')->insert([
                'created_at' => now(),
                'is_active' => true,
                'name' => $name,
                'slug' => mb_substr($slug, 0, 140),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_concepts');
    }
};
