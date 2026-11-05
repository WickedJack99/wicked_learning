import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';

import { apiClient } from './api/client';
import { OriginalLoginPage } from './original-login';
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

    if (location.pathname === '/login') {
        return <OriginalLoginPage />;
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

    return <NotFound />;
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

function NotFound() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-slate-950 p-6 text-slate-100">
            <section className="max-w-md text-center">
                <h1 className="text-2xl font-semibold">Page not found</h1>
                <p className="mt-3 text-slate-300">
                    This route is not available in the Rust replatform yet.
                </p>
            </section>
        </main>
    );
}
