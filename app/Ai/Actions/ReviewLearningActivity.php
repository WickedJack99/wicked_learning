<?php

namespace App\Ai\Actions;

use App\Ai\Contracts\ActivityReviewContract;
use App\Learning\Services\ActivityCompetenceConfiguration;
use App\Learning\Services\ActivityReviewContext;
use App\Models\AiAgentTemplate;
use App\Models\LearningActivity;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ReviewLearningActivity
{
    public function __construct(
        private readonly RunAiAgentTemplate $runner,
        private readonly ActivityReviewContract $contract,
        private readonly ActivityReviewContext $context,
    ) {}

    public function handle(
        LearningActivity $activity,
        AiAgentTemplate $template,
        User $user,
    ): LearningActivity {
        $reviewContext = $this->context->for($activity);
        $result = $this->runner->handle(
            $template,
            $this->prompt($reviewContext),
            $this->contract->responseFormat(),
        );
        $review = json_decode($result['text'], true);

        if (! is_array($review)) {
            $this->fail('The AI returned a response that was not a valid activity review.');
        }

        $review = Validator::make($review, [
            'summary' => ['required', 'string', 'max:1200'],
            'strengths' => ['required', 'array', 'max:4'],
            'strengths.*' => ['required', 'string', 'max:400'],
            'suggestions' => ['required', 'array', 'max:5'],
            'suggestions.*' => ['required', 'string', 'max:500'],
            'sdt' => ['required', 'array'],
            'sdt.autonomy' => ['required', 'array'],
            'sdt.autonomy.signal' => ['required', 'in:supported,unclear,risk'],
            'sdt.autonomy.note' => ['required', 'string', 'max:600'],
            'sdt.competence' => ['required', 'array'],
            'sdt.competence.signal' => ['required', 'in:supported,unclear,risk'],
            'sdt.competence.note' => ['required', 'string', 'max:600'],
            'sdt.relatedness' => ['required', 'array'],
            'sdt.relatedness.signal' => ['required', 'in:supported,unclear,risk'],
            'sdt.relatedness.note' => ['required', 'string', 'max:600'],
            'learningDesign' => ['required', 'array'],
            'learningDesign.purpose' => ['required', 'array'],
            'learningDesign.purpose.signal' => ['required', 'in:aligned,unclear,mismatch'],
            'learningDesign.purpose.note' => ['required', 'string', 'max:600'],
            'learningDesign.topics' => ['required', 'array'],
            'learningDesign.topics.signal' => ['required', 'in:aligned,unclear,mismatch'],
            'learningDesign.topics.note' => ['required', 'string', 'max:600'],
            'learningDesign.suggestedLearningIntent' => ['present', 'nullable', 'string', Rule::in(ActivityCompetenceConfiguration::LEARNING_INTENTS)],
            'learningDesign.suggestedCompetenceTopics' => ['required', 'array', 'max:3'],
            'learningDesign.suggestedCompetenceTopics.*' => ['required', 'string', 'max:120'],
        ])->validate();

        $activity->forceFill([
            'ai_review_status' => LearningActivity::AI_REVIEW_STATUS_REVIEWED,
            'ai_reviewed_at' => now(),
            'ai_review' => [
                'contractVersion' => ActivityReviewContract::VERSION,
                'review' => $review,
                'provider' => $result['provider'],
                'model' => $result['model'],
                'reviewedByUserId' => $user->id,
                'usage' => $result['usage'],
            ],
        ])->save();

        return $activity->refresh();
    }

    /** @param array<string, mixed> $context */
    private function prompt(array $context): string
    {
        return implode("\n\n", [
            'Review exactly one Wicked Learning activity for learning usefulness and a supportive learning environment.',
            'This is an authoring aid, not a learner grade and not a claim about learner performance.',
            'Compare the declared learning purpose and competence topics with the actual activity content. Flag alignment as unclear or mismatch when the metadata asks for something the activity does not visibly provide. Also inspect autonomy, competence and relatedness support.',
            'Mention strengths before suggestions. Suggestions must be concrete, optional adjustments for the tutor. If either learning-design alignment signal is unclear or mismatch, provide a concise replacement learning intent and/or topic list; otherwise use null and an empty list. Reuse an available competence topic label exactly when one fits; only suggest a new concise label when none fits. Do not output weights or thresholds. Do not rewrite or apply the activity.',
            'Use only the scoped activity context below. Do not infer learner data or invent missing content.',
            'Activity review context:\n'.json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'ActivityReview contract:\n'.json_encode($this->contract->schema(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);
    }

    private function fail(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['review' => [$message]],
        ], 422));
    }
}
