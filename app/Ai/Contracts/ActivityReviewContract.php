<?php

namespace App\Ai\Contracts;

class ActivityReviewContract
{
    public const VERSION = '1.0';

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

        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['summary', 'strengths', 'suggestions', 'sdt'],
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
            ],
        ];
    }
}
