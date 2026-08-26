<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('registration_tokens', function (Blueprint $table): void {
            $table->string('note', 500)->nullable()->after('token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('registration_tokens', function (Blueprint $table): void {
            $table->dropColumn('note');
        });
    }
};
