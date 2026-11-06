-- Fresh demonstration content for the complete source-derived Shared Task
-- slice. It is intentionally a new greenfield activity, not a migrated
-- Laravel record. Two accepted contributions are required so the local flow
-- can exercise its shared-progress and anonymous peer-review behavior.
INSERT INTO learning_activities (
    id, route_id, slug, title, description, position, published_at, activity_type, activity_config
)
VALUES (
    '00000000-0000-4000-8000-000000000048',
    '00000000-0000-4000-8000-000000000005',
    'build-orientation-clues',
    'Build orientation clues together',
    'Add one useful clue, then anonymously review a peer contribution.',
    5,
    NOW(),
    'shared_task',
    jsonb_build_object(
        'taskKind', 'reflection',
        'prompt', 'What clue would help a new learner make a confident first move on this map?',
        'instructions', 'Share one concrete, respectful observation. You may opt in to anonymous peer review.',
        'inputLabel', 'Your orientation clue',
        'projectGoal', 'Create a small collection of practical first-step clues.',
        'projectDeliverable', 'Two or more anonymous contributions that future learners can use.',
        'projectSteps', jsonb_build_array(
            'Notice one useful place, action or question.',
            'Write a concrete clue in your own words.',
            'Review one peer contribution if you chose to share yours.'
        ),
        'showContributions', true,
        'peerReviewEnabled', true,
        'peerReviewPrompt', 'What does this contribution help you notice, question, or extend?',
        'threshold', 2,
        'minimumLength', 20,
        'repeatPolicy', 'once_per_user',
        'validationMode', 'minimum_length'
    )
)
ON CONFLICT (route_id, slug) DO NOTHING;

INSERT INTO learning_activity_transitions (
    from_activity_id, to_activity_id, from_connector, to_connector, trigger, label
)
VALUES (
    '00000000-0000-4000-8000-000000000045',
    '00000000-0000-4000-8000-000000000048',
    'completed',
    'in',
    'completed',
    'Build orientation clues together'
)
ON CONFLICT (from_activity_id, from_connector, trigger, trigger_value) DO NOTHING;
