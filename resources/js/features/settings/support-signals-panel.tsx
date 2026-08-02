import { HeartHandshake, Signal, Sparkles, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    SettingsItemPanelHeader,
    SettingsSectionWorkspace,
    type SettingsNavigationItem,
} from '@/components/settings-configuration-shell';
import { cn } from '@/lib/utils';

export type SupportSignalsSettings = {
    activityOverview30Days: {
        activeLearners: number;
        date: string;
        pointsAwarded: number;
        topicAwards: number;
    }[];
    learners: SupportLearner[];
    monthKey: string;
    summary: {
        learners: number;
        learnersWithSignals: number;
        topicsWithMonthlyActivity: number;
    };
};

type SupportLearner = {
    email: string;
    groups: {
        id: number;
        name: string;
        studyTopic: string | null;
    }[];
    id: number;
    lastActivityAt: string | null;
    name: string;
    signals: {
        text: string;
        tone: 'attention' | 'quiet' | 'support' | string;
    }[];
    topics: {
        monthlyPoints: number;
        name: string;
        slug: string;
        totalPoints: number;
    }[];
    username: string | null;
};

type Props = {
    sectionItem: SettingsNavigationItem<string>;
    settings: SupportSignalsSettings;
};

type SupportSignalsView = 'collective' | 'individual';

const supportSignalSections = [
    {
        description: 'See anonymous activity across the visible learner scope.',
        icon: Users,
        key: 'collective',
        label: 'Collective Overview',
    },
    {
        description: 'Review learner-specific counters as support prompts.',
        icon: HeartHandshake,
        key: 'individual',
        label: 'Individual Support',
    },
] satisfies SettingsNavigationItem<SupportSignalsView>[];

const supportSignalDescriptions = {
    collective:
        'Anonymous 30-day activity signals show whether the learning space is alive without exposing daily learner histories.',
    individual:
        'Use learner-specific counters as conversation starters for support. They are not rankings and should not be used to compare learners.',
} satisfies Record<SupportSignalsView, string>;

const defaultSupportSignalsView: SupportSignalsView = 'collective';

function readSupportSignalsViewFromUrl(): SupportSignalsView {
    if (typeof window === 'undefined') {
        return defaultSupportSignalsView;
    }

    const value = new URL(window.location.href).searchParams.get('signals');

    return value === 'collective' || value === 'individual'
        ? value
        : defaultSupportSignalsView;
}

function writeSupportSignalsViewToUrl(view: SupportSignalsView): void {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('panel', 'admin-learning-support');
    url.searchParams.set('support', 'support-signals');
    url.searchParams.set('signals', view);
    window.history.pushState({ supportSignalsView: view }, '', url);
}

export function SupportSignalsPanel({ sectionItem, settings }: Props) {
    const [activeView, setActiveView] = useState<SupportSignalsView>(() =>
        readSupportSignalsViewFromUrl(),
    );
    const [selectedLearnerId, setSelectedLearnerId] = useState<number | null>(
        () => settings.learners[0]?.id ?? null,
    );
    const selectedLearner = useMemo(
        () =>
            settings.learners.find(
                (learner) => learner.id === selectedLearnerId,
            ) ??
            settings.learners[0] ??
            null,
        [selectedLearnerId, settings.learners],
    );

    useEffect(() => {
        if (
            selectedLearnerId !== null &&
            settings.learners.some(
                (learner) => learner.id === selectedLearnerId,
            )
        ) {
            return;
        }

        setSelectedLearnerId(settings.learners[0]?.id ?? null);
    }, [selectedLearnerId, settings.learners]);

    const activeSection =
        supportSignalSections.find((section) => section.key === activeView) ??
        supportSignalSections[0];

    function selectView(view: SupportSignalsView) {
        setActiveView(view);
        writeSupportSignalsViewToUrl(view);
    }

    return (
        <SettingsSectionWorkspace
            activeItem={activeSection}
            ariaLabel="Support signals sections"
            bannerClassName="!bg-[var(--settings-sidebar-background)]"
            bannerItem={sectionItem}
            items={supportSignalSections}
            onChange={selectView}
        >
            <div className="grid gap-5">
                <SettingsItemPanelHeader
                    description={supportSignalDescriptions[activeView]}
                    item={activeSection}
                    title={activeSection.label}
                />

                {activeView === 'individual' ? (
                    <IndividualSupportView
                        monthKey={settings.monthKey}
                        onSelectLearner={setSelectedLearnerId}
                        selectedLearner={selectedLearner}
                        settings={settings}
                    />
                ) : null}

                {activeView === 'collective' ? (
                    <CollectiveOverviewView settings={settings} />
                ) : null}
            </div>
        </SettingsSectionWorkspace>
    );
}

