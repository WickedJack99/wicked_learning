<?php

use App\Models\Organization;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->string('governance_type', 24)
                ->default(Organization::GOVERNANCE_MONARCHY)
                ->after('icon_set_by_user_id');
            $table->timestamp('leadership_rotated_at')->nullable()->after('governance_type');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table): void {
            $table->dropColumn(['governance_type', 'leadership_rotated_at']);
        });
    }
};
