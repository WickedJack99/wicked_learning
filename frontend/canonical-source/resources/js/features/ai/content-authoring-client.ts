export type ContentPlanActivityType =
    | 'markdown'
    | 'message_prompt'
    | 'reflection'
    | 'shared_task'
    | 'open_practice';

export type ContentPlanActivity = {
    body: string | null;
    competenceTopics: string[];
    introduction: string | null;
    inputLabel: string | null;
    learningIntent: string;
    note: string | null;
    prompt: string | null;
    sourceRecordIds?: number[];
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

export type ContentAuthoringSourceRecord = {
    anchor: string | null;
    concepts: string[];
    excerpt: string | null;
    id: number;
    publishedAt: string | null;
    publisher: string | null;
    rights: string | null;
    title: string;
    url: string;
};

export type SourceRecordPage = {
    items: ContentAuthoringSourceRecord[];
    pagination: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
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
    sourceRecords: ContentAuthoringSourceRecord[];
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
    source_record_ids: number[];
    target_audience: string | null;
    template_id: number;
};

export async function loadSourceRecords(
    page = 1,
    search = '',
): Promise<SourceRecordPage> {
    const params = new URLSearchParams({
        page: String(page),
        per_page: '12',
    });

    if (search.trim() !== '') {
        params.set('search', search.trim());
    }

    return requestJson<SourceRecordPage>(
        `/settings/worlds/source-records?${params.toString()}`,
        undefined,
        'GET',
    );
}

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

export async function updateContentPlan(
    runId: number,
    plan: ContentPlan,
): Promise<ContentAuthoringRun> {
    return requestJson<{ data: ContentAuthoringRun }>(
        `/settings/ai-content-plans/${runId}`,
        { plan },
        'PATCH',
    ).then(({ data }) => data);
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
    return requestJson<T>(url, payload, 'POST');
}

async function requestJson<T>(
    url: string,
    payload: unknown,
    method: 'GET' | 'PATCH' | 'POST',
): Promise<T> {
    const csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? '';
    const response = await fetch(url, {
        ...(method === 'GET' ? {} : { body: JSON.stringify(payload) }),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
            'X-CSRF-TOKEN': csrfToken,
            'X-Requested-With': 'XMLHttpRequest',
        },
        method,
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
