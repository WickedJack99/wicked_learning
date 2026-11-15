import { expect, test } from '@playwright/test';

import type { components } from '../src/api/schema';
import {
    sourceItemObstacleRequest,
    sourcePortalRequest,
} from '../src/lifted-source-activity-command-mapper';
import { adaptRustActivityEditorDocument } from '../src/lifted-world-builder-activity-editor-adapter';
import { activityFormPayload } from '../src/lifted-world-builder-activity-form-payload';
import {
    activityFormFromActivity,
    emptyCreateForm,
} from '../src/lifted-world-builder-activity-form-state';
import { buildGraphEdges, buildGraphNodes } from '../src/lifted-world-builder-activity-graph-elements';
import {
    sourceActivityVersion,
    sourceActivityVersionDetails,
} from '../src/lifted-world-builder-activity-history-dialog';
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

test('maps the typed Rust history contract to the pinned source dialog shape', () => {
    const summary = sourceActivityVersion({
        activity_type: 'markdown',
        created_at: '2026-11-15T12:00:00.000000Z',
        id: '00000000-0000-4000-8000-000000000401',
        introduction: null,
        slug: 'history-entry',
        title: 'Earlier Markdown',
    });
    const details = sourceActivityVersionDetails({
        ...summary,
        activity_type: 'markdown',
        created_at: '2026-11-15T12:00:00.000000Z',
        id: '00000000-0000-4000-8000-000000000401',
        introduction: null,
        slug: 'history-entry',
        snapshot: {
            companionConfig: { welcome_message: 'Earlier context.' },
            config: { markdown: 'Earlier content.' },
            graphPositionX: null,
            graphPositionY: 42,
            transitions: [{ fromConnector: 'completed' }],
        },
        title: 'Earlier Markdown',
    });

    expect(summary).toEqual({
        createdAt: '2026-11-15T12:00:00.000000Z',
        id: '00000000-0000-4000-8000-000000000401',
        introduction: null,
        slug: 'history-entry',
        title: 'Earlier Markdown',
        type: 'markdown',
    });
    expect(details).toMatchObject({
        id: '00000000-0000-4000-8000-000000000401',
        snapshot: {
            companionConfig: { welcome_message: 'Earlier context.' },
            config: { markdown: 'Earlier content.' },
            graphPositionX: null,
            graphPositionY: 42,
            transitions: [{ fromConnector: 'completed' }],
        },
    });
});

test('retains source activity defaults, form hydration, and type-scoped payloads', () => {
    const portal = emptyCreateForm('portal');
    const portalPayload = activityFormPayload({
        ...portal,
        target_portal_activity_id: '00000000-0000-4000-8000-000000000301',
        title: 'Travel',
    });

    expect(portal).toMatchObject({
        portal_duration_seconds: '1.5',
        portal_mode: 'output',
        portal_show_on_arrival: true,
        portal_swirl_enabled: true,
    });
    expect(portalPayload).toMatchObject({
        target_portal_activity_id: '00000000-0000-4000-8000-000000000301',
        title: 'Travel',
    });
    expect(portalPayload).not.toHaveProperty('item_grant_items');

    const hydrated = activityFormFromActivity(
        {
            config: {
                allowMultiple: true,
                options: [
                    {
                        body: 'First option',
                        feedback: '',
                        isCorrect: true,
                        label: 'A',
                        outcomeKey: 'right',
                        weights: { recall: 1 },
                    },
                ],
                prompt: 'Which option?',
            },
            introduction: 'Think first.',
            portalLink: null,
            question: {
                allowMultiple: true,
                explanation: null,
                feedbackCorrect: null,
                feedbackIncorrect: null,
                options: [
                    {
                        body: 'First option',
                        feedback: null,
                        isCorrect: true,
                        label: 'A',
                        outcomeKey: 'right',
                        weights: { recall: 1 },
                    },
                ],
                prompt: 'Which option?',
            },
            slug: 'question',
            title: 'Question',
            type: 'question',
            updatedAt: '2026-11-15T10:00:00Z',
        },
        'open_practice',
    );

    expect(hydrated).toMatchObject({
        introduction: 'Think first.',
        question_allow_multiple: true,
        question_options: [
            {
                weights: { recall: 1 },
            },
        ],
        question_prompt: 'Which option?',
        type: 'question',
        updated_at: '2026-11-15T10:00:00Z',
    });
});

test('maps direct-source portal and item-obstacle forms to typed Rust UUID commands', () => {
    const portal = sourcePortalRequest({
        ...emptyCreateForm('portal'),
        portal_assets: [
            {
                id: 'scene-asset',
                imageDark: 'dark.webp',
                imageLight: 'light.webp',
                label: 'Foreground',
                layer: 'front',
                mirrored: true,
                opacity: '75',
                width: '42',
                x: '20',
                y: '60',
            },
        ],
        target_portal_activity_id: '00000000-0000-4000-8000-000000000501',
        title: 'Travel',
    });

    expect(portal).toMatchObject({
        portal_assets: [
            {
                image_dark: 'dark.webp',
                image_light: 'light.webp',
                layer: 'front',
                opacity: 75,
                width: 42,
                x: 20,
                y: 60,
            },
        ],
        target_portal_activity_id: '00000000-0000-4000-8000-000000000501',
    });

    const itemObstacle = sourceItemObstacleRequest({
        ...emptyCreateForm('item_obstacle'),
        item_obstacle_slots: [
            {
                itemId: '00000000-0000-4000-8000-000000000502',
                width: '30',
                x: '15',
                y: '70',
            },
        ],
        item_obstacle_sound_met_id: '00000000-0000-4000-8000-000000000503',
        item_obstacle_sound_met_enabled: true,
        title: 'Unlock',
    });

    expect(itemObstacle).toMatchObject({
        slots: [
            {
                item_id: '00000000-0000-4000-8000-000000000502',
                width: 30,
                x: 15,
                y: 70,
            },
        ],
        sound_met_enabled: true,
        sound_met_id: '00000000-0000-4000-8000-000000000503',
    });
});
