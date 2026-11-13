import { expect, installE2eAdminSession, test } from './authenticated';
import {
    collaborationStorageStatePath,
    hasCollaborationStorageState,
} from './session-state';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

type Session = {
    csrf: string;
    request: Parameters<typeof advanceToSharedTask>[0];
};

type SharedTaskState = {
    accepted_count: number;
    is_complete: boolean;
    peer_review: {
        has_reviewed: boolean;
        received_reviews: Array<{
            body: string;
            can_mark_helpful: boolean;
            id: string;
            response_type: string | null;
        }>;
        reviewable_contributions: Array<{ body: string; id: string }>;
        submitted_review: { body: string } | null;
    } | null;
    submission: {
        body: string;
        can_revise: boolean;
        id: string;
        revised_body: string | null;
    } | null;
};

async function sharedTaskState(
    session: Session,
    playRunId: string,
): Promise<SharedTaskState> {
    const playback = await session.request.get(
        `/api/v1/learner/play-runs/${playRunId}`,
    );
    expect(playback.status()).toBe(200);
    const document = (await playback.json()) as {
        activity: { shared_task: SharedTaskState | null };
    };
    const state = document.activity.shared_task;
    expect(state).toBeTruthy();
    if (!state) {
        throw new Error('the Shared Task playback did not include its state');
    }
    return state;
}

async function submitOrReuseContribution(
    session: Session,
    run: { base: string; playRunId: string },
    body: string,
    projectStepIndex: number,
): Promise<SharedTaskState> {
    const submitted = await session.request.post(
        `${run.base}/build-orientation-clues/shared-task/submissions`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
            data: {
                body,
                share_with_peers: true,
                project_step_index: projectStepIndex,
            },
        },
    );
    if (submitted.status() === 200) {
        return submitted.json() as Promise<SharedTaskState>;
    }

    // The authored activity admits one contribution per learner. Reusing the
    // two ignored local collaborators must retain that source rule rather than
    // creating accounts or deleting learner work for every browser run.
    expect(submitted.status()).toBe(404);
    const state = await sharedTaskState(session, run.playRunId);
    expect(state.submission).toBeTruthy();
    return state;
}

async function authenticatedSession(
    request: Parameters<typeof advanceToSharedTask>[0],
): Promise<Session> {
    const csrf = await request.get('/api/v1/security/csrf');
    expect(csrf.status()).toBe(200);
    const { token } = await csrf.json();
    return { csrf: token, request };
}

async function advanceToSharedTask(
    session: Session,
    marker: string,
): Promise<{ base: string; playRunId: string; nodeSlug: string }> {
    const world = await session.request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const start = (await world.json()).start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'find-your-place',
    );
    expect(start).toBeDefined();
    const reset = await session.request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/reset`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
        },
    );
    expect(reset.status()).toBe(200);
    const started = await session.request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/start`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
        },
    );
    expect(started.status()).toBe(200);
    const { play_run_id: playRunId } = await started.json();
    const base = `/api/v1/learner/play-runs/${playRunId}/activities`;

    for (const slug of ['find-your-place', 'name-a-landmark']) {
        const result = await session.request.post(`${base}/${slug}/complete`, {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
            data: {},
        });
        expect(result.status()).toBe(200);
    }
    const support = await session.request.post(
        `${base}/ask-learning-support/support-request`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
            data: { body: `Please help me orient myself (${marker}).` },
        },
    );
    expect(support.status()).toBe(200);
    for (const slug of ['ask-learning-support', 'share-orientation-note']) {
        const result = await session.request.post(`${base}/${slug}/complete`, {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
            data: {},
        });
        expect(result.status()).toBe(200);
    }
    const wall = await session.request.post(
        `${base}/explore-peer-wall/complete`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': session.csrf },
            data: {},
        },
    );
    expect(wall.status()).toBe(200);
    const playback = await session.request.get(
        `/api/v1/learner/play-runs/${playRunId}`,
    );
    expect(playback.status()).toBe(200);
    await expect(playback.json()).resolves.toMatchObject({
        activity: {
            activity_type: 'shared_task',
            slug: 'build-orientation-clues',
        },
    });
    return { base, nodeSlug: start.node_slug, playRunId };
}

