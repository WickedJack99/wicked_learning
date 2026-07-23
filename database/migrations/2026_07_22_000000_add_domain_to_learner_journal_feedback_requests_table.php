<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('learner_journal_feedback_requests', function (Blueprint $table): void {
            $table->string('domain_type', 32)->default('journal')->after('requester_id');
            $table->unsignedBigInteger('domain_id')->nullable()->after('domain_type');
            $table->string('domain_label')->default('Journal')->after('domain_id');
            $table->index(['domain_type', 'domain_id']);
        });
    }

    public function down(): void
    {
        Schema::table('learner_journal_feedback_requests', function (Blueprint $table): void {
            $table->dropIndex(['domain_type', 'domain_id']);
            $table->dropColumn(['domain_type', 'domain_id', 'domain_label']);
        });
    }
};
