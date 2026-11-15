import { apiClient, getCsrfToken } from './api/client';

/**
 * Direct source type and request lift from
 * `features/ai/activity-review-client.ts`.
 *
 * The only changes are the Rust UUID identifiers and the typed API/CSRF
 * transport replacing Laravel's numeric IDs and `fetch` helper.
 */
export type ActivityReview = {
    contractVersion: string;
    model: string;
    provider: string;
    reviewedByPrincipalId: string;
    review: {
        learningDesign?: {
            purpose: ActivityReviewAlignment;
            suggestedCompetenceTopics: string[];
            suggestedLearningIntent: string | null;
            topics: ActivityReviewAlignment;
        };
        feedbackGuidance?: {
            evidence: ActivityReviewDimension;
            nextAction: ActivityReviewDimension;
            purpose: ActivityReviewDimension;
        };
        sdt: {
            autonomy: ActivityReviewDimension;
            competence: ActivityReviewDimension;
            relatedness: ActivityReviewDimension;
        };
        strengths: string[];
        suggestions: string[];
        summary: string;
    };
    usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
    };
};

export type ActivityReviewDimension = {
    note: string;
    signal: 'supported' | 'unclear' | 'risk';
};

export type ActivityReviewAlignment = {
    note: string;
    signal: 'aligned' | 'unclear' | 'mismatch';
};

export type ActivityReviewMetadataSuggestions = {
    suggestedCompetenceTopics: string[];
    suggestedLearningIntent: string | null;
};

export type ActivityReviewResult = {
    activityId: string;
    aiReview: ActivityReview;
    aiReviewedAt: string;
    aiReviewStatus: 'reviewed';
};

export async function reviewActivity(
    activityId: string,
    templateId: string,
): Promise<ActivityReviewResult> {
    const csrfToken = await getCsrfToken();
    const { data, response } = await apiClient.POST(
        '/admin/world-builder/activities/{activity_id}/ai-review',
        {
            body: { template_id: templateId },
            params: {
                header: { 'X-CSRF-Token': csrfToken },
                path: { activity_id: activityId },
            },
        },
    );

    if (!response.ok || !data) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return {
        activityId: data.activity_id,
        aiReview: data.ai_review,
        aiReviewedAt: data.ai_reviewed_at,
        aiReviewStatus: data.ai_review_status,
    };
}
