import {
    ArrowLeft,
    ArrowRight,
    Compass,
    MessageCircle,
    RotateCcw,
    X,
} from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Companion = components['schemas']['LearnerCompanion'];
type CompanionNode = {
    capabilities?: string[];
    choices?: Array<{
        action?: string;
        key: string;
        label: string;
        next?: string;
    }>;
    id: string;
    message?: string;
    next?: string;
    prompt?: string;
    title?: string;
    type: 'ai' | 'choice' | 'end' | 'message';
};
type AssistanceLevel = 'off' | 'question' | 'hint' | 'post-attempt';

export type OriginalLearningCompanionScope = {
    activityId?: string;
    mapSlug?: string;
    surface: 'activity' | 'desk' | 'world';
};

/**
 * Source-adapted Learning Companion launcher. It treats the companion
 * projection as a server-owned read model and submits only an authored AI-node
 * choice plus the current opaque run; prompts and navigation stay server-side.
 */
export function OriginalLearningCompanionLauncher({
    scope,
}: {
    scope: OriginalLearningCompanionScope;
}) {
    const [companion, setCompanion] = useState<Companion | null>(null);

    useEffect(() => {
        let isCurrent = true;
        setCompanion(null);
        void apiClient
            .GET('/learner/companion', {
                params: {
                    query: {
                        activity_id: scope.activityId,
                        map_slug: scope.mapSlug,
                        surface: scope.surface,
                    },
                },
            })
            .then(({ data, response }) => {
                if (isCurrent && response.ok && data) {
                    setCompanion(data);
                }
            })
            .catch(() => {
                // The companion is optional help and must never block learning.
            });
        return () => {
            isCurrent = false;
        };
    }, [scope.activityId, scope.mapSlug, scope.surface]);

    return companion ? <Launcher companion={companion} scope={scope} /> : null;
}

function Launcher({
    companion,
    scope,
}: {
    companion: Companion;
    scope: OriginalLearningCompanionScope;
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        const close = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                window.setTimeout(() => triggerRef.current?.focus(), 0);
            }
        };
        const outside = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                panelRef.current?.contains(event.target)
            ) {
                return;
            }
            setOpen(false);
        };
        document.addEventListener('keydown', close);
        document.addEventListener('pointerdown', outside);
        return () => {
            document.removeEventListener('keydown', close);
            document.removeEventListener('pointerdown', outside);
        };
    }, [open]);

    return (
        <div
            className={`fixed bottom-5 left-4 z-40 sm:left-6 ${scope.surface === 'world' ? 'md:left-[calc(min(24rem,calc(100vw-2rem))+1.5rem)]' : ''}`}
            ref={panelRef}
        >
            {open ? (
                <aside
                    aria-labelledby="learning-companion-title"
                    className="absolute bottom-14 left-0 grid max-h-[min(38rem,calc(100svh-6rem))] w-[min(22rem,calc(100vw-2rem))] gap-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-950/20 dark:border-white/15 dark:bg-slate-950 dark:text-slate-100"
                    data-wl-id="learner.companion.panel"
                    id="learning-companion-panel"
                    role="dialog"
                >
                    <header className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Compass className="size-4 text-cyan-700 dark:text-teal-200" />
                            <h2
                                className="text-sm font-semibold"
                                id="learning-companion-title"
                            >
                                {companion.display_name}
                            </h2>
                        </div>
                        <button
                            aria-label="Close learning companion"
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:hover:bg-white/10 dark:hover:text-white"
                            onClick={() => setOpen(false)}
                            type="button"
                        >
                            <X className="size-4" />
                        </button>
                    </header>
                    <CompanionPanel companion={companion} scope={scope} />
                </aside>
            ) : null}
            <button
                aria-controls="learning-companion-panel"
                aria-expanded={open}
                aria-label={`Open ${companion.display_name}`}
                className="grid size-12 place-items-center overflow-hidden rounded-full border-2 border-white shadow-xl transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 focus-visible:outline-none dark:border-slate-950 dark:focus-visible:ring-teal-200"
                data-wl-id="learner.companion.launcher"
                onClick={() => setOpen((value) => !value)}
                ref={triggerRef}
                style={{ backgroundColor: companion.avatar_color }}
                title={companion.display_name}
                type="button"
            >
                <CompanionAvatar companion={companion} iconSize="size-6" />
            </button>
        </div>
    );
}

function CompanionAvatar({
    companion,
    iconSize,
}: {
    companion: Companion;
    iconSize: string;
}) {
    return companion.avatar_url ? (
        <img
            alt=""
            className="size-full object-cover"
            src={companion.avatar_url}
            style={{
                objectPosition: `${companion.avatar_position_x}% ${companion.avatar_position_y}%`,
                transform: `scale(${companion.avatar_scale / 100})`,
            }}
        />
    ) : (
        <Compass className={`${iconSize} text-white`} />
    );
}

