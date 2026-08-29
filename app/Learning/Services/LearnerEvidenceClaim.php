<?php

namespace App\Learning\Services;

use App\Models\LearnerEvidenceEvent;

/** Describes the modest learner-facing claim supported by an evidence event. */
class LearnerEvidenceClaim
{
    public function forEvent(LearnerEvidenceEvent $event): string
    {
        if (
            $event->evidence_type === 'retrieve'
            && $event->outcome === 'correct'
            && $event->assistance_level === 'independent'
        ) {
            return 'independent_recall';
        }

        return match ($event->evidence_type) {
            'apply' => 'application_attempt',
            'explain' => 'explanation_attempt',
            'participate' => 'participation',
            'reflect' => 'reflection',
            'retrieve' => 'retrieval_attempt',
            'review' => 'review',
            'transfer' => 'transfer_attempt',
            default => 'learning_encounter',
        };
    }
}
