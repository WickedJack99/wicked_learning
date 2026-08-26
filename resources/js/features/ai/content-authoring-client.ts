export type ContentPlanActivityType =
    | 'markdown'
    | 'message_prompt'
    | 'reflection';

export type ContentPlanActivity = {
    body: string | null;
    introduction: string | null;
    inputLabel: string | null;
    note: string | null;
    prompt: string | null;
    topic: string | null;
    title: string;
    type: ContentPlanActivityType;
};

export type ContentPlan = {
    activities: ContentPlanActivity[];
    mapAsset: {
        description: string | null;
        label: string | null;
        title: string;
    };
    summary: string;
};

export type ContentAuthoringRun = {
    appliedAt: string | null;
    contractVersion: string;
    id: number;
    mapAsset: {
        activityCount: number;
        id: number;
        title: string;
    } | null;
    model: string;
    plan: ContentPlan;
    provider: string;
    status: 'applied' | 'draft';
    usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
    };
    warnings: string[];
};

export type GenerateContentPlanInput = {
    activity_types: ContentPlanActivityType[];
    goal: string;
    prior_knowledge: string | null;
    route_length: number;
    target_audience: string | null;
    template_id: number;
};

export async function generateContentPlan(
    mapId: number,
    input: GenerateContentPlanInput,
): Promise<ContentAuthoringRun> {
    return postJson<{ data: ContentAuthoringRun }>(
        `/settings/worlds/maps/${mapId}/ai-content-plans`,
        input,
    ).then(({ data }) => data);
}

export async function applyContentPlan(
    runId: number,
): Promise<ContentAuthoringRun> {
    return postJson<{ data: ContentAuthoringRun }>(
        `/settings/ai-content-plans/${runId}/apply`,
        {},
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
