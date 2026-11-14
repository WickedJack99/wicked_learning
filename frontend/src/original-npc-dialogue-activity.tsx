import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { useLearnerSoundPreferences } from './learner-sound-preferences';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type Dialogue = components['schemas']['LearnerNpcDialogue'];
type DialogueNode = components['schemas']['LearnerNpcDialogueNode'];
type DialogueTypingSoundSet = components['schemas']['LearnerNpcDialogueTypingSoundSet'];
type DialogueTypingSound = components['schemas']['LearnerNpcDialogueTypingSound'];
type DialogueSceneAssetLayer = 'behind_npc' | 'front' | 'bubble' | 'overlay';

type DialogueSceneAsset = {
    id: string;
    imageUrl: string | null;
    label: string;
    layer: DialogueSceneAssetLayer;
    mirrored: boolean;
    width: number;
    x: number;
    y: number;
};

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
    const t = usePlatformTranslation();
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
        return <p className="rounded-lg border border-dashed border-white/20 p-4 text-sm text-[var(--learner-muted-text)]">{t('learning.npc_dialogue.no_start_path', 'This NPC dialogue has no start path yet.')}</p>;
    }

    const isQuestion = currentNode.node_type === 'npc_question';
    const isReflection = currentNode.node_type === 'reflection';
    const isEnd = currentNode.node_type === 'end';
    const canGoBack = dialogue.history.length > 0;
    const backgroundImage = themedImage(currentNode.config, appearance, 'background');
    const backgroundMirrored = booleanConfig(currentNode.config.backgroundMirrored, false);
    const npcImage = themedImage(currentNode.config, appearance, 'npcImage');
    const sceneAssets = useMemo(
        () => dialogueSceneAssets(currentNode.config.sceneAssets, appearance),
        [appearance, currentNode.config.sceneAssets],
    );
    const bubbleStyle = speechBubbleStyle(currentNode, appearance);
    const requestedTypingSoundSetId = nullableString(currentNode.config.typingSoundSetId);
    const typingSoundSet = dialogue.typing_sound_sets.find(
        (set) => set.id === requestedTypingSoundSetId,
    ) ?? dialogue.typing_sound_sets.find((set) => set.is_default);
    const typingSoundEnabled = booleanConfig(currentNode.config.typingSoundEnabled, false)
        && typingSoundSet !== undefined;

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
            {backgroundImage ? <img alt="" className="absolute inset-0 size-full object-cover" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none'; }} src={backgroundImage} style={{ transform: backgroundMirrored ? 'scaleX(-1)' : undefined }} /> : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />
            <DialogueSceneAssetLayers assets={sceneAssets} layer="behind_npc" />
            {npcImage ? <NpcCharacterImage fadeDuration={numberConfig(currentNode.config.fadeDurationSeconds, 0.4)} imageUrl={npcImage} mirrored={booleanConfig(currentNode.config.npcImageMirrored, false)} nodeId={currentNode.id} slideDirection={currentNode.config.slideDirection} slideDuration={numberConfig(currentNode.config.slideDurationSeconds, 0.6)} x={numberConfig(currentNode.config.npcX, 50)} y={numberConfig(currentNode.config.npcY, 50)} /> : null}
            <DialogueSceneAssetLayers assets={sceneAssets} layer="front" />
            <div className="relative z-20 mt-auto flex w-full flex-col gap-4 p-4">
                <DialogueSceneAssetLayers assets={sceneAssets} layer="bubble" />
                <div className="rounded-2xl border p-4 backdrop-blur-md" style={bubbleStyle}>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4" />{currentNode.title}</div>
                    <TypingText key={currentNode.id} soundSet={typingSoundEnabled ? typingSoundSet : undefined} speed={numberConfig(currentNode.config.typingSpeed, 28)} text={currentNode.body ?? ''} />
                    {grantedToolName ? <p className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100">{t('learning.npc_dialogue.tool_added', 'Added tool: :tool', { tool: grantedToolName })}</p> : null}
                    {isQuestion ? answers.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-white/20 p-3 text-sm opacity-80">{t('learning.npc_dialogue.no_answers', 'This question has no answers configured yet.')}</p> : <div className="mt-4 grid gap-2">
                        {answers.map((answer, index) => <button className={`rounded-lg border p-3 text-left text-sm leading-6 transition ${selectedAnswerId === answer.id ? 'border-cyan-600 bg-cyan-50 text-slate-900 dark:border-teal-200 dark:bg-teal-200/10 dark:text-slate-100' : 'border-white/20 bg-white/70 text-slate-800 hover:bg-white dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-950/70'}`} disabled={isSubmitting} key={answer.id} onClick={() => setSelectedAnswerId(answer.id)} type="button"><span className="mr-2 font-semibold">{answer.label ?? String.fromCharCode(65 + index)}</span>{answer.body}</button>)}
                        <button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={!selectedAnswerId || isSubmitting} onClick={() => void answer()} type="button">{t('learning.npc_dialogue.confirm_answer', 'Confirm answer')}</button>
                    </div> : null}
                    {isReflection ? <div className="mt-4 grid gap-3"><textarea className="min-h-28 resize-none rounded-lg border border-white/20 bg-slate-950/30 p-3 text-sm leading-6 text-inherit outline-none focus:border-cyan-400 dark:focus:border-teal-200" onChange={(event) => setReflection(event.target.value)} placeholder={t('learning.npc_dialogue.reflection_placeholder', 'Write a reflection for your journal.')} value={reflection} /><button className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={!reflection.trim() || isSubmitting} onClick={() => void saveReflection()} type="button">{t('learning.npc_dialogue.keep_reflection', 'Keep reflection')}</button></div> : null}
                    {error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-200" role="alert">{error}</p> : null}
                </div>
                <div className="flex items-center justify-between gap-3"><button aria-label={t('learning.npc_dialogue.previous', 'Previous dialogue')} className="rounded-md border border-[var(--learner-border-color)] p-2 disabled:opacity-50" disabled={!canGoBack || isSubmitting} onClick={() => void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/back')} type="button"><ArrowLeft className="size-4" /></button><p className="text-xs text-[var(--learner-muted-text)]">{isReflection ? t('learning.npc_dialogue.reflection_continue', 'Save your reflection to continue.') : isQuestion ? t('learning.npc_dialogue.question_continue', 'Choose an answer, then confirm.') : isEnd ? 'Completing dialogue…' : t('learning.npc_dialogue.keyboard_hint', 'Use Space or arrows to move.')}</p><button aria-label={t('learning.npc_dialogue.next', 'Next dialogue')} className="rounded-md bg-cyan-700 p-2 text-white disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950" disabled={isQuestion || isReflection || isEnd || isSubmitting} onClick={() => void command('/learner/play-runs/{play_run_id}/activities/{activity_slug}/npc-dialogue/continue')} type="button"><ArrowRight className="size-4" /></button></div>
            </div>
            <DialogueSceneAssetLayers assets={sceneAssets} layer="overlay" />
        </div>
    );
}

function answerOptions(dialogue: Dialogue, node: DialogueNode): Array<{ id: string; body: string; label: string | null }> {
    return dialogue.transitions.filter((transition) => transition.from_node_id === node.id && transition.from_connector.startsWith('answer-')).sort((first, second) => first.from_connector.localeCompare(second.from_connector, undefined, { numeric: true })).flatMap((transition) => {
        const answer = dialogue.nodes.find((candidate) => candidate.id === transition.to_node_id);
        return answer?.node_type === 'answer' ? [{ id: answer.id, body: answer.body ?? answer.title, label: typeof answer.config.answerLabel === 'string' ? answer.config.answerLabel : null }] : [];
    });
}

function DialogueSceneAssetLayers({
    assets,
    layer,
}: {
    assets: DialogueSceneAsset[];
    layer: DialogueSceneAssetLayer;
}) {
    return <>{assets.filter((asset) => asset.layer === layer).map((asset) => <DialogueSceneAssetImage asset={asset} key={asset.id} />)}</>;
}

function DialogueSceneAssetImage({ asset }: { asset: DialogueSceneAsset }) {
    if (!asset.imageUrl) return null;

    return <img alt={asset.label} className="pointer-events-none absolute max-h-[95%] object-contain" decoding="async" draggable={false} src={asset.imageUrl} style={{ left: `${asset.x}%`, top: `${asset.y}%`, transform: imageTransform('translate(-50%, -50%)', asset.mirrored), width: `${asset.width}%`, zIndex: dialogueSceneAssetZIndex(asset.layer) }} />;
}

function NpcCharacterImage({
    fadeDuration,
    imageUrl,
    mirrored,
    nodeId,
    slideDirection,
    slideDuration,
    x,
    y,
}: {
    fadeDuration: number;
    imageUrl: string;
    mirrored: boolean;
    nodeId: string;
    slideDirection: unknown;
    slideDuration: number;
    x: number;
    y: number;
}) {
    return <AnimatedNpcCharacterImage fadeDuration={fadeDuration} imageUrl={imageUrl} key={[nodeId, imageUrl, stringConfig(slideDirection, 'left'), slideDuration, fadeDuration, mirrored, x, y].join(':')} mirrored={mirrored} slideDirection={slideDirection} slideDuration={slideDuration} x={x} y={y} />;
}

function AnimatedNpcCharacterImage({
    fadeDuration,
    imageUrl,
    mirrored,
    slideDirection,
    slideDuration,
    x,
    y,
}: Omit<Parameters<typeof NpcCharacterImage>[0], 'nodeId'>) {
    const startTransform = npcEntranceTransform(slideDirection);
    const endTransform = imageTransform('translate(-50%, -50%) translate3d(0, 0, 0)', mirrored);
    const slideDurationMs = Math.max(0, slideDuration) * 1000;
    const fadeDurationMs = Math.max(0, fadeDuration) * 1000;
    const hasEntranceAnimation = slideDurationMs > 0 || fadeDurationMs > 0;
    const [isVisible, setIsVisible] = useState(!hasEntranceAnimation);

    useEffect(() => {
        if (!hasEntranceAnimation) return;
        const frame = window.requestAnimationFrame(() => setIsVisible(true));
        return () => window.cancelAnimationFrame(frame);
    }, [hasEntranceAnimation]);

    return <img alt="" className="absolute z-10 max-h-[70%] max-w-[55%] object-contain" decoding="async" draggable={false} src={imageUrl} style={{ left: `${x}%`, opacity: isVisible ? 1 : 0, top: `${y}%`, transform: isVisible ? endTransform : imageTransform(startTransform, mirrored), transitionDuration: `${slideDurationMs}ms, ${fadeDurationMs}ms`, transitionProperty: 'transform, opacity', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1), ease-out' }} />;
}

const typingAudioCache = new Map<string, HTMLAudioElement>();

function TypingText({ soundSet, speed, text }: { soundSet: DialogueTypingSoundSet | undefined; speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');
    const { play, stop } = useDialogueTypingSoundPlayer();

    useEffect(() => {
        if (!text) {
            setVisibleText('');
            return;
        }
        let index = 0;
        const timer = window.setInterval(() => {
            index += 1;
            setVisibleText(text.slice(0, index));
            const character = text[index - 1];
            if (soundSet && character?.trim()) {
                const sounds = Object.values(soundSet.sounds);
                const sound = soundSet.sounds[character.toLowerCase()] ?? sounds[Math.floor(Math.random() * sounds.length)];
                if (sound) play(sound);
            }
            if (index >= text.length) window.clearInterval(timer);
        }, clampNumber(speed, 1, 250));
        return () => { window.clearInterval(timer); stop(); };
    }, [play, soundSet, speed, stop, text]);

    return <p className="min-h-16 whitespace-pre-wrap text-sm leading-6">{visibleText}</p>;
}

/** Source-adapted typing-audio behavior, gated by the learner's private
 * source-equivalent effects preference. */
function useDialogueTypingSoundPlayer(): { play: (sound: DialogueTypingSound) => void; stop: () => void } {
    const activeAudio = useRef<HTMLAudioElement | null>(null);
    const preferences = useLearnerSoundPreferences();
    const stop = useCallback(() => {
        activeAudio.current?.pause();
        if (activeAudio.current) {
            activeAudio.current.currentTime = 0;
            activeAudio.current = null;
        }
    }, []);
    const play = useCallback((sound: DialogueTypingSound) => {
        if (preferences.muted || preferences.effects_volume <= 0) {
            return;
        }
        stop();
        const audio = typingAudioCache.get(sound.url) ?? new Audio(sound.url);
        audio.preload = 'auto';
        audio.currentTime = 0;
        audio.volume =
            (clampNumber(sound.volume, 0, 100) / 100) *
            (preferences.effects_volume / 100);
        activeAudio.current = audio;
        void audio.play().catch(() => {
            if (activeAudio.current === audio) activeAudio.current = null;
        });
        typingAudioCache.set(sound.url, audio);
    }, [preferences.effects_volume, preferences.muted, stop]);
    useEffect(() => stop, [stop]);
    return { play, stop };
}

function themedImage(config: Record<string, unknown>, appearance: OriginalAppearance, prefix: 'background' | 'npcImage'): string | null {
    const light = config[`${prefix}Light`];
    const dark = config[`${prefix}Dark`];
    const image = appearance === 'light' ? light ?? dark : dark ?? light;
    return typeof image === 'string' && image.trim() ? image : null;
}

function numberConfig(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }

function booleanConfig(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback; }

function stringConfig(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value : fallback; }

function dialogueSceneAssets(value: unknown, appearance: OriginalAppearance): DialogueSceneAsset[] {
    if (!Array.isArray(value)) return [];
    return value.filter(isRecord).map((asset, index) => ({ id: stringConfig(asset.id, `asset-${index + 1}`), imageUrl: themedAssetImage(asset.imageDark, asset.imageLight, appearance), label: stringConfig(asset.label, `Scene asset ${index + 1}`), layer: dialogueSceneAssetLayer(asset.layer), mirrored: booleanConfig(asset.mirrored, false), width: clampNumber(numberConfig(asset.width, 24), 1, 100), x: clampNumber(numberConfig(asset.x, 50), 0, 100), y: clampNumber(numberConfig(asset.y, 50), 0, 100) }));
}

function themedAssetImage(darkValue: unknown, lightValue: unknown, appearance: OriginalAppearance): string | null {
    const darkImage = nullableString(darkValue);
    const lightImage = nullableString(lightValue);
    return appearance === 'light' ? lightImage ?? darkImage : darkImage ?? lightImage;
}

function nullableString(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }

function dialogueSceneAssetLayer(value: unknown): DialogueSceneAssetLayer {
    return value === 'behind_npc' || value === 'front' || value === 'bubble' || value === 'overlay' ? value : 'front';
}

function dialogueSceneAssetZIndex(layer: DialogueSceneAssetLayer): number {
    if (layer === 'behind_npc') return 8;
    if (layer === 'front') return 18;
    if (layer === 'bubble') return 22;
    return 30;
}

function imageTransform(transform: string, mirrored: boolean): string { return mirrored ? `${transform} scaleX(-1)` : transform; }

function npcEntranceTransform(value: unknown): string {
    const offset = 48;
    if (stringConfig(value, 'left') === 'right') return `translate(-50%, -50%) translate3d(${offset}px, 0, 0)`;
    if (stringConfig(value, 'left') === 'top') return `translate(-50%, -50%) translate3d(0, -${offset}px, 0)`;
    if (stringConfig(value, 'left') === 'bottom') return `translate(-50%, -50%) translate3d(0, ${offset}px, 0)`;
    return `translate(-50%, -50%) translate3d(-${offset}px, 0, 0)`;
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

function clampNumber(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }

function isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

function speechBubbleStyle(node: DialogueNode, appearance: OriginalAppearance): CSSProperties {
    const light = appearance === 'light';
    const background = node.config[light ? 'bubbleColorLight' : 'bubbleColorDark'];
    const border = node.config[light ? 'bubbleBorderColorLight' : 'bubbleBorderColorDark'];
    return { backgroundColor: typeof background === 'string' ? background : light ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 23, 42, 0.92)', borderColor: typeof border === 'string' ? border : light ? '#0891b2' : '#2dd4bf' };
}