test('the source-shaped Shared Task preserves anonymous contributions, review and private checklist state', async ({
    page,
    playwright,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL ||
            !process.env.E2E_LOGIN_PASSWORD ||
            !hasCollaborationStorageState(),
        'requires the disposable local administrator and global collaboration sessions',
    );

    const marker = String(Date.now());
    const firstRequest = await playwright.request.newContext({
        baseURL: publicOrigin,
        storageState: collaborationStorageStatePath('first'),
    });
    const secondRequest = await playwright.request.newContext({
        baseURL: publicOrigin,
        storageState: collaborationStorageStatePath('second'),
    });
    try {
        await installE2eAdminSession(page.context());
        const first = await authenticatedSession(firstRequest);
        const second = await authenticatedSession(secondRequest);
        const firstRun = await advanceToSharedTask(first, `first-${marker}`);
        const secondRun = await advanceToSharedTask(second, `second-${marker}`);
        const firstContribution = `A concrete first-map clue from the first learner (${marker}).`;
        const secondContribution = `A different concrete first-map clue from the second learner (${marker}).`;

        const firstState = await submitOrReuseContribution(
            first,
            firstRun,
            firstContribution,
            0,
        );
        expect(firstState).toMatchObject({
            accepted_count: expect.any(Number),
            submission: { body: expect.any(String) },
        });
        expect(JSON.stringify(firstState)).not.toContain('shared-task-');

        const secondState = await submitOrReuseContribution(
            second,
            secondRun,
            secondContribution,
            1,
        );
        expect(secondState).toMatchObject({ is_complete: true });
        expect(secondState.accepted_count).toBeGreaterThanOrEqual(2);

        const firstSubmission = firstState.submission;
        const secondSubmission = secondState.submission;
        expect(firstSubmission).toBeTruthy();
        expect(secondSubmission).toBeTruthy();
        if (!firstSubmission || !secondSubmission) {
            throw new Error(
                'each collaborator must have one private submission',
            );
        }

        const refreshedFirstState = await sharedTaskState(
            first,
            firstRun.playRunId,
        );
        const reviewTarget =
            refreshedFirstState.peer_review?.reviewable_contributions.find(
                (candidate) => candidate.id === secondSubmission.id,
            );
        expect(reviewTarget).toBeDefined();
        if (!reviewTarget) {
            throw new Error(
                'the first learner cannot review the second learner',
            );
        }
        let reviewedFirstState = refreshedFirstState;
        if (!refreshedFirstState.peer_review?.has_reviewed) {
            const review = await first.request.post(
                `${firstRun.base}/build-orientation-clues/shared-task/reviews`,
                {
                    headers: {
                        Origin: publicOrigin,
                        'X-CSRF-Token': first.csrf,
                    },
                    data: {
                        body: 'This makes the next first move clearer and easier to test.',
                        submission_id: reviewTarget.id,
                        response_type: 'example',
                        project_step_index: 1,
                    },
                },
            );
            expect(review.status()).toBe(200);
            reviewedFirstState = await review.json();
        }
        const reviewText =
            reviewedFirstState.peer_review?.submitted_review?.body;
        expect(reviewText).toBeTruthy();

        let refreshedSecondState = await sharedTaskState(
            second,
            secondRun.playRunId,
        );
        const receivedReview =
            refreshedSecondState.peer_review?.received_reviews.find(
                (candidate) => candidate.body === reviewText,
            );
        expect(receivedReview).toMatchObject({
            can_mark_helpful: true,
            response_type: 'example',
        });
        expect(JSON.stringify(receivedReview)).not.toContain('shared-task-');
        if (!receivedReview) {
            throw new Error(
                'the second learner did not receive the anonymous review',
            );
        }
        const helpful = await second.request.patch(
            `${secondRun.base}/build-orientation-clues/shared-task/reviews/${receivedReview.id}/helpfulness`,
            {
                headers: { Origin: publicOrigin, 'X-CSRF-Token': second.csrf },
                data: { helpful: true },
            },
        );
        expect(helpful.status()).toBe(200);
        const followUp = await second.request.patch(
            `${secondRun.base}/build-orientation-clues/shared-task/reviews/${receivedReview.id}/follow-up`,
            {
                headers: { Origin: publicOrigin, 'X-CSRF-Token': second.csrf },
                data: { body: 'I will use that example in my next clue.' },
            },
        );
        expect(followUp.status()).toBe(200);
        refreshedSecondState = await sharedTaskState(
            second,
            secondRun.playRunId,
        );
        const latestSecondSubmission = refreshedSecondState.submission;
        expect(latestSecondSubmission).toBeTruthy();
        if (!latestSecondSubmission) {
            throw new Error('the second learner lost their private submission');
        }
        if (latestSecondSubmission.can_revise) {
            const revision = await second.request.patch(
                `${secondRun.base}/build-orientation-clues/shared-task/submissions/${latestSecondSubmission.id}/revision`,
                {
                    headers: {
                        Origin: publicOrigin,
                        'X-CSRF-Token': second.csrf,
                    },
                    data: {
                        body: `${secondContribution} I will now make it more specific.`,
                    },
                },
            );
            expect(revision.status()).toBe(200);
        } else {
            expect(latestSecondSubmission.revised_body).toBeTruthy();
        }
        const checklist = await second.request.post(
            `${secondRun.base}/build-orientation-clues/shared-task/checklist`,
            {
                headers: { Origin: publicOrigin, 'X-CSRF-Token': second.csrf },
                data: { completed_step_indexes: [0, 2] },
            },
        );
        expect(checklist.status()).toBe(200);
        await expect(checklist.json()).resolves.toEqual({
            completed_step_indexes: [0, 2],
        });

        const storageState = await first.request.storageState();
        await page.context().addCookies(storageState.cookies);
        await page.goto(
            `/learning/nodes/${firstRun.nodeSlug}/play?run=${firstRun.playRunId}`,
        );
        await expect(
            page.getByText('Build orientation clues together'),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Peer review' }).click();
        await expect(page.getByText('Your peer review')).toBeVisible();
        await expect(page.getByText(reviewText!)).toBeVisible();
    } finally {
        await firstRequest.dispose();
        await secondRequest.dispose();
    }
});
