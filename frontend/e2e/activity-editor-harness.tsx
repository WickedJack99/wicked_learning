import '@xyflow/react/dist/style.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { CurrentUserProvider } from '../src/current-user';
import EditNodeActivities from '../src/lifted-world-builder-edit-node-activities';
import type { ActivityGraphPayload } from '../src/lifted-world-builder-edit-node-activity-types';
import { OriginalPlatformTranslationProvider } from '../src/original-platform-translation';
import '../src/styles.css';

const fixtureSearch = new URLSearchParams(window.location.search);
const fixtureType = fixtureSearch.has('reflection')
    ? 'reflection'
    : fixtureSearch.has('review')
      ? 'review'
      : fixtureSearch.has('markdown')
        ? 'markdown'
        : fixtureSearch.has('portal')
          ? 'portal'
      : 'open_practice';
const reflectionLikeFixture =
    fixtureType === 'reflection' || fixtureType === 'review';

const activity = {
    aiReview: null,
    aiReviewedAt: null,
    aiReviewHistory: [],
    aiReviewStatus: 'reviewed',
    config: {
        graphLayout: { end: { x: 480, y: 0 } },
        ...(reflectionLikeFixture
            ? {
                  note: 'Take a quiet moment.',
                  prompt: 'How did that go?',
                  subtopic: 'Experiments',
                  topic: 'Learning',
              }
            : {}),
        ...(fixtureType === 'markdown'
            ? {
                  markdownGraphLayout: {},
                  markdownPages: [
                      {
                          body: '# First page\n\nWrite markdown content here. Use `![Alt text](/path/to/image.svg)` to insert images.',
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
    portalLink:
        fixtureType === 'portal'
            ? {
                  description: null,
                  id: '00000000-0000-4000-8000-000000000712',
                  label: null,
                  targetActivity: {
                      id: '00000000-0000-4000-8000-000000000713',
                      mapTitle: 'Map',
                      nodeTitle: 'Exit node',
                      title: 'Exit portal',
                  },
                  targetNode: {
                      id: '00000000-0000-4000-8000-000000000714',
                      mapTitle: 'Map',
                      title: 'Exit node',
                  },
              }
            : null,
    position: { x: 100, y: 80 },
    question: null,
    slug: 'first-activity',
    title:
        fixtureType === 'reflection'
            ? 'First reflection'
            : fixtureType === 'review'
              ? 'First review'
              : fixtureType === 'markdown'
                ? 'First markdown'
                : fixtureType === 'portal'
                  ? 'First portal'
              : 'First activity',
    type: fixtureType,
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
    portalCandidates:
        fixtureType === 'portal'
            ? [
                  {
                      id: '00000000-0000-4000-8000-000000000713',
                      mapId: '00000000-0000-4000-8000-000000000702',
                      mapTitle: 'Map',
                      nodeId: '00000000-0000-4000-8000-000000000714',
                      nodeTitle: 'Exit node',
                      title: 'Exit portal',
                  },
              ]
            : [],
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