function CompanionPanel({
    companion,
    scope,
}: {
    companion: Companion;
    scope: OriginalLearningCompanionScope;
}) {
    const context = companion.context;
    const entries = [
        ['Topic', context.topic?.title],
        ['Map', context.map?.title],
        ['Place', context.node?.title],
        ['Activity', context.activity?.title],
        ['Route', context.route?.title],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    return (
        <>
            <div className="flex items-start gap-3">
                <div
                    className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full"
                    style={{ backgroundColor: companion.avatar_color }}
                >
                    <CompanionAvatar companion={companion} iconSize="size-5" />
                </div>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {companion.message}
                </p>
            </div>
            <Dialogue companion={companion} scope={scope} />
            {entries.length ? (
                <dl className="grid gap-2 border-t border-slate-200 pt-3 text-xs dark:border-white/15">
                    {entries.slice(0, 4).map(([label, value]) => (
                        <div
                            className="flex items-baseline justify-between gap-3"
                            key={label}
                        >
                            <dt className="font-medium tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
                                {label}
                            </dt>
                            <dd className="truncate text-right font-semibold">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            <div className="grid gap-2 border-t border-slate-200 pt-3 dark:border-white/15">
                {context.actions.map((action) => (
                    <Link
                        className="rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-white/15 dark:hover:bg-white/10"
                        key={action.key}
                        to={action.href}
                    >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                            <span>{action.label}</span>
                            <ArrowRight className="size-4 text-cyan-700 dark:text-teal-200" />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {action.reason}
                        </span>
                    </Link>
                ))}
            </div>
        </>
    );
}

function Dialogue({
    companion,
    scope,
}: {
    companion: Companion;
    scope: OriginalLearningCompanionScope;
}) {
    const graph = companion.dialogue as {
        nodes: CompanionNode[];
        start: string;
    } | null;
    const [nodeId, setNodeId] = useState(graph?.start ?? '');
    const [history, setHistory] = useState<string[]>([]);
    const [response, setResponse] = useState<Record<string, string>>({});
    const [error, setError] = useState<Record<string, string>>({});
    const [assistance, setAssistance] = useState<
        Record<string, AssistanceLevel>
    >({});
    const [busy, setBusy] = useState(false);
    const nodes = useMemo(
        () => new Map(graph?.nodes.map((node) => [node.id, node])),
        [graph],
    );
    const node = nodes.get(nodeId);

    useEffect(() => {
        setNodeId(graph?.start ?? '');
        setHistory([]);
        setResponse({});
        setError({});
    }, [graph]);

    if (!graph || !node) {
        return null;
    }
    const move = (next: string | undefined) => {
        if (next && nodes.has(next) && next !== nodeId) {
            setHistory((current) => [...current, nodeId]);
            setNodeId(next);
        }
    };
    const requestAi = async () => {
        const level = assistance[node.id] ?? 'question';
        setError((current) => ({ ...current, [node.id]: '' }));
        if (level === 'off') {
            setResponse((current) => ({ ...current, [node.id]: '' }));
            return;
        }
        setBusy(true);
        try {
            const token = await getCsrfToken();
            const { data, response: request } = await apiClient.POST(
                '/learner/companion/turn',
                {
                    body: {
                        activity_id: companion.context.activity?.id,
                        assistance_level: level,
                        dialogue_node_id: node.id,
                        map_slug: scope.mapSlug,
                        play_run_id: companion.context.play_run_id ?? undefined,
                        surface: companion.context.surface,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!request.ok || !data) {
                throw new Error(
                    'The companion could not answer this turn. You can continue exploring without it.',
                );
            }
            setResponse((current) => ({ ...current, [node.id]: data.text }));
        } catch (reason) {
            setError((current) => ({
                ...current,
                [node.id]:
                    reason instanceof Error
                        ? reason.message
                        : 'The companion could not answer this turn. You can continue exploring without it.',
            }));
        } finally {
            setBusy(false);
        }
    };
    const choices: Array<[AssistanceLevel, string, string]> = [
        ['off', 'No AI', 'Continue without assistance.'],
        ['question', 'Ask a question', 'Prompt your own thinking.'],
        ['hint', 'Give me a hint', 'Offer one small clue.'],
        ...(companion.context.post_attempt_available
            ? [
                  [
                      'post-attempt',
                      'After my attempt',
                      'Compare with authored guidance without sharing your response.',
                  ] as [AssistanceLevel, string, string],
              ]
            : []),
    ];
    const hasResponse = Object.hasOwn(response, node.id);
    return (
        <section
            className="grid gap-3 border-t border-slate-200 pt-3 dark:border-white/15"
            data-wl-id="learner.companion.dialogue"
        >
            <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-cyan-700 dark:text-teal-200" />
                <h3 className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400">
                    Conversation
                </h3>
            </div>
            <div
                aria-live="polite"
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/15 dark:bg-white/5"
            >
                {node.title ? (
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {node.title}
                    </p>
                ) : null}
                <p className="text-sm leading-6">
                    {node.type === 'ai'
                        ? hasResponse
                            ? response[node.id] ||
                              'AI assistance is off for this turn.'
                            : error[node.id] ||
                              (companion.configuration.ai_enabled
                                  ? 'Choose how much support you want before asking the companion.'
                                  : (node.message ??
                                    node.prompt ??
                                    'AI assistance is not available for this companion turn yet.'))
                        : node.type === 'choice'
                          ? (node.prompt ?? '')
                          : (node.message ?? '')}
                </p>
            </div>
            {node.type === 'ai' && hasResponse && response[node.id] ? (
                <aside
                    className="rounded-lg border border-slate-200 p-3 text-xs leading-5 text-slate-600 dark:border-white/15 dark:text-slate-300"
                    role="note"
                >
                    <p className="font-semibold text-slate-900 dark:text-white">
                        About this AI response
                    </p>
                    <p>
                        It uses the authored guidance and displayed context
                        only. It does not receive your private response and
                        cannot navigate or change learning content.
                    </p>
                    <p className="mt-2">
                        {assistance[node.id] === 'post-attempt'
                            ? 'This post-attempt support is recorded separately from your earlier completion evidence.'
                            : 'This support is recorded separately and is not independent learning evidence.'}
                    </p>
                </aside>
            ) : null}
            {node.type === 'ai' &&
            companion.configuration.ai_enabled &&
            !hasResponse ? (
                <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/15">
                    <fieldset className="grid gap-2">
                        <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Choose AI assistance
                        </legend>
                        <div className="grid gap-2">
                            {choices.map(([value, label, description]) => (
                                <label
                                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 has-[:checked]:border-cyan-600 has-[:checked]:bg-cyan-50 dark:border-white/15 dark:has-[:checked]:border-teal-200 dark:has-[:checked]:bg-teal-200/10"
                                    key={value}
                                >
                                    <input
                                        checked={
                                            (assistance[node.id] ??
                                                'question') === value
                                        }
                                        name={`companion-${node.id}`}
                                        onChange={() =>
                                            setAssistance((current) => ({
                                                ...current,
                                                [node.id]: value,
                                            }))
                                        }
                                        type="radio"
                                        value={value}
                                    />
                                    <span>
                                        <span className="block text-sm font-semibold">
                                            {label}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                        AI support is optional and transient. It is not
                        independent learning evidence.
                    </p>
                    <button
                        className="min-h-11 rounded-lg border border-cyan-700 px-3 py-2 text-sm font-semibold text-cyan-800 hover:bg-cyan-50 disabled:opacity-60 dark:border-teal-200 dark:text-teal-100 dark:hover:bg-teal-200/10"
                        disabled={busy}
                        onClick={() => void requestAi()}
                        type="button"
                    >
                        {busy
                            ? 'The companion is considering this context…'
                            : 'Use this level of support'}
                    </button>
                </div>
            ) : null}
            {node.type === 'choice' && node.choices?.length ? (
                <div className="grid gap-2">
                    {node.choices.map((choice) => {
                        const action = choice.action
                            ? companion.context.actions.find(
                                  (item) => item.key === choice.action,
                              )
                            : undefined;
                        return choice.next && nodes.has(choice.next) ? (
                            <button
                                className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/10"
                                key={choice.key}
                                onClick={() => move(choice.next)}
                                type="button"
                            >
                                {choice.label}
                                <ArrowRight className="size-4" />
                            </button>
                        ) : action ? (
                            <Link
                                className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/15"
                                key={choice.key}
                                to={action.href}
                            >
                                {choice.label}
                                <ArrowRight className="size-4" />
                            </Link>
                        ) : (
                            <span
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 dark:border-white/15 dark:text-slate-400"
                                key={choice.key}
                            >
                                {choice.label}
                            </span>
                        );
                    })}
                </div>
            ) : null}
            {node.type !== 'choice' && node.next && nodes.has(node.next) ? (
                <button
                    className="flex min-h-11 items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/10"
                    onClick={() => move(node.next)}
                    type="button"
                >
                    Continue
                    <ArrowRight className="size-4" />
                </button>
            ) : null}
            {node.type === 'end' ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    This conversation is complete.
                </p>
            ) : null}
            {history.length || nodeId !== graph.start ? (
                <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-white/15">
                    {history.length ? (
                        <button
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/15"
                            onClick={() => {
                                const previous = history.at(-1);
                                if (previous) {
                                    setHistory((current) =>
                                        current.slice(0, -1),
                                    );
                                    setNodeId(previous);
                                }
                            }}
                            type="button"
                        >
                            <ArrowLeft className="size-4" />
                            Back
                        </button>
                    ) : null}
                    {nodeId !== graph.start ? (
                        <button
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-white/15"
                            onClick={() => {
                                setHistory([]);
                                setNodeId(graph.start);
                            }}
                            type="button"
                        >
                            <RotateCcw className="size-4" />
                            Restart
                        </button>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
