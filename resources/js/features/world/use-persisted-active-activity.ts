import { useCallback, useEffect, useState } from 'react';
import { readPersistedActiveActivity } from './active-activity';
import type { ActiveActivity } from './active-activity';

/** Keeps learner navigation in sync with the activity last opened by the learner. */
export function usePersistedActiveActivity(refreshKey?: string) {
    const [activeActivity, setActiveActivity] = useState<ActiveActivity | null>(
        () => readPersistedActiveActivity(),
    );
    const refresh = useCallback(() => {
        setActiveActivity(readPersistedActiveActivity());
    }, []);

    useEffect(() => {
        window.addEventListener('learning:active-activity-changed', refresh);
        window.addEventListener('storage', refresh);

        return () => {
            window.removeEventListener(
                'learning:active-activity-changed',
                refresh,
            );
            window.removeEventListener('storage', refresh);
        };
    }, [refresh]);

    useEffect(() => {
        const refreshTimer = window.setTimeout(refresh, 0);

        return () => window.clearTimeout(refreshTimer);
    }, [refresh, refreshKey]);

    return activeActivity;
}
