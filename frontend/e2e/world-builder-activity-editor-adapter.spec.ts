import { expect, test } from '@playwright/test';

import type { components } from '../src/api/schema';
import { adaptRustActivityEditorDocument } from '../src/lifted-world-builder-activity-editor-adapter';
import { buildGraphEdges, buildGraphNodes } from '../src/lifted-world-builder-activity-graph-elements';
import { activityTemplateContext } from '../src/lifted-world-builder-activity-template-context';
import {
    isImageMediaReference,
    replaceTemplateMediaReferences,
} from '../src/lifted-world-builder-activity-template-media';

test('adapts a UUID selected-node document to the pinned-source activity editor shape', () => {
    const document = {
        activity_graph: {
            activities: [
                {
                    ai_review: null,
                    ai_review_history: [],
                    ai_review_status: 'needs_review',
                    ai_reviewed_at: null,
                    activity_type: 'question',
                    config: {
                        allowMultiple: true,
                        explanation: 'The explanation.',
                        feedbackCorrect: 'Correct.',
                        feedbackIncorrect: 'Try again.',
                        graphLayout: { end: { x: 88, y: 99 } },
                        options: [
                            {
                                body: 'One',
                                feedback: null,
                                isCorrect: true,
                                label: 'A',
                                outcomeKey: 'right',
                                weights: { recall: 0.5 },
                            },
                        ],
                        prompt: 'Which one?',
                    },
                    connectors: {
                        inputs: [{ id: 'in', label: 'Entry' }],
                        outputs: [{ id: 'correct', label: 'Correct' }],
                    },
                    id: '00000000-0000-4000-8000-000000000101',
                    introduction: 'Orient yourself.',
                    portal_link: {
                        description: null,
                        id: '00000000-0000-4000-8000-000000000102',
                        label: 'Travel',
                        target_activity: {
                            id: '00000000-0000-4000-8000-000000000103',
                            map_title: 'Destination map',
                            node_title: 'Destination node',
                            title: 'Arrival',
                        },
                        target_node: {
                            id: '00000000-0000-4000-8000-000000000104',
                            map_title: 'Destination map',
                            title: 'Destination node',
                        },
                    },
                    position: { x: 10, y: 20 },
                    question: {
                        allowMultiple: true,
                        explanation: 'The explanation.',
                        feedbackCorrect: 'Correct.',
                        feedbackIncorrect: 'Try again.',
                        options: [
                            {
                                body: 'One',
                                feedback: null,
                                isCorrect: true,
                                label: 'A',
                                outcomeKey: 'right',
                                weights: { recall: 0.5 },
                            },
                        ],
                        prompt: 'Which one?',
                    },
                    slug: 'question',
                    title: 'Question',
                    updated_at: '2026-11-15T10:00:00Z',
                },
            ],
            activity_types: [
                {
                    description: 'Answer a question.',
                    inputs: [{ id: 'in', label: 'Entry' }],
                    key: 'question',
                    label: 'Question',
                    outputs: [{ id: 'correct', label: 'Correct' }],
                    portal_modes: null,
                },
            ],
            ai_review_templates: [],
            can_manage_ai_review: false,
            competence_topic_options: ['Recall'],
            evidence_concept_options: ['Retrieval'],
            map: {
                id: '00000000-0000-4000-8000-000000000201',
                slug: 'map',
                title: 'Map',
            },
            message_topics: [],
            node: {
                description: 'A node.',
                graph_layout: { start: { x: 1, y: 2 } },
                id: '00000000-0000-4000-8000-000000000202',
                slug: 'node',
                start_activity_id: '00000000-0000-4000-8000-000000000101',
                start_routes: [
                    {
                        activity_id: '00000000-0000-4000-8000-000000000101',
                        button_border_color_dark: null,
                        button_border_color_light: null,
                        button_color_dark: null,
                        button_color_light: null,
                        description: null,
                        id: '00000000-0000-4000-8000-000000000203',
                        image_dark: null,
                        image_light: null,
                        label: 'Begin',
                        sort_order: 1,
                    },
                ],
                title: 'Node',
            },
            portal_candidates: [],
            source_records: {
                items: [
                    {
                        anchor: null,
                        concepts: ['Retrieval'],
                        excerpt: null,
                        id: '00000000-0000-4000-8000-000000000204',
                        published_at: null,
                        publisher: null,
                        rights: null,
                        title: 'Source',
                        url: 'https://example.test/source',
                    },
                ],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 4,
                    total: 1,
                },
            },
            transitions: [
                {
                    from_activity_id: '00000000-0000-4000-8000-000000000101',
                    from_connector: 'correct',
                    id: '00000000-0000-4000-8000-000000000205',
                    label: null,
                    to_activity_id: null,
                    to_connector: 'end',
                    trigger: 'outcome',
                    trigger_value: 'right',
                },
            ],
            world: {
                id: '00000000-0000-4000-8000-000000000206',
                slug: 'world',
                title: 'World',
            },
        },
        items: [],
        sounds: [],
        tools: [],
    } as unknown as components['schemas']['AdminEditableNode'];

    const worldGraph = {
        maps: [
            {
                id: '00000000-0000-4000-8000-000000000201',
                nodes: [
                    {
                        id: '00000000-0000-4000-8000-000000000202',
                        title: 'Node',
                    },
                ],
                title: 'Map',
            },
        ],
    } as unknown as components['schemas']['AdminWorldGraph'];

    const adapted = adaptRustActivityEditorDocument(document, worldGraph);

    expect(adapted.activityGraph.node.id).toBe(
        '00000000-0000-4000-8000-000000000202',
    );
    expect(adapted.activityGraph.node.startActivityId).toBe(
        '00000000-0000-4000-8000-000000000101',
    );
    expect(adapted.activityGraph.node.graphLayout).toEqual({
        start: { x: 1, y: 2 },
    });
    expect(adapted.activityGraph.activities[0]).toMatchObject({
        graphLayout: { end: { x: 88, y: 99 } },
        id: '00000000-0000-4000-8000-000000000101',
        portalLink: {
            targetActivity: {
                id: '00000000-0000-4000-8000-000000000103',
                mapTitle: 'Destination map',
            },
        },
        question: {
            allowMultiple: true,
            options: [{ outcomeKey: 'right', weights: { recall: 0.5 } }],
        },
    });
    expect(adapted.activityGraph.sourceRecords).toEqual([
        {
            anchor: '',
            concepts: ['Retrieval'],
            excerpt: '',
            id: '00000000-0000-4000-8000-000000000204',
            publishedAt: '',
            publisher: '',
            rights: '',
            title: 'Source',
            url: 'https://example.test/source',
        },
    ]);
    expect(adapted.activityGraph.transitions).toEqual([
        {
            fromActivityId: '00000000-0000-4000-8000-000000000101',
            fromConnector: 'correct',
            id: '00000000-0000-4000-8000-000000000205',
            label: null,
            toActivityId: null,
            toConnector: 'end',
            trigger: 'outcome',
            triggerValue: 'right',
        },
    ]);
    expect(adapted.worldGraph?.maps[0]?.nodes[0]?.id).toBe(
        '00000000-0000-4000-8000-000000000202',
    );

    const edges = buildGraphEdges(adapted.activityGraph);
    const nodes = buildGraphNodes(
        adapted.activityGraph,
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined,
        () => undefined,
    );

    expect(nodes.map((node) => node.id)).toEqual([
        'start',
        '00000000-0000-4000-8000-000000000101',
        'end',
    ]);
    expect(edges).toMatchObject([
        {
            data: {
                start: true,
                startRouteId: '00000000-0000-4000-8000-000000000203',
            },
            source: 'start',
            target: '00000000-0000-4000-8000-000000000101',
        },
        {
            data: {
                fromActivityId: '00000000-0000-4000-8000-000000000101',
                id: '00000000-0000-4000-8000-000000000205',
            },
            source: '00000000-0000-4000-8000-000000000101',
            target: 'end',
        },
    ]);
});

test('retains the source template context and recursive media replacement helpers', () => {
    expect(
        activityTemplateContext({
            message_topic_id: 'topic-uuid',
            target_portal_activity_id: '',
            type: 'message_prompt',
        }),
    ).toEqual({ references: ['message_topic'] });
    expect(
        activityTemplateContext({
            message_topic_id: '',
            target_portal_activity_id: 'activity-uuid',
            type: 'portal',
        }),
    ).toEqual({ references: ['portal_destination'] });
    expect(isImageMediaReference('/api/v1/admin/media-assets/a/content?size=1')).toBe(
        false,
    );
    expect(isImageMediaReference('scene.webp?version=2')).toBe(true);
    expect(
        replaceTemplateMediaReferences(
            {
                nested: [
                    'old-image.webp',
                    { retained: 'text', visual: 'old-image.webp' },
                ],
            },
            { 'old-image.webp': 'managed-image.webp' },
        ),
    ).toEqual({
        nested: [
            'managed-image.webp',
            { retained: 'text', visual: 'managed-image.webp' },
        ],
    });
});
