import { useEffect } from 'react';
import { useLayeredSoundPlayer } from '@/features/sounds/sound-player';
import type { LearningActivity } from '@/types';
import { booleanConfig, numericConfig } from './activity-utils';

/** Starts configured scene ambience while an activity is the active route step. */
export function ActivityAmbientSound({
    activity,
}: {
    activity: LearningActivity;
}) {
    const { play, stop } = useLayeredSoundPlayer();
    const ambientSound = isRecord(activity.config.ambientSound)
        ? activity.config.ambientSound
        : null;
    const soundId = numericConfig(ambientSound?.soundId, 0);
    const isEnabled = booleanConfig(ambientSound?.enabled, false);
    const sound = activity.configuredSounds.find(
        (candidate) => candidate.id === soundId,
    );
    const layerKey = `activity-ambient-${activity.id}`;

    useEffect(() => {
        if (!isEnabled || !sound) {
            return;
        }

        play(sound, layerKey);

        return () => stop(layerKey);
    }, [isEnabled, layerKey, play, sound, stop]);

    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
