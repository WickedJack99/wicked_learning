import type { JournalThemeSettings } from '@/features/journal/theme';
import { getJson, patchJson, postJson } from '@/features/world/api';

export type JournalPage = {
    expertAccessRequested: boolean;
    id: number;
    markdown: string;
    preferredMode: 'edit' | 'view';
    reflectionCount: number;
    subtopic: string | null;
    title: string;
    topic: string;
    updatedAt: string | null;
};

export type JournalPayload = {
    allowExpertAccessRequests: boolean;
    pages: JournalPage[];
    theme: JournalThemeSettings;
};

let cachedPayload: JournalPayload | null = null;
let pendingPayload: Promise<JournalPayload> | null = null;

/** Loads the learner journal once per browser session and reuses it while the app is open. */
export async function loadJournalPayload(): Promise<JournalPayload> {
    if (cachedPayload) {
        return cachedPayload;
    }

    pendingPayload ??= getJson<JournalPayload>('/learning/journal').then(
        (payload) => {
            cachedPayload = payload;
            pendingPayload = null;

            return payload;
        },
        (error: unknown) => {
            pendingPayload = null;

            throw error;
        },
    );

    return pendingPayload;
}

export function getCachedJournalPayload(): JournalPayload | null {
    return cachedPayload;
}

export function filterJournalPayload(
    payload: JournalPayload,
    search: string,
): JournalPayload {
    const query = search.trim().toLowerCase();

    if (!query) {
        return payload;
    }

    return {
        ...payload,
        pages: payload.pages.filter((page) => journalPageMatches(page, query)),
    };
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

export async function updateJournalPage(next: JournalPage): Promise<JournalPage> {
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

function journalPageMatches(page: JournalPage, query: string): boolean {
    return [
        page.title,
        page.topic,
        page.subtopic ?? '',
        page.markdown,
        String(page.reflectionCount),
    ].some((value) => value.toLowerCase().includes(query));
}
