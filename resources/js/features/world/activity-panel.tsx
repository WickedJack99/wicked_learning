import {
    ArrowLeft,
    ArrowRight,
    Bookmark,
    CheckCircle2,
    Map as MapIcon,
    MessageCircle,
    PlayCircle,
    RotateCcw,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
    ActivityTransition,
    LearningActivity,
    LearningNode,
    LearningPortalLink,
    LearningProgress,
    QuestionAnswerProgress,
} from '@/types';
import { postJson } from './api';

export function ActivityPanel({
    activity,
    answerProgress,
    node,
    onAnswer,
    onClose,
    onComplete,
    onMoveToActivity,
    onToggleBookmark,
    onTravel,
    isBookmarked,
}: {
    activity: LearningActivity | null;
    answerProgress: LearningProgress['answers'];
    isBookmarked: boolean;
    node: LearningNode | null;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onClose: () => void;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    onToggleBookmark: (node: LearningNode) => void;
    onTravel: (portalLink: LearningPortalLink) => void;
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

    if (!activity) {
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
                <EmptyActivityState />
            </PanelShell>
        );
    }

    const completedTransition =
        activity.transitions.find(
            (transition) => transition.trigger === 'completed',
        ) ?? null;

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

                {activity.type === 'reflection' ? (
                    <ReflectionActivity
                        activity={activity}
                        onComplete={onComplete}
                    />
                ) : null}

                {activity.type === 'placeholder' ? (
                    <PlaceholderActivity activity={activity} />
                ) : null}

                {activity.type === 'portal' ? (
                    <PortalActivity
                        activity={activity}
                        node={node}
                        onComplete={onComplete}
                        onTravel={onTravel}
                    />
                ) : null}
            </ActivityFrame>
        </PanelShell>
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

function PlaceholderActivity({ activity }: { activity: LearningActivity }) {
    const nextStep =
        typeof activity.config.nextStep === 'string'
            ? activity.config.nextStep
            : 'A concrete interaction can be attached here next.';

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {nextStep}
            </p>
        </div>
    );
}

