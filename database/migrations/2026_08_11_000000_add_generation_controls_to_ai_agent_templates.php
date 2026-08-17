<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_agent_templates', function (Blueprint $table): void {
            $table->decimal('temperature', 3, 2)->nullable()->default(null)->change();
            $table->string('reasoning_effort', 16)->nullable()->after('temperature');
        });

        DB::table('ai_agent_templates')
            ->whereRaw('LOWER(model) LIKE ?', ['gpt-5.6%'])
            ->whereIn(
                'ai_provider_credential_id',
                DB::table('ai_provider_credentials')
                    ->select('id')
                    ->where('provider', 'openai'),
            )
            ->update(['temperature' => null]);
    }

    public function down(): void
    {
        DB::table('ai_agent_templates')
            ->whereNull('temperature')
            ->update(['temperature' => 0.70]);

        Schema::table('ai_agent_templates', function (Blueprint $table): void {
            $table->dropColumn('reasoning_effort');
            $table->decimal('temperature', 3, 2)->default(0.70)->nullable(false)->change();
        });
    }
};
