import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    Building2,
    Flag,
    Inbox,
    MessageSquareText,
    Plus,
    Save,
    Send,
    ShieldCheck,
    Sparkles,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
    SettingsConfigurationLayout,
    SettingsConfigurationShell,
    SettingsLevelBanner,
    SettingsPanelHeader,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { OrganizationIcon } from '@/features/organizations/organization-icon';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type AdminPanelMetrics = {
    feedbackRequests: number;
    journalPages: number;
    pendingFeedbackRequests: number;
    pendingOrganizationIconReports: number;
    registeredUsers: number;
};

export type FeedbackRequest = {
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

export type OrganizationIconReport = {
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

export type CompetenceTopicDefinition = {
    auraThreshold: number;
    description: string | null;
    emittanceThreshold: number;
    growthThreshold: number;
    isActive: boolean;
    name: string;
    slug: string;
};

type CompetenceTopicDraft = {
    auraThreshold: string;
    description: string;
    emittanceThreshold: string;
    growthThreshold: string;
    isActive: boolean;
    name: string;
    slug: string;
};

export type AdminPanelProps = {
    activeSection?: AdminPanelSection;
    competenceTopics: CompetenceTopicDefinition[];
    embedded?: boolean;
    feedbackRequests: FeedbackRequest[];
    hideNavigation?: boolean;
    metrics: AdminPanelMetrics;
    onSelectSection?: (section: AdminPanelSection) => void;
    organizationIconReports: OrganizationIconReport[];
    organizationSettings: {
        maxMembershipsPerUser: number;
    };
};

export type AdminPanelSection =
    | 'competence-topics'
    | 'feedback-requests'
    | 'organization-icons';

const adminPanelSections = [
    {
        description: 'Review learner journal feedback requests.',
        icon: MessageSquareText,
        key: 'feedback-requests',
        label: 'Feedback Requests',
    },
    {
        description: 'Review reported icons and organization limits.',
        icon: Flag,
        key: 'organization-icons',
        label: 'Organization Icons',
    },
    {
        description: 'Define topics and star-map thresholds.',
        icon: Sparkles,
        key: 'competence-topics',
        label: 'Competence Topics',
    },
] satisfies SettingsNavigationItem<AdminPanelSection>[];

const embeddedSectionHeadings = {
    'competence-topics': {
        description: 'Define topic thresholds for competence star growth.',
        eyebrow: 'Competence',
        title: 'Competence Topics',
    },
    'feedback-requests': {
        description: 'Review learner journal feedback requests.',
        eyebrow: 'Feedback',
        title: 'Feedback Requests',
    },
    'organization-icons': {
        description: 'Review reported icons and organization limits.',
        eyebrow: 'Organizations',
        title: 'Organization Icons',
    },
} satisfies Record<
    AdminPanelSection,
    { description: string; eyebrow: string; title: string }
>;

export default function AdminPanel({
    activeSection,
    competenceTopics,
    embedded = false,
    feedbackRequests,
    hideNavigation = false,
    metrics,
    onSelectSection,
    organizationIconReports,
    organizationSettings,
}: AdminPanelProps) {
    const t = usePlatformTranslation();
    const [internalSection, setInternalSection] =
        useState<AdminPanelSection>('feedback-requests');
    const section = activeSection ?? internalSection;
    const setSection = onSelectSection ?? setInternalSection;
    const activeSectionItem =
        adminPanelSections.find((item) => item.key === section) ??
        adminPanelSections[0];
    const embeddedHeading = embeddedSectionHeadings[section];
    const embeddedHeadingItem: SettingsNavigationItem<AdminPanelSection> = {
        ...activeSectionItem,
        label: embeddedHeading.eyebrow,
    };

    const sidebar = (
        <aside className="min-h-0 overflow-hidden border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] p-3 lg:border-r lg:border-b-0">
            <SettingsSectionNavigation
                activeSection={section}
                ariaLabel="Admin panel sections"
                items={adminPanelSections}
                onChange={setSection}
            />
        </aside>
    );

    const content = (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--settings-panel-background)]">
            {hideNavigation ? null : (
                <SettingsLevelBanner item={activeSectionItem} />
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4">
                    {hideNavigation ? (
                        <SettingsPanelHeader
                            description={embeddedHeading.description}
                            item={embeddedHeadingItem}
                            title={embeddedHeading.title}
                        />
                    ) : null}
                    <SectionStats
                        metrics={metrics}
                        section={section}
                        topics={competenceTopics}
                        t={t}
                    />
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
                    {section === 'competence-topics' ? (
                        <CompetenceTopicsSection topics={competenceTopics} />
                    ) : null}
                </div>
            </div>
        </div>
    );

    if (embedded) {
        if (hideNavigation) {
            return content;
        }

        return (
            <SettingsConfigurationLayout
                className="h-full gap-0"
                contentClassName="min-h-0 overflow-hidden"
                sidebar={sidebar}
            >
                {content}
            </SettingsConfigurationLayout>
        );
    }

    return (
        <>
            <Head title={t('settings.admin_panel.title', 'Admin Panel')} />
            <SettingsConfigurationShell
                backHref="/settings"
                eyebrow={t('settings.admin_panel.eyebrow', 'Administration')}
                sidebar={sidebar}
                title={t('settings.admin_panel.title', 'Admin Panel')}
            >
                {content}
            </SettingsConfigurationShell>
        </>
    );
}

function CompetenceTopicsSection({
    topics,
}: {
    topics: CompetenceTopicDefinition[];
}) {
    const baselineDrafts = useMemo(() => topicDrafts(topics), [topics]);
    const [drafts, setDrafts] = useState<CompetenceTopicDraft[]>(
        () => baselineDrafts,
    );
    const syncedDraftsRef = useRef<CompetenceTopicDraft[]>(baselineDrafts);
    const hasChanges = useDirtyState(drafts, baselineDrafts);

    useEffect(() => {
        const hasLocalEdits =
            draftSnapshot(drafts) !== draftSnapshot(syncedDraftsRef.current);

        if (hasLocalEdits) {
            return;
        }

        syncedDraftsRef.current = baselineDrafts;
        setDrafts(baselineDrafts);
    }, [baselineDrafts, drafts]);

    function updateTopic(
        index: number,
        field: keyof CompetenceTopicDraft,
        value: string | boolean,
    ) {
        setDrafts((current) =>
            current.map((topic, topicIndex) =>
                topicIndex === index ? { ...topic, [field]: value } : topic,
            ),
        );
    }

    function addTopic() {
        setDrafts((current) => [...current, emptyCompetenceTopic()]);
    }

    function removeTopic(index: number) {
        setDrafts((current) => {
            const next = current.filter(
                (_, topicIndex) => topicIndex !== index,
            );

            return next.length > 0 ? next : [emptyCompetenceTopic()];
        });
    }

    function saveTopics(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!hasChanges) {
            return;
        }

        router.patch(
            '/settings/admin-panel/competence-topics',
            {
                topics: drafts
                    .filter((topic) => topic.name.trim().length > 0)
                    .map((topic) => ({
                        aura_threshold: Number(topic.auraThreshold),
                        description: topic.description,
                        emittance_threshold: Number(topic.emittanceThreshold),
                        growth_threshold: Number(topic.growthThreshold),
                        is_active: topic.isActive,
                        name: topic.name,
                    })),
            },
            { preserveScroll: true },
        );
    }

    return (
        <form className="grid gap-4" onSubmit={saveTopics}>
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Sparkles
                                className="size-4"
                                style={{ color: 'var(--settings-accent)' }}
                            />
                            <h2 className="font-semibold">
                                Competence topic definitions
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Thresholds decide how quickly each topic star grows,
                            brightens and shows its monthly aura.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={addTopic}
                            type="button"
                            variant="secondary"
                        >
                            <Plus className="size-4" />
                            Add topic
                        </Button>
                        <Button disabled={!hasChanges} type="submit">
                            <Save className="size-4" />
                            Save
                        </Button>
                    </div>
                </div>
            </section>

            <div className="grid gap-3">
                {drafts.map((topic, index) => (
                    <article
                        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                        key={`${topic.slug || 'new'}-${index}`}
                    >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_auto] lg:items-start">
                            <div className="grid gap-2">
                                <label
                                    className="text-sm font-medium"
                                    htmlFor={`competence-topic-name-${index}`}
                                >
                                    Topic
                                </label>
                                <Input
                                    id={`competence-topic-name-${index}`}
                                    onChange={(event) =>
                                        updateTopic(
                                            index,
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="e.g. Algebra"
                                    value={topic.name}
                                />
                            </div>
                            <ThresholdInput
                                id={`competence-growth-${index}`}
                                label="Growth"
                                onChange={(value) =>
                                    updateTopic(index, 'growthThreshold', value)
                                }
                                value={topic.growthThreshold}
                            />
                            <ThresholdInput
                                id={`competence-emittance-${index}`}
                                label="Emittance"
                                onChange={(value) =>
                                    updateTopic(
                                        index,
                                        'emittanceThreshold',
                                        value,
                                    )
                                }
                                value={topic.emittanceThreshold}
                            />
                            <ThresholdInput
                                id={`competence-aura-${index}`}
                                label="Aura"
                                onChange={(value) =>
                                    updateTopic(index, 'auraThreshold', value)
                                }
                                value={topic.auraThreshold}
                            />
                            <Button
                                aria-label="Remove competence topic"
                                className="lg:mt-7"
                                onClick={() => removeTopic(index)}
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
                            <div className="grid gap-2">
                                <label
                                    className="text-sm font-medium"
                                    htmlFor={`competence-description-${index}`}
                                >
                                    Description
                                </label>
                                <textarea
                                    className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--settings-accent)_24%,transparent)] dark:border-white/10 dark:bg-slate-950 dark:text-white"
                                    id={`competence-description-${index}`}
                                    onChange={(event) =>
                                        updateTopic(
                                            index,
                                            'description',
                                            event.target.value,
                                        )
                                    }
                                    value={topic.description}
                                />
                            </div>
                            <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 p-3 text-sm font-medium dark:border-white/10">
                                <Checkbox
                                    checked={topic.isActive}
                                    onCheckedChange={(checked) =>
                                        updateTopic(
                                            index,
                                            'isActive',
                                            checked === true,
                                        )
                                    }
                                />
                                Active
                            </label>
                        </div>
                    </article>
                ))}
            </div>
        </form>
    );
}

