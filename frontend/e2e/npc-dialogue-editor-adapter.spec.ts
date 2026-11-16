import { expect, test } from '@playwright/test';

import type { components } from '../src/api/schema';
import { sourceNpcDialogueGraph } from '../src/lifted-world-builder-edit-npc-dialogue-adapter';

test('maps the complete Rust NPC dialogue graph into the pinned source page contract', () => {
    const graph = {
        activity: {
            graph_layout: { start: { x: -220, y: 40 } },
            id: '00000000-0000-4000-8000-000000000001',
            introduction: 'Meet the archivist.',
            slug: 'archivist-dialogue',
            title: 'Archivist dialogue',
        },
        dialogue_nodes: [
            {
                body: 'Welcome.',
                config: { npcImageLight: '/media/archivist.png' },
                connector: {
                    color: '#0ea5e9',
                    id: 'dialogue-end-00000000-0000-4000-8000-000000000010',
                    label: 'A',
                    symbol: 'A',
                },
                id: '00000000-0000-4000-8000-000000000010',
                node_type: 'end',
                position: { x: 120, y: 80 },
                title: 'End A',
            },
        ],
        map: {
            id: '00000000-0000-4000-8000-000000000002',
            slug: 'archive',
            title: 'Archive',
        },
        node: {
            id: '00000000-0000-4000-8000-000000000003',
            slug: 'reading-room',
            title: 'Reading room',
        },
        transitions: [
            {
                from_connector: 'out',
                from_node_id: null,
                id: '00000000-0000-4000-8000-000000000011',
                to_connector: 'in',
                to_node_id: '00000000-0000-4000-8000-000000000010',
            },
        ],
        typing_sound_sets: [],
        world: {
            id: '00000000-0000-4000-8000-000000000004',
            slug: 'library',
            title: 'Library',
        },
        world_nodes: [
            {
                id: '00000000-0000-4000-8000-000000000005',
                map_title: 'Archive',
                title: 'Stacks',
            },
        ],
    } as unknown as components['schemas']['AdminNpcDialogueGraph'];

    expect(sourceNpcDialogueGraph(graph)).toEqual({
        activity: {
            graphLayout: { start: { x: -220, y: 40 } },
            id: '00000000-0000-4000-8000-000000000001',
            introduction: 'Meet the archivist.',
            slug: 'archivist-dialogue',
            title: 'Archivist dialogue',
        },
        dialogueNodes: [
            {
                body: 'Welcome.',
                config: { npcImageLight: '/media/archivist.png' },
                connector: {
                    color: '#0ea5e9',
                    id: 'dialogue-end-00000000-0000-4000-8000-000000000010',
                    label: 'A',
                    symbol: 'A',
                },
                id: '00000000-0000-4000-8000-000000000010',
                position: { x: 120, y: 80 },
                title: 'End A',
                type: 'end',
            },
        ],
        map: graph.map,
        node: graph.node,
        transitions: [
            {
                fromConnector: 'out',
                fromNodeId: null,
                id: '00000000-0000-4000-8000-000000000011',
                toConnector: 'in',
                toNodeId: '00000000-0000-4000-8000-000000000010',
            },
        ],
        world: graph.world,
        worldNodes: [
            {
                id: '00000000-0000-4000-8000-000000000005',
                mapTitle: 'Archive',
                title: 'Stacks',
            },
        ],
    });
});
