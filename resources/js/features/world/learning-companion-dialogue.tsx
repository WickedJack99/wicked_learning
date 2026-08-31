import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, MessageCircle, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { readJsonResponse } from '@/lib/json-response';
import type { LearningCompanion, LearningCompanionDialogueNode } from '@/types';

type CompanionTurnResponse = {
    disclosure?: {
        can_change_content: boolean;
        can_navigate: boolean;
        kind: string;
        uses_private_learner_response: boolean;
    } | null;
    errors?: Record<string, string[]>;
    message?: string;
    node_id: string;
    text: string;
    assistance_level?: string;
};

type CompanionAssistanceLevel = 'off' | 'question' | 'hint' | 'post-attempt';
type RecordedAssistanceLevel =
    | 'hint'
    | 'questions_only'
    | 'post_attempt_support';

export function LearningCompanionDialogue({
    companion,
    postAttemptAvailable = companion.context.postAttemptAvailable,
}: {
    companion: LearningCompanion;
    postAttemptAvailable?: boolean;
}) {
    const t = usePlatformTranslation();
    const graph = companion.dialogue;
    const [nodeId, setNodeId] = useState(graph?.start ?? '');
    const [nodeHistory, setNodeHistory] = useState<string[]>([]);
    const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
    const [aiDisclosures, setAiDisclosures] = useState<Record<string, boolean>>(
        {},
    );
    const [aiAssistanceUsed, setAiAssistanceUsed] = useState<
        Record<string, boolean>
    >({});
    const [aiAssistanceLevels, setAiAssistanceLevels] = useState<
        Record<string, RecordedAssistanceLevel>
    >({});
    const [aiErrors, setAiErrors] = useState<Record<string, string>>({});
    const [aiAssistance, setAiAssistance] = useState<
        Record<string, CompanionAssistanceLevel>
    >({});
    const [aiSubmitting, setAiSubmitting] = useState<Record<string, boolean>>(
        {},
    );
    const nodeById = useMemo(
        () => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []),
        [graph],
    );

    const node = nodeById.get(nodeId);
    const aiEnabled = companion.configuration.aiEnabled;

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

    const requestAi = (assistanceLevel: CompanionAssistanceLevel): void => {
        if (!aiEnabled || node.type !== 'ai' || aiSubmitting[node.id]) {
            return;
        }

        setAiErrors((current) => {
            const next = { ...current };
            delete next[node.id];

            return next;
        });

        if (assistanceLevel === 'off') {
            setAiResponses((current) => ({ ...current, [node.id]: '' }));

            return;
        }

        setAiSubmitting((current) => ({ ...current, [node.id]: true }));

        const context = companion.context;
        const body = {
            activity_id: context.activity?.id ?? undefined,
            assistance_level: assistanceLevel,
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
                setAiResponses((current) => ({
                    ...current,
                    [node.id]: payload.text,
                }));
                setAiDisclosures((current) => ({
                    ...current,
                    [node.id]:
                        payload.disclosure?.kind === 'bounded_authored_context',
                }));

                const assistanceLevel = payload.assistance_level;

                if (
                    context.activity &&
                    payload.text.trim() !== '' &&
                    isRecordedAssistanceLevel(assistanceLevel)
                ) {
                    setAiAssistanceLevels((current) => ({
                        ...current,
                        [node.id]: assistanceLevel,
                    }));
                    setAiAssistanceUsed((current) => ({
                        ...current,
                        [node.id]: true,
                    }));
                    window.dispatchEvent(
                        new CustomEvent('learning-companion:assistance-used', {
                            detail: {
                                assistanceLevel,
                            },
                        }),
                    );
                }
            })
            .catch((error: unknown) => {
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
            })
            .finally(() => {
                setAiSubmitting((current) => ({
                    ...current,
                    [node.id]: false,
                }));
            });
    };

    const selectedAssistance = aiAssistance[node.id] ?? 'question';
    const hasAiResponse = aiResponses[node.id] !== undefined;

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
                        ? hasAiResponse
                            ? aiResponses[node.id] ||
                              t(
                                  'learning.companion.dialogue.ai_off',
                                  'AI assistance is off for this turn.',
                              )
                            : aiErrors[node.id] ||
                              (aiEnabled
                                  ? t(
                                        'learning.companion.dialogue.ai_choose',
                                        'Choose how much support you want before asking the companion.',
                                    )
                                  : nodeContent(node, t))
                        : nodeContent(node, t)}
                </p>
            </div>

            {node.type === 'ai' && hasAiResponse && aiDisclosures[node.id] ? (
                <aside
                    aria-label={t(
                        'learning.companion.dialogue.ai_disclosure_title',
                        'About this AI response',
                    )}
                    className="grid gap-1 rounded-lg border border-[var(--map-side-control-panel-border-color)] bg-[var(--map-side-control-hover-background)]/30 p-3 text-xs leading-5 text-[var(--map-side-control-muted-text-color)]"
                    role="note"
                >
                    <p className="font-semibold text-[var(--map-side-control-text-color)]">
                        {t(
                            'learning.companion.dialogue.ai_disclosure_title',
                            'About this AI response',
                        )}
                    </p>
                    <p>
                        {t(
                            'learning.companion.dialogue.ai_disclosure_basis',
                            'It uses the authored guidance and context shown here only, so it may be incomplete.',
                        )}
                    </p>
                    <p>
                        {t(
                            'learning.companion.dialogue.ai_disclosure_limits',
                            'It does not receive your private response and cannot navigate or change learning content.',
                        )}
                    </p>
                </aside>
            ) : null}

            {node.type === 'ai' &&
            hasAiResponse &&
            aiAssistanceUsed[node.id] &&
            companion.context.activity ? (
                <p
                    className="text-xs leading-5 text-[var(--map-side-control-muted-text-color)]"
                    role="note"
                >
                    {aiAssistanceLevels[node.id] === 'post_attempt_support'
                        ? t(
                              'learning.companion.dialogue.assistance_post_attempt_recorded',
                              'This post-attempt support does not rewrite the completed activity evidence.',
                          )
                        : t(
                              'learning.companion.dialogue.assistance_recorded',
                              'If you complete this activity now, its evidence will show that you used support rather than independent support.',
                          )}
                </p>
            ) : null}

            {node.type === 'ai' && aiEnabled && !hasAiResponse ? (
                <div className="grid gap-3 rounded-lg border border-[var(--map-side-control-panel-border-color)] p-3">
                    <fieldset className="grid gap-2">
                        <legend className="text-xs font-semibold text-[var(--map-side-control-muted-text-color)]">
                            {t(
                                'learning.companion.dialogue.assistance_label',
                                'Choose AI assistance',
                            )}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {(
                                [
                                    [
                                        'off',
                                        t(
                                            'learning.companion.dialogue.assistance_off',
                                            'No AI',
                                        ),
                                        t(
                                            'learning.companion.dialogue.assistance_off_description',
                                            'Continue without assistance.',
                                        ),
                                    ],
                                    [
                                        'question',
                                        t(
                                            'learning.companion.dialogue.assistance_question',
                                            'Ask a question',
                                        ),
                                        t(
                                            'learning.companion.dialogue.assistance_question_description',
                                            'Prompt your own thinking.',
                                        ),
                                    ],
                                    [
                                        'hint',
                                        t(
                                            'learning.companion.dialogue.assistance_hint',
                                            'Give me a hint',
                                        ),
                                        t(
                                            'learning.companion.dialogue.assistance_hint_description',
                                            'Offer one small clue.',
                                        ),
                                    ],
                                    ...(postAttemptAvailable
                                        ? [
                                              [
                                                  'post-attempt',
                                                  t(
                                                      'learning.companion.dialogue.assistance_post_attempt',
                                                      'After my attempt',
                                                  ),
                                                  t(
                                                      'learning.companion.dialogue.assistance_post_attempt_description',
                                                      'Compare with authored guidance without sharing your response.',
                                                  ),
                                              ],
                                          ]
                                        : []),
                                ] as [
                                    CompanionAssistanceLevel,
                                    string,
                                    string,
                                ][]
                            ).map(([value, label, description]) => (
                                <label
                                    className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-[var(--map-side-control-panel-border-color)] px-3 py-2 text-left transition hover:bg-[var(--map-side-control-hover-background)] has-[:checked]:border-[var(--map-floating-accent-color)] has-[:checked]:bg-[var(--map-side-control-hover-background)]"
                                    key={value}
                                >
                                    <input
                                        checked={selectedAssistance === value}
                                        className="mt-1 accent-[var(--map-floating-accent-color)]"
                                        name={`companion-assistance-${node.id}`}
                                        onChange={() =>
                                            setAiAssistance((current) => ({
                                                ...current,
                                                [node.id]: value,
                                            }))
                                        }
                                        type="radio"
                                        value={value}
                                    />
                                    <span className="grid gap-0.5">
                                        <span className="text-sm font-semibold text-[var(--map-side-control-text-color)]">
                                            {label}
                                        </span>
                                        <span className="text-xs text-[var(--map-side-control-muted-text-color)]">
                                            {description}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <p className="text-xs leading-5 text-[var(--map-side-control-muted-text-color)]">
                        {t(
                            'learning.companion.dialogue.assistance_disclosure',
                            'AI support is optional and transient. It is not independent learning evidence.',
                        )}
                    </p>
                    <button
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--map-floating-accent-color)] px-3 py-2 text-sm font-semibold text-[var(--map-side-control-text-color)] transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                        disabled={aiSubmitting[node.id] === true}
                        onClick={() => requestAi(selectedAssistance)}
                        type="button"
                    >
                        {aiSubmitting[node.id]
                            ? t(
                                  'learning.companion.dialogue.ai_loading',
                                  'The companion is considering this context...',
                              )
                            : t(
                                  'learning.companion.dialogue.ai_request',
                                  'Use this level of support',
                              )}
                    </button>
                </div>
            ) : null}

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

function isRecordedAssistanceLevel(
    value: string | undefined,
): value is 'hint' | 'questions_only' | 'post_attempt_support' {
    return (
        value === 'hint' ||
        value === 'questions_only' ||
        value === 'post_attempt_support'
    );
}
