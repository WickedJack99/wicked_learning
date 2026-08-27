<?php

namespace App\Ai\Contracts;

use App\Learning\Services\ActivityCompetenceConfiguration;

class ActivityReviewContract
{
    public const VERSION = '1.2';

    /** @return array<string, mixed> */
    public function responseFormat(): array
    {
        return [
            'type' => 'json_schema',
            'name' => 'wicked_learning_activity_review',
            'description' => 'A structured, non-grading review of one learning activity.',
            'strict' => true,
            'schema' => $this->schema(),
        ];
    }

    /** @return array<string, mixed> */
    public function schema(): array
    {
        $dimension = [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['signal', 'note'],
            'properties' => [
                'signal' => [
                    'type' => 'string',
                    'enum' => ['supported', 'unclear', 'risk'],
                ],
                'note' => ['type' => 'string', 'maxLength' => 600],
            ],
        ];
        $alignmentDimension = [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['signal', 'note'],
            'properties' => [
                'signal' => [
                    'type' => 'string',
                    'enum' => ['aligned', 'unclear', 'mismatch'],
                ],
                'note' => ['type' => 'string', 'maxLength' => 600],
            ],
        ];

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['summary', 'strengths', 'suggestions', 'sdt', 'learningDesign', 'feedbackGuidance'],
            'properties' => [
                'summary' => ['type' => 'string', 'maxLength' => 1200],
                'strengths' => [
                    'type' => 'array',
                    'maxItems' => 4,
                    'items' => ['type' => 'string', 'maxLength' => 400],
                ],
                'suggestions' => [
                    'type' => 'array',
                    'maxItems' => 5,
                    'items' => ['type' => 'string', 'maxLength' => 500],
                ],
                'sdt' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['autonomy', 'competence', 'relatedness'],
                    'properties' => [
                        'autonomy' => $dimension,
                        'competence' => $dimension,
                        'relatedness' => $dimension,
                    ],
                ],
                'learningDesign' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['purpose', 'topics', 'suggestedLearningIntent', 'suggestedCompetenceTopics'],
                    'properties' => [
                        'purpose' => $alignmentDimension,
                        'topics' => $alignmentDimension,
                        'suggestedLearningIntent' => [
                            'type' => ['string', 'null'],
                            'description' => 'Optional replacement learning intent when the current purpose is unclear or mismatched.',
                            'enum' => [...ActivityCompetenceConfiguration::LEARNING_INTENTS, null],
                        ],
                        'suggestedCompetenceTopics' => [
                            'type' => 'array',
                            'description' => 'Optional replacement topic labels when the current topics are unclear or mismatched.',
                            'maxItems' => 3,
                            'items' => ['type' => 'string', 'maxLength' => 120],
                        ],
                    ],
                ],
                'feedbackGuidance' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['purpose', 'evidence', 'nextAction'],
                    'properties' => [
                        'purpose' => $dimension,
                        'evidence' => $dimension,
                        'nextAction' => $dimension,
                    ],
                ],
            ],
        ];
    }
}
