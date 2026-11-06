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

/** A safe default keeps an unavailable preference read from making playback
 * unusable. The server remains the durable owner when a learner saves. */
export function useLearnerSoundPreferences(): LearnerSoundPreferences {
    const [preferences, setPreferences] = useState<LearnerSoundPreferences>(
        defaultLearnerSoundPreferences,
    );

    useEffect(() => {
        let active = true;
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
        };
    }, []);

    return preferences;
}
