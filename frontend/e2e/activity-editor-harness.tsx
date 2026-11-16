import '@xyflow/react/dist/style.css';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BrowserRouter } from 'react-router';

import { CurrentUserProvider } from '../src/current-user';
import EditNodeActivities from '../src/lifted-world-builder-edit-node-activities';
import type { ActivityGraphPayload } from '../src/lifted-world-builder-edit-node-activity-types';
import { OriginalPlatformTranslationProvider } from '../src/original-platform-translation';
import './activity-editor-harness.css';

const fixtureSearch = new URLSearchParams(window.location.search);
const multiStartFixture = fixtureSearch.has('multi-start');
const mutationHarness = fixtureSearch.has('source-mutations');
const fixtureType = fixtureSearch.has('reflection')
    ? 'reflection'
    : fixtureSearch.has('review')
      ? 'review'
      : fixtureSearch.has('markdown')
        ? 'markdown'
        : fixtureSearch.has('portal')
          ? 'portal'
          : fixtureSearch.has('question')
            ? 'question'
            : fixtureSearch.has('message-prompt')
              ? 'message_prompt'
              : fixtureSearch.has('message-wall')
                ? 'message_wall'
                : fixtureSearch.has('shared-task')
                  ? 'shared_task'
                  : fixtureSearch.has('item-grant')
                    ? 'item_grant'
                    : fixtureSearch.has('item-obstacle')
                      ? 'item_obstacle'
                      : fixtureSearch.has('obstacle')
                        ? 'obstacle'
                    : fixtureSearch.has('tool-grant')
                      ? 'tool_grant'
            : 'open_practice';
const reflectionLikeFixture =
    fixtureType === 'reflection' || fixtureType === 'review';
