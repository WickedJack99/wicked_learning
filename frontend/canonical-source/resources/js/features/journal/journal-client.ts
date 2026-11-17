import type { JournalThemeSettings } from '@/features/journal/theme';
import { deleteJson, getJson, patchJson, postJson } from '@/features/world/api';

export type JournalPage = {
    expertAccessRequested: boolean;
    feedbackRequest: {
        domain: {
            id: number | null;
            label: string;
            type: string;
        };
        feedback: string | null;
        requestedAt: string | null;
        respondedAt: string | null;
        status: 'pending' | 'responded';
    } | null;
    id: number;
    learningContext: {
        activityHref: string | null;
        activityTitle: string | null;
        mapHref: string;
        mapTitle: string;
        nodeHref: string;
        nodeTitle: string;
        topic: { href: string; title: string } | null;
    } | null;
    markdown: string;
    preferredMode: 'edit' | 'view';
    reflectionCount: number;
    subtopic: string | null;
    title: string;
    topic: string;
    updatedAt: string | null;
};

export type JournalFeedbackDomain = {
    id: number | null;
    key: string;
    label: string;
    type: string;
};

export type JournalLearningCheckIn = {
    activityId: number;
    activityHref: string;
    activityTitle: string;
    feeling: string | null;
    note: string | null;
    nextDirection: 'revisit' | 'related' | 'settle' | null;
    nodeTitle: string;
    nodeHref: string;
    originTopicSlug: string | null;
    recordedAt: string;
    topics: { slug: string; name: string }[];
};

export type JournalRevisitInvitation = {
    activityHref: string;
    activityId: number;
    activityTitle: string;
    availableAfterDays: number;
    availableAt: string;
    availableSince: string;
    mapTitle: string;
    nodeHref: string;
    nodeTitle: string;
    revisitReason: 'pause' | 'later';
};

export type JournalPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

export async function requestJournalFeedback(
    pageId: number,
    domainKey: string,
): Promise<JournalPage> {
    const response = await postJson<{ page: JournalPage }>(
        `/learning/journal/pages/${pageId}/feedback-request`,
        { domain_key: domainKey },
    );

    updateCachedPages((pages) =>
        pages.map((page) =>
            page.id === response.page.id ? response.page : page,
        ),
    );

    return response.page;
}

export async function deleteJournalPage(pageId: number): Promise<number> {
    const response = await deleteJson<{ deletedPageId: number }>(
        `/learning/journal/pages/${pageId}`,
    );

    updateCachedPages((pages) =>
        pages.filter((page) => page.id !== response.deletedPageId),
    );

    return response.deletedPageId;
}

export type JournalPayload = {
    allowExpertAccessRequests: boolean;
    checkIns: JournalLearningCheckIn[];
    feedbackDomains: JournalFeedbackDomain[];
    pages: JournalPage[];
    pagination: JournalPagination;
    revisitInvitations: JournalRevisitInvitation[];
    theme: JournalThemeSettings;
};

export const JOURNAL_PAGE_SIZE = 4;

let cachedPayload: JournalPayload | null = null;
let cachedQueryKey: string | null = null;
let pendingPayload: { key: string; promise: Promise<JournalPayload> } | null =
    null;

/** Loads the learner journal and can refresh policy/settings that may change elsewhere. */
export async function loadJournalPayload({
    refresh = false,
    page = 1,
    search = '',
    signal,
}: {
    refresh?: boolean;
    page?: number;
    search?: string;
    signal?: AbortSignal;
} = {}): Promise<JournalPayload> {
    const normalizedPage = Number.isFinite(page)
        ? Math.max(1, Math.trunc(page))
        : 1;
    const normalizedSearch = search.trim();
    const query = new URLSearchParams({
        page: String(normalizedPage),
        per_page: String(JOURNAL_PAGE_SIZE),
    });

    if (normalizedSearch !== '') {
        query.set('search', normalizedSearch);
    }

    const key = query.toString();

    if (cachedPayload && cachedQueryKey === key && !refresh) {
        return cachedPayload;
    }

    if (pendingPayload?.key === key && !refresh) {
        return pendingPayload.promise;
    }

    const promise = getJson<JournalPayload>(
        `/learning/journal?${query.toString()}`,
        signal,
    ).then(
        (payload) => {
            cachedPayload = payload;
            cachedQueryKey = key;

            if (pendingPayload?.promise === promise) {
                pendingPayload = null;
            }

            return payload;
        },
        (error: unknown) => {
            if (pendingPayload?.promise === promise) {
                pendingPayload = null;
            }

            throw error;
        },
    );
    pendingPayload = { key, promise };

    return promise;
}

export async function updateRevisitInvitation(
    activityId: number,
    action: 'dismiss' | 'snooze',
): Promise<void> {
    await postJson(`/learning/activities/${activityId}/revisit-invitation`, {
        action,
    });

    if (cachedPayload) {
        cachedPayload = {
            ...cachedPayload,
            revisitInvitations: cachedPayload.revisitInvitations.filter(
                (invitation) => invitation.activityId !== activityId,
            ),
        };
    }
}

export function getCachedJournalPayload(): JournalPayload | null {
    return cachedPayload;
}

export async function createJournalPage(): Promise<JournalPage> {
    const response = await postJson<{ page: JournalPage }>(
        '/learning/journal/pages',
        {
            markdown: '',
            preferred_mode: 'edit',
            subtopic: '',
            title: 'Untitled page',
            topic: 'General',
        },
    );

    updateCachedPages((pages) => [response.page, ...pages]);

    return response.page;
}

export async function updateJournalPage(
    next: JournalPage,
): Promise<JournalPage> {
    const response = await patchJson<{ page: JournalPage }>(
        `/learning/journal/pages/${next.id}`,
        {
            markdown: next.markdown,
            preferred_mode: next.preferredMode,
            request_expert_access: next.expertAccessRequested,
            subtopic: next.subtopic ?? '',
            title: next.title,
            topic: next.topic,
        },
    );

    updateCachedPages((pages) =>
        pages.map((page) =>
            page.id === response.page.id ? response.page : page,
        ),
    );

    return response.page;
}

function updateCachedPages(
    transform: (pages: JournalPage[]) => JournalPage[],
): void {
    if (!cachedPayload) {
        return;
    }

    cachedPayload = {
        ...cachedPayload,
        pages: transform(cachedPayload.pages),
    };
}
