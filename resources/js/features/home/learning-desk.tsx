import { Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bookmark,
    BookOpenText,
    Clock3,
    Compass,
    Focus,
    MessageCircle,
    Pin,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LearnerDocumentSurface } from '@/components/learner-document-surface';
import { LearnerPaginatedItems } from '@/components/learner-paginated-items';
import { competenceTopicHref } from '@/features/competence/competence-links';
import { updateRevisitInvitation } from '@/features/journal/journal-client';
import {
    postponeRecallQuestion,
    removeRecallQuestion,
} from '@/features/learning/recall-items';
import {
    learningCheckInDirectionLabel,
    learningIntentLabel,
} from '@/features/world/activity-utils';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { LearningDeskSearch } from './learning-desk-search';
import type {
    LearningDeskBookmark,
    LearningDeskCheckIn,
    LearningDeskData,
    LearningDeskRevisitInvitation,
    LearningDeskRecallItem,
    LearningDeskRoute,
    LearningDeskSupportResponse,
} from './types';

type LearningDeskArea =
    | 'connections'
    | 'reflections'
    | 'recall'
    | 'revisit'
    | 'recent'
    | 'support'
    | 'continue';

type DeskTimeBudget = 'any' | 15 | 30;

type DeskLearningPurpose =
    | 'apply'
    | 'explain'
    | 'participate'
    | 'reflect'
    | 'retrieve'
    | 'review'
    | 'transfer';

type DeskPurposeFilter = 'any' | DeskLearningPurpose;

const DESK_LEARNING_PURPOSES: DeskLearningPurpose[] = [
    'apply',
    'explain',
    'participate',
    'reflect',
    'retrieve',
    'review',
    'transfer',
];