const messageFixture =
    fixtureType === 'message_prompt' || fixtureType === 'message_wall';

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
        ...(messageFixture
            ? {
                  messageAllowResponses: fixtureType === 'message_wall',
                  messageAudience:
                      fixtureType === 'message_prompt' ? 'support' : 'peers',
                  messageInputLabel: 'Share one useful detail',
                  messagePrompt: 'What should another learner notice?',
                  messageResponsePrompt:
                      'Reply with a helpful explanation or example.',
                  messageTopicId: '00000000-0000-4000-8000-000000000716',
                  messageUi: {
                      accentColorDark: '#4ade80',
                      accentColorLight: '#15803d',
                      cardBorderColorDark: '#22c55e',
                      cardBorderColorLight: '#166534',
                      cardColorDark: '#10261a',
                      cardColorLight: '#f0fdf4',
                      surfaceColorDark: '#07140d',
                      surfaceColorLight: '#dcfce7',
                      textColorDark: '#f0fdf4',
                      textColorLight: '#14532d',
                  },
              }
            : {}),
        ...(fixtureType === 'shared_task'
            ? {
                  cycleMode: 'question_response_question',
                  inputLabel: 'Your useful contribution',
                  instructions: 'Connect your contribution to the shared goal.',
                  minimumLength: 40,
                  peerReviewEnabled: true,
                  peerReviewPrompt:
                      'Offer one helpful explanation or example.',
                  projectDeliverable: 'A shared field guide',
                  projectGoal: 'Notice the details together.',
                  projectSteps: ['Look closely', 'Share a detail'],
                  prompt: 'What detail helps the next learner?',
                  repeatPolicy: 'unlimited',
                  showContributions: true,
                  taskKind: 'reflection',
                  threshold: 4,
                  validationMode: 'none',
              }
            : {}),
        ...(fixtureType === 'item_grant'
            ? {
                  backgroundDark: '/media/dark.png',
                  backgroundLight: '/media/light.png',
                  backgroundMirrored: true,
                  items: [
                      {
                          itemId: '00000000-0000-4000-8000-000000000719',
                          quantity: 3,
                      },
                  ],
                  probabilityPercent: 65.5,
              }
            : {}),
        ...(fixtureType === 'item_obstacle'
            ? {
                  backgroundDark: '/media/obstacle-dark.png',
                  backgroundLight: '/media/obstacle-light.png',
                  backgroundMirrored: true,
                  consumeOnEachEntry: true,
                  lockMinutes: 7,
                  metBackgroundDark: '/media/obstacle-met-dark.png',
                  metBackgroundLight: '/media/obstacle-met-light.png',
                  metBackgroundMirrored: true,
                  overlayDark: '/media/obstacle-overlay-dark.png',
                  overlayLight: '/media/obstacle-overlay-light.png',
                  overlayMirrored: true,
                  overlayWidth: 36,
                  overlayX: 42,
                  overlayY: 58,
                  slots: [
                      {
                          itemId: '00000000-0000-4000-8000-000000000719',
                          width: 18,
                          x: 42,
                          y: 58,
                      },
                  ],
                  sounds: {
                      met: {
                          enabled: true,
                          soundId: '00000000-0000-4000-8000-000000000720',
                      },
                      notMet: {
                          enabled: true,
                          soundId: '00000000-0000-4000-8000-000000000720',
                      },
                      transition: {
                          enabled: true,
                          soundId: '00000000-0000-4000-8000-000000000720',
                      },
                  },
              }
            : {}),
        ...(fixtureType === 'obstacle'
            ? {
                  allowedToolIds: [
                      '00000000-0000-4000-8000-000000000721',
                  ],
                  backgroundDark: '/media/base-obstacle-dark.png',
                  backgroundLight: '/media/base-obstacle-light.png',
                  backgroundMirrored: true,
                  bubbleBorderColorDark: '#4ade80',
                  bubbleBorderColorLight: '#15803d',
                  bubbleColorDark: '#10261a',
                  bubbleColorLight: '#f0fdf4',
                  bubbleOpacityDark: 88,
                  bubbleOpacityLight: 91,
                  obstacleImageDark: '/media/base-obstacle-image-dark.png',
                  obstacleImageLight: '/media/base-obstacle-image-light.png',
                  obstacleImageMirrored: true,
                  obstacleWidth: 34,
                  obstacleX: 42,
                  obstacleY: 58,
                  persistAfterSolved: false,
                  promptText: 'Use the lens to inspect this signal.',
                  revisitBackgroundDark: '/media/base-obstacle-revisit-dark.png',
                  revisitBackgroundLight: '/media/base-obstacle-revisit-light.png',
                  revisitBackgroundMirrored: true,
                  revisitImageDark: '/media/base-obstacle-revisit-image-dark.png',
                  revisitImageLight: '/media/base-obstacle-revisit-image-light.png',
                  revisitImageMirrored: true,
                  revisitText: 'The signal is ready to inspect again.',
                  successAnimation: 'shake',
                  successText: 'You found the useful detail.',
                  typingSpeed: 30,
              }
            : {}),
        ...(fixtureType === 'tool_grant'
            ? {
                  backgroundDark: '/media/tool-dark.png',
                  backgroundLight: '/media/tool-light.png',
                  backgroundMirrored: true,
                  bubbleBorderColorDark: '#4ade80',
                  bubbleBorderColorLight: '#15803d',
                  bubbleColorDark: '#10261a',
                  bubbleColorLight: '#f0fdf4',
                  bubbleOpacityDark: 88,
                  bubbleOpacityLight: 91,
                  fadeDurationSeconds: 0.8,
                  slideDirection: 'bottom',
                  slideDurationSeconds: 1.2,
                  text: 'Use this tool to notice the details.',
                  toolId: '00000000-0000-4000-8000-000000000721',
                  toolMirrored: true,
                  toolX: 42,
                  toolY: 58,
                  typingSpeed: 30,
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
    question:
        fixtureType === 'question'
            ? {
                  allowMultiple: true,
                  explanation: 'Notice why the first answer fits.',
                  feedbackCorrect: 'That is right.',
                  feedbackIncorrect: 'Try the other answer.',
                  options: [
                      {
                          body: 'The first answer',
                          feedback: 'It connects the route.',
                          isCorrect: true,
                          label: 'A',
                          outcomeKey: 'continue',
                          weights: { recall: 1 },
                      },
                      {
                          body: 'The second answer',
                          feedback: 'It opens a different route.',
                          isCorrect: false,
                          label: 'B',
                          outcomeKey: null,
                          weights: {},
                      },
                  ],
                  prompt: 'Which answer connects the route?',
              }
            : null,
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
                  : fixtureType === 'question'
                    ? 'First question'
                    : fixtureType === 'message_prompt'
                      ? 'First message prompt'
                      : fixtureType === 'message_wall'
                        ? 'First message wall'
                        : fixtureType === 'shared_task'
                          ? 'First shared task'
                          : fixtureType === 'item_grant'
                            ? 'First item grant'
                            : fixtureType === 'item_obstacle'
                              ? 'First item obstacle'
                              : fixtureType === 'obstacle'
                                ? 'First obstacle'
                            : fixtureType === 'tool_grant'
                              ? 'First tool grant'
                    : 'First activity',
    type: fixtureType,
    updatedAt: '2026-11-15T10:00:00Z',
};

const secondActivity = {
    ...activity,
    id: '00000000-0000-4000-8000-000000000722',
    position: { x: 420, y: 180 },
    slug: 'second-activity',
    title: 'Second activity',
};

const graph: ActivityGraphPayload = {
    activities: fixtureSearch.has('empty')
        ? []
        : multiStartFixture
          ? [activity, secondActivity]
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
    messageTopics: messageFixture
        ? [
              {
                  id: '00000000-0000-4000-8000-000000000716',
                  title: 'Useful details',
              },
          ]
        : [],
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
            ...(multiStartFixture
                ? [
                      {
                          activityId: secondActivity.id,
                          buttonBorderColorDark: null,
                          buttonBorderColorLight: null,
                          buttonColorDark: null,
                          buttonColorLight: null,
                          customLabel: null,
                          description: null,
                          id: '00000000-0000-4000-8000-000000000723',
                          imageDark: null,
                          imageLight: null,
                          label: 'Second',
                          sortOrder: 2,
                      },
                  ]
                : []),
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

const items = [
    {
        id: '00000000-0000-4000-8000-000000000719',
        imageDark: null,
        imageLight: null,
        slug: 'field-notebook',
        title: 'Field notebook',
    },
];

const tools = [
    {
        id: '00000000-0000-4000-8000-000000000721',
        imageDark: null,
        imageLight: null,
        slug: 'field-lens',
        title: 'Field lens',
    },
];

const sounds = [
    {
        id: '00000000-0000-4000-8000-000000000720',
        name: 'Field chime',
        slug: 'field-chime',
        url: '/media/field-chime.mp3',
    },
];

function ActivityEditorHarness(): React.JSX.Element {
    const [dedicatedActivityType, setDedicatedActivityType] = useState<
        string | null
    >(null);
    const [reloadCount, setReloadCount] = useState(0);

    return (
        <BrowserRouter>
            <OriginalPlatformTranslationProvider>
                <CurrentUserProvider>
                    <EditNodeActivities
                        activityGraph={graph}
                        items={items}
                        onOpenDedicatedActivity={(selectedActivity) =>
                            setDedicatedActivityType(selectedActivity.type)
                        }
                        {...(mutationHarness
                            ? {
                                  onReload: () =>
                                      setReloadCount((current) => current + 1),
                              }
                            : {})}
                        sounds={sounds}
                        tools={tools}
                        worldGraph={null}
                    />
                    {dedicatedActivityType ? (
                        <output data-testid="dedicated-activity-handoff">
                            {dedicatedActivityType}
                        </output>
                    ) : null}
                    {mutationHarness ? (
                        <output data-testid="source-mutation-reloads">
                            {reloadCount}
                        </output>
                    ) : null}
                </CurrentUserProvider>
            </OriginalPlatformTranslationProvider>
        </BrowserRouter>
    );
}

createRoot(document.getElementById('root')!).render(<ActivityEditorHarness />);
