<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('learner_competence_activity_awards');
        Schema::dropIfExists('learner_competence_topic_months');
        Schema::dropIfExists('learner_competence_topics');

        Schema::create('learner_evidence_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->uuid('play_run_id');
            $table->string('topic_slug');
            $table->string('topic_name');
            $table->string('evidence_type');
            $table->decimal('contribution', 12, 2);
            $table->string('outcome')->default('completed');
            $table->string('assistance_level')->default('untracked');
            $table->timestamps();

            $table->unique([
                'user_id',
                'learning_activity_id',
                'play_run_id',
                'topic_slug',
                'evidence_type',
            ], 'learner_evidence_events_unique');
            $table->index(['user_id', 'topic_slug', 'evidence_type']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_evidence_events');

        Schema::create('learner_competence_topics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('topic_slug');
            $table->string('topic_name');
            $table->decimal('total_points', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'topic_slug']);
            $table->index(['user_id', 'total_points']);
        });

        Schema::create('learner_competence_topic_months', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('topic_slug');
            $table->string('topic_name');
            $table->char('month_key', 7);
            $table->decimal('points', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'topic_slug', 'month_key']);
            $table->index(['user_id', 'month_key']);
        });

        Schema::create('learner_competence_activity_awards', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('learning_activity_id')->constrained()->cascadeOnDelete();
            $table->uuid('play_run_id');
            $table->string('topic_slug');
            $table->string('topic_name');
            $table->decimal('points', 12, 2);
            $table->timestamps();
            $table->unique(['user_id', 'learning_activity_id', 'play_run_id', 'topic_slug'], 'competence_awards_unique');
            $table->index(['user_id', 'play_run_id']);
        });
    }
};