export function LearningDesk({ desk }: { desk: LearningDeskData }) {
    const { auth, localization } = usePage().props;
    const t = usePlatformTranslation();
    const firstName = auth.user?.name.trim().split(/\s+/)[0] ?? '';
    const [focusView, setFocusView] = useState(false);
    const [timeBudget, setTimeBudget] = useState<DeskTimeBudget>('any');
    const [purposeFilter, setPurposeFilter] =
        useState<DeskPurposeFilter>('any');
    const [handledRevisitIds, setHandledRevisitIds] = useState<number[]>([]);
    const [updatingRevisitId, setUpdatingRevisitId] = useState<number | null>(
        null,
    );
    const [revisitError, setRevisitError] = useState(false);
    const [removedRecallQuestionIds, setRemovedRecallQuestionIds] = useState<
        number[]
    >([]);
    const [recallError, setRecallError] = useState(false);
    const [removingRecallQuestionId, setRemovingRecallQuestionId] = useState<
        number | null
    >(null);
    const [postponingRecallQuestionId, setPostponingRecallQuestionId] =
        useState<number | null>(null);
    const [postponedRecallDates, setPostponedRecallDates] = useState<
        Record<number, string>
    >({});
    const recallItems = desk.recallItems
        .filter((item) => !removedRecallQuestionIds.includes(item.questionId))
        .map((item) => {
            const nextReviewAt = postponedRecallDates[item.questionId];

            return nextReviewAt
                ? { ...item, isDue: false, nextReviewAt }
                : item;
        });
    const revisitInvitations = desk.revisitInvitations.filter(
        (invitation) => !handledRevisitIds.includes(invitation.activityId),
    );
    const areaLabels: Record<LearningDeskArea, string> = {
        connections: t(
            'home.learning_desk.sections.connections',
            'Connections',
        ),
        continue: t(
            'home.learning_desk.sections.continue',
            'Continue learning',
        ),
        recent: t('home.learning_desk.sections.recent', 'Recent traces'),
        recall: t('home.learning_desk.sections.recall', 'Recall queue'),
        reflections: t(
            'home.learning_desk.sections.reflections',
            'Recent reflections',
        ),
        revisit: t('home.learning_desk.sections.revisit', 'Return when useful'),
        support: t('home.learning_desk.sections.support', 'Learning Support'),
    };
    const availableAreas: LearningDeskArea[] = [
        'connections',
        ...(desk.checkIns.length > 0 ? (['reflections'] as const) : []),
        ...(recallItems.length > 0 ? (['recall'] as const) : []),
        ...(revisitInvitations.length > 0 ? (['revisit'] as const) : []),
        ...(desk.recentRoutes.length > 0 ? (['recent'] as const) : []),
        ...(desk.supportResponses.length > 0 ? (['support'] as const) : []),
        'continue',
    ];
    const defaultArea =
        desk.connections.length > 0
            ? 'connections'
            : desk.currentRoutes.length > 0
              ? 'continue'
              : (availableAreas.find(
                    (area) => area !== 'connections' && area !== 'continue',
                ) ?? 'connections');
    const deskAreas = availableAreas.map((id) => ({
        id,
        label: areaLabels[id],
    }));
    const initialArea = deskAreaFromUrl() ?? defaultArea;
    const [activeArea, setActiveArea] = useState<LearningDeskArea>(initialArea);
    const timeBudgetOptions: { label: string; value: DeskTimeBudget }[] = [
        {
            label: t('home.learning_desk.time_budget.any', 'Any time'),
            value: 'any',
        },
        {
            label: t(
                'home.learning_desk.time_budget.short',
                'Up to 15 minutes',
            ),
            value: 15,
        },
        {
            label: t(
                'home.learning_desk.time_budget.medium',
                'Up to 30 minutes',
            ),
            value: 30,
        },
    ];
    const learningPurposeOptions = DESK_LEARNING_PURPOSES.filter((purpose) =>
        desk.currentRoutes.some((route) => route.learningIntent === purpose),
    ).map((purpose) => ({
        label: learningIntentLabel(purpose, t) ?? purpose,
        value: purpose,
    }));
    const visibleCurrentRoutes = desk.currentRoutes.filter((route) =>
        fitsDeskFilters(
            route.timeGuideMinutes,
            route.learningIntent,
            timeBudget,
            purposeFilter,
        ),
    );
    const hasTimeGuides = desk.currentRoutes.some(
        (route) => route.timeGuideMinutes !== null,
    );
    const hasLearningPurposes = learningPurposeOptions.length > 0;
    const hasActiveRouteFilter =
        timeBudget !== 'any' || purposeFilter !== 'any';

    useEffect(() => {
        const handlePopState = () => {
            setActiveArea(deskAreaFromUrl() ?? defaultArea);
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [defaultArea]);

    function selectArea(area: LearningDeskArea) {
        setActiveArea(area);

        const url = new URL(window.location.href);

        if (area === 'connections') {
            url.searchParams.delete('area');
        } else {
            url.searchParams.set('area', area);
        }

        window.history.pushState(window.history.state, '', url);
    }

    const visibleArea = deskAreas.some((area) => area.id === activeArea)
        ? activeArea
        : (deskAreas[0]?.id ?? 'connections');

    async function handleRevisitUpdate(
        activityId: number,
        action: 'dismiss' | 'snooze',
    ) {
        if (updatingRevisitId !== null) {
            return;
        }

        setUpdatingRevisitId(activityId);
        setRevisitError(false);

        try {
            await updateRevisitInvitation(activityId, action);
            setHandledRevisitIds((current) => [...current, activityId]);
        } catch {
            setRevisitError(true);
        } finally {
            setUpdatingRevisitId(null);
        }
    }

    async function handleRecallRemoval(questionId: number) {
        if (
            removingRecallQuestionId !== null ||
            postponingRecallQuestionId !== null
        ) {
            return;
        }

        setRemovingRecallQuestionId(questionId);
        setRecallError(false);

        try {
            await removeRecallQuestion(questionId);
            setRemovedRecallQuestionIds((current) => [...current, questionId]);
        } catch {
            setRecallError(true);
        } finally {
            setRemovingRecallQuestionId(null);
        }
    }

    async function handleRecallPostpone(questionId: number) {
        if (
            removingRecallQuestionId !== null ||
            postponingRecallQuestionId !== null
        ) {
            return;
        }

        setPostponingRecallQuestionId(questionId);
        setRecallError(false);

        try {
            const response = await postponeRecallQuestion(questionId);
            setPostponedRecallDates((current) => ({
                ...current,
                [questionId]: response.nextReviewAt,
            }));
        } catch {
            setRecallError(true);
        } finally {
            setPostponingRecallQuestionId(null);
        }
    }

    return (
        <LearnerDocumentSurface scrollable={false}>
            <div
                className={[
                    'grid min-h-0 flex-1 overflow-y-auto lg:overflow-hidden',
                    focusView
                        ? 'lg:grid-cols-1'
                        : 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]',
                ].join(' ')}
            >
                <div className="min-w-0 px-5 py-10 sm:px-8 lg:min-h-0 lg:overflow-hidden lg:px-12 lg:py-14 xl:px-[clamp(3rem,7vw,8rem)]">
                    <div className="mx-auto flex max-w-4xl flex-col lg:h-full lg:min-h-0">
                        <section>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                                        {t(
                                            'home.learning_desk.eyebrow',
                                            'Your learning desk',
                                        )}
                                    </p>
                                    <h1 className="mt-3 text-3xl font-medium tracking-tight">
                                        {greeting(t)}, {firstName}.
                                    </h1>
                                    <p className="mt-2 text-sm text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.prompt',
                                            'What would you like to think about next?',
                                        )}
                                    </p>
                                </div>
                                <button
                                    aria-pressed={focusView}
                                    className={[
                                        'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none',
                                        focusView
                                            ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-heading-text)]'
                                            : 'border-[var(--learner-border-color)] text-[var(--learner-muted-text)] hover:border-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]',
                                    ].join(' ')}
                                    onClick={() =>
                                        setFocusView((current) => !current)
                                    }
                                    type="button"
                                >
                                    <Focus
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                    {focusView
                                        ? t(
                                              'home.learning_desk.focus.show_rail',
                                              'Show pinned',
                                          )
                                        : t(
                                              'home.learning_desk.focus.enter',
                                              'Focus view',
                                          )}
                                </button>
                            </div>
                            <LearningDeskSearch />
                        </section>

                        <nav
                            aria-label={t(
                                'home.learning_desk.sections.label',
                                'Learning desk areas',
                            )}
                            className="mt-8 shrink-0 border-y border-[var(--learner-border-color)] py-3"
                        >
                            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-muted-text)] uppercase">
                                {t(
                                    'home.learning_desk.sections.label',
                                    'Learning desk areas',
                                )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {deskAreas.map((area) => (
                                    <button
                                        aria-pressed={visibleArea === area.id}
                                        className={[
                                            'min-h-10 rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none',
                                            visibleArea === area.id
                                                ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-heading-text)]'
                                                : 'border-[var(--learner-border-color)] text-[var(--learner-muted-text)] hover:border-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]',
                                        ].join(' ')}
                                        key={area.id}
                                        onClick={() => selectArea(area.id)}
                                        type="button"
                                    >
                                        {area.label}
                                    </button>
                                ))}
                            </div>
                        </nav>

                        <div className="min-h-0 flex-1">
                            {visibleArea === 'connections' ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="connections-heading"
                                >
                                    <SectionHeading
                                        id="connections-heading"
                                        label={t(
                                            'home.learning_desk.connections.title',
                                            'Possible connections',
                                        )}
                                    />
                                    {desk.connections.length > 0 ? (
                                        <div className="border-b border-[var(--learner-border-color)] py-6">
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
                                                {desk.connections.map(
                                                    (connection, index) => (
                                                        <div
                                                            className="flex items-center gap-4"
                                                            key={connection.id}
                                                        >
                                                            {index > 0 ? (
                                                                <ArrowRight className="size-4 text-[var(--learner-action-accent)]" />
                                                            ) : null}
                                                            <Link
                                                                className="underline decoration-transparent underline-offset-4 transition hover:text-[var(--learner-accent)] hover:decoration-[var(--learner-accent)]"
                                                                href={
                                                                    connection.href
                                                                }
                                                            >
                                                                {
                                                                    connection.title
                                                                }
                                                            </Link>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--learner-muted-text)]">
                                                {t(
                                                    'home.learning_desk.connections.saved_reason',
                                                    'Drawn from places you saved for later. Tutor and AI suggestions can join this space as separate, clearly labelled sources.',
                                                )}
                                            </p>
                                        </div>
                                    ) : (
                                        <EmptyState
                                            body={t(
                                                'home.learning_desk.connections.empty_body',
                                                'Save interesting places and this area can reveal useful paths between them.',
                                            )}
                                            href="/world"
                                            link={t(
                                                'home.learning_desk.connections.empty_action',
                                                'Open the map',
                                            )}
                                            title={t(
                                                'home.learning_desk.connections.empty_title',
                                                'Connections need a little context',
                                            )}
                                        />
                                    )}
                                </section>
                            ) : null}

                            {visibleArea === 'reflections' &&
                            desk.checkIns.length > 0 ? (
                                <section
                                    aria-labelledby="reflections-heading"
                                    className="mt-4"
                                >
                                    <SectionHeading
                                        id="reflections-heading"
                                        label={t(
                                            'home.learning_desk.reflections.title',
                                            'Recent reflections',
                                        )}
                                    />
                                    <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-2 text-xs leading-5 text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.reflections.body',
                                            'A quiet trail of what you noticed and where you chose to go next. Open an activity whenever the thread feels useful again.',
                                        )}
                                    </p>
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={desk.checkIns}
                                        pageSize={1}
                                        paginationLabel={t(
                                            'home.learning_desk.reflections.pagination',
                                            'Recent reflections',
                                        )}
                                        paginationClassName="mt-2 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3"
                                        renderItem={(checkIn) => (
                                            <CheckInRow
                                                checkIn={checkIn}
                                                key={`${checkIn.activityId}:${checkIn.recordedAt}`}
                                                locale={localization.locale}
                                            />
                                        )}
                                    />
                                </section>
                            ) : null}

                            {visibleArea === 'support' &&
                            desk.supportResponses.length > 0 ? (
                                <section
                                    aria-labelledby="support-heading"
                                    className="mt-8"
                                >
                                    <SectionHeading
                                        id="support-heading"
                                        label={t(
                                            'home.learning_desk.support.title',
                                            'Learning Support replies',
                                        )}
                                    />
                                    <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.support.body',
                                            'Private replies to your support requests are kept here so you can return when the guidance is useful.',
                                        )}
                                    </p>
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={desk.supportResponses}
                                        pageSize={2}
                                        paginationLabel={t(
                                            'home.learning_desk.support.pagination',
                                            'Learning Support replies',
                                        )}
                                        renderItem={(response) => (
                                            <SupportResponseRow
                                                key={response.id}
                                                locale={localization.locale}
                                                response={response}
                                            />
                                        )}
                                    />
                                </section>
                            ) : null}

                            {visibleArea === 'revisit' &&
                            revisitInvitations.length > 0 ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="revisit-heading"
                                >
                                    <SectionHeading
                                        id="revisit-heading"
                                        label={t(
                                            'home.learning_desk.revisit.title',
                                            'Return when useful',
                                        )}
                                    />
                                    <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.revisit.body',
                                            'These are places you chose to return to after some time away.',
                                        )}
                                    </p>
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={revisitInvitations}
                                        pageSize={2}
                                        paginationLabel={t(
                                            'home.learning_desk.revisit.pagination',
                                            'Revisit invitations',
                                        )}
                                        renderItem={(invitation) => (
                                            <RevisitInvitationRow
                                                invitation={invitation}
                                                key={invitation.activityId}
                                                locale={localization.locale}
                                                onUpdate={handleRevisitUpdate}
                                                updating={
                                                    updatingRevisitId ===
                                                    invitation.activityId
                                                }
                                            />
                                        )}
                                    />
                                    {revisitError ? (
                                        <p
                                            aria-live="polite"
                                            className="mt-3 text-sm text-red-300"
                                            role="status"
                                        >
                                            {t(
                                                'home.learning_desk.revisit.error',
                                                'That choice could not be saved. Try again.',
                                            )}
                                        </p>
                                    ) : null}
                                </section>
                            ) : null}

                            {visibleArea === 'recall' &&
                            recallItems.length > 0 ? (
                                <section
                                    aria-labelledby="recall-heading"
                                    className="mt-8"
                                >
                                    <SectionHeading
                                        id="recall-heading"
                                        label={t(
                                            'home.learning_desk.recall.title',
                                            'Recall queue',
                                        )}
                                    />
                                    <p className="max-w-2xl border-b border-[var(--learner-border-color)] py-5 text-sm leading-6 text-[var(--learner-muted-text)]">
                                        {t(
                                            'home.learning_desk.recall.body',
                                            'Questions you chose to keep nearby for another look. There is no deadline; remove one whenever it no longer helps.',
                                        )}
                                    </p>
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={recallItems}
                                        pageSize={2}
                                        paginationLabel={t(
                                            'home.learning_desk.recall.pagination',
                                            'Recall questions',
                                        )}
                                        renderItem={(item) => (
                                            <RecallItemRow
                                                item={item}
                                                key={item.questionId}
                                                onRemove={handleRecallRemoval}
                                                onPostpone={
                                                    handleRecallPostpone
                                                }
                                                removing={
                                                    removingRecallQuestionId ===
                                                    item.questionId
                                                }
                                                postponing={
                                                    postponingRecallQuestionId ===
                                                    item.questionId
                                                }
                                            />
                                        )}
                                    />
                                    {recallError ? (
                                        <p
                                            aria-live="polite"
                                            className="mt-3 text-sm text-red-300"
                                            role="status"
                                        >
                                            {t(
                                                'home.learning_desk.recall.error',
                                                'That recall choice could not be updated. Try again.',
                                            )}
                                        </p>
                                    ) : null}
                                </section>
                            ) : null}

                            {visibleArea === 'recent' &&
                            desk.recentRoutes.length > 0 ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="recent-heading"
                                >
                                    <SectionHeading
                                        id="recent-heading"
                                        label={t(
                                            'home.learning_desk.recent.title',
                                            'Recent traces',
                                        )}
                                    />
                                    <LearnerPaginatedItems
                                        className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                        items={desk.recentRoutes}
                                        pageSize={2}
                                        paginationLabel="Recent traces"
                                        renderItem={(route) => (
                                            <RecentRouteRow
                                                key={route.id}
                                                locale={localization.locale}
                                                route={route}
                                            />
                                        )}
                                    />
                                </section>
                            ) : null}

                            {visibleArea === 'continue' ? (
                                <section
                                    className="mt-8"
                                    aria-labelledby="continue-heading"
                                >
                                    <SectionHeading
                                        id="continue-heading"
                                        label={t(
                                            'home.learning_desk.continue.title',
                                            'Continue learning',
                                        )}
                                    />
                                    {hasTimeGuides || hasLearningPurposes ? (
                                        <div className="mt-4 grid gap-4 border-b border-[var(--learner-border-color)] pb-4 md:grid-cols-[minmax(0,1.3fr)_minmax(14rem,0.7fr)]">
                                            {hasTimeGuides ? (
                                                <fieldset>
                                                    <legend className="text-xs font-medium text-[var(--learner-muted-text)]">
                                                        {t(
                                                            'home.learning_desk.time_budget.label',
                                                            'Plan by suggested time',
                                                        )}
                                                    </legend>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {timeBudgetOptions.map(
                                                            (option) => (
                                                                <button
                                                                    aria-pressed={
                                                                        timeBudget ===
                                                                        option.value
                                                                    }
                                                                    className={[
                                                                        'min-h-11 rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none',
                                                                        timeBudget ===
                                                                        option.value
                                                                            ? 'border-[var(--learner-action-accent)] bg-[color-mix(in_srgb,var(--learner-action-accent)_14%,transparent)] text-[var(--learner-heading-text)]'
                                                                            : 'border-[var(--learner-border-color)] text-[var(--learner-muted-text)] hover:border-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]',
                                                                    ].join(' ')}
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    onClick={() =>
                                                                        setTimeBudget(
                                                                            option.value,
                                                                        )
                                                                    }
                                                                    type="button"
                                                                >
                                                                    {
                                                                        option.label
                                                                    }
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                    <p className="mt-2 text-xs leading-5 text-[var(--learner-muted-text)]">
                                                        {t(
                                                            'home.learning_desk.time_budget.helper',
                                                            'This only narrows routes with an author-provided guide; it is not a deadline.',
                                                        )}
                                                    </p>
                                                </fieldset>
                                            ) : null}
                                            {hasLearningPurposes ? (
                                                <div>
                                                    <label
                                                        className="text-xs font-medium text-[var(--learner-muted-text)]"
                                                        htmlFor="learning-desk-purpose"
                                                    >
                                                        {t(
                                                            'home.learning_desk.purpose_filter.label',
                                                            'Explore by learning purpose',
                                                        )}
                                                    </label>
                                                    <select
                                                        className="mt-2 min-h-11 w-full rounded-md border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)] px-3 text-sm text-[var(--learner-heading-text)] focus:border-[var(--learner-action-accent)] focus:ring-2 focus:ring-[var(--learner-action-accent)] focus:outline-none"
                                                        aria-describedby="learning-desk-purpose-help"
                                                        id="learning-desk-purpose"
                                                        onChange={(event) =>
                                                            setPurposeFilter(
                                                                event.target
                                                                    .value as DeskPurposeFilter,
                                                            )
                                                        }
                                                        value={purposeFilter}
                                                    >
                                                        <option value="any">
                                                            {t(
                                                                'home.learning_desk.purpose_filter.any',
                                                                'Any purpose',
                                                            )}
                                                        </option>
                                                        {learningPurposeOptions.map(
                                                            (option) => (
                                                                <option
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {
                                                                        option.label
                                                                    }
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                    <p
                                                        className="mt-2 text-xs leading-5 text-[var(--learner-muted-text)]"
                                                        id="learning-desk-purpose-help"
                                                    >
                                                        {t(
                                                            'home.learning_desk.purpose_filter.helper',
                                                            'Choose the kind of learning encounter that feels useful now. This only changes the view.',
                                                        )}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    {visibleCurrentRoutes.length > 0 ? (
                                        <LearnerPaginatedItems
                                            className="divide-y divide-[var(--learner-border-color)] border-b border-[var(--learner-border-color)]"
                                            items={visibleCurrentRoutes}
                                            pageSize={2}
                                            paginationLabel="Current routes"
                                            renderItem={(route) => (
                                                <RouteRow
                                                    key={route.id}
                                                    locale={localization.locale}
                                                    route={route}
                                                    emphasized={
                                                        route.id ===
                                                        visibleCurrentRoutes[0]
                                                            ?.id
                                                    }
                                                />
                                            )}
                                        />
                                    ) : !hasActiveRouteFilter ? (
                                        <EmptyState
                                            body={t(
                                                'home.learning_desk.continue.empty_body',
                                                'Start a learning route and it will wait for you here.',
                                            )}
                                            href="/topics"
                                            link={t(
                                                'home.learning_desk.continue.empty_action',
                                                'Browse topics',
                                            )}
                                            title={t(
                                                'home.learning_desk.continue.empty_title',
                                                'Nothing is currently in progress',
                                            )}
                                        />
                                    ) : (
                                        <div className="border-b border-[var(--learner-border-color)] py-7">
                                            <p className="font-medium">
                                                {t(
                                                    'home.learning_desk.route_filter.empty_title',
                                                    'No current routes match these choices yet',
                                                )}
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-[var(--learner-muted-text)]">
                                                {t(
                                                    'home.learning_desk.route_filter.empty_body',
                                                    'Try another time or purpose, or show every current route again.',
                                                )}
                                            </p>
                                            <button
                                                className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                                                onClick={() =>
                                                    setTimeBudget('any')
                                                }
                                                type="button"
                                            >
                                                {t(
                                                    'home.learning_desk.time_budget.show_all',
                                                    'Show all routes',
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </section>
                            ) : null}
                        </div>
                    </div>
                </div>

                {!focusView ? <LearningDeskRail desk={desk} /> : null}
            </div>
        </LearnerDocumentSurface>
    );
}

function LearningDeskRail({ desk }: { desk: LearningDeskData }) {
    const t = usePlatformTranslation();
    const featured = desk.featuredBookmark;

    return (
        <aside className="border-t border-[var(--learner-border-color)] bg-[var(--learner-panel-muted-background)] px-5 py-9 sm:px-8 lg:h-full lg:border-t-0 lg:border-l lg:px-7">
            <p className="text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase">
                {t('home.learning_desk.rail.title', 'Pinned for later')}
            </p>

            {featured ? (
                <FeaturedBookmark bookmark={featured} />
            ) : (
                <div className="mt-7 border-y border-[var(--learner-border-color)] py-6">
                    <Pin className="size-5 text-[var(--learner-action-accent)]" />
                    <p className="mt-4 font-medium">
                        {t(
                            'home.learning_desk.rail.empty_title',
                            'Pin a place to your desk',
                        )}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--learner-muted-text)]">
                        {t(
                            'home.learning_desk.rail.empty_body',
                            'Your most recently visited bookmarked place will appear here.',
                        )}
                    </p>
                </div>
            )}

            <div className="mt-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-[var(--learner-action-accent)] uppercase">
                    {t('home.learning_desk.bookmarks.title', 'Saved places')}
                </p>
                <div className="mt-4 divide-y divide-[var(--learner-border-color)] border-y border-[var(--learner-border-color)]">
                    {desk.bookmarks.length > 0 ? (
                        desk.bookmarks.slice(0, 5).map((bookmark) => (
                            <Link
                                className="group flex items-start gap-3 py-4 text-sm"
                                href={bookmark.href}
                                key={bookmark.id}
                            >
                                <Bookmark className="mt-0.5 size-4 shrink-0 text-[var(--learner-action-accent)] transition group-hover:fill-current" />
                                <span>
                                    <span className="block font-medium text-[var(--learner-heading-text)] group-hover:text-[var(--learner-accent)]">
                                        {bookmark.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                                        {bookmark.mapTitle}
                                    </span>
                                    {bookmark.topic ? (
                                        <span className="mt-1 block text-xs text-[var(--learner-accent)]">
                                            {bookmark.topic.title}
                                        </span>
                                    ) : null}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="py-5 text-sm text-[var(--learner-muted-text)]">
                            {t(
                                'home.learning_desk.bookmarks.empty',
                                'No saved places yet.',
                            )}
                        </p>
                    )}
                </div>
                <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)]"
                    href="/bookmarks"
                >
                    {t(
                        'home.learning_desk.bookmarks.all',
                        'View all bookmarks',
                    )}
                    <ArrowRight className="size-4" />
                </Link>
            </div>
        </aside>
    );
}

function FeaturedBookmark({ bookmark }: { bookmark: LearningDeskBookmark }) {
    const t = usePlatformTranslation();

    return (
        <article className="mt-7 border-b border-[var(--learner-border-color)] pb-8">
            {bookmark.imageUrl ? (
                <div className="mb-5 flex h-28 items-center justify-center overflow-hidden bg-[var(--learner-panel-background)]">
                    <img
                        alt=""
                        className="h-full w-full object-contain"
                        src={bookmark.imageUrl}
                    />
                </div>
            ) : null}
            <p className="text-xs font-medium tracking-[0.16em] text-[var(--learner-accent)] uppercase">
                {t('home.learning_desk.rail.featured', 'Pinned place')}
            </p>
            <h2 className="mt-3 text-sm font-semibold">{bookmark.title}</h2>
            <p className="mt-1 text-xs text-[var(--learner-muted-text)]">
                {bookmark.mapTitle}
            </p>
            {bookmark.topic ? (
                <Link
                    className="mt-1 inline-flex text-xs text-[var(--learner-accent)] underline decoration-[color-mix(in_srgb,var(--learner-accent)_60%,transparent)] underline-offset-4 hover:text-[var(--learner-heading-text)]"
                    href={bookmark.topic.href}
                >
                    {bookmark.topic.title}
                </Link>
            ) : null}
            {bookmark.description ? (
                <p className="mt-4 line-clamp-5 text-sm leading-6 text-[var(--learner-body-text)]">
                    {bookmark.description}
                </p>
            ) : null}
            <Link
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)] hover:text-[var(--learner-heading-text)]"
                href={bookmark.href}
            >
                {t('home.learning_desk.rail.open', 'Open place')}
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function RouteRow({
    emphasized,
    locale,
    route,
}: {
    emphasized: boolean;
    locale: string;
    route: LearningDeskRoute;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group relative grid gap-4 py-6 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            {emphasized ? (
                <span className="absolute top-3 bottom-3 -left-4 w-0.5 bg-[var(--learner-accent)] sm:-left-6" />
            ) : null}
            <Link
                aria-label={route.routeLabel ?? route.nodeTitle}
                className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-accent)] transition hover:border-[color-mix(in_srgb,var(--learner-accent)_55%,var(--learner-border-color))]"
                href={route.href}
            >
                {route.imageUrl ? (
                    <img
                        alt=""
                        className="size-10 object-contain"
                        src={route.imageUrl}
                    />
                ) : (
                    <BookOpenText className="size-5" />
                )}
            </Link>
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                {route.learningIntent ? (
                    <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                        {learningIntentLabel(route.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.nodeHref}
                    >
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas route={route} />
                {route.currentActivityTitle ? (
                    <span className="mt-2 block truncate text-xs font-medium text-[var(--learner-action-accent)]">
                        {t('home.learning_desk.continue.next', 'Current step')}:{' '}
                        {route.currentActivityTitle}
                    </span>
                ) : null}
                {route.timeGuideMinutes ? (
                    <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                        {t(
                            'learning.activity.time_guide',
                            'Suggested time: :minutes minutes',
                            { minutes: route.timeGuideMinutes },
                        )}
                    </span>
                ) : null}
                <DeskReason reason={route.deskReason} />
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastEnteredAt ? (
                    <span className="hidden items-center gap-1.5 text-xs text-[var(--learner-muted-text)] xl:flex">
                        <Clock3 className="size-3.5" />
                        {formatDate(route.lastEnteredAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {t('common.continue', 'Continue')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </div>
    );
}

function RecentRouteRow({
    locale,
    route,
}: {
    locale: string;
    route: LearningDeskRoute;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center">
            <Link
                aria-label={route.routeLabel ?? route.nodeTitle}
                className="grid size-12 place-items-center border border-[var(--learner-border-color)] text-[var(--learner-action-accent)] hover:border-[color-mix(in_srgb,var(--learner-action-accent)_55%,var(--learner-border-color))]"
                href={route.href}
            >
                {route.imageUrl ? (
                    <img
                        alt=""
                        className="size-10 object-contain"
                        src={route.imageUrl}
                    />
                ) : (
                    <Clock3 className="size-5" />
                )}
            </Link>
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={route.href}
                >
                    {route.routeLabel ?? route.nodeTitle}
                </Link>
                {route.learningIntent ? (
                    <span className="mt-1 block text-xs font-medium text-[var(--learner-action-accent)]">
                        {learningIntentLabel(route.learningIntent, t)}
                    </span>
                ) : null}
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.nodeHref}
                    >
                        {route.nodeTitle}
                    </Link>{' '}
                    ·{' '}
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={route.mapHref}
                    >
                        {route.mapTitle}
                    </Link>
                </span>
                {route.topic ? (
                    <Link
                        className="mt-2 inline-block truncate text-xs font-medium text-[var(--learner-accent)] hover:underline"
                        href={route.topic.href}
                    >
                        {route.topic.title}
                    </Link>
                ) : null}
                <RouteLearningAreas route={route} />
                <DeskReason reason={route.deskReason} />
            </span>
            <span className="flex items-center gap-4 sm:justify-end">
                {route.lastCompletedAt ? (
                    <span className="hidden text-xs text-[var(--learner-muted-text)] xl:inline">
                        {formatDate(route.lastCompletedAt, locale)}
                    </span>
                ) : null}
                <Link
                    className="inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)]"
                    href={route.href}
                >
                    {t('home.learning_desk.recent.action', 'Revisit')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </span>
        </div>
    );
}

function SupportResponseRow({
    locale,
    response,
}: {
    locale: string;
    response: LearningDeskSupportResponse;
}) {
    const t = usePlatformTranslation();

    return (
        <article className="grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start">
            <MessageCircle
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-[var(--learner-heading-text)]">
                        {t(
                            'home.learning_desk.support.reply_label',
                            'Private reply from Learning Support',
                        )}
                    </span>
                    {response.createdAt ? (
                        <time
                            className="text-xs text-[var(--learner-muted-text)]"
                            dateTime={response.createdAt}
                        >
                            {formatDate(response.createdAt, locale)}
                        </time>
                    ) : null}
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--learner-body-text)]">
                    {response.body}
                </p>
                <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                    {response.topicTitle} · {response.mapTitle}
                </p>
            </div>
            <Link
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] sm:justify-self-end"
                href={response.nodeHref}
            >
                {t('home.learning_desk.support.open', 'Return to place')}
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function CheckInRow({
    checkIn,
    locale,
}: {
    checkIn: LearningDeskCheckIn;
    locale: string;
}) {
    const t = usePlatformTranslation();
    const feelingLabel =
        {
            clearer: t(
                'home.learning_desk.reflections.feeling_clearer',
                'Something clicked',
            ),
            forming: t(
                'home.learning_desk.reflections.feeling_forming',
                'Still taking shape',
            ),
            stretched: t(
                'home.learning_desk.reflections.feeling_stretched',
                'It stretched me',
            ),
            stuck: t(
                'home.learning_desk.reflections.feeling_stuck',
                'I got stuck',
            ),
        }[checkIn.feeling ?? ''] ??
        t('home.learning_desk.reflections.feeling_default', 'A reflection');
    const directionLabel = learningCheckInDirectionLabel(checkIn.nextDirection);

    return (
        <article className="grid gap-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-start">
            <BookOpenText
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-medium text-[var(--learner-heading-text)]">
                        {feelingLabel}
                    </span>
                    <time
                        className="text-xs text-[var(--learner-muted-text)]"
                        dateTime={checkIn.recordedAt}
                    >
                        {formatDate(checkIn.recordedAt, locale)}
                    </time>
                </div>
                <Link
                    className="mt-1 block truncate text-sm text-[var(--learner-action-accent)] hover:text-[var(--learner-heading-text)] hover:underline"
                    href={checkIn.activityHref}
                >
                    {checkIn.activityTitle} · {checkIn.nodeTitle}
                </Link>
                {checkIn.note ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--learner-body-text)]">
                        {checkIn.note}
                    </p>
                ) : null}
                {directionLabel ? (
                    <p className="mt-2 text-xs text-[var(--learner-muted-text)]">
                        {t(
                            'home.learning_desk.reflections.next_direction',
                            'Next direction:',
                        )}{' '}
                        <span className="text-[var(--learner-action-accent)]">
                            {directionLabel}
                        </span>
                    </p>
                ) : null}
                {checkIn.nextDirection === 'related' &&
                checkIn.topics.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="text-[var(--learner-muted-text)]">
                            {t(
                                'home.learning_desk.reflections.related',
                                'Explore a connected learning area:',
                            )}
                        </span>
                        {checkIn.topics.map((topic) => (
                            <Link
                                className="underline decoration-[var(--learner-border-color)] underline-offset-2 hover:text-[var(--learner-heading-text)]"
                                href={competenceTopicHref(
                                    topic.slug,
                                    checkIn.originTopicSlug,
                                )}
                                key={topic.slug}
                            >
                                {topic.name}
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>
            <Link
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)] sm:justify-self-end"
                href={checkIn.activityHref}
            >
                {t('home.learning_desk.reflections.open', 'Open activity')}
                <ArrowRight className="size-4" />
            </Link>
        </article>
    );
}

function RevisitInvitationRow({
    invitation,
    locale,
    onUpdate,
    updating,
}: {
    invitation: LearningDeskRevisitInvitation;
    locale: string;
    onUpdate: (
        activityId: number,
        action: 'dismiss' | 'snooze',
    ) => Promise<void>;
    updating: boolean;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <Clock3
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <span className="min-w-0">
                <Link
                    className="block truncate text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={invitation.activityHref}
                >
                    {invitation.activityTitle}
                </Link>
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    <Link
                        className="hover:text-[var(--learner-action-accent)] hover:underline"
                        href={invitation.nodeHref}
                    >
                        {invitation.nodeTitle}
                    </Link>{' '}
                    · {invitation.mapTitle}
                </span>
                <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
                    {t(
                        'home.learning_desk.revisit.chosen',
                        'You chose to return on',
                    )}{' '}
                    {formatDate(invitation.availableSince, locale)}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                    {t('home.learning_desk.revisit.ready', 'Ready since')}{' '}
                    {formatDate(invitation.availableAt, locale)}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                    {invitation.revisitReason === 'later'
                        ? t(
                              'home.learning_desk.revisit.snoozed',
                              'You chose to wait longer before returning.',
                          )
                        : t(
                              'home.learning_desk.revisit.due',
                              'Ready after :days days away.',
                              { days: invitation.availableAfterDays },
                          )}
                </span>
                <DeskReason reason={invitation.deskReason} />
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Link
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={invitation.activityHref}
                >
                    {t('home.learning_desk.revisit.action', 'Open activity')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-action-accent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() =>
                        void onUpdate(invitation.activityId, 'snooze')
                    }
                    type="button"
                >
                    {t('home.learning_desk.revisit.later', 'Later')}
                </button>
                <button
                    className="inline-flex min-h-11 items-center px-2 text-sm text-[var(--learner-muted-text)] underline-offset-2 transition hover:text-[var(--learner-heading-text)] hover:underline disabled:pointer-events-none disabled:opacity-50"
                    disabled={updating}
                    onClick={() =>
                        void onUpdate(invitation.activityId, 'dismiss')
                    }
                    type="button"
                >
                    {t('home.learning_desk.revisit.hide', 'Hide')}
                </button>
            </span>
        </div>
    );
}

function RecallItemRow({
    item,
    onRemove,
    onPostpone,
    removing,
    postponing,
}: {
    item: LearningDeskRecallItem;
    onRemove: (questionId: number) => Promise<void>;
    onPostpone: (questionId: number) => Promise<void>;
    removing: boolean;
    postponing: boolean;
}) {
    const t = usePlatformTranslation();
    const confidenceLabel = item.lastConfidence
        ? t(
              `home.learning_desk.recall.confidence_${item.lastConfidence}`,
              item.lastConfidence,
          )
        : null;
    const confidenceAfterFeedbackLabel = item.lastConfidenceAfterFeedback
        ? t(
              `home.learning_desk.recall.confidence_${item.lastConfidenceAfterFeedback}`,
              item.lastConfidenceAfterFeedback,
          )
        : null;

    return (
        <div className="group grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
            <Bookmark
                aria-hidden="true"
                className="size-5 text-[var(--learner-action-accent)]"
            />
            <span className="min-w-0">
                <Link
                    className="block text-sm font-medium hover:text-[var(--learner-accent)]"
                    href={item.activityHref}
                >
                    {item.prompt}
                </Link>
                <span className="mt-1 block truncate text-sm text-[var(--learner-muted-text)]">
                    {item.activityTitle} · {item.nodeTitle} · {item.mapTitle}
                </span>
                <span className="mt-1 block text-xs text-[var(--learner-action-accent)]">
                    {item.isDue
                        ? t(
                              'home.learning_desk.recall.ready',
                              'Ready to recall',
                          )
                        : t(
                              'home.learning_desk.recall.next',
                              'Next recall: :date',
                              {
                                  date: formatRecallDate(item.nextReviewAt),
                              },
                          )}
                    {item.reviewCount > 0
                        ? ` · ${t(
                              'home.learning_desk.recall.review_count',
                              'Recalled :count times',
                              { count: item.reviewCount },
                          )}`
                        : ''}
                </span>
                {item.lastOutcome ||
                item.lastConfidence ||
                item.lastConfidenceAfterFeedback ? (
                    <span className="mt-1 block text-xs text-[var(--learner-muted-text)]">
                        {item.lastOutcome
                            ? t(
                                  item.lastOutcome === 'correct'
                                      ? 'home.learning_desk.recall.last_result_correct'
                                      : 'home.learning_desk.recall.last_result_incorrect',
                                  item.lastOutcome === 'correct'
                                      ? 'Last result: correct'
                                      : 'Last result: not correct',
                              )
                            : null}
                        {item.lastConfidence
                            ? ` · ${t(
                                  'home.learning_desk.recall.last_confidence',
                                  'Confidence: :confidence',
                                  {
                                      confidence:
                                          confidenceLabel ??
                                          item.lastConfidence,
                                  },
                              )}`
                            : null}
                        {item.lastConfidenceAfterFeedback
                            ? ` · ${t(
                                  'home.learning_desk.recall.last_confidence_after_feedback',
                                  'After feedback: :confidence',
                                  {
                                      confidence:
                                          confidenceAfterFeedbackLabel ??
                                          item.lastConfidenceAfterFeedback,
                                  },
                              )}`
                            : null}
                    </span>
                ) : null}
                <DeskReason reason={item.deskReason} />
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Link
                    className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-[var(--learner-accent)]"
                    href={item.activityHref}
                >
                    {t('home.learning_desk.recall.open', 'Open question')}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                    aria-busy={postponing}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={removing || postponing}
                    onClick={() => void onPostpone(item.questionId)}
                    type="button"
                >
                    <Clock3 aria-hidden="true" className="size-4" />
                    {postponing
                        ? t(
                              'home.learning_desk.recall.postpone_busy',
                              'Deferring...',
                          )
                        : t(
                              'home.learning_desk.recall.postpone',
                              'Defer one day',
                          )}
                </button>
                <button
                    aria-label={t(
                        'home.learning_desk.recall.remove_label',
                        'Remove question from recall queue',
                    )}
                    className="inline-flex size-11 items-center justify-center rounded-md text-[var(--learner-muted-text)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-50"
                    disabled={removing || postponing}
                    onClick={() => void onRemove(item.questionId)}
                    type="button"
                >
                    <Trash2 aria-hidden="true" className="size-4" />
                </button>
            </span>
        </div>
    );
}

function formatRecallDate(value: string | null): string {
    if (!value) {
        return 'soon';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
    }).format(new Date(value));
}

function RouteLearningAreas({ route }: { route: LearningDeskRoute }) {
    if (route.learningAreas.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[var(--learner-muted-text)]">
            <span>Learning areas:</span>
            {route.learningAreas.map((area) => (
                <Link
                    className="text-[var(--learner-action-accent)] underline decoration-[color-mix(in_srgb,var(--learner-action-accent)_30%,transparent)] underline-offset-2 transition hover:text-[var(--learner-heading-text)]"
                    href={competenceTopicHref(area.slug, route.topic?.slug)}
                    key={area.slug}
                >
                    {area.name}
                </Link>
            ))}
        </div>
    );
}

function DeskReason({
    reason,
}: {
    reason:
        | LearningDeskRoute['deskReason']
        | LearningDeskRevisitInvitation['deskReason']
        | LearningDeskRecallItem['deskReason'];
}) {
    const t = usePlatformTranslation();
    const copy = {
        active_route: [
            'home.learning_desk.reason.active_route',
            'Why here: this route is still in progress.',
        ],
        recently_completed: [
            'home.learning_desk.reason.recently_completed',
            'Why here: you completed this route recently.',
        ],
        chosen_to_return: [
            'home.learning_desk.reason.chosen_to_return',
            'Why here: you chose to return to this activity.',
        ],
        saved_for_recall: [
            'home.learning_desk.reason.saved_for_recall',
            'Why here: you kept this question for another recall attempt.',
        ],
    }[reason];

    return (
        <span className="mt-2 block text-xs text-[var(--learner-muted-text)]">
            {t(copy[0], copy[1])}
        </span>
    );
}

function SectionHeading({ id, label }: { id: string; label: string }) {
    return (
        <div className="flex items-center gap-5 border-b border-[var(--learner-border-color)] pb-3">
            <h2
                className="shrink-0 text-xs font-semibold tracking-[0.22em] text-[var(--learner-muted-text)] uppercase"
                id={id}
            >
                {label}
            </h2>
            <span className="h-px flex-1 bg-[var(--learner-border-color)]" />
        </div>
    );
}

function EmptyState({
    body,
    href,
    link,
    title,
}: {
    body: string;
    href: string;
    link: string;
    title: string;
}) {
    return (
        <div className="border-b border-[var(--learner-border-color)] py-7">
            <div className="flex items-start gap-4">
                <Compass className="mt-1 size-5 shrink-0 text-[var(--learner-action-accent)]" />
                <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--learner-muted-text)]">
                        {body}
                    </p>
                    <Link
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--learner-action-accent)]"
                        href={href}
                    >
                        {link}
                        <ArrowRight className="size-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function greeting(t: ReturnType<typeof usePlatformTranslation>): string {
    const hour = new Date().getHours();

    if (hour < 12) {
        return t('home.learning_desk.greeting.morning', 'Good morning');
    }

    if (hour < 18) {
        return t('home.learning_desk.greeting.afternoon', 'Good afternoon');
    }

    return t('home.learning_desk.greeting.evening', 'Good evening');
}

function deskAreaFromUrl(): LearningDeskArea | null {
    const area = new URL(window.location.href).searchParams.get('area');

    if (
        area === 'connections' ||
        area === 'continue' ||
        area === 'recent' ||
        area === 'recall' ||
        area === 'reflections' ||
        area === 'revisit' ||
        area === 'support'
    ) {
        return area;
    }

    return null;
}

function fitsTimeBudget(
    timeGuideMinutes: number | null,
    timeBudget: DeskTimeBudget,
): boolean {
    return (
        timeBudget === 'any' ||
        (timeGuideMinutes !== null && timeGuideMinutes <= timeBudget)
    );
}

function fitsDeskFilters(
    timeGuideMinutes: number | null,
    learningIntent: string | null,
    timeBudget: DeskTimeBudget,
    purposeFilter: DeskPurposeFilter,
): boolean {
    return (
        fitsTimeBudget(timeGuideMinutes, timeBudget) &&
        (purposeFilter === 'any' || learningIntent === purposeFilter)
    );
}

function formatDate(value: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    }).format(new Date(value));
}
