import { History, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { LiftedButton } from './lifted-button';
import {
    LiftedDialog,
    LiftedDialogContent,
    LiftedDialogDescription,
    LiftedDialogFooter,
    LiftedDialogHeader,
    LiftedDialogTitle,
} from './lifted-dialog';
import { LiftedInput } from './lifted-input';
import { LiftedInputError } from './lifted-input-error';
import { LiftedLabel } from './lifted-label';

type RustWorld = components['schemas']['AdminWorldSummary'];
type RustWorldDetailsVersionPage =
    components['schemas']['AdminWorldDetailsVersionPage'];

type WorldDetailsForm = {
    description: string;
    title: string;
    updated_at: string;
};

type WorldDetailsVersion = {
    createdAt: string | null;
    description: string | null;
    id: string;
    title: string;
};

type WorldDetailsVersionPage = {
    items: WorldDetailsVersion[];
    pagination: {
        lastPage: number;
        page: number;
        perPage: number;
        total: number;
    };
};

/**
 * Changes only Rust's snake_case history envelope into the pinned source
 * component's property names. The source controls, pagination and copy remain
 * wholly owned by the lifted component below.
 */
function adaptRustWorldDetailsVersionPage(
    page: RustWorldDetailsVersionPage,
): WorldDetailsVersionPage {
    return {
        items: page.items.map((version) => ({
            createdAt: version.created_at,
            description: version.description,
            id: version.id,
            title: version.title,
        })),
        pagination: {
            lastPage: page.last_page,
            page: page.page,
            perPage: page.per_page,
            total: page.total,
        },
    };
}

/**
 * Direct lift of `WorldBuilderPanel`'s current-main World details control and
 * dialog. Laravel/Inertia fetch, patch, restore and reload seams are adapted
 * to the existing typed Rust contract; no dialog structure or source behavior
 * is recreated here.
 */
export function LiftedWorldBuilderWorldDetailsDialog({
    onUpdated,
    world,
}: {
    onUpdated: () => void;
    world: RustWorld;
}) {
    const [worldDetailsOpen, setWorldDetailsOpen] = useState(false);
    const [worldDetailsForm, setWorldDetailsForm] = useState<WorldDetailsForm>({
        description: world.description ?? '',
        title: world.title,
        updated_at: world.updated_at ?? '',
    });
    const [worldDetailsErrors, setWorldDetailsErrors] = useState<
        Record<string, string>
    >({});
    const [worldDetailsHistory, setWorldDetailsHistory] =
        useState<WorldDetailsVersionPage | null>(null);
    const [worldDetailsHistoryLoading, setWorldDetailsHistoryLoading] =
        useState(false);
    const [worldDetailsHistoryError, setWorldDetailsHistoryError] =
        useState(false);
    const [worldDetailsSaving, setWorldDetailsSaving] = useState(false);
    const [restoringWorldDetailsVersionId, setRestoringWorldDetailsVersionId] =
        useState<string | null>(null);

    const loadWorldDetailsHistory = async (page = 1) => {
        setWorldDetailsHistoryLoading(true);
        setWorldDetailsHistoryError(false);

        try {
            const { data, response } = await apiClient.GET(
                '/admin/world-builder/world/versions',
                { params: { query: { page, per_page: 1 } } },
            );
            if (!response.ok || !data) {
                throw new Error('The world history could not be loaded.');
            }

            setWorldDetailsHistory(adaptRustWorldDetailsVersionPage(data));
        } catch {
            setWorldDetailsHistoryError(true);
        } finally {
            setWorldDetailsHistoryLoading(false);
        }
    };

    const openWorldDetails = () => {
        setWorldDetailsErrors({});
        setWorldDetailsForm({
            description: world.description ?? '',
            title: world.title,
            updated_at: world.updated_at ?? '',
        });
        setWorldDetailsOpen(true);
        void loadWorldDetailsHistory();
    };

    const saveWorldDetails = async () => {
        setWorldDetailsSaving(true);
        setWorldDetailsErrors({});

        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/world/details',
                {
                    body: {
                        description:
                            worldDetailsForm.description.trim() === ''
                                ? null
                                : worldDetailsForm.description,
                        title: worldDetailsForm.title,
                        updated_at: worldDetailsForm.updated_at,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok) {
                setWorldDetailsErrors({
                    updated_at:
                        response.status === 409
                            ? 'These world details changed in another session. Close this dialog, reload the World Builder, then apply your changes again.'
                            : 'The world details could not be saved. Refresh the World Builder and try again.',
                });
                return;
            }

            setWorldDetailsOpen(false);
            onUpdated();
        } catch {
            setWorldDetailsErrors({
                updated_at:
                    'The world details could not be saved. Check your connection and try again.',
            });
        } finally {
            setWorldDetailsSaving(false);
        }
    };

    const restoreWorldDetailsVersion = async (version: WorldDetailsVersion) => {
        if (
            !window.confirm(
                'Restore this world detail version? The current details will be preserved in history.',
            )
        ) {
            return;
        }

        setRestoringWorldDetailsVersionId(version.id);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/world/versions/{version_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { version_id: version.id },
                    },
                },
            );

            if (!response.ok || !data) {
                throw new Error('The world version could not be restored.');
            }

            setWorldDetailsForm({
                description: data.description ?? '',
                title: data.title,
                updated_at: data.updated_at ?? '',
            });
            await loadWorldDetailsHistory(
                worldDetailsHistory?.pagination.page ?? 1,
            );
            onUpdated();
        } catch {
            setWorldDetailsHistoryError(true);
        } finally {
            setRestoringWorldDetailsVersionId(null);
        }
    };

    return (
        <>
            <LiftedButton
                className="mt-2 w-full"
                data-wl-id="settings.world-builder.world-details.open"
                onClick={openWorldDetails}
                type="button"
                variant="outline"
            >
                <History className="size-4" />
                Edit world details
            </LiftedButton>
            <LiftedDialog
                onOpenChange={setWorldDetailsOpen}
                open={worldDetailsOpen}
            >
                <LiftedDialogContent
                    className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl"
                    data-wl-id="settings.world-builder.world-details-dialog"
                >
                    <LiftedDialogHeader>
                        <LiftedDialogTitle>Edit world details</LiftedDialogTitle>
                        <LiftedDialogDescription>
                            Update the author-facing title and description. The
                            canonical world slug stays unchanged.
                        </LiftedDialogDescription>
                    </LiftedDialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="world-title">Title</LiftedLabel>
                            <LiftedInput
                                id="world-title"
                                onChange={(event) =>
                                    setWorldDetailsForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                value={worldDetailsForm.title}
                            />
                            <LiftedInputError
                                message={worldDetailsErrors.title}
                            />
                        </div>
                        <div className="grid gap-2">
                            <LiftedLabel htmlFor="world-description">
                                Description
                            </LiftedLabel>
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_22%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                id="world-description"
                                onChange={(event) =>
                                    setWorldDetailsForm((current) => ({
                                        ...current,
                                        description: event.target.value,
                                    }))
                                }
                                value={worldDetailsForm.description}
                            />
                            <LiftedInputError
                                message={worldDetailsErrors.description}
                            />
                        </div>
                        <LiftedInputError
                            message={worldDetailsErrors.updated_at}
                        />
                    </div>
                    <div
                        className="grid min-h-0 gap-3 border-t border-[var(--settings-border-color)] pt-4"
                        data-wl-id="settings.world-builder.world-history"
                    >
                        <div>
                            <h3 className="text-sm font-semibold">
                                Previous versions
                            </h3>
                            <p className="text-xs text-[var(--settings-muted-text)]">
                                Restoring creates a new version of the current
                                details.
                            </p>
                        </div>
                        {worldDetailsHistoryLoading ? (
                            <p aria-live="polite" role="status">
                                Loading world history…
                            </p>
                        ) : worldDetailsHistoryError ? (
                            <p
                                aria-live="polite"
                                className="text-sm text-red-400"
                                role="status"
                            >
                                World history could not be loaded. Try again.
                            </p>
                        ) : worldDetailsHistory &&
                          worldDetailsHistory.items.length > 0 ? (
                            <div className="grid gap-2">
                                {worldDetailsHistory.items.map((version) => (
                                    <div
                                        className="grid gap-2 rounded-md border border-[var(--settings-border-color)] p-3"
                                        key={version.id}
                                    >
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="text-sm font-medium">
                                                {version.title}
                                            </p>
                                            <time className="text-xs text-[var(--settings-muted-text)]">
                                                {formatWorldVersionDate(
                                                    version.createdAt,
                                                )}
                                            </time>
                                        </div>
                                        <p className="line-clamp-1 text-xs text-[var(--settings-muted-text)]">
                                            {version.description ||
                                                'No description'}
                                        </p>
                                        <LiftedButton
                                            className="justify-self-end"
                                            disabled={
                                                restoringWorldDetailsVersionId !==
                                                null
                                            }
                                            onClick={() =>
                                                void restoreWorldDetailsVersion(
                                                    version,
                                                )
                                            }
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <RotateCcw className="size-4" />
                                            {restoringWorldDetailsVersionId ===
                                            version.id
                                                ? 'Restoring…'
                                                : 'Restore this version'}
                                        </LiftedButton>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--settings-muted-text)]">
                                No earlier world details yet. The first update
                                will create one.
                            </p>
                        )}
                        {worldDetailsHistory &&
                        worldDetailsHistory.pagination.lastPage > 1 ? (
                            <div className="flex items-center justify-between gap-3">
                                <LiftedButton
                                    disabled={
                                        worldDetailsHistoryLoading ||
                                        worldDetailsHistory.pagination.page <= 1
                                    }
                                    onClick={() =>
                                        void loadWorldDetailsHistory(
                                            worldDetailsHistory.pagination
                                                .page - 1,
                                        )
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Previous
                                </LiftedButton>
                                <span className="text-xs text-[var(--settings-muted-text)]">
                                    Page {worldDetailsHistory.pagination.page}{' '}
                                    of {
                                        worldDetailsHistory.pagination.lastPage
                                    }
                                </span>
                                <LiftedButton
                                    disabled={
                                        worldDetailsHistoryLoading ||
                                        worldDetailsHistory.pagination.page >=
                                            worldDetailsHistory.pagination
                                                .lastPage
                                    }
                                    onClick={() =>
                                        void loadWorldDetailsHistory(
                                            worldDetailsHistory.pagination
                                                .page + 1,
                                        )
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Next
                                </LiftedButton>
                            </div>
                        ) : null}
                    </div>
                    <LiftedDialogFooter>
                        <LiftedButton
                            disabled={worldDetailsSaving}
                            onClick={() => setWorldDetailsOpen(false)}
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </LiftedButton>
                        <LiftedButton
                            disabled={worldDetailsSaving}
                            onClick={saveWorldDetails}
                            type="button"
                        >
                            <Save className="size-4" />
                            {worldDetailsSaving ? 'Saving…' : 'Save details'}
                        </LiftedButton>
                    </LiftedDialogFooter>
                </LiftedDialogContent>
            </LiftedDialog>
        </>
    );
}

function formatWorldVersionDate(value: string | null): string {
    if (!value) {
        return 'Unknown date';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
