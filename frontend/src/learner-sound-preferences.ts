import { useEffect, useState } from 'react';

import { apiClient } from './api/client';
import type { components } from './api/schema';

export type LearnerSoundPreferences =
    components['schemas']['LearnerSoundPreferences'];

export const defaultLearnerSoundPreferences: LearnerSoundPreferences = {
    ambience_volume: 100,
    effects_volume: 100,
    muted: false,
};

const preferencesChangedEvent = 'wicked-learning:sound-preferences-changed';

/** Lets active source-derived players react when the learner saves settings. */
export function publishLearnerSoundPreferences(
    preferences: LearnerSoundPreferences,
): void {
    window.dispatchEvent(
        new CustomEvent<LearnerSoundPreferences>(preferencesChangedEvent, {
            detail: preferences,
        }),
    );
}

/** A safe default keeps an unavailable preference read from making playback
 * unusable. The server remains the durable owner when a learner saves. */
export function useLearnerSoundPreferences(): LearnerSoundPreferences {
    const [preferences, setPreferences] = useState<LearnerSoundPreferences>(
        defaultLearnerSoundPreferences,
    );

    useEffect(() => {
        let active = true;
        const receiveUpdate = (event: Event): void => {
            const preferences = (event as CustomEvent<LearnerSoundPreferences>)
                .detail;
            if (preferences) {
                setPreferences(preferences);
            }
        };
        window.addEventListener(preferencesChangedEvent, receiveUpdate);
        void apiClient
            .GET('/learner/sound-preferences')
            .then(({ data, response }) => {
                if (active && response.ok && data) {
                    setPreferences(data);
                }
            })
            .catch(() => undefined);
        return () => {
            active = false;
            window.removeEventListener(preferencesChangedEvent, receiveUpdate);
        };
    }, []);

    return preferences;
}
