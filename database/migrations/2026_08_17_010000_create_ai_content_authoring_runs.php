<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_content_authoring_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('learning_map_id')->constrained('learning_maps')->cascadeOnDelete();
            $table->foreignId('ai_agent_template_id')->nullable()->constrained('ai_agent_templates')->nullOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('applied_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('learning_map_asset_id')->nullable()->constrained('learning_map_assets')->nullOnDelete();
            $table->string('contract_version', 40);
            $table->text('prompt');
            $table->json('context');
            $table->json('plan');
            $table->json('warnings')->nullable();
            $table->string('provider', 40);
            $table->string('model', 160);
            $table->string('provider_response_id', 255)->nullable();
            $table->string('provider_request_id', 255)->nullable();
            $table->unsignedInteger('input_tokens')->nullable();
            $table->unsignedInteger('output_tokens')->nullable();
            $table->unsignedInteger('total_tokens')->nullable();
            $table->string('status', 40)->default('draft');
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_content_authoring_runs');
    }
};
