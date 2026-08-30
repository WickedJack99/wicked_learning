<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_message_responses', function (Blueprint $table): void {
            $table->timestamp('helpful_at')->nullable()->after('response_type');
            $table->index(['learner_message_id', 'helpful_at']);
        });
    }

    public function down(): void
    {
        Schema::table('learner_message_responses', function (Blueprint $table): void {
            $table->dropIndex(['learner_message_id', 'helpful_at']);
            $table->dropColumn('helpful_at');
        });
    }
};
