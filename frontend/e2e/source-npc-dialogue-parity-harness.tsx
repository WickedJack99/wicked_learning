import '@xyflow/react/dist/style.css';
import { App } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

import EditNpcDialogue from '../../resources/js/pages/settings/worlds/edit-npc-dialogue';
import './activity-editor-harness.css';

const props = {
    dialogueGraph: {
            activity: {
                graphLayout: {},
                id: 900,
                introduction: null,
                slug: 'archivist-dialogue',
                title: 'Archivist dialogue',
            },
            dialogueNodes: [
                {
                    body: 'Welcome to the archive.',
                    config: {},
                    connector: {
                        color: '#0ea5e9',
                        id: 'dialogue-end-102',
                        label: 'A End A',
                        symbol: 'A',
                    },
                    id: 102,
                    position: { x: 120, y: 0 },
                    title: 'Archivist greeting',
                    type: 'npc_monologue',
                },
                {
                    body: null,
                    config: {},
                    connector: null,
                    id: 103,
                    position: { x: 440, y: 0 },
                    title: 'End A',
                    type: 'end',
                },
            ],
            map: { id: 22, slug: 'archive', title: 'Archive' },
            node: { id: 23, slug: 'notice-the-map', title: 'Notice the map' },
            transitions: [],
            world: { id: 24, slug: 'library-world', title: 'Library world' },
            worldNodes: [],
    },
    dialogueSoundSets: [],
    tools: [],
};

createRoot(document.getElementById('root')!).render(
    <App
        initialComponent={EditNpcDialogue}
        initialPage={{
            component: 'settings/worlds/edit-npc-dialogue',
            props,
            url: '/settings/worlds/activities/900/npc-dialogue',
            version: null,
        }}
        resolveComponent={() => Promise.resolve(EditNpcDialogue)}
    />,
);