function ThresholdInput({
    id,
    label,
    onChange,
    value,
}: {
    id: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor={id}>
                {label}
            </label>
            <Input
                id={id}
                min="0.01"
                onChange={(event) => onChange(event.target.value)}
                step="0.1"
                type="number"
                value={value}
            />
        </div>
    );
}

function topicDraft(topic: CompetenceTopicDefinition): CompetenceTopicDraft {
    return {
        auraThreshold: String(topic.auraThreshold),
        description: topic.description ?? '',
        emittanceThreshold: String(topic.emittanceThreshold),
        growthThreshold: String(topic.growthThreshold),
        isActive: topic.isActive,
        name: topic.name,
        slug: topic.slug,
    };
}

function topicDrafts(
    topics: CompetenceTopicDefinition[],
): CompetenceTopicDraft[] {
    return topics.length > 0
        ? topics.map(topicDraft)
        : [emptyCompetenceTopic()];
}

function draftSnapshot(drafts: CompetenceTopicDraft[]): string {
    return JSON.stringify(drafts);
}

function emptyCompetenceTopic(): CompetenceTopicDraft {
    return {
        auraThreshold: '10',
        description: '',
        emittanceThreshold: '20',
        growthThreshold: '20',
        isActive: true,
        name: '',
        slug: '',
    };
}

