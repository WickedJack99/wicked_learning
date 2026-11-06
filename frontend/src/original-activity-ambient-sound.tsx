import { useEffect } from 'react';

import type { components } from './api/schema';
import { useLearnerSoundPreferences } from './learner-sound-preferences';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];

/**
 * Source-adapted from `features/world/activity-ambient-sound.tsx` and the
 * shared layered sound player. The API publishes only the one sound explicitly
 * referenced by the safe activity configuration; this component never treats
 * arbitrary authored JSON as a media URL.
 */
export function OriginalActivityAmbientSound({
    activity,
}: {
    activity: LearnerPlaybackActivity;
}) {
    const preferences = useLearnerSoundPreferences();
    const ambientSound = configuredAmbientSound(activity);

    useEffect(() => {
        if (
            !ambientSound ||
            preferences.muted ||
            preferences.ambience_volume <= 0
        ) {
            return;
        }

        const audio = new Audio(ambientSound.url);
        audio.loop = ambientSound.looped;
        audio.preload = 'auto';
        audio.volume = normalizedVolume(ambientSound.volume) *
            normalizedVolume(preferences.ambience_volume);

        let stopped = false;
        let timeoutId: number | undefined;
        if (ambientSound.play_seconds && ambientSound.play_seconds > 0) {
            timeoutId = window.setTimeout(
                () => stopAudio(audio),
                ambientSound.play_seconds * 1000,
            );
        }

        void audio.play().catch(() => {
            if (!stopped) {
                stopAudio(audio);
            }
        });

        return () => {
            stopped = true;
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
            stopAudio(audio);
        };
    }, [ambientSound, preferences.ambience_volume, preferences.muted]);

    return null;
}

function configuredAmbientSound(
    activity: LearnerPlaybackActivity,
): components['schemas']['LearnerPlaybackSound'] | null {
    const config = activity.config as { ambientSound?: unknown };
    const ambientSound = config.ambientSound;
    if (!isEnabledAmbientSound(ambientSound)) {
        return null;
    }

    return activity.sounds.find((sound) => sound.id === ambientSound.soundId) ?? null;
}

function isEnabledAmbientSound(
    value: unknown,
): value is { enabled: true; soundId: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const ambientSound = value as Record<string, unknown>;
    return ambientSound.enabled === true && typeof ambientSound.soundId === 'string';
}

function normalizedVolume(volume: number): number {
    return Math.min(Math.max(volume, 0), 100) / 100;
}

function stopAudio(audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
}
