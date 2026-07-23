import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    Building2,
    Flag,
    Inbox,
    Map as MapIcon,
    MessageSquareText,
    Save,
    Send,
    ShieldCheck,
    Users,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrganizationIcon } from '@/features/organizations/organization-icon';
import { WorldMapManagementPanel } from '@/features/settings/world-map-management-panel';
import type { WorldMapManagementGraph } from '@/features/settings/world-map-management-panel';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

type AdminPanelMetrics = {
    feedbackRequests: number;
    journalPages: number;
    pendingFeedbackRequests: number;
    pendingOrganizationIconReports: number;
    registeredUsers: number;
};

type FeedbackRequest = {
    domain: {
        id: number | null;
        label: string;
        type: string;
    };
    feedback: string | null;
    id: number;
    page: {
        id: number | null;
        markdown: string | null;
        subtopic: string | null;
        title: string | null;
        topic: string | null;
    };
    requestedAt: string | null;
    requester: {
        email: string | null;
        id: number | null;
        name: string | null;
    };
    respondedAt: string | null;
    status: 'pending' | 'responded';
};

type OrganizationIconReport = {
    createdAt: string | null;
    iconSetter: {
        email: string;
        id: number;
        name: string;
    } | null;
    iconUrl: string | null;
    id: number;
    organization: {
        id: number;
        name: string;
        slug: string;
    };
    reason: string | null;
    reporter: {
        email: string;
        id: number;
        name: string;
    };
    status: 'dismissed' | 'pending' | 'resolved';
};

type AdminPanelProps = {
    feedbackRequests: FeedbackRequest[];
    metrics: AdminPanelMetrics;
    organizationIconReports: OrganizationIconReport[];
    organizationSettings: {
        maxMembershipsPerUser: number;
    };
    worldGraph: WorldMapManagementGraph;
};

type AdminPanelSection = 'feedback-requests' | 'organization-icons' | 'world';