function SectionStats({
    metrics,
    section,
    topics,
    t,
}: {
    metrics: AdminPanelMetrics;
    section: AdminPanelSection;
    topics: CompetenceTopicDefinition[];
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const activeTopics = topics.filter((topic) => topic.isActive).length;
    const metricItems = {
        'competence-topics': [
            {
                label: t(
                    'settings.admin_panel.metrics.configured_topics',
                    'Configured topics',
                ),
                value: topics.length,
            },
            {
                label: t(
                    'settings.admin_panel.metrics.active_topics',
                    'Active topics',
                ),
                value: activeTopics,
            },
        ],
        'feedback-requests': [
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
                label: t(
                    'settings.admin_panel.metrics.journal_pages',
                    'Journal pages',
                ),
                value: metrics.journalPages,
            },
        ],
        'organization-icons': [
            {
                label: t(
                    'settings.admin_panel.metrics.icon_reports',
                    'Icon reports',
                ),
                value: metrics.pendingOrganizationIconReports,
            },
        ],
    } satisfies Record<AdminPanelSection, { label: string; value: number }[]>;

    return (
        <section className="grid max-w-4xl gap-5 border-b border-[var(--settings-border-color)] pb-4 sm:grid-cols-2 xl:grid-cols-3">
            {metricItems[section].map((metric) => (
                <SectionStatItem
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                />
            ))}
        </section>
    );
}

function SectionStatItem({ label, value }: { label: string; value: number }) {
    return (
        <div className="border-l border-[var(--settings-accent-color)] pl-4">
            <p className="text-2xl font-semibold text-[var(--settings-primary-text)]">
                {value}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
                {label}
            </p>
        </div>
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
    const hasLimitChanges = useDirtyState(
        limit,
        String(settings.maxMembershipsPerUser),
    );

    function saveLimit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!hasLimitChanges) {
            return;
        }

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
                <Button disabled={!hasLimitChanges} type="submit">
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
