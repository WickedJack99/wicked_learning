<?php

use App\Learning\Services\LearnerEvidenceClaim;
use App\Models\LearnerEvidenceEvent;

test('only correct independent retrieval supports an independent recall claim', function () {
    $claim = new LearnerEvidenceClaim;

    $independentRecall = new LearnerEvidenceEvent([
        'assistance_level' => 'independent',
        'evidence_type' => 'retrieve',
        'outcome' => 'correct',
    ]);
    $assistedRecall = new LearnerEvidenceEvent([
        'assistance_level' => 'hint',
        'evidence_type' => 'retrieve',
        'outcome' => 'correct',
    ]);
    $explanation = new LearnerEvidenceEvent([
        'assistance_level' => 'independent',
        'evidence_type' => 'explain',
        'outcome' => 'completed',
    ]);

    expect($claim->forEvent($independentRecall))->toBe('independent_recall')
        ->and($claim->forEvent($assistedRecall))->toBe('retrieval_attempt')
        ->and($claim->forEvent($explanation))->toBe('explanation_attempt');
});

test('example', function () {
    expect(true)->toBeTrue();
});
