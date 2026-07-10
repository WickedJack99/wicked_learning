import { ArrowLeft, ArrowRight, Bookmark, PlayCircle, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type {
    LearningActivity,
    LearningNode,
    LearningPortalLink,
    LearningProgress,
    QuestionAnswerProgress,
} from '@/types';
import { NpcDialogueActivity } from './npc-dialogue-player';
import { ObstacleActivity } from './obstacle-activity';
import {
    DialogueActivity,
    PlaceholderActivity,
    PortalActivity,
    QuestionActivity,
    ReflectionActivity,
} from './standard-activities';
import { ToolGrantActivity } from './tool-grant-activity';

export function ActivityPanel({
    node,
    onClose,
    onStart,
    onToggleBookmark,
    isBookmarked,
}: {
    isBookmarked: boolean;
    node: LearningNode | null;
    onClose: () => void;
    onStart: (node: LearningNode, activityId: number | null) => void;
    onToggleBookmark: (node: LearningNode) => void;
}) {
    if (!node) {
        return null;
    }

    if (node.state === 'locked') {
        return (
            <PanelShell
                eyebrow="Location"
                headerAction={
                    <BookmarkButton
                        isBookmarked={isBookmarked}
                        node={node}
                        onToggleBookmark={onToggleBookmark}
                    />
                }
                onClose={onClose}
                title={node.title}
            >
                <NodeSummary node={node} />
                <LockedActivityState />
            </PanelShell>
        );
    }

    return (
        <PanelShell
            eyebrow="Location"
            headerAction={
                <BookmarkButton
                    isBookmarked={isBookmarked}
                    node={node}
                    onToggleBookmark={onToggleBookmark}
                />
            }
            onClose={onClose}
            title={node.title}
        >
            <NodeSummary node={node} />
            {node.activities.length > 0 ? (
                <RouteStartButtons node={node} onStart={onStart} />
            ) : (
                <EmptyActivityState />
            )}
        </PanelShell>
    );
}

function RouteStartButtons({
    node,
    onStart,
}: {
    node: LearningNode;
    onStart: (node: LearningNode, activityId: number | null) => void;
}) {
    const { resolvedAppearance } = useAppearance();
    const routes =
        node.startRoutes.length > 0
            ? node.startRoutes
            : ([
                  {
                      activityId: node.startActivityId,
                      buttonBorderColorDark: null,
                      buttonBorderColorLight: null,
                      buttonColorDark: null,
                      buttonColorLight: null,
                      id: 0,
                      imageDark: null,
                      imageLight: null,
                      label: 'Start node',
                      sortOrder: 0,
                  },
              ].filter(
                  (route) => route.activityId !== null,
              ) as LearningNode['startRoutes']);

    if (routes.length === 0) {
        return <EmptyActivityState />;
    }

    const showScrollHints = routes.length > 3;

    return (
        <div className="relative mt-auto min-h-0">
            {showScrollHints ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center bg-gradient-to-b from-white via-white/80 to-transparent py-1 text-slate-400 dark:from-[#111820] dark:via-[#111820]/80">
                    <ArrowLeft className="size-3 rotate-90" />
                </div>
            ) : null}
            <div
                className={cn(
                    'route-options-scroll -mt-1 grid max-h-56 gap-2 overflow-y-auto px-1 pt-2 pb-1',
                    showScrollHints && 'py-6',
                )}
            >
                {routes.map((route) => (
                    <RouteStartOption
                        key={`${route.id}:${route.activityId}`}
                        mode={resolvedAppearance}
                        node={node}
                        onStart={onStart}
                        route={route}
                    />
                ))}
            </div>
            {showScrollHints ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-white via-white/80 to-transparent py-1 text-slate-400 dark:from-[#111820] dark:via-[#111820]/80">
                    <ArrowLeft className="size-3 -rotate-90" />
                </div>
            ) : null}
        </div>
    );
}

function RouteStartOption({
    mode,
    node,
    onStart,
    route,
}: {
    mode: 'dark' | 'light';
    node: LearningNode;
    onStart: (node: LearningNode, activityId: number | null) => void;
    route: LearningNode['startRoutes'][number];
}) {
    const image = mode === 'light' ? route.imageLight : route.imageDark;
    const buttonColor =
        mode === 'light' ? route.buttonColorLight : route.buttonColorDark;
    const buttonBorderColor =
        mode === 'light'
            ? route.buttonBorderColorLight
            : route.buttonBorderColorDark;
    const routeBorderColor =
        buttonBorderColor ??
        (mode === 'light' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.1)');
    const buttonStyle: CSSProperties = {
        ...(buttonColor ? { backgroundColor: buttonColor } : {}),
        backgroundClip: 'padding-box',
        boxShadow: `inset 0 0 0 2px ${routeBorderColor}`,
    };
    const frameStyle: CSSProperties = {
        boxShadow: `inset 0 0 0 2px ${routeBorderColor}`,
    };

    if (image) {
        return (
            <button
                className="group relative overflow-hidden rounded-lg bg-slate-950 text-left transition duration-200 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:focus-visible:ring-teal-200"
                onClick={() => onStart(node, route.activityId)}
                type="button"
            >
                <img alt="" className="h-32 w-full object-cover" src={image} />
                <span
                    className="absolute inset-x-0 top-0 z-[1] flex min-h-10 items-center justify-between gap-3 rounded-lg bg-white/90 px-3 py-2 text-sm font-semibold text-slate-950 backdrop-blur-md dark:bg-slate-950/82 dark:text-white"
                    style={buttonStyle}
                >
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                        <span className="truncate">{route.label}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-cyan-700 transition group-hover:translate-x-0.5 dark:text-teal-200" />
                </span>
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[2] rounded-lg"
                    style={frameStyle}
                />
            </button>
        );
    }

    return (
        <Button
            className="h-10 justify-between border border-transparent bg-white/90 text-slate-950 shadow-none transition duration-200 hover:-translate-y-0.5 hover:bg-cyan-50 hover:text-slate-950 hover:shadow-none dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900 dark:hover:text-white"
            onClick={() => onStart(node, route.activityId)}
            style={buttonStyle}
            variant="ghost"
            type="button"
        >
            <span className="inline-flex min-w-0 items-center gap-2">
                <PlayCircle className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
                <span className="truncate">{route.label}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-cyan-700 dark:text-teal-200" />
        </Button>
    );
}

export function ActivityPlayer({
    activity,
    answerProgress,
    node,
    onAnswer,
    onComplete,
    onMoveToActivity,
    onTravel,
}: {
    activity: LearningActivity | null;
    answerProgress: LearningProgress['answers'];
    node: LearningNode;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    onTravel: (portalLink: LearningPortalLink) => void;
}) {
    if (!activity) {
        return <EmptyActivityState />;
    }

    const completedTransition =
        activity.transitions.find(
            (transition) => transition.trigger === 'completed',
        ) ??
        activity.transitions.find(
            (transition) => transition.trigger === 'arrived',
        ) ??
        null;

    return (
        <ActivityFrame activity={activity}>
            {activity.type === 'dialogue' ? (
                <DialogueActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    transition={completedTransition}
                />
            ) : null}

            {activity.type === 'question' && activity.question ? (
                <QuestionActivity
                    activity={activity}
                    answer={answerProgress[activity.question.id]}
                    onAnswer={onAnswer}
                    onMoveToActivity={onMoveToActivity}
                />
            ) : null}

            {activity.type === 'npc_dialogue' ? (
                <NpcDialogueActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                />
            ) : null}

            {activity.type === 'reflection' ? (
                <ReflectionActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    transition={completedTransition}
                />
            ) : null}

            {activity.type === 'obstacle' ? (
                <ObstacleActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    transition={completedTransition}
                />
            ) : null}

            {activity.type === 'tool_grant' ? (
                <ToolGrantActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    transition={completedTransition}
                />
            ) : null}

            {activity.type === 'placeholder' ? (
                <PlaceholderActivity
                    activity={activity}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    transition={completedTransition}
                />
            ) : null}

            {activity.type === 'portal' ? (
                <PortalActivity
                    activity={activity}
                    node={node}
                    onComplete={onComplete}
                    onMoveToActivity={onMoveToActivity}
                    onTravel={onTravel}
                    transition={completedTransition}
                />
            ) : null}
        </ActivityFrame>
    );
}

function NodeSummary({ node }: { node: LearningNode }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/6">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {node.description}
            </p>
        </div>
    );
}

