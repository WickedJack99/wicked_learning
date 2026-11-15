import '@xyflow/react/dist/style.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { CurrentUserProvider } from '../src/current-user';
import EditNodeActivities from '../src/lifted-world-builder-edit-node-activities';
import type { ActivityGraphPayload } from '../src/lifted-world-builder-edit-node-activity-types';
import { OriginalPlatformTranslationProvider } from '../src/original-platform-translation';
import '../src/styles.css';

const reflectionFixture = new URLSearchParams(window.location.search).has(
    'reflection',
);

const activity = {
    aiReview: null,
    aiReviewedAt: null,
    aiReviewHistory: [],
    aiReviewStatus: 'reviewed',
    config: {
        graphLayout: { end: { x: 480, y: 0 } },
        ...(reflectionFixture
            ? {
                  note: 'Take a quiet moment.',
                  prompt: 'How did that go?',
                  subtopic: 'Experiments',
                  topic: 'Learning',
              }
            : {}),
    },
    connectors: {
        inputs: [{ id: 'in', label: 'Entry' }],
        outputs: [{ id: 'completed', label: 'Completed' }],
    },
    graphLayout: { end: { x: 480, y: 0 } },
    id: '00000000-0000-4000-8000-000000000701',
    introduction: 'Start with this activity.',
    portalLink: null,
    position: { x: 100, y: 80 },
    question: null,
    slug: 'first-activity',
    title: reflectionFixture ? 'First reflection' : 'First activity',
    type: reflectionFixture ? 'reflection' : 'open_practice',
    updatedAt: '2026-11-15T10:00:00Z',
};

const graph: ActivityGraphPayload = {
    activities: new URLSearchParams(window.location.search).has('empty')
        ? []
        : [activity],
    activityTypes: [
        {
            description: 'Practice a next step.',
            key: 'open_practice',
            label: 'Open practice',
        },
        {
            description: 'Reflect on progress.',
            key: 'reflection',
            label: 'Reflection',
        },
        {
            description: 'Revisit an earlier route.',
            key: 'review',
            label: 'Review',
        },
        {
            description: 'Write a linked page sequence.',
            key: 'markdown',
            label: 'Markdown',
        },
        {
            description: 'Travel between map locations.',
            key: 'portal',
            label: 'Portal',
            portalModes: [
                { key: 'input', label: 'Arrival' },
                { key: 'output', label: 'Departure' },
            ],
        },
        {
            description: 'Ask a retrieval question.',
            key: 'question',
            label: 'Question',
        },
        {
            description: 'Prompt one learner response.',
            key: 'message_prompt',
            label: 'Message prompt',
        },
        {
            description: 'Host learner responses together.',
            key: 'message_wall',
            label: 'Message wall',
        },
        {
            description: 'Collect a shared contribution.',
            key: 'shared_task',
            label: 'Shared task',
        },
        {
            description: 'Give the learner an item.',
            key: 'item_grant',
            label: 'Item grant',
        },
        {
            description: 'Require items to proceed.',
            key: 'item_obstacle',
            label: 'Item obstacle',
        },
        {
            description: 'Require a tool to proceed.',
            key: 'obstacle',
            label: 'Obstacle',
        },
        {
            description: 'Give the learner a tool.',
            key: 'tool_grant',
            label: 'Tool grant',
        },
    ],
    aiReviewTemplates: [],
    canManageAiReview: false,
    competenceTopicOptions: [],
    evidenceConceptOptions: [],
    map: {
        id: '00000000-0000-4000-8000-000000000702',
        slug: 'map',
        title: 'Map',
    },
    messageTopics: [],
    node: {
        description: 'A selected node.',
        graphLayout: { start: { x: -180, y: 0 } },
        id: '00000000-0000-4000-8000-000000000703',
        slug: 'node',
        startActivityId: activity.id,
        startRoutes: [
            {
                activityId: activity.id,
                buttonBorderColorDark: null,
                buttonBorderColorLight: null,
                buttonColorDark: null,
                buttonColorLight: null,
                customLabel: null,
                description: null,
                id: '00000000-0000-4000-8000-000000000704',
                imageDark: null,
                imageLight: null,
                label: 'Begin',
                sortOrder: 1,
            },
        ],
        title: 'Node',
    },
    portalCandidates: [],
    sourceRecords: [],
    sourceRecordsPagination: {
        currentPage: 1,
        lastPage: 1,
        perPage: 12,
        total: 0,
    },
    transitions: [
        {
            fromActivityId: activity.id,
            fromConnector: 'completed',
            id: '00000000-0000-4000-8000-000000000705',
            label: null,
            toActivityId: null,
            toConnector: 'end',
            trigger: 'completed',
            triggerValue: null,
        },
    ],
    world: {
        id: '00000000-0000-4000-8000-000000000706',
        slug: 'world',
        title: 'World',
    },
};

createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <OriginalPlatformTranslationProvider>
            <CurrentUserProvider>
                <EditNodeActivities
                    activityGraph={graph}
                    items={[]}
                    sounds={[]}
                    tools={[]}
                    worldGraph={null}
                />
            </CurrentUserProvider>
        </OriginalPlatformTranslationProvider>
    </BrowserRouter>,
);
