export type ActivityReview = {
    contractVersion: string;
    model: string;
    provider: string;
    reviewedByUserId: number;
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
    activityId: number;
    aiReview: ActivityReview;
    aiReviewedAt: string;
    aiReviewStatus: 'reviewed';
};

export async function reviewActivity(
    activityId: number,
    templateId: number,
): Promise<ActivityReviewResult> {
    return postJson<{ data: ActivityReviewResult }>(
        `/settings/worlds/activities/${activityId}/ai-review`,
        { template_id: templateId },
    ).then(({ data }) => data);
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'POST',
    });

    if (!response.ok) {
        throw await requestError(response);
    }

    return response.json() as Promise<T>;
}

async function requestError(response: Response): Promise<Error> {
    const fallback = `Request failed with status ${response.status}`;

    try {
        const body = (await response.json()) as {
            errors?: Record<string, string[]>;
            message?: string;
        };
        const firstError = body.errors
            ? Object.values(body.errors).flat()[0]
            : null;

        return new Error(firstError ?? body.message ?? fallback);
    } catch {
        return new Error(fallback);
    }
}
