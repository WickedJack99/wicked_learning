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
import type { PublicPresentation } from './public-presentation';
import { PublicWorldPage } from './public-world';

type CurrentUserState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | { kind: 'loaded'; email: string }
    | { kind: 'unavailable' };

type PublicPresentationState =
    | { kind: 'loading' }
    | { kind: 'loaded'; presentation: PublicPresentation }
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
    const [presentationState, setPresentationState] =
        useState<PublicPresentationState>({ kind: 'loading' });

    useEffect(() => {
        void loadCurrentUser().then(setCurrentUser);
    }, [location.pathname]);

    useEffect(() => {
        let isCurrent = true;

        void apiClient.GET('/public/presentation').then(({ data, response }) => {
            if (!isCurrent) {
                return;
            }
            setPresentationState(
                response.ok && data
                    ? { kind: 'loaded', presentation: data }
                    : { kind: 'unavailable' },
            );
        }).catch(() => {
            if (isCurrent) {
                setPresentationState({ kind: 'unavailable' });
            }
        });

        return () => {
            isCurrent = false;
        };
    }, []);

    const isPublicPresentationRoute =
        location.pathname === '/' ||
        location.pathname === '/login' ||
        location.pathname === '/source' ||
        publicSlugs.includes(
            location.pathname.slice(1) as (typeof publicSlugs)[number],
        );
    if (isPublicPresentationRoute && presentationState.kind !== 'loaded') {
        return <PublicPresentationStatus state={presentationState.kind} />;
    }

    const presentation =
        presentationState.kind === 'loaded'
            ? presentationState.presentation
            : null;

    if (location.pathname === '/') {
        return (
            <OriginalWelcomePage
                isAuthenticated={currentUser.kind === 'loaded'}
                presentation={presentation!}
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
        return <OriginalLoginPage presentation={presentation!} />;
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
        return <PublicSourceCodePage presentation={presentation!} />;
    }

    const publicInformationSlug = location.pathname.slice(1);
    if (
        publicSlugs.includes(
            publicInformationSlug as (typeof publicSlugs)[number],
        )
    ) {
        return (
            <PublicInformationPage
                presentation={presentation!}
                slug={publicInformationSlug}
            />
        );
    }

    // The Laravel application has no generic client-side not-found surface for
    // these public routes. Keep an unsupported deep link on a retained public
    // page rather than introducing another substitute design.
    return <Navigate replace to="/" />;
}

function PublicPresentationStatus({
    state,
}: {
    state: 'loading' | 'unavailable';
}) {
    const message =
        state === 'loading'
            ? 'Loading public presentation…'
            : 'Public presentation is temporarily unavailable.';

    return (
        <main className="flex min-h-svh items-center justify-center bg-[#07111f] p-6 text-slate-100">
            <p aria-live={state === 'loading' ? 'polite' : undefined} role={state === 'unavailable' ? 'alert' : undefined}>
                {message}
            </p>
        </main>
    );
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