function PortalActivity({
    activity,
    node,
    onComplete,
    onTravel,
}: {
    activity: LearningActivity;
    node: LearningNode;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onTravel: (portalLink: LearningPortalLink) => void;
}) {
    const [isTravelling, setIsTravelling] = useState(false);
    const portalMode = activity.config.portalMode;
    const link = node.outgoingPortalLinks[0] ?? null;
    const isInputPortal = portalMode === 'input';

    const travel = async () => {
        if (!link) {
            return;
        }

        setIsTravelling(true);

        try {
            await onComplete(activity);
            onTravel(link);
        } finally {
            setIsTravelling(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/14 dark:text-teal-200">
                    <MapIcon className="size-4" />
                </span>
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {isInputPortal
                            ? 'Arrival portal'
                            : link
                              ? (link.label ?? 'Linked portal')
                              : 'Portal not linked yet'}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {isInputPortal
                            ? 'This portal is configured as an entry point for paths that arrive here.'
                            : link
                              ? `Travel to ${link.targetMapTitle} / ${link.targetNodeTitle}.`
                              : 'An admin can connect this tile to another portal in Settings > Edit World.'}
                    </p>
                    {link?.description ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {link.description}
                        </p>
                    ) : null}
                </div>
            </div>

            {!isInputPortal ? (
                <Button
                    className="mt-auto"
                    disabled={!link || isTravelling}
                    onClick={() => void travel()}
                    type="button"
                >
                    Travel
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            ) : null}
        </div>
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

function DialogueActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const [stageIndex, setStageIndex] = useState(0);
    const stages = activity.dialogueStages;
    const stage = stages[stageIndex];
    const canGoBack = stageIndex > 0;
    const canGoForward = stageIndex < stages.length - 1;

    if (!stage) {
        return null;
    }

    const completeDialogue = async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/55">
                {stage.portraitUrl ? (
                    <img
                        alt={stage.imageAlt ?? stage.speakerName}
                        className="aspect-[4/3] w-full object-cover"
                        src={stage.portraitUrl}
                    />
                ) : null}
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-50 p-4 dark:border-teal-200/20 dark:bg-teal-100/8">
                <div className="mb-3 flex items-center gap-2 text-cyan-700 dark:text-teal-100">
                    <MessageCircle className="size-4" />
                    <span className="text-sm font-medium">
                        {stage.speakerName}
                    </span>
                    {stage.speakerRole ? (
                        <span className="text-xs text-cyan-600 dark:text-teal-100/60">
                            {stage.speakerRole}
                        </span>
                    ) : null}
                </div>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-100">
                    {stage.body}
                </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3">
                <Button
                    disabled={!canGoBack}
                    onClick={() =>
                        setStageIndex((current) => Math.max(0, current - 1))
                    }
                    size="icon"
                    variant="secondary"
                >
                    <ArrowLeft className="size-4" />
                </Button>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {stageIndex + 1} / {stages.length}
                </span>

                {canGoForward ? (
                    <Button
                        onClick={() =>
                            setStageIndex((current) =>
                                Math.min(stages.length - 1, current + 1),
                            )
                        }
                        size="icon"
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                ) : (
                    <Button onClick={completeDialogue}>
                        {transition?.label ?? 'Continue'}
                        <ArrowRight className="ml-2 size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

function QuestionActivity({
    activity,
    answer,
    onAnswer,
    onMoveToActivity,
}: {
    activity: LearningActivity;
    answer: QuestionAnswerProgress | undefined;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onMoveToActivity: (activityId: number | null) => void;
}) {
    const question = activity.question;
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!question) {
        return null;
    }

    const submitAnswer = async (optionId: number) => {
        setIsSubmitting(true);

        try {
            const response = await postJson<{ answer: QuestionAnswerProgress }>(
                `/learning/questions/${question.id}/answer`,
                {
                    option_id: optionId,
                },
            );

            onAnswer(question.id, response.answer);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-100">
                {question.prompt}
            </p>

            <div className="grid gap-3">
                {question.options.map((option) => (
                    <button
                        className={cn(
                            'rounded-lg border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 transition hover:border-cyan-500/60 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-100 dark:hover:border-teal-200/60 dark:hover:bg-teal-100/8 dark:focus-visible:ring-teal-200',
                            answer?.optionId === option.id &&
                                'border-cyan-500/80 bg-cyan-50 dark:border-teal-200/80 dark:bg-teal-100/12',
                        )}
                        disabled={isSubmitting}
                        key={option.id}
                        onClick={() => void submitAnswer(option.id)}
                        type="button"
                    >
                        <span className="mr-2 font-semibold text-cyan-700 dark:text-teal-200">
                            {option.label}
                        </span>
                        {option.body}
                    </button>
                ))}
            </div>

            {answer ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-teal-100">
                        {answer.isCorrect ? (
                            <CheckCircle2 className="size-4" />
                        ) : (
                            <RotateCcw className="size-4" />
                        )}
                        <span>
                            {answer.isCorrect
                                ? 'Useful clue found'
                                : 'Adjust the hypothesis'}
                        </span>
                    </div>
                    {answer.feedback ? (
                        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {answer.feedback}
                        </p>
                    ) : null}
                    {answer.explanation ? (
                        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {answer.explanation}
                        </p>
                    ) : null}
                    {answer.nextActivityId ? (
                        <Button
                            className="mt-4"
                            onClick={() =>
                                onMoveToActivity(answer.nextActivityId ?? null)
                            }
                        >
                            Continue
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function ReflectionActivity({
    activity,
    onComplete,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
}) {
    const [reflection, setReflection] = useState('');
    const prompt =
        typeof activity.config.prompt === 'string'
            ? activity.config.prompt
            : 'What feels clearer now?';
    const note =
        typeof activity.config.note === 'string' ? activity.config.note : null;

    return (
        <div className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                {prompt}
            </p>
            <textarea
                className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                onChange={(event) => setReflection(event.target.value)}
                placeholder="Write a short note for yourself."
                value={reflection}
            />
            {note ? (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {note}
                </p>
            ) : null}
            <Button
                className="mt-auto"
                disabled={reflection.trim().length === 0}
                onClick={() => void onComplete(activity)}
            >
                Keep reflection
            </Button>
        </div>
    );
}
