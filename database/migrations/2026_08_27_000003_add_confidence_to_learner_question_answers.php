<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_question_answers', function (Blueprint $table) {
            $table->string('confidence')->nullable()->after('is_correct');
        });
    }

    public function down(): void
    {
        Schema::table('learner_question_answers', function (Blueprint $table) {
            $table->dropColumn('confidence');
        });
    }
};