function EmptyActivityState() {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-950/24">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                No activity configured yet
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                This panel is ready for future actions such as starting a first
                activity, opening a portal or showing unlock requirements.
            </p>
        </div>
    );
}

function LockedActivityState() {
    return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-white/15 dark:bg-slate-950/24">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Locked for now
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                This place is visible for orientation, but its activities are
                not open yet.
            </p>
        </div>
    );
}

function ActivityFrame({
    activity,
    children,
}: {
    activity: LearningActivity;
    children: React.ReactNode;
}) {
    return (
        <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/28">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/14 dark:text-teal-200">
                    <PlayCircle className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200/70">
                        {activity.type}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                        {activity.title}
                    </h3>
                    {activity.introduction ? (
                        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {activity.introduction}
                        </p>
                    ) : null}
                </div>
            </div>

            {children}
        </section>
    );
}

function PanelShell({
    children,
    eyebrow,
    headerAction,
    onClose,
    title,
}: {
    children?: React.ReactNode;
    eyebrow: string;
    headerAction?: React.ReactNode;
    onClose?: () => void;
    title: string;
}) {
    return (
        <div className="flex h-full min-h-[44vh] flex-col gap-5 overflow-y-auto overscroll-contain p-5 md:p-7">
            <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/78">
                        {eyebrow}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">
                        {title}
                    </h2>
                </div>
                {headerAction}
                {onClose ? (
                    <Button
                        aria-label="Close node panel"
                        onClick={onClose}
                        size="icon"
                        variant="ghost"
                    >
                        <X className="size-4" />
                    </Button>
                ) : null}
            </div>
            {children}
        </div>
    );
}

function BookmarkButton({
    isBookmarked,
    node,
    onToggleBookmark,
}: {
    isBookmarked: boolean;
    node: LearningNode;
    onToggleBookmark: (node: LearningNode) => void;
}) {
    return (
        <Button
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this tile'}
            onClick={() => onToggleBookmark(node)}
            size="icon"
            type="button"
            variant="ghost"
        >
            <Bookmark
                className={cn(
                    'size-4',
                    isBookmarked &&
                        'fill-cyan-600 text-cyan-600 dark:fill-teal-200 dark:text-teal-200',
                )}
            />
        </Button>
    );
}