function IndividualSupportView({
    monthKey,
    onSelectLearner,
    selectedLearner,
    settings,
}: {
    monthKey: string;
    onSelectLearner: (id: number) => void;
    selectedLearner: SupportLearner | null;
    settings: SupportSignalsSettings;
}) {
    return (
        <>
            <SupportSummary settings={settings} />
            {settings.learners.length > 0 ? (
                <div className="grid min-h-[28rem] overflow-hidden border-t border-[var(--settings-border-color)] lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <LearnerList
                        learners={settings.learners}
                        onSelect={onSelectLearner}
                        selectedLearnerId={selectedLearner?.id ?? null}
                    />
                    <LearnerDetails
                        learner={selectedLearner}
                        monthKey={monthKey}
                    />
                </div>
            ) : (
                <EmptySupportSignals />
            )}
        </>
    );
}

function CollectiveOverviewView({
    settings,
}: {
    settings: SupportSignalsSettings;
}) {
    return (
        <>
            <CollectiveSummary settings={settings} />
            <ActivityOverview buckets={settings.activityOverview30Days} />
        </>
    );
}

function SupportSummary({ settings }: { settings: SupportSignalsSettings }) {
    const items = [
        {
            label: 'Scoped learners',
            value: settings.summary.learners,
        },
        {
            label: 'Learners with signals',
            value: settings.summary.learnersWithSignals,
        },
        {
            label: 'Monthly topic signals',
            value: settings.summary.topicsWithMonthlyActivity,
        },
    ];

    return (
        <section className="grid max-w-4xl gap-5 border-b border-[var(--settings-border-color)] pb-4 sm:grid-cols-3">
            {items.map((item) => (
                <div
                    className="border-l border-[var(--settings-accent-color)] pl-4"
                    key={item.label}
                >
                    <p className="text-2xl font-semibold text-[var(--settings-primary-text)]">
                        {item.value}
                    </p>
                    <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
                        {item.label}
                    </p>
                </div>
            ))}
        </section>
    );
}

function CollectiveSummary({ settings }: { settings: SupportSignalsSettings }) {
    const activeDays = settings.activityOverview30Days.filter(
        (bucket) => bucket.activeLearners > 0,
    ).length;
    const activeLearners = Math.max(
        0,
        ...settings.activityOverview30Days.map(
            (bucket) => bucket.activeLearners,
        ),
    );
    const topicSignals = settings.activityOverview30Days.reduce(
        (sum, bucket) => sum + bucket.topicAwards,
        0,
    );
    const items = [
        {
            label: 'Active days',
            value: activeDays,
        },
        {
            label: 'Learners per day max',
            value: activeLearners,
        },
        {
            label: 'Topic signals',
            value: topicSignals,
        },
    ];

    return (
        <section className="grid max-w-4xl gap-5 border-b border-[var(--settings-border-color)] pb-4 sm:grid-cols-3">
            {items.map((item) => (
                <div
                    className="border-l border-[var(--settings-accent-color)] pl-4"
                    key={item.label}
                >
                    <p className="text-2xl font-semibold text-[var(--settings-primary-text)]">
                        {item.value}
                    </p>
                    <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
                        {item.label}
                    </p>
                </div>
            ))}
        </section>
    );
}

