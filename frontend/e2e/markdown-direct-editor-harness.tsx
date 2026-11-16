import '@xyflow/react/dist/style.css';
import { createRoot } from 'react-dom/client';

import EditMarkdownActivity, {
    type LiftedMarkdownActivityPayload,
    type LiftedMarkdownTransport,
} from '../src/lifted-world-builder-edit-markdown-activity';
import '../src/styles.css';

const markdownActivity: LiftedMarkdownActivityPayload = {
    activity: {
        config: {
            markdownGraphLayout: {
                end: { x: 680, y: 110 },
                start: { x: -320, y: 110 },
            },
            markdownPages: [
                {
                    body: '# First page\n\nKeep the useful direction visible.',
                    id: 'page-1',
                    position: { x: 140, y: 80 },
                    title: 'First page',
                    visual: {
                        borderColorDark: '#2dd4bf',
                        borderColorLight: '#0891b2',
                        headingColorDark: '#67e8f9',
                        headingColorLight: '#0e7490',
                        pageColorDark: '#0f172a',
                        pageColorLight: '#ffffff',
                        textColorDark: '#f8fafc',
                        textColorLight: '#0f172a',
                    },
                },
            ],
            markdownTransitions: [
                { from: 'start', id: 'start-page-1', to: 'page-1' },
                { from: 'page-1', id: 'page-1-end', to: 'end' },
            ],
        },
        id: '00000000-0000-4000-8000-000000000701',
        introduction: 'Start with this activity.',
        portalLink: null,
        question: null,
        slug: 'source-markdown',
        title: 'Source markdown',
        type: 'markdown',
        updatedAt: '2026-11-16T12:00:00Z',
    },
    map: {
        id: '00000000-0000-4000-8000-000000000702',
        slug: 'archive',
        title: 'Archive',
    },
    node: {
        id: '00000000-0000-4000-8000-000000000703',
        slug: 'reading-room',
        title: 'Reading room',
    },
    world: {
        id: '00000000-0000-4000-8000-000000000704',
        slug: 'library',
        title: 'Library',
    },
};

const transport: LiftedMarkdownTransport = {
    patch: async (_url, _body, options) => {
        if (new URLSearchParams(window.location.search).has('failure')) {
            options?.onError?.({
                updated_at:
                    'The Markdown pages could not be saved. Refresh and try again.',
            });
            options?.onFinish?.();
            return;
        }

        options?.onSuccess?.({
            props: {
                markdownActivity: {
                    activity: { updatedAt: '2026-11-16T12:00:01Z' },
                },
            },
        });
        options?.onFinish?.();
    },
};

createRoot(document.getElementById('root')!).render(
    <EditMarkdownActivity
        markdownActivity={markdownActivity}
        onBack={() => undefined}
        transport={transport}
    />,
);