export default function AdminPanel({
    feedbackRequests,
    metrics,
    organizationIconReports,
    organizationSettings,
    worldGraph,
}: AdminPanelProps) {
    const t = usePlatformTranslation();
    const [section, setSection] =
        useState<AdminPanelSection>('feedback-requests');

    return (
        <>
            <Head title={t('settings.admin_panel.title', 'Admin Panel')} />
            <SettingsConfigurationShell
                backHref="/settings"
                eyebrow={t('settings.admin_panel.eyebrow', 'Administration')}
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton<AdminPanelSection>
                            active={section === 'feedback-requests'}
                            description={t(
                                'settings.admin_panel.feedback_requests.description',
                                'Review learner journal feedback requests.',
                            )}
                            icon={MessageSquareText}
                            id="feedback-requests"
                            label={t(
                                'settings.admin_panel.feedback_requests',
                                'Feedback Requests',
                            )}
                            onSelect={setSection}
                        />
                        <SettingsSectionButton<AdminPanelSection>
                            active={section === 'organization-icons'}
                            description="Review reported icons and organization limits."
                            icon={Flag}
                            id="organization-icons"
                            label="Organization Icons"
                            onSelect={setSection}
                        />
                        <SettingsSectionButton<AdminPanelSection>
                            active={section === 'world'}
                            description="Choose maps and jump into map or node configuration."
                            icon={MapIcon}
                            id="world"
                            label="World"
                            onSelect={setSection}
                        />
                    </SettingsSidebar>
                }
                title={t('settings.admin_panel.title', 'Admin Panel')}
            >
                <SettingsContentPane>
                    <div className="grid gap-4">
                        <MetricGrid metrics={metrics} t={t} />
                        {section === 'feedback-requests' ? (
                            <FeedbackRequestsSection
                                feedbackRequests={feedbackRequests}
                                t={t}
                            />
                        ) : null}
                        {section === 'organization-icons' ? (
                            <OrganizationModerationSection
                                reports={organizationIconReports}
                                settings={organizationSettings}
                            />
                        ) : null}
                        {section === 'world' ? (
                            <WorldMapManagementPanel maps={worldGraph.maps} />
                        ) : null}
                    </div>
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

function MetricGrid({
    metrics,
    t,
}: {
    metrics: AdminPanelMetrics;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const metricCards = [
        {
            label: t('settings.admin_panel.metrics.users', 'Registered users'),
            value: metrics.registeredUsers,
        },
        {
            label: t(
                'settings.admin_panel.metrics.journal_pages',
                'Journal pages',
            ),
            value: metrics.journalPages,
        },
        {
            label: t(
                'settings.admin_panel.metrics.feedback_requests',
                'Feedback requests',
            ),
            value: metrics.feedbackRequests,
        },
        {
            label: t(
                'settings.admin_panel.metrics.pending_feedback',
                'Pending feedback',
            ),
            value: metrics.pendingFeedbackRequests,
        },
        {
            label: 'Icon reports',
            value: metrics.pendingOrganizationIconReports,
        },
    ];

    return (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metricCards.map((metric) => (
                <div
                    className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                    key={metric.label}
                >
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                        {metric.label}
                    </p>
                </div>
            ))}
        </section>
    );
}

function FeedbackRequestsSection({
    feedbackRequests,
    t,
}: {
    feedbackRequests: FeedbackRequest[];
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const [selectedId, setSelectedId] = useState<number | null>(
        feedbackRequests[0]?.id ?? null,
    );
    const [feedbackById, setFeedbackById] = useState<Record<number, string>>(
        () =>
            Object.fromEntries(
                feedbackRequests.map((request) => [
                    request.id,
                    request.feedback ?? '',
                ]),
            ),
    );
    const selectedRequest = useMemo(
        () =>
            feedbackRequests.find((request) => request.id === selectedId) ??
            null,
        [feedbackRequests, selectedId],
    );
    const currentFeedback = selectedRequest
        ? (feedbackById[selectedRequest.id] ?? '')
        : '';

    function updateFeedback(value: string) {
        if (!selectedRequest) {
            return;
        }

        setFeedbackById((feedback) => ({
            ...feedback,
            [selectedRequest.id]: value,
        }));
    }

    function sendFeedback(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            !selectedRequest ||
            selectedRequest.respondedAt ||
            currentFeedback.trim().length === 0
        ) {
            return;
        }

        router.post(
            `/settings/admin-panel/feedback-requests/${selectedRequest.id}`,
            { feedback: currentFeedback },
            { preserveScroll: true },
        );
    }

    return (
        <section className="grid min-h-[28rem] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="min-h-0 rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-2 border-b border-slate-200 p-4 dark:border-white/10">
                    <Inbox
                        className="size-4"
                        style={{ color: 'var(--settings-accent)' }}
                    />
                    <h2 className="font-semibold">
                        {t(
                            'settings.admin_panel.feedback_requests',
                            'Feedback Requests',
                        )}
                    </h2>
                </div>
                <div className="max-h-[32rem] overflow-y-auto p-3">
                    {feedbackRequests.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                            {t(
                                'settings.admin_panel.no_feedback_requests',
                                'No feedback requests yet.',
                            )}
                        </p>
                    ) : (
                        <div className="grid gap-2">
                            {feedbackRequests.map((request) => (
                                <FeedbackRequestButton
                                    active={selectedRequest?.id === request.id}
                                    key={request.id}
                                    onSelect={() => setSelectedId(request.id)}
                                    request={request}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                {selectedRequest ? (
                    <form
                        className="grid h-full min-h-0 gap-4"
                        onSubmit={sendFeedback}
                    >
                        <FeedbackRequestHeader
                            request={selectedRequest}
                            t={t}
                        />
                        <div className="grid min-h-0 gap-4 xl:grid-cols-2">
                            <section className="min-h-0 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#070b14]">
                                <h3 className="font-semibold">
                                    {t(
                                        'settings.admin_panel.reflection',
                                        'Reflection',
                                    )}
                                </h3>
                                <div className="mt-3 max-h-[26rem] overflow-y-auto text-sm leading-6 whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                                    {selectedRequest.page.markdown ||
                                        t(
                                            'settings.admin_panel.empty_reflection',
                                            'This journal page is empty.',
                                        )}
                                </div>
                            </section>

                            <section className="grid min-h-0 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#070b14]">
                                <label
                                    className="font-semibold"
                                    htmlFor="feedback"
                                >
                                    {t(
                                        'settings.admin_panel.feedback',
                                        'Feedback',
                                    )}
                                </label>
                                <textarea
                                    className="min-h-[18rem] rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-950 outline-none focus:border-[var(--settings-accent)] dark:border-white/10 dark:bg-[#020617] dark:text-white"
                                    disabled={
                                        selectedRequest.respondedAt !== null
                                    }
                                    id="feedback"
                                    onChange={(event) =>
                                        updateFeedback(event.target.value)
                                    }
                                    placeholder={t(
                                        'settings.admin_panel.feedback_placeholder',
                                        'Write informational feedback for this learner...',
                                    )}
                                    value={currentFeedback}
                                />
                            </section>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                disabled={
                                    selectedRequest.respondedAt !== null ||
                                    currentFeedback.trim().length === 0
                                }
                                type="submit"
                            >
                                <Send className="size-4" />
                                {t('settings.admin_panel.send', 'Send')}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <EmptySelection t={t} />
                )}
            </div>
        </section>
    );
}

function FeedbackRequestButton({
    active,
    onSelect,
    request,
    t,
}: {
    active: boolean;
    onSelect: () => void;
    request: FeedbackRequest;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const requester =
        request.requester.name ??
        request.requester.email ??
        t('settings.admin_panel.unknown_requester', 'Unknown requester');

    return (
        <button
            className={cn(
                'rounded-lg border p-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/10',
                active
                    ? 'border-[var(--settings-accent)] bg-slate-50 dark:bg-white/10'
                    : 'border-slate-200 dark:border-white/10',
            )}
            onClick={onSelect}
            type="button"
        >
            <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                    {request.page.title || t('common.untitled', 'Untitled')}
                </p>
                <span
                    className="rounded-full px-2 py-1 text-[0.65rem] font-bold uppercase"
                    style={{
                        background: request.respondedAt
                            ? 'color-mix(in srgb, var(--settings-accent) 18%, transparent)'
                            : 'var(--settings-accent)',
                        color: request.respondedAt
                            ? 'var(--settings-accent)'
                            : 'var(--settings-accent-foreground)',
                    }}
                >
                    {request.respondedAt
                        ? t(
                              'settings.admin_panel.status.responded',
                              'Responded',
                          )
                        : t('settings.admin_panel.status.pending', 'Pending')}
                </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {requester}
            </p>
            <p
                className="mt-2 text-xs font-semibold"
                style={{ color: 'var(--settings-accent)' }}
            >
                {request.domain.label}
            </p>
        </button>
    );
}

function FeedbackRequestHeader({
    request,
    t,
}: {
    request: FeedbackRequest;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p
                    className="text-xs font-semibold tracking-[0.16em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    {t('settings.admin_panel.journal_page', 'Journal page')}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                    {request.page.title || t('common.untitled', 'Untitled')}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {request.page.topic}
                    {request.page.subtopic ? ` / ${request.page.subtopic}` : ''}
                </p>
                <p
                    className="mt-2 text-sm font-semibold"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    {request.domain.label}
                </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Users className="size-4" />
                {request.requester.name ?? request.requester.email}
            </div>
        </div>
    );
}

function EmptySelection({
    t,
}: {
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    return (
        <div className="grid h-full place-items-center text-center">
            <div>
                <BarChart3
                    className="mx-auto size-10"
                    style={{ color: 'var(--settings-accent)' }}
                />
                <h2 className="mt-4 text-xl font-semibold">
                    {t(
                        'settings.admin_panel.select_request',
                        'Select a feedback request',
                    )}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.admin_panel.select_request.description',
                        'Choose a journal page on the left to review it.',
                    )}
                </p>
            </div>
        </div>
    );
}

function OrganizationModerationSection({
    reports,
    settings,
}: {
    reports: OrganizationIconReport[];
    settings: { maxMembershipsPerUser: number };
}) {
    const [limit, setLimit] = useState(String(settings.maxMembershipsPerUser));

    function saveLimit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        router.patch(
            '/settings/admin-panel/organizations',
            { max_memberships_per_user: Number(limit) },
            { preserveScroll: true },
        );
    }

    function resolveReport(
        report: OrganizationIconReport,
        removeIcon: boolean,
    ) {
        router.patch(
            `/settings/admin-panel/organization-icon-reports/${report.id}`,
            { remove_icon: removeIcon },
            { preserveScroll: true },
        );
    }

    return (
        <section className="grid gap-4">
            <form
                className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_10rem_max-content] md:items-end dark:border-white/10 dark:bg-white/5"
                onSubmit={saveLimit}
            >
                <div>
                    <div className="flex items-center gap-2">
                        <Building2
                            className="size-4"
                            style={{ color: 'var(--settings-accent)' }}
                        />
                        <h2 className="font-semibold">
                            Organization membership limit
                        </h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Applies globally to every user.
                    </p>
                </div>
                <Input
                    min={1}
                    max={100}
                    type="number"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                />
                <Button type="submit">
                    <Save className="size-4" />
                    Save
                </Button>
            </form>

            <div className="grid gap-3">
                {reports.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                        No pending organization icon reports.
                    </p>
                ) : null}
                {reports.map((report) => (
                    <article
                        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[5rem_minmax(0,1fr)_max-content] dark:border-white/10 dark:bg-white/5"
                        key={report.id}
                    >
                        <OrganizationIcon
                            className="size-20"
                            iconUrl={report.iconUrl}
                            name={report.organization.name}
                        />
                        <div className="min-w-0">
                            <h3 className="font-semibold">
                                {report.organization.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Reported by {report.reporter.name} (
                                {report.reporter.email})
                            </p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Icon set by{' '}
                                {report.iconSetter
                                    ? `${report.iconSetter.name} (${report.iconSetter.email})`
                                    : 'unknown user'}
                            </p>
                            {report.reason ? (
                                <p className="mt-2 text-sm leading-6">
                                    {report.reason}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 md:flex-col">
                            <Button
                                onClick={() => resolveReport(report, true)}
                                type="button"
                                variant="destructive"
                            >
                                <ShieldCheck className="size-4" />
                                Remove icon
                            </Button>
                            <Button
                                onClick={() => resolveReport(report, false)}
                                type="button"
                                variant="secondary"
                            >
                                <X className="size-4" />
                                Dismiss
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
