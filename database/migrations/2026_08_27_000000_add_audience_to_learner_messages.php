<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_messages', function (Blueprint $table): void {
            $table->string('audience')->default('peers')->after('body');
            $table->index(['learning_message_topic_id', 'audience', 'hidden_at']);
        });
    }

    public function down(): void
    {
        Schema::table('learner_messages', function (Blueprint $table): void {
            $table->dropIndex(['learning_message_topic_id', 'audience', 'hidden_at']);
            $table->dropColumn('audience');
        });
    }
};
