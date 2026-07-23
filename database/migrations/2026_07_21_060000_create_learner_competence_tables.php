<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('learner_competence_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('topic_slug');
            $table->string('topic_name');
            $table->decimal('total_points', 12, 2)->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'topic_slug']);
            $table->index(['user_id', 'total_points']);
        });

        Schema::create('learner_competence_topic_months', function (Blueprint $table) {
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

        Schema::create('learner_competence_activity_awards', function (Blueprint $table) {
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

        Schema::create('learner_competence_topic_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('from_topic_slug');
            $table->string('from_topic_name');
            $table->string('to_topic_slug');
            $table->string('to_topic_name');
            $table->unsignedInteger('transition_count')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'from_topic_slug', 'to_topic_slug'], 'competence_transitions_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_competence_topic_transitions');
        Schema::dropIfExists('learner_competence_activity_awards');
        Schema::dropIfExists('learner_competence_topic_months');
        Schema::dropIfExists('learner_competence_topics');
    }
};
