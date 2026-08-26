<?php

namespace App\ContentApi;

class ContentPlanContract
{
    public const VERSION = '1.2';

    public const ACTIVITY_TYPES = ['markdown', 'reflection', 'message_prompt', 'shared_task'];

    /** @return array<string, mixed> */
    public function document(): array
    {
        return [
            'version' => self::VERSION,
            'purpose' => 'A reviewable draft for one MapAsset and a short linear learning route.',
            'humanApprovalRequired' => true,
            'supportedActivityTypes' => self::ACTIVITY_TYPES,
            'placementDefaults' => [
                'positionX' => 50,
                'positionY' => 50,
                'width' => 14,
            ],
            'schema' => $this->schema(),
        ];
    }

    /** @return array<string, mixed> */
    public function responseFormat(): array
    {
        return [
            'type' => 'json_schema',
            'name' => 'wicked_learning_content_plan',
            'description' => 'One reviewable MapAsset with a short linear route.',
            'strict' => true,
            'schema' => $this->schema(),
        ];
    }

    /** @return array<string, mixed> */
    public function schema(): array
    {
        return [
            'type' => 'object',
            'additionalProperties' => false,
            'required' => ['summary', 'mapAsset', 'activities'],
            'properties' => [
                'summary' => [
                    'type' => 'string',
                    'description' => 'A short rationale for the proposed learning route.',
                    'maxLength' => 1200,
                ],
                'mapAsset' => [
                    'type' => 'object',
                    'additionalProperties' => false,
                    'required' => ['title', 'description', 'label'],
                    'properties' => [
                        'title' => ['type' => 'string', 'maxLength' => 120],
                        'description' => ['type' => ['string', 'null'], 'maxLength' => 1000],
                        'label' => ['type' => ['string', 'null'], 'maxLength' => 80],
                    ],
                ],
                'activities' => [
                    'type' => 'array',
                    'minItems' => 1,
                    'maxItems' => 3,
                    'items' => [
                        'type' => 'object',
                        'additionalProperties' => false,
                        'required' => ['type', 'title', 'introduction', 'body', 'prompt', 'note', 'topic', 'inputLabel'],
                        'properties' => [
                            'type' => ['type' => 'string', 'enum' => self::ACTIVITY_TYPES],
                            'title' => ['type' => 'string', 'maxLength' => 120],
                            'introduction' => ['type' => ['string', 'null'], 'maxLength' => 1000],
                            'body' => [
                                'type' => ['string', 'null'],
                                'description' => 'Markdown body for markdown activities; null for interactive activities.',
                                'maxLength' => 12000,
                            ],
                            'prompt' => [
                                'type' => ['string', 'null'],
                                'description' => 'Learner prompt for reflections, message prompts and shared tasks; null for markdown activities.',
                                'maxLength' => 4000,
                            ],
                            'note' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional reflection guidance or shared-task instructions; null for markdown activities.',
                                'maxLength' => 2000,
                            ],
                            'topic' => [
                                'type' => ['string', 'null'],
                                'description' => 'Shared message topic for message prompts; null for other activity types, including shared tasks.',
                                'maxLength' => 120,
                            ],
                            'inputLabel' => [
                                'type' => ['string', 'null'],
                                'description' => 'Optional learner message or shared-task input label; null for other activity types.',
                                'maxLength' => 120,
                            ],
                        ],
                    ],
                ],
            ],
        ];
    }
}
