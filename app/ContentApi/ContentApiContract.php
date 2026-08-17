<?php

namespace App\ContentApi;

use App\Learning\ActivityTypeRegistry;

class ContentApiContract
{
    public const VERSION = '1.1';

    public function __construct(
        private readonly ActivityTypeRegistry $activityTypes,
        private readonly ContentPlanContract $contentPlan,
    ) {}

    /** @return array<string, mixed> */
    public function document(): array
    {
        return [
            'name' => 'Wicked Learning Content API',
            'version' => self::VERSION,
            'basePath' => '/api/content/v1',
            'authentication' => [
                'type' => 'session',
                'description' => 'Requests currently use the signed-in administrator session. Mutating requests require the page CSRF token in the X-CSRF-TOKEN header.',
            ],
            'aiInstructions' => [
                'Use only operations listed in this contract.',
                'Treat returned IDs as opaque identifiers and reuse them exactly.',
                'Create or select a map before creating MapAssets, then create Activities through the returned MapAsset ID.',
                'Do not invent uploaded media paths. Reuse an existing path supplied by an administrator or leave image_url null.',
                'Show the planned request body to the administrator before sending a mutating request.',
                'Use the ContentPlan schema for AI-assisted drafts and never apply a generated draft without explicit administrator approval.',
                'If validation fails, repair only the fields named in the 422 response and ask before changing the instructional intent.',
            ],
            'activityTypes' => $this->activityTypes->definitions(),
            'contentPlan' => $this->contentPlan->document(),
            'operations' => $this->operations(),
            'errors' => [
                '401' => 'No authenticated administration session.',
                '403' => 'The current role or map scope does not allow this operation.',
                '404' => 'The requested content object does not exist.',
                '422' => 'The request body does not satisfy the documented contract.',
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function operations(): array
    {
        return [
            $this->operation(
                'contract.show',
                'GET',
                '/api/content/v1/contract',
                'Read the machine contract',
                'Returns this versioned document for API consoles and AI context.',
                null,
                ['data' => ['version' => self::VERSION, 'operations' => []]],
            ),
            $this->operation(
                'maps.index',
                'GET',
                '/api/content/v1/maps',
                'List editable maps',
                'Returns only maps within the administrator\'s editable scope.',
                null,
                ['data' => [['id' => 12, 'slug' => 'engine-bay', 'title' => 'Engine Bay']]],
            ),
            $this->operation(
                'maps.store',
                'POST',
                '/api/content/v1/maps',
                'Create a map',
                'Creates a new map in the current learning world.',
                [
                    'title' => 'Engine Bay',
                    'slug' => 'engine-bay',
                    'description' => 'An exploratory map of connected vehicle systems.',
                ],
                ['data' => ['id' => 12, 'slug' => 'engine-bay', 'title' => 'Engine Bay']],
            ),
            $this->operation(
                'map-assets.index',
                'GET',
                '/api/content/v1/maps/{map}/map-assets',
                'List MapAssets',
                'Returns MapAssets and their linked activity counts for one editable map.',
                null,
                ['data' => [['id' => 31, 'title' => 'Alternator', 'activityCount' => 2]]],
            ),
            $this->operation(
                'map-assets.store',
                'POST',
                '/api/content/v1/maps/{map}/map-assets',
                'Create a MapAsset',
                'Creates the learner-facing MapAsset and its internal content node as one authoring operation.',
                [
                    'title' => 'Alternator',
                    'description' => 'Converts mechanical energy into electrical energy.',
                    'image_url' => null,
                    'text' => 'Alternator',
                    'position_x' => 50,
                    'position_y' => 50,
                    'position_z' => 0,
                    'width' => 14,
                    'opacity' => 1,
                    'locked' => false,
                    'interaction_mode' => 'focusable',
                    'interaction_config' => null,
                    'visual_config' => null,
                    'sound_config' => null,
                ],
                ['data' => ['id' => 31, 'mapId' => 12, 'title' => 'Alternator', 'activityCount' => 0]],
            ),
            $this->operation(
                'activities.index',
                'GET',
                '/api/content/v1/map-assets/{mapAsset}/activities',
                'List MapAsset Activities',
                'Returns the Activities that form the routes of one MapAsset.',
                null,
                ['data' => [['id' => 44, 'type' => 'reflection', 'title' => 'Explain the energy conversion']]],
            ),
            $this->operation(
                'activities.store',
                'POST',
                '/api/content/v1/map-assets/{mapAsset}/activities',
                'Create a MapAsset Activity',
                'Creates an Activity with the same validated authoring fields used by the World Builder. Type-specific fields use snake_case.',
                [
                    'title' => 'Explain the energy conversion',
                    'slug' => 'explain-energy-conversion',
                    'type' => 'reflection',
                    'introduction' => 'Connect the visible parts to the flow of energy.',
                    'reflection_prompt' => 'How does energy change form inside this component?',
                    'reflection_note' => 'Name the input and output forms of energy.',
                    'reflection_topic' => 'Vehicle electrics',
                    'reflection_subtopic' => 'Alternator',
                    'graph_position_x' => 120,
                    'graph_position_y' => 80,
                ],
                ['data' => ['id' => 44, 'type' => 'reflection', 'title' => 'Explain the energy conversion']],
            ),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $requestExample
     * @param  array<string, mixed>  $responseExample
     * @return array<string, mixed>
     */
    private function operation(
        string $id,
        string $method,
        string $path,
        string $summary,
        string $description,
        ?array $requestExample,
        array $responseExample,
    ): array {
        return [
            'id' => $id,
            'method' => $method,
            'path' => $path,
            'summary' => $summary,
            'description' => $description,
            'requestExample' => $requestExample,
            'responseExample' => $responseExample,
        ];
    }
}
