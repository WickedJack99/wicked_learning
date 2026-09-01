import { ArrowLeft, History, RotateCcw, Search } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type ActivityVersion = {
    createdAt: string | null;
    id: number;
    introduction: string | null;
    slug: string | null;
    title: string | null;
    type: string | null;
};

type ActivityVersionPage = {
    items: ActivityVersion[];
    pagination: {
        lastPage: number;
        page: number;
    };
};

type ActivityVersionDetails = ActivityVersion & {
    snapshot: {
        companionConfig: Record<string, unknown>;
        config: Record<string, unknown>;
        graphPositionX: number | null;
        graphPositionY: number | null;
        transitions?: Array<Record<string, unknown>>;
    };
};

export function ActivityHistoryDialog({
    activityId,
    children,
    onOpenChange,
    onRestored,
    open,
}: {
    activityId: number | null;
    children: ReactNode;
    onOpenChange: (open: boolean) => void;
    onRestored: () => void;
    open: boolean;
}) {
    const t = usePlatformTranslation();
    const [history, setHistory] = useState<ActivityVersionPage | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [inspectedVersion, setInspectedVersion] =
        useState<ActivityVersionDetails | null>(null);
    const [inspectingId, setInspectingId] = useState<number | null>(null);
    const [restoringId, setRestoringId] = useState<number | null>(null);

    const loadHistory = useCallback(
        async (page = 1) => {
            if (!activityId) {
                return;
            }

            setLoading(true);
            setError(false);
            setInspectedVersion(null);

            try {
                const response = await fetch(
                    `/settings/worlds/activities/${activityId}/versions?page=${page}&per_page=6`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error(
                        'The activity history could not be loaded.',
                    );
                }

                setHistory((await response.json()) as ActivityVersionPage);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [activityId],
    );

    const inspectVersion = async (version: ActivityVersion) => {
        if (!activityId) {
            return;
        }

        setInspectingId(version.id);
        setError(false);

        try {
            const response = await fetch(
                `/settings/worlds/activities/${activityId}/versions/${version.id}`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );

            if (!response.ok) {
                throw new Error(
                    t(
                        'settings.activity_history.details_load_error',
                        'The activity version could not be inspected.',
                    ),
                );
            }

            const payload = (await response.json()) as {
                version: ActivityVersionDetails;
            };
            setInspectedVersion(payload.version);
        } catch {
            setError(true);
        } finally {
            setInspectingId(null);
        }
    };

    const restoreVersion = async (version: ActivityVersion) => {
        if (
            !window.confirm(
                t(
                    'settings.activity_history.restore_confirm',
                    'Restore this activity version? The current configuration will be preserved in history and the restored activity will need review.',
                ),
            )
        ) {
            return;
        }

        if (!activityId) {
            return;
        }

        setRestoringId(version.id);

        try {
            const csrfToken =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const response = await fetch(
                `/settings/worlds/activities/${activityId}/versions/${version.id}/restore`,
                {
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    method: 'POST',
                },
            );

            if (!response.ok) {
                throw new Error('The activity version could not be restored.');
            }

            onRestored();
        } catch {
            setError(true);
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <Dialog
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);

                if (nextOpen) {
                    void loadHistory();
                } else {
                    setInspectedVersion(null);
                }
            }}
            open={open}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[min(44rem,calc(100vh-2rem))] overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="inline-flex items-center gap-2">
                        <History className="size-4" />
                        {t('settings.activity_history.title', 'Activity history')}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'settings.activity_history.description',
                            'Review earlier activity details, type-specific settings and route connections. Restoring preserves the current state as a new history entry. Separate dialogue graph records are not changed.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid min-h-0 gap-3 overflow-hidden">
                    {loading ? (
                        <p aria-live="polite" className="text-sm" role="status">
                            {t(
                                'settings.activity_history.loading',
                                'Loading activity history…',
                            )}
                        </p>
                    ) : error ? (
                        <p
                            aria-live="polite"
                            className="text-sm text-red-400"
                            role="status"
                        >
                            {t(
                                'settings.activity_history.error',
                                'Activity history could not be loaded or restored. Try again.',
                            )}
                        </p>
                    ) : inspectingId !== null ? (
                        <p aria-live="polite" className="text-sm" role="status">
                            {t(
                                'settings.activity_history.details_loading',
                                'Loading version details…',
                            )}
                        </p>
                    ) : inspectedVersion ? (
                        <ActivityVersionDetailsView
                            onBack={() => setInspectedVersion(null)}
                            onRestore={() =>
                                void restoreVersion(inspectedVersion)
                            }
                            restoring={restoringId === inspectedVersion.id}
                            t={t}
                            version={inspectedVersion}
                        />
                    ) : history && history.items.length > 0 ? (
                        <div className="grid min-h-0 gap-2">
                            {history.items.map((version) => (
                                <div
                                    className="grid gap-1 rounded-md border border-[var(--settings-border-color)] p-3"
                                    key={version.id}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="text-sm font-medium">
                                            {version.title ||
                                                t(
                                                    'settings.activity_history.untitled',
                                                    'Untitled activity',
                                                )}
                                        </p>
                                        <time className="text-xs text-[var(--settings-muted-text)]">
                                            {formatVersionDate(version.createdAt, t)}
                                        </time>
                                    </div>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {version.type ||
                                            t(
                                                'settings.activity_history.unknown_type',
                                                'Unknown type',
                                            )}
                                        {version.introduction
                                            ? ` · ${version.introduction}`
                                            : ''}
                                    </p>
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                            disabled={restoringId !== null}
                                            onClick={() =>
                                                void inspectVersion(version)
                                            }
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            <Search className="size-4" />
                                            {t(
                                                'settings.activity_history.inspect',
                                                'Inspect',
                                            )}
                                        </Button>
                                        <Button
                                            disabled={restoringId !== null}
                                            onClick={() =>
                                                void restoreVersion(version)
                                            }
                                            size="sm"
                                            type="button"
                                            variant="ghost"
                                        >
                                            <RotateCcw className="size-4" />
                                            {restoringId === version.id
                                                ? t(
                                                      'settings.activity_history.restoring',
                                                      'Restoring…',
                                                  )
                                                : t(
                                                      'settings.activity_history.restore',
                                                      'Restore this version',
                                                  )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            {t(
                                'settings.activity_history.empty',
                                'No earlier activity configuration yet. The first update will create one.',
                            )}
                        </p>
                    )}
                    {history ? (
                        <PaginationControls
                            buttonClassName="text-[var(--settings-accent)]"
                            currentPage={history.pagination.page}
                            disabled={
                                loading ||
                                inspectingId !== null ||
                                restoringId !== null
                            }
                            label={t(
                                'settings.activity_history.pagination',
                                'Activity history pagination',
                            )}
                            onPageChange={(page) => void loadHistory(page)}
                            pageCount={history.pagination.lastPage}
                            showSinglePage
                            textClassName="text-[var(--settings-muted-text)]"
                        />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ActivityVersionDetailsView({
    onBack,
    onRestore,
    restoring,
    t,
    version,
}: {
    onBack: () => void;
    onRestore: () => void;
    restoring: boolean;
    t: (key: string, fallback: string) => string;
    version: ActivityVersionDetails;
}) {
    const configEntries = Object.entries(version.snapshot.config);
    const companionConfigured =
        Object.keys(version.snapshot.companionConfig).length > 0;

    return (
        <div className="grid gap-3">
            <Button
                className="justify-self-start"
                onClick={onBack}
                size="sm"
                type="button"
                variant="ghost"
            >
                <ArrowLeft className="size-4" />
                {t('settings.activity_history.back', 'Back to history')}
            </Button>
            <div className="grid gap-3 rounded-md border border-[var(--settings-border-color)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-sm font-medium">
                        {version.title ||
                            t(
                                'settings.activity_history.untitled',
                                'Untitled activity',
                            )}
                    </h3>
                    <time className="text-xs text-[var(--settings-muted-text)]">
                        {formatVersionDate(version.createdAt, t)}
                    </time>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <SnapshotField
                        label={t(
                            'settings.activity_history.details.type',
                            'Activity type',
                        )}
                        value={version.type || t('common.unknown', 'Unknown')}
                    />
                    <SnapshotField
                        label={t(
                            'settings.activity_history.details.slug',
                            'Slug',
                        )}
                        value={version.slug || t('common.not_set', 'Not set')}
                    />
                    <SnapshotField
                        className="sm:col-span-2"
                        label={t(
                            'settings.activity_history.details.introduction',
                            'Introduction',
                        )}
                        value={
                            version.introduction ||
                            t('common.not_set', 'Not set')
                        }
                    />
                </dl>
            </div>
            <div className="grid gap-2 rounded-md border border-[var(--settings-border-color)] p-3">
                <h3 className="text-sm font-medium">
                    {t(
                        'settings.activity_history.details.configuration',
                        'Type-specific settings',
                    )}
                </h3>
                {configEntries.length > 0 ? (
                    <dl className="grid gap-2 text-sm">
                        {configEntries.map(([key, value]) => (
                            <SnapshotField
                                key={key}
                                label={humanizeKey(key)}
                                value={formatSnapshotValue(value, t)}
                            />
                        ))}
                    </dl>
                ) : (
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        {t(
                            'settings.activity_history.details.no_configuration',
                            'No type-specific settings were stored.',
                        )}
                    </p>
                )}
            </div>
            <div className="grid gap-1 text-sm text-[var(--settings-muted-text)]">
                <p>
                    {t(
                        'settings.activity_history.details.routes',
                        'Route connections',
                    )}{' '}
                    {version.snapshot.transitions?.length ?? 0}
                </p>
                <p>
                    {t(
                        'settings.activity_history.details.companion',
                        'Companion override',
                    )}{' '}
                    {companionConfigured
                        ? t(
                              'settings.activity_history.details.configured',
                              'Configured',
                          )
                        : t(
                              'settings.activity_history.details.not_configured',
                              'Not configured',
                          )}
                </p>
                <p>
                    {t(
                        'settings.activity_history.details.position',
                        'Graph position',
                    )}{' '}
                    {formatPosition(
                        version.snapshot.graphPositionX,
                        version.snapshot.graphPositionY,
                        t,
                    )}
                </p>
            </div>
            <Button
                className="justify-self-end"
                disabled={restoring}
                onClick={onRestore}
                type="button"
            >
                <RotateCcw className="size-4" />
                {restoring
                    ? t('settings.activity_history.restoring', 'Restoring…')
                    : t(
                          'settings.activity_history.restore',
                          'Restore this version',
                      )}
            </Button>
        </div>
    );
}

function SnapshotField({
    className,
    label,
    value,
}: {
    className?: string;
    label: string;
    value: string;
}) {
    return (
        <div className={className}>
            <dt className="text-xs text-[var(--settings-muted-text)]">{label}</dt>
            <dd className="break-words">{value}</dd>
        </div>
    );
}

function formatSnapshotValue(
    value: unknown,
    t: (key: string, fallback: string) => string,
): string {
    if (value === null || value === '') {
        return t('common.not_set', 'Not set');
    }

    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }

    if (typeof value === 'boolean') {
        return value ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled');
    }

    if (Array.isArray(value)) {
        return `${value.length} ${t('settings.activity_history.details.values', 'configured values')}`;
    }

    if (typeof value === 'object') {
        return `${Object.keys(value).length} ${t('settings.activity_history.details.fields', 'configured fields')}`;
    }

    return t('common.unknown', 'Unknown');
}

function formatPosition(
    x: number | null,
    y: number | null,
    t: (key: string, fallback: string) => string,
): string {
    if (x === null || y === null) {
        return t('common.not_set', 'Not set');
    }

    return `(${x}, ${y})`;
}

function humanizeKey(value: string): string {
    return value
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^./, (character) => character.toUpperCase());
}

function formatVersionDate(
    value: string | null,
    t: (key: string, fallback: string) => string,
): string {
    if (!value) {
        return t('common.unknown', 'Unknown');
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
