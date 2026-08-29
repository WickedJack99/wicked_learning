<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reusable_media_metadata', function (Blueprint $table): void {
            $table->string('display_name', 160)->nullable()->after('url');
        });
    }

    public function down(): void
    {
        Schema::table('reusable_media_metadata', function (Blueprint $table): void {
            $table->dropColumn('display_name');
        });
    }
};
