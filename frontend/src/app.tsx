import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { apiClient } from './api/client';
import { OriginalLoginPage } from './original-login';
import { OriginalBookmarksPage } from './original-bookmarks';
import { OriginalOpenPracticePage } from './original-activity-playback';
import { OriginalWelcomePage } from './original-welcome';
import {
    PublicInformationPage,
    PublicSourceCodePage,
} from './public-information';
import { PublicWorldPage } from './public-world';

type CurrentUserState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | { kind: 'loaded'; email: string }
    | { kind: 'unavailable' };

const publicSlugs = ['about', 'imprint', 'data-protection'] as const;

/**
 * Each active route is a source-derived React surface with an available Rust
 * contract. Do not add placeholder pages here: extract the corresponding
 * Laravel React page first, or leave the route unavailable.
 */
export function App() {
    const location = useLocation();
    const [currentUser, setCurrentUser] = useState<CurrentUserState>({
        kind: 'loading',
    });

    useEffect(() => {
        void loadCurrentUser().then(setCurrentUser);
    }, [location.pathname]);

    if (location.pathname === '/') {
        return (
            <OriginalWelcomePage
                isAuthenticated={currentUser.kind === 'loaded'}
            />
        );
    }

    if (location.pathname === '/world') {
        return (
            <PublicWorldPage
                isAuthenticated={currentUser.kind === 'loaded'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={
                    currentUser.kind === 'loaded' ? currentUser.email : null
                }
            />
        );
    }

    if (location.pathname === '/bookmarks') {
        return (
            <OriginalBookmarksPage
                isAuthenticationLoading={currentUser.kind === 'loading'}
                isAuthenticated={currentUser.kind === 'loaded'}
            />
        );
    }

    if (location.pathname === '/login') {
        return <OriginalLoginPage />;
    }

    const playerMatch = location.pathname.match(
        /^\/learning\/nodes\/([^/]+)\/play$/,
    );
    if (playerMatch) {
        return (
            <OriginalOpenPracticePage
                nodeSlug={decodeURIComponent(playerMatch[1])}
                playRunId={new URLSearchParams(location.search).get('run')}
            />
        );
    }

    if (location.pathname === '/source') {
        return <PublicSourceCodePage />;
    }

    const publicInformationSlug = location.pathname.slice(1);
    if (
        publicSlugs.includes(
            publicInformationSlug as (typeof publicSlugs)[number],
        )
    ) {
        return <PublicInformationPage slug={publicInformationSlug} />;
    }

    // The Laravel application has no generic client-side not-found surface for
    // these public routes. Keep an unsupported deep link on a retained public
    // page rather than introducing another substitute design.
    return <Navigate replace to="/" />;
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

        return { kind: 'loaded', email: data.email };
    } catch {
        return { kind: 'unavailable' };
    }
}
