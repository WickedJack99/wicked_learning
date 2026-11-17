import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef } from 'react';
import type { DialogueTypingSound } from '@/types';
import type { SoundPreferences } from './sound-player';

const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
    ambienceVolume: 100,
    effectsVolume: 100,
    muted: false,
};

const audioCache = new Map<string, HTMLAudioElement>();

export function useDialogueTypingSoundPlayer() {
    const { soundPreferences = DEFAULT_SOUND_PREFERENCES } = usePage().props;
    const activeAudio = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        activeAudio.current?.pause();

        if (activeAudio.current) {
            activeAudio.current.currentTime = 0;
            activeAudio.current = null;
        }
    }, []);

    const play = useCallback(
        (sound: DialogueTypingSound) => {
            stop();

            if (soundPreferences.muted || soundPreferences.effectsVolume <= 0) {
                return;
            }

            const audio = audioCache.get(sound.url) ?? new Audio(sound.url);
            audio.preload = 'auto';
            audio.currentTime = 0;
            audio.volume =
                normalizedVolume(sound.volume) *
                normalizedVolume(soundPreferences.effectsVolume);
            activeAudio.current = audio;

            void audio.play().catch(() => {
                if (activeAudio.current === audio) {
                    activeAudio.current = null;
                }
            });

            audioCache.set(sound.url, audio);
        },
        [soundPreferences, stop],
    );

    useEffect(() => stop, [stop]);

    return { play, stop };
}

function normalizedVolume(volume: number | null | undefined): number {
    if (typeof volume !== 'number' || !Number.isFinite(volume)) {
        return 0.7;
    }

    return Math.min(Math.max(volume, 0), 100) / 100;
}
