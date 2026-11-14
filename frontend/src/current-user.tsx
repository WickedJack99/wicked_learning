import {
    createContext,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useContext,
    useEffect,
    useState,
} from 'react';
import { useLocation } from 'react-router';

import { apiClient } from './api/client';
import type { OriginalAppearance } from './original-appearance';

export type CurrentUserState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | {
          kind: 'loaded';
          appearance: OriginalAppearance;
          capabilities: string[];
          email: string;
          roles: string[];
          settingsAccess: Record<string, boolean>;
          subjectId: string;
      }
    | { kind: 'unavailable' };

type CurrentUserContextValue = {
    currentUser: CurrentUserState;
    setCurrentUser: Dispatch<SetStateAction<CurrentUserState>>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/**
 * Keeps the typed `/me` projection in one place so shared page chrome can
 * render the same authenticated account information as its Laravel source.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<CurrentUserState>({
        kind: 'loading',
    });

    useEffect(() => {
        void loadCurrentUser().then(setCurrentUser);
    }, [location.pathname]);

    return (
        <CurrentUserContext.Provider value={{ currentUser, setCurrentUser }}>
            {children}
        </CurrentUserContext.Provider>
    );
}

export function useCurrentUser(): CurrentUserContextValue {
    const currentUser = useContext(CurrentUserContext);

    if (!currentUser) {
        throw new Error('CurrentUserProvider is required.');
    }

    return currentUser;
}

async function loadCurrentUser(): Promise<CurrentUserState> {
    try {
        const { data, response } = await apiClient.GET('/me');
        if (response.status === 401) {
            return { kind: 'anonymous' };
        }
        if (!response.ok || !data) {
            return { kind: 'unavailable' };
        }

        return {
            kind: 'loaded',
            // The fallback keeps older mocked contract responses harmless while
            // live API responses always carry the documented preference.
            appearance: data.appearance === 'dark' ? 'dark' : 'light',
            capabilities: data.capabilities,
            email: data.email,
            roles: data.roles,
            settingsAccess: data.settings_access,
            subjectId: data.subject_id,
        };
    } catch {
        return { kind: 'unavailable' };
    }
}
