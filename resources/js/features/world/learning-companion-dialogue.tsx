import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { readJsonResponse } from '@/lib/json-response';
import type { LearningCompanion, LearningCompanionDialogueNode } from '@/types';

type CompanionTurnResponse = {
    errors?: Record<string, string[]>;
    message?: string;
    node_id: string;
    text: string;
};

export function LearningCompanionDialogue({
    companion,
}: {
    companion: LearningCompanion;
}) {
    const t = usePlatformTranslation();
    const graph = companion.dialogue;
    const [nodeId, setNodeId] = useState(graph?.start ?? '');
    const [nodeHistory, setNodeHistory] = useState<string[]>([]);
    const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
    const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
    const nodeById = useMemo(
        () => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []),
        [graph],
    );

    const node = nodeById.get(nodeId);
    const aiEnabled = companion.configuration.aiEnabled;

    useEffect(() => {
        if (
            !aiEnabled ||
            !node ||
            node.type !== 'ai' ||
            aiResponses[node.id] !== undefined
        ) {
            return;
        }

        const controller = new AbortController();
        // The request is intentionally one turn per node; cached responses avoid
        // repeated provider work when a learner revisits a branch.

        const context = companion.context;
        const body = {
            activity_id: context.activity?.id ?? undefined,
            dialogue_node_id: node.id,
            map_id: context.map?.id ?? undefined,
            node_id: context.node?.id ?? undefined,
            surface: context.surface,
        };
        const csrfToken =
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                ?.content ?? '';

        void fetch('/learning/companion/turn', {
            body: JSON.stringify(body),
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
            },
            method: 'POST',
            signal: controller.signal,
        })
            .then((response) =>
                readJsonResponse<CompanionTurnResponse>(
                    response,
                    t(
                        'learning.companion.dialogue.ai_error',
                        'The companion could not answer this turn. You can continue exploring without it.',
                    ),
                ),
            )
            .then((payload) => {
                if (controller.signal.aborted) {
                    return;
                }

                setAiResponses((current) => ({
                    ...current,
                    [node.id]: payload.text,
                }));
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                setAiErrors((current) => ({
                    ...current,
                    [node.id]:
                        error instanceof Error
                            ? error.message
                            : t(
                                  'learning.companion.dialogue.ai_error',
                                  'The companion could not answer this turn. You can continue exploring without it.',
                              ),
                }));
            });

        return () => controller.abort();
    }, [aiEnabled, aiResponses, companion.context, node, t]);

    if (!graph || graph.nodes.length === 0) {
        return null;
    }

    if (!node) {
        return null;
    }

    const moveTo = (target: string | null | undefined): void => {
        if (target && nodeById.has(target) && target !== nodeId) {
            setNodeHistory((history) => [...history, nodeId]);
            setNodeId(target);
        }
    };

    const moveBack = (): void => {
        const previousNodeId = nodeHistory.at(-1);

        if (!previousNodeId) {
            return;
        }

        setNodeHistory((history) => history.slice(0, -1));
        setNodeId(previousNodeId);
    };

    const restart = (): void => {
        setNodeHistory([]);
        setNodeId(graph.start);
    };

    return (
        <section
            aria-labelledby="learning-companion-dialogue-title"
            className="grid gap-3 border-t border-[var(--map-side-control-panel-border-color)] pt-3"
        >
            <div className="flex items-center gap-2">
                <MessageCircle className="size-4 text-[var(--map-floating-accent-color)]" />
                <h3
                    className="text-xs font-semibold tracking-[0.12em] text-[var(--map-side-control-muted-text-color)] uppercase"
                    id="learning-companion-dialogue-title"
                >
                    {t('learning.companion.dialogue.title', 'Conversation')}
                </h3>
            </div>

            <div
                aria-live="polite"
                className="grid gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] bg-[var(--map-side-control-hover-background)]/45 p-3"
            >
                {node.title ? (
                    <p className="text-xs font-semibold text-[var(--map-side-control-muted-text-color)]">
                        {node.title}
                    </p>
                ) : null}
                <p className="text-sm leading-6 text-[var(--map-side-control-text-color)]">
                    {node.type === 'ai'
                        ? aiResponses[node.id] ||
                          aiErrors[node.id] ||
                          t(
                              'learning.companion.dialogue.ai_loading',
                              'The companion is considering this context...',
                          )
                        : nodeContent(node, t)}
                </p>
            </div>

            {node.type === 'choice' && node.choices?.length ? (
                <div
                    aria-label={t(
                        'learning.companion.dialogue.choose',
                        'Choose a direction',
                    )}
                    className="grid gap-2"
                    role="group"
                >
                    {node.choices.map((choice) => {
                        const nextNode = choice.next
                            ? nodeById.get(choice.next)
                            : undefined;
                        const action = choice.action
                            ? companion.context.actions.find(
                                  (contextAction) =>
                                      contextAction.key === choice.action,
                              )
                            : undefined;

                        if (nextNode) {
                            return (
                                <button
                                    className="group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-left text-sm font-semibold text-[var(--map-side-control-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                                    key={choice.key}
                                    onClick={() => moveTo(choice.next)}
                                    type="button"
                                >
                                    {choice.label}
                                    <ArrowRight className="size-4 shrink-0 text-[var(--map-floating-accent-color)] transition-transform group-hover:translate-x-0.5" />
                                </button>
                            );
                        }

                        if (action) {
                            return (
                                <Link
                                    className="group flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-left text-sm font-semibold text-[var(--map-side-control-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                                    href={action.href}
                                    key={choice.key}
                                >
                                    {choice.label}
                                    <ArrowRight className="size-4 shrink-0 text-[var(--map-floating-accent-color)] transition-transform group-hover:translate-x-0.5" />
                                </Link>
                            );
                        }

                        return (
                            <span
                                className="rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-sm text-[var(--map-side-control-muted-text-color)]"
                                key={choice.key}
                            >
                                {choice.label}
                            </span>
                        );
                    })}
                </div>
            ) : null}

            {node.type !== 'choice' && node.next && nodeById.has(node.next) ? (
                <button
                    className="group inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-left text-sm font-semibold text-[var(--map-side-control-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                    onClick={() => moveTo(node.next)}
                    type="button"
                >
                    {t('learning.companion.dialogue.continue', 'Continue')}
                    <ArrowRight className="size-4 shrink-0 text-[var(--map-floating-accent-color)] transition-transform group-hover:translate-x-0.5" />
                </button>
            ) : null}

            {node.type === 'end' ? (
                <p className="text-xs text-[var(--map-side-control-muted-text-color)]">
                    {t(
                        'learning.companion.dialogue.complete',
                        'This conversation is complete.',
                    )}
                </p>
            ) : null}

            {nodeHistory.length > 0 || nodeId !== graph.start ? (
                <div
                    aria-label={t(
                        'learning.companion.dialogue.navigation',
                        'Conversation navigation',
                    )}
                    className="flex flex-wrap gap-2 border-t border-[var(--map-side-control-panel-border-color)] pt-3"
                    role="group"
                >
                    {nodeHistory.length > 0 ? (
                        <button
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-sm font-semibold text-[var(--map-side-control-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                            onClick={moveBack}
                            type="button"
                        >
                            <ArrowLeft className="size-4" />
                            {t('learning.companion.dialogue.back', 'Back')}
                        </button>
                    ) : null}
                    {nodeId !== graph.start ? (
                        <button
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-sm font-semibold text-[var(--map-side-control-muted-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] hover:text-[var(--map-side-control-text-color)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                            onClick={restart}
                            type="button"
                        >
                            <RotateCcw className="size-4" />
                            {t(
                                'learning.companion.dialogue.restart',
                                'Restart',
                            )}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

function nodeContent(
    node: LearningCompanionDialogueNode,
    t: ReturnType<typeof usePlatformTranslation>,
): string {
    if (node.type === 'ai') {
        return t(
            'learning.companion.dialogue.ai_unavailable',
            'AI assistance is not available for this companion turn yet.',
        );
    }

    return node.type === 'choice' ? (node.prompt ?? '') : (node.message ?? '');
}
