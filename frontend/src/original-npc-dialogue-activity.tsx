import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type Dialogue = components['schemas']['LearnerNpcDialogue'];
type DialogueNode = components['schemas']['LearnerNpcDialogueNode'];

/**
 * Source-adapted from `features/world/npc-dialogue-player.tsx`.
 *
 * The scene remains a React concern, but cursor, answer validity, private
 * reflection, configured tool grants and completion eligibility stay in Axum.
 */
export function OriginalNpcDialogueActivity({
    activity,
    appearance,
    onComplete,
    onRefresh,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
    onRefresh: () => Promise<void>;
    playRunId: string;
}) {
    const dialogue = activity.npc_dialogue;
    const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
    const [reflection, setReflection] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [grantedToolName, setGrantedToolName] = useState<string | null>(null);
    const completedEndNodeId = useRef<string | null>(null);

    useEffect(() => {
        setSelectedAnswerId(null);
        setReflection('');
        setError(null);
        setGrantedToolName(null);
    }, [dialogue?.current_node_id]);

    const currentNode = useMemo(
        () => dialogue?.nodes.find((node) => node.id === dialogue.current_node_id) ?? null,
        [dialogue],
    );
    const answers = useMemo(
        () => (dialogue && currentNode ? answerOptions(dialogue, currentNode) : []),
        [dialogue, currentNode],
    );

    if (!dialogue || !currentNode) {
        return <p className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-[var(--learner-muted-text)]">This dialogue is not available.</p>;
    }

    const isQuestion = currentNode.node_type === 'npc_question';
    const isReflection = currentNode.node_type === 'reflection';
    const isEnd = currentNode.node_type === 'end';
    const canGoBack = dialogue.history.length > 0;
    const backgroundImage = themedImage(currentNode.config, appearance, 'background');
    const npcImage = themedImage(currentNode.config, appearance, 'npcImage');
    const bubbleStyle = speechBubbleStyle(currentNode, appearance);

    useEffect(() => {
        if (!isEnd || completedEndNodeId.current === currentNode.id) {
            return;
        }

        completedEndNodeId.current = currentNode.id;
        void onComplete();
    }, [currentNode.id, isEnd, onComplete]);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (isEditableTarget(event.target)) {
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                if (canGoBack && !isSubmitting) {
                    void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/back');
                }
            }
            if ((event.key === 'ArrowRight' || event.key === ' ') && !isQuestion && !isReflection && !isEnd) {
                event.preventDefault();
                void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/continue');
            }
            if (event.key === 'Enter' && isQuestion) {
                event.preventDefault();
                void answer();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canGoBack, isEnd, isQuestion, isReflection, isSubmitting, selectedAnswerId]);

    async function command(
        path:
            | '/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/continue'
            | '/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/back',
    ): Promise<void> {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(path, {
                params: {
                    header: { 'X-CSRF-Token': token },
                    path: { activity_slug: activity.slug, play_run_id: playRunId },
                },
            });
            if (!response.ok) throw new Error('dialogue command');
            setGrantedToolName(data?.granted_tool?.title ?? null);
            await onRefresh();
        } catch {
            setError('The dialogue could not continue. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function answer(): Promise<void> {
        if (!selectedAnswerId || isSubmitting) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/answer',
                {
                    body: { answer_node_id: selectedAnswerId },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activity.slug, play_run_id: playRunId },
                    },
                },
            );
            if (!response.ok) throw new Error('dialogue answer');
            await onRefresh();
        } catch {
            setError('That answer is no longer available. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function saveReflection(): Promise<void> {
        if (!reflection.trim() || isSubmitting) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/reflection',
                {
                    body: { reflection },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_slug: activity.slug, play_run_id: playRunId },
                    },
                },
            );
            if (!response.ok) throw new Error('dialogue reflection');
            await onRefresh();
        } catch {
            setError('Your private reflection could not be saved. Try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="relative isolate flex min-h-[32rem] flex-1 overflow-hidden rounded-lg border border-[var(--learner-border-color)] bg-[var(--learner-panel-background)]">
            {backgroundImage ? <img alt="" className="absolute inset-0 size-full object-cover" src={backgroundImage} /> : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />
            {npcImage ? (
                <img
                    alt=""
                    className="absolute z-10 max-h-[70%] max-w-[55%] object-contain"
                    draggable={false}
                    src={npcImage}
                    style={{
                        left: `${numberConfig(currentNode.config.npcX, 50)}%`,
                        top: `${numberConfig(currentNode.config.npcY, 50)}%`,
                        transform: currentNode.config.npcImageMirrored === true ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)',
                    }}
                />
            ) : null}
            <div className="relative z-20 mt-auto flex w-full flex-col gap-4 p-4">
                <div className="rounded-2xl border p-4 backdrop-blur-md" style={bubbleStyle}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4" />{currentNode.title}</div>
                    <p className="min-h-16 whitespace-pre-wrap text-sm leading-6">{currentNode.body ?? ''}</p>
                    {grantedToolName ? <p className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100">Added tool: {grantedToolName}</p> : null}
                    {isQuestion ? <div className="mt-4 grid gap-2">
                        {answers.map((answer, index) => <button className={`rounded-lg border p-3 text-left text-sm leading-6 transition ${selectedAnswerId === answer.id ? 'border-cyan-600 bg-cyan-50 text-slate-900 dark:border-teal-200 dark:bg-teal-200/10 dark:text-slate-100' : 'border-white/20 bg-white/70 text-slate-800 hover:bg-white dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-950/70'}`} disabled={isSubmitting} key={answer.id} onClick={() => setSelectedAnswerId(answer.id)} type="button"><span className="mr-2 font-semibold">{answer.label ?? String.fromCharCode(65 + index)}</span>{answer.body}</button>)}
                        <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={!selectedAnswerId || isSubmitting} onClick={() => void answer()} type="button">Confirm answer</button>
                    </div> : null}
                    {isReflection ? <div className="mt-4 grid gap-3"><textarea className="min-h-28 resize-none rounded-lg border border-white/20 bg-slate-950/30 p-3 text-sm leading-6 text-inherit outline-none focus:border-cyan-400 dark:focus:border-teal-200" onChange={(event) => setReflection(event.target.value)} placeholder="Write a reflection for your journal." value={reflection} /><button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={!reflection.trim() || isSubmitting} onClick={() => void saveReflection()} type="button">Keep reflection</button></div> : null}
                    {error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-200" role="alert">{error}</p> : null}
                </div>
                <div className="flex items-center justify-between gap-3"><button aria-label="Previous dialogue" className="rounded-md border border-[var(--learner-border-color)] p-2 disabled:opacity-50" disabled={!canGoBack || isSubmitting} onClick={() => void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/back')} type="button"><ArrowLeft className="size-4" /></button><p className="text-xs text-[var(--learner-muted-text)]">{isReflection ? 'Save your reflection to continue.' : isQuestion ? 'Choose an answer, then confirm.' : isEnd ? 'Completing dialogue…' : 'Use Space or arrows to move.'}</p><button aria-label="Next dialogue" className="rounded-md bg-cyan-700 p-2 text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={isQuestion || isReflection || isEnd || isSubmitting} onClick={() => void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/continue')} type="button"><ArrowRight className="size-4" /></button></div>
            </div>
        </div>
    );
}

function answerOptions(dialogue: Dialogue, node: DialogueNode): Array<{ id: string; body: string; label: string | null }> {
    return dialogue.transitions.filter((transition) => transition.from_node_id === node.id && transition.from_connector.startsWith('answer-')).sort((first, second) => first.from_connector.localeCompare(second.from_connector, undefined, { numeric: true })).flatMap((transition) => {
        const answer = dialogue.nodes.find((candidate) => candidate.id === transition.to_node_id);
        return answer?.node_type === 'answer' ? [{ id: answer.id, body: answer.body ?? answer.title, label: typeof answer.config.answerLabel === 'string' ? answer.config.answerLabel : null }] : [];
    });
}

function themedImage(config: Record<string, unknown>, appearance: OriginalAppearance, prefix: 'background' | 'npcImage'): string | null {
    const light = config[`${prefix}Light`];
    const dark = config[`${prefix}Dark`];
    const image = appearance === 'light' ? light ?? dark : dark ?? light;
    return typeof image === 'string' && image.trim() ? image : null;
}

function numberConfig(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }

function isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

function speechBubbleStyle(node: DialogueNode, appearance: OriginalAppearance): CSSProperties {
    const light = appearance === 'light';
    const background = node.config[light ? 'bubbleColorLight' : 'bubbleColorDark'];
    const border = node.config[light ? 'bubbleBorderColorLight' : 'bubbleBorderColorDark'];
    return { backgroundColor: typeof background === 'string' ? background : light ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)', borderColor: typeof border === 'string' ? border : light ? '#0891b2' : '#2dd4bf' };
}