function ActivityOverview({
    buckets,
}: {
    buckets: SupportSignalsSettings['activityOverview30Days'];
}) {
    const maxActiveLearners = Math.max(
        1,
        ...buckets.map((bucket) => bucket.activeLearners),
    );
    const chartWidth = 760;
    const chartHeight = 240;
    const chartMargin = {
        bottom: 44,
        left: 54,
        right: 18,
        top: 18,
    };
    const drawableWidth = chartWidth - chartMargin.left - chartMargin.right;
    const drawableHeight = chartHeight - chartMargin.top - chartMargin.bottom;
    const xAxisY = chartHeight - chartMargin.bottom;
    const yTickValues = createUserAxisTicks(maxActiveLearners);
    const xTickIndexes = createDateAxisTickIndexes(buckets.length);
    const chartPoints = buckets.map((bucket, index) => {
        const x =
            buckets.length <= 1
                ? chartMargin.left + drawableWidth / 2
                : chartMargin.left +
                  (index / (buckets.length - 1)) * drawableWidth;
        const normalizedHeight = bucket.activeLearners / maxActiveLearners;
        const y = chartMargin.top + (1 - normalizedHeight) * drawableHeight;

        return { bucket, x, y };
    });
    const linePath = chartPoints
        .map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
        )
        .join(' ');
    const areaPath =
        chartPoints.length > 0
            ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${xAxisY} L ${chartPoints[0].x} ${xAxisY} Z`
            : '';

    return (
        <section className="grid max-w-5xl gap-4 border-b border-[var(--settings-border-color)] pb-5">
            <div>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    Anonymous activity overview
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--settings-primary-text)]">
                    Last 30 days
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    This anonymized diagram shows the total number of scoped
                    learners with at least one competence signal per day. Names
                    are intentionally not shown in this overview.
                </p>
            </div>
            <div className="grid gap-2">
                <svg
                    aria-label="Anonymous active learners during the last 30 days"
                    className="h-64 w-full max-w-5xl overflow-visible"
                    role="img"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                >
                    <title>
                        Anonymous active learners during the last 30 days
                    </title>
                    {yTickValues.map((value) => {
                        const y =
                            chartMargin.top +
                            (1 - value / maxActiveLearners) * drawableHeight;

                        return (
                            <g key={value}>
                                <line
                                    className="stroke-[var(--settings-border-color)]"
                                    strokeDasharray="4 8"
                                    strokeWidth="1"
                                    x1={chartMargin.left}
                                    x2={chartWidth - chartMargin.right}
                                    y1={y}
                                    y2={y}
                                />
                                <text
                                    className="fill-[var(--settings-muted-text)] text-[10px]"
                                    dominantBaseline="middle"
                                    textAnchor="end"
                                    x={chartMargin.left - 10}
                                    y={y}
                                >
                                    {value}
                                </text>
                            </g>
                        );
                    })}
                    <line
                        className="stroke-[var(--settings-muted-text)]"
                        strokeWidth="1.5"
                        x1={chartMargin.left}
                        x2={chartMargin.left}
                        y1={chartMargin.top}
                        y2={xAxisY}
                    />
                    <line
                        className="stroke-[var(--settings-muted-text)]"
                        strokeWidth="1.5"
                        x1={chartMargin.left}
                        x2={chartWidth - chartMargin.right}
                        y1={xAxisY}
                        y2={xAxisY}
                    />
                    {areaPath ? (
                        <path
                            className="fill-[var(--settings-accent)] opacity-10"
                            d={areaPath}
                        />
                    ) : null}
                    {linePath ? (
                        <path
                            className="fill-none stroke-[var(--settings-accent)]"
                            d={linePath}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                        />
                    ) : null}
                    {xTickIndexes.map((index) => {
                        const point = chartPoints[index];

                        if (!point) {
                            return null;
                        }

                        return (
                            <g key={point.bucket.date}>
                                <line
                                    className="stroke-[var(--settings-muted-text)]"
                                    strokeWidth="1"
                                    x1={point.x}
                                    x2={point.x}
                                    y1={xAxisY}
                                    y2={xAxisY + 6}
                                />
                                <text
                                    className="fill-[var(--settings-muted-text)] text-[10px]"
                                    textAnchor="middle"
                                    x={point.x}
                                    y={xAxisY + 20}
                                >
                                    {formatDate(point.bucket.date)}
                                </text>
                            </g>
                        );
                    })}
                    {chartPoints.map(({ bucket, x, y }) => (
                        <g key={bucket.date}>
                            <circle
                                className={cn(
                                    'fill-[var(--settings-accent)]',
                                    bucket.activeLearners > 0
                                        ? 'opacity-90'
                                        : 'opacity-30',
                                )}
                                r={bucket.activeLearners > 0 ? 3.5 : 2.5}
                                cx={x}
                                cy={y}
                            />
                            <title>
                                {`${formatDate(bucket.date)}: ${bucket.activeLearners} active learners, ${bucket.topicAwards} topic signals`}
                            </title>
                        </g>
                    ))}
                    <text
                        className="fill-[var(--settings-muted-text)] text-[10px] font-medium tracking-[0.12em] uppercase"
                        textAnchor="middle"
                        transform={`rotate(-90 ${14} ${chartHeight / 2})`}
                        x={14}
                        y={chartHeight / 2}
                    >
                        Users per day
                    </text>
                    <text
                        className="fill-[var(--settings-muted-text)] text-[10px] font-medium tracking-[0.12em] uppercase"
                        textAnchor="middle"
                        x={chartMargin.left + drawableWidth / 2}
                        y={chartHeight - 6}
                    >
                        Time
                    </text>
                </svg>
            </div>
        </section>
    );
}

function LearnerList({
    learners,
    onSelect,
    selectedLearnerId,
}: {
    learners: SupportLearner[];
    onSelect: (id: number) => void;
    selectedLearnerId: number | null;
}) {
    return (
        <aside className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] py-3 lg:border-r lg:border-b-0 lg:pr-3">
            <div className="grid gap-2">
                {learners.map((learner) => (
                    <button
                        className={cn(
                            'relative grid gap-1 px-3 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                            selectedLearnerId === learner.id
                                ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]'
                                : 'text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]',
                        )}
                        key={learner.id}
                        onClick={() => onSelect(learner.id)}
                        type="button"
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--settings-accent)] transition-opacity',
                                selectedLearnerId === learner.id
                                    ? 'opacity-100'
                                    : 'opacity-0',
                            )}
                        />
                        <span className="font-medium text-[var(--settings-primary-text)]">
                            {learner.name}
                        </span>
                        <span className="text-xs leading-5">
                            {learner.groups.length > 0
                                ? learner.groups
                                      .map((group) => group.name)
                                      .join(', ')
                                : 'No group assigned'}
                        </span>
                    </button>
                ))}
            </div>
        </aside>
    );
}

function LearnerDetails({
    learner,
    monthKey,
}: {
    learner: SupportLearner | null;
    monthKey: string;
}) {
    if (!learner) {
        return <EmptySupportSignals />;
    }

    return (
        <section className="min-h-0 overflow-y-auto py-5 lg:pl-5">
            <div className="grid max-w-5xl gap-6">
                <header className="border-b border-[var(--settings-border-color)] pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                Learner support
                            </p>
                            <h3 className="mt-2 text-2xl font-semibold text-[var(--settings-primary-text)]">
                                {learner.name}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--settings-muted-text)]">
                                {learner.username ?? learner.email}
                            </p>
                        </div>
                        <div className="text-right text-sm text-[var(--settings-muted-text)]">
                            <p className="font-medium text-[var(--settings-primary-text)]">
                                Last activity
                            </p>
                            <p>{formatDateTime(learner.lastActivityAt)}</p>
                            <p className="mt-2 font-medium text-[var(--settings-primary-text)]">
                                Current month
                            </p>
                            <p>{monthKey}</p>
                        </div>
                    </div>
                    {learner.groups.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {learner.groups.map((group) => (
                                <span
                                    className="border border-[var(--settings-border-color)] px-2.5 py-1 text-xs text-[var(--settings-muted-text)]"
                                    key={group.id}
                                >
                                    {group.studyTopic
                                        ? `${group.name}: ${group.studyTopic}`
                                        : group.name}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </header>

                <SupportNotes signals={learner.signals} />
                <TopicSignals topics={learner.topics} />
            </div>
        </section>
    );
}

function SupportNotes({ signals }: { signals: SupportLearner['signals'] }) {
    return (
        <section className="grid gap-3 border-b border-[var(--settings-border-color)] pb-5">
            <div className="flex items-center gap-2 text-[var(--settings-accent)]">
                <Signal className="size-4" />
                <h4 className="font-semibold text-[var(--settings-primary-text)]">
                    Support prompts
                </h4>
            </div>
            <div className="grid gap-2">
                {signals.map((signal, index) => (
                    <p
                        className={cn(
                            'border-l px-3 py-2 text-sm leading-6',
                            signal.tone === 'attention'
                                ? 'border-amber-400 text-amber-200'
                                : 'border-[var(--settings-accent-color)] text-[var(--settings-muted-text)]',
                        )}
                        key={`${signal.text}-${index}`}
                    >
                        {signal.text}
                    </p>
                ))}
            </div>
        </section>
    );
}

function TopicSignals({ topics }: { topics: SupportLearner['topics'] }) {
    if (topics.length === 0) {
        return (
            <section className="grid gap-2 py-4 text-sm text-[var(--settings-muted-text)]">
                <Sparkles className="size-5 text-[var(--settings-accent)]" />
                <p>
                    No topic counters are available yet. The useful next step is
                    to help the learner find an activity that fits their current
                    path.
                </p>
            </section>
        );
    }

    return (
        <section className="grid gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-4 border-b border-[var(--settings-border-color)] pb-2 text-xs font-semibold tracking-[0.16em] text-[var(--settings-muted-text)] uppercase">
                <span>Topic</span>
                <span className="text-right">Total</span>
                <span className="text-right">This month</span>
            </div>
            {topics.map((topic) => (
                <div
                    className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-4 border-b border-[var(--settings-border-color)] py-3 text-sm"
                    key={topic.slug}
                >
                    <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--settings-primary-text)]">
                            {topic.name}
                        </p>
                        <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                            {topic.slug}
                        </p>
                    </div>
                    <p className="text-right font-medium text-[var(--settings-primary-text)]">
                        {formatPoints(topic.totalPoints)}
                    </p>
                    <p className="text-right font-medium text-[var(--settings-accent)]">
                        {formatPoints(topic.monthlyPoints)}
                    </p>
                </div>
            ))}
        </section>
    );
}

function EmptySupportSignals() {
    return (
        <section className="grid min-h-[18rem] place-items-center border-t border-[var(--settings-border-color)] p-6 text-center">
            <div className="max-w-md">
                <Users className="mx-auto size-6 text-[var(--settings-accent)]" />
                <h3 className="mt-3 font-semibold text-[var(--settings-primary-text)]">
                    No support signals yet
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                    Competence counters appear here after learners complete
                    activities with configured topics.
                </p>
            </div>
        </section>
    );
}

function createUserAxisTicks(maxValue: number): number[] {
    if (maxValue <= 1) {
        return [0, 1];
    }

    const step = Math.max(1, Math.ceil(maxValue / 4));
    const ticks = new Set<number>();

    for (let value = 0; value <= maxValue; value += step) {
        ticks.add(value);
    }

    ticks.add(maxValue);

    return [...ticks].sort((left, right) => left - right);
}

function createDateAxisTickIndexes(length: number): number[] {
    if (length <= 0) {
        return [];
    }

    if (length <= 7) {
        return Array.from({ length }, (_, index) => index);
    }

    const lastIndex = length - 1;
    const step = Math.max(1, Math.round(lastIndex / 4));
    const indexes = new Set<number>();

    for (let index = 0; index <= lastIndex; index += step) {
        indexes.add(index);
    }

    indexes.add(lastIndex);

    return [...indexes].sort((left, right) => left - right);
}

function formatPoints(value: number): string {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
    }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return 'No activity yet';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
