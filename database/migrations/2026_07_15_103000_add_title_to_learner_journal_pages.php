<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_journal_pages', function (Blueprint $table): void {
            $table->string('title', 240)->default('');
        });

        // Existing journals used the topic as their visible page name.
        DB::table('learner_journal_pages')->where('title', '')->update([
            'title' => DB::raw('topic'),
        ]);

        Schema::table('learner_journal_pages', function (Blueprint $table): void {
            $table->dropUnique(['user_id', 'topic', 'subtopic']);
        });
    }

    public function down(): void
    {
        Schema::table('learner_journal_pages', function (Blueprint $table): void {
            $table->unique(['user_id', 'topic', 'subtopic']);
            $table->dropColumn('title');
        });
    }
};
