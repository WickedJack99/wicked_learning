<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('learner_activity_progress', function (Blueprint $table): void {
            $table->string('revisit_status', 24)->default('none')->after('completed_at');
            $table->timestamp('revisit_available_at')->nullable()->after('revisit_status');
            $table->index(
                ['user_id', 'revisit_status', 'revisit_available_at'],
                'learner_progress_revisit_due_index',
            );
        });

        DB::table('learner_activity_progress')
            ->select(['id', 'metadata'])
            ->whereNotNull('metadata')
            ->orderBy('id')
            ->chunkById(500, function (Collection $progresses): void {
                foreach ($progresses as $progress) {
                    [$status, $availableAt] = $this->scheduleFrom($progress->metadata);

                    if ($status === 'none') {
                        continue;
                    }

                    DB::table('learner_activity_progress')
                        ->where('id', $progress->id)
                        ->update([
                            'revisit_status' => $status,
                            'revisit_available_at' => $availableAt?->toDateTimeString(),
                        ]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('learner_activity_progress', function (Blueprint $table): void {
            $table->dropIndex('learner_progress_revisit_due_index');
            $table->dropColumn(['revisit_status', 'revisit_available_at']);
        });
    }

    /**
     * @return array{0: string, 1: Carbon|null}
     */
    private function scheduleFrom(mixed $rawMetadata): array
    {
        $metadata = is_array($rawMetadata)
            ? $rawMetadata
            : json_decode((string) $rawMetadata, true);

        if (! is_array($metadata)) {
            return ['none', null];
        }

        $invitation = is_array($metadata['revisitInvitation'] ?? null)
            ? $metadata['revisitInvitation']
            : [];

        if (($invitation['status'] ?? null) === 'dismissed') {
            return ['dismissed', null];
        }

        $checkIns = is_array($metadata['learningCheckIns'] ?? null)
            ? $metadata['learningCheckIns']
            : [$metadata['learningCheckIn'] ?? null];

        foreach (array_reverse($checkIns) as $checkIn) {
            if (! is_array($checkIn) || ! is_string($checkIn['recordedAt'] ?? null)) {
                continue;
            }

            if (($checkIn['nextDirection'] ?? null) !== 'revisit') {
                return ['none', null];
            }

            $recordedAt = $this->dateFrom($checkIn['recordedAt']);

            if ($recordedAt === null) {
                return ['none', null];
            }

            if (($invitation['status'] ?? null) === 'snoozed') {
                return ['snoozed', $this->dateFrom($invitation['until'] ?? null)
                    ?? $recordedAt->copy()->addDays(3)];
            }

            return ['pending', $recordedAt->copy()->addDays(3)];
        }

        return ['none', null];
    }

    private function dateFrom(mixed $value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (Throwable) {
            return null;
        }
    }
};
