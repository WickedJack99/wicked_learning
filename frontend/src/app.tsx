import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { OriginalLoginPage } from './original-login';
import {
    OriginalForgotPasswordPage,
    OriginalResetPasswordPage,
} from './original-password-recovery';
import { OriginalConfirmPasswordPage } from './original-confirm-password';
import { OriginalTwoFactorChallengePage } from './original-two-factor-challenge';
import { OriginalOrganizationsPage } from './original-organizations';
import { OriginalRegisterPage } from './original-register';
import { OriginalRecallDeskPage } from './original-recall-desk';
import { OriginalBookmarksPage } from './original-bookmarks';
import { OriginalOpenPracticePage } from './original-activity-playback';
import { OriginalPersonalAppearancePage } from './original-personal-appearance';
import { OriginalPersonalFeedbackPage } from './original-personal-feedback';
import { OriginalPersonalLanguagePage } from './original-personal-language';
import { OriginalPersonalNotificationsPage } from './original-personal-notifications';
import { OriginalPersonalProfilePage } from './original-personal-profile';
import { OriginalPersonalDeleteAccountPage } from './original-personal-delete-account';
import { OriginalPersonalSoundPage } from './original-personal-sound';
import { OriginalPersonalSecurityPage } from './original-personal-security';
import { OriginalPlatformFeedbackPage } from './original-platform-feedback';
import { OriginalPathsPage } from './original-paths';
import { OriginalTopicsPage } from './original-topics';
import { OriginalWelcomePage } from './original-welcome';
import {
    PublicInformationPage,
    PublicSourceCodePage,
} from './public-information';
import {
    type OriginalAppearance,
    useOriginalAppearance,
} from './original-appearance';
import type { PublicPresentation } from './public-presentation';
import { PublicWorldPage } from './public-world';

type CurrentUserState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | {
          kind: 'loaded';
          appearance: OriginalAppearance;
          capabilities: string[];
          email: string;
          roles: string[];
          subjectId: string;
      }
    | { kind: 'unavailable' };

type PublicPresentationState =
    | { kind: 'loading' }
    | { kind: 'loaded'; presentation: PublicPresentation }
    | { kind: 'unavailable' };

const publicSlugs = ['about', 'imprint', 'data-protection'] as const;

const OriginalCompetencePage = lazy(async () => {
    const module = await import('./original-competence');

    return { default: module.OriginalCompetencePage };
});

const OriginalLearningSupportModerationPage = lazy(async () => {
    const module = await import('./original-learning-support-moderation');

    return { default: module.OriginalLearningSupportModerationPage };
});

const OriginalPlatformFeedbackReviewPage = lazy(async () => {
    const module = await import('./original-platform-feedback-review');

    return { default: module.OriginalPlatformFeedbackReviewPage };
});

const OriginalJournalFeedbackReviewPage = lazy(async () => {
    const module = await import('./original-journal-feedback-review');

    return { default: module.OriginalJournalFeedbackReviewPage };
});

const OriginalGroupManagementPage = lazy(async () => {
    const module = await import('./original-group-management');

    return { default: module.OriginalGroupManagementPage };
});

const OriginalOrganizationIconModerationPage = lazy(async () => {
    const module = await import('./original-organization-icon-moderation');

    return { default: module.OriginalOrganizationIconModerationPage };
});

const OriginalAccessLinksPage = lazy(async () => {
    const module = await import('./original-access-links');

    return { default: module.OriginalAccessLinksPage };
});

const OriginalAdminUsersPage = lazy(async () => {
    const module = await import('./original-admin-users');

    return { default: module.OriginalAdminUsersPage };
});

const OriginalAdminRolesPage = lazy(async () => {
    const module = await import('./original-admin-roles');

    return { default: module.OriginalAdminRolesPage };
});

const OriginalAccessLinkRedeemPage = lazy(async () => {
    const module = await import('./original-access-links');

    return { default: module.OriginalAccessLinkRedeemPage };
});

/**
 * Each active route is a source-derived React surface with an available Rust
 * contract. Do not add placeholder pages here: extract the corresponding
 * Laravel React page first, or leave the route unavailable.
 */
export function App() {
    const location = useLocation();
    const [appearance, setAppearance] = useOriginalAppearance();
    const [currentUser, setCurrentUser] = useState<CurrentUserState>({
        kind: 'loading',
    });
    const [presentationState, setPresentationState] =
        useState<PublicPresentationState>({ kind: 'loading' });

    useEffect(() => {
        void loadCurrentUser().then(setCurrentUser);
    }, [location.pathname]);

    useEffect(() => {
        if (
            currentUser.kind === 'loaded' &&
            currentUser.appearance !== appearance
        ) {
            setAppearance(currentUser.appearance);
        }
    }, [appearance, currentUser, setAppearance]);

    async function saveAppearance(
        nextAppearance: OriginalAppearance,
    ): Promise<void> {
        const token = await getCsrfToken();
        const { data, response } = await apiClient.PATCH(
            '/learner/appearance',
            {
                body: { appearance: nextAppearance },
                params: { header: { 'X-CSRF-Token': token } },
            },
        );
        if (!response.ok || !data) {
            throw new Error('appearance unavailable');
        }
        setAppearance(data.appearance);
        setCurrentUser((current) =>
            current.kind === 'loaded'
                ? { ...current, appearance: data.appearance }
                : current,
        );
    }

    useEffect(() => {
        let isCurrent = true;

        void apiClient
            .GET('/public/presentation')
            .then(({ data, response }) => {
                if (!isCurrent) {
                    return;
                }
                setPresentationState(
                    response.ok && data
                        ? { kind: 'loaded', presentation: data }
                        : { kind: 'unavailable' },
                );
            })
            .catch(() => {
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
        location.pathname === '/forgot-password' ||
        /^\/reset-password\/[^/]+$/.test(location.pathname) ||
        location.pathname === '/confirm-password' ||
        location.pathname === '/two-factor-challenge' ||
        location.pathname === '/register' ||
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
                appearance={appearance}
                isAuthenticated={currentUser.kind === 'loaded'}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    if (location.pathname === '/world') {
        return (
            <PublicWorldPage
                appearance={appearance}
                isAuthenticated={currentUser.kind === 'loaded'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={
                    currentUser.kind === 'loaded' ? currentUser.email : null
                }
            />
        );
    }

    const accessLinkMatch = location.pathname.match(/^\/access-links\/([^/]+)$/);
    if (accessLinkMatch) {
        const token = decodeURIComponent(accessLinkMatch[1]);
        return <Suspense fallback={null}><OriginalAccessLinkRedeemPage token={token} isAuthenticated={currentUser.kind === 'loaded'} /></Suspense>;
    }

    if (location.pathname === '/bookmarks') {
        return (
            <OriginalBookmarksPage
                appearance={appearance}
                isAuthenticationLoading={currentUser.kind === 'loading'}
                isAuthenticated={currentUser.kind === 'loaded'}
            />
        );
    }

    if (location.pathname === '/home') {
        if (
            currentUser.kind === 'loading' ||
            currentUser.kind === 'unavailable'
        ) {
            return null;
        }

        if (currentUser.kind === 'anonymous') {
            return <Navigate replace to="/login" />;
        }

        return (
            <OriginalRecallDeskPage
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={currentUser.email}
                userSubjectId={currentUser.subjectId}
            />
        );
    }

    if (location.pathname === '/paths') {
        return (
            <OriginalPathsPage
                isAuthenticationLoading={currentUser.kind === 'loading'}
                isAuthenticated={currentUser.kind === 'loaded'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={
                    currentUser.kind === 'loaded' ? currentUser.email : ''
                }
            />
        );
    }

    if (location.pathname === '/competence') {
        return (
            <Suspense fallback={null}>
                <OriginalCompetencePage
                    isAuthenticationLoading={currentUser.kind === 'loading'}
                    isAuthenticated={currentUser.kind === 'loaded'}
                    onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                    userEmail={
                        currentUser.kind === 'loaded' ? currentUser.email : ''
                    }
                />
            </Suspense>
        );
    }

    if (
        location.pathname === '/topics' ||
        /^\/topics\/[^/]+$/.test(location.pathname)
    ) {
        return (
            <OriginalTopicsPage
                isAuthenticationLoading={currentUser.kind === 'loading'}
                isAuthenticated={currentUser.kind === 'loaded'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={
                    currentUser.kind === 'loaded' ? currentUser.email : ''
                }
            />
        );
    }

    if (location.pathname === '/login') {
        return (
            <OriginalLoginPage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    if (location.pathname === '/forgot-password') {
        return (
            <OriginalForgotPasswordPage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    const passwordResetMatch = location.pathname.match(/^\/reset-password\/([^/]+)$/);
    if (passwordResetMatch) {
        return (
            <OriginalResetPasswordPage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
                token={decodeURIComponent(passwordResetMatch[1])}
            />
        );
    }

    if (location.pathname === '/confirm-password') {
        if (
            currentUser.kind === 'loading' ||
            currentUser.kind === 'unavailable'
        ) {
            return null;
        }

        if (currentUser.kind === 'anonymous') {
            const next = `${location.pathname}${location.search}`;
            return (
                <Navigate
                    replace
                    to={`/login?next=${encodeURIComponent(next)}`}
                />
            );
        }

        return (
            <OriginalConfirmPasswordPage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    if (location.pathname === '/two-factor-challenge') {
        return (
            <OriginalTwoFactorChallengePage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    if (location.pathname === '/register') {
        return (
            <OriginalRegisterPage
                appearance={appearance}
                onAppearanceChange={setAppearance}
                presentation={presentation!}
            />
        );
    }

    if (location.pathname === '/feedback') {
        if (
            currentUser.kind === 'loading' ||
            currentUser.kind === 'unavailable'
        ) {
            return null;
        }

        return (
            <OriginalPlatformFeedbackPage
                isAuthenticated={currentUser.kind === 'loaded'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={
                    currentUser.kind === 'loaded' ? currentUser.email : ''
                }
            />
        );
    }

    const organizationMatch = location.pathname.match(/^\/organizations\/([^/]+)$/);
    if (location.pathname === '/organizations' || organizationMatch) {
        return (
            <OriginalOrganizationsPage
                isAuthenticated={currentUser.kind === 'loaded'}
                isAuthenticationLoading={currentUser.kind === 'loading'}
                onSignedOut={() => setCurrentUser({ kind: 'anonymous' })}
                userEmail={currentUser.kind === 'loaded' ? currentUser.email : ''}
                slug={
                    organizationMatch
                        ? decodeURIComponent(organizationMatch[1])
                        : undefined
                }
            />
        );
    }

    if (location.pathname === '/settings') {
        const usersPanel =
            new URLSearchParams(location.search).get('panel') ===
                'admin-access' &&
            new URLSearchParams(location.search).get('access') === 'users';
        const rolesPanel =
            new URLSearchParams(location.search).get('panel') ===
                'admin-access' &&
            new URLSearchParams(location.search).get('access') === 'roles';
        const groupPanel =
            new URLSearchParams(location.search).get('panel') ===
                'admin-access' &&
            new URLSearchParams(location.search).get('access') === 'groups';
        const supportPanel =
            new URLSearchParams(location.search).get('panel') ===
            'admin-learning-support';
        if (
            currentUser.kind === 'loading' ||
            currentUser.kind === 'unavailable'
        ) {
            return null;
        }

        if (currentUser.kind === 'anonymous') {
            return <Navigate replace to="/login" />;
        }

        if (usersPanel) {
            return (
                <Suspense fallback={null}>
                    <OriginalAdminUsersPage
                        appearance={appearance}
                        currentSubjectId={currentUser.subjectId}
                    />
                </Suspense>
            );
        }

        if (rolesPanel) {
            return <Suspense fallback={null}><OriginalAdminRolesPage appearance={appearance} /></Suspense>;
        }

        if (groupPanel) {
            return (
                <Suspense fallback={null}>
                    <OriginalGroupManagementPage appearance={appearance} />
                </Suspense>
            );
        }

        const accessLinksPanel =
            new URLSearchParams(location.search).get('panel') === 'admin-access' &&
            new URLSearchParams(location.search).get('access') === 'links';
        if (accessLinksPanel) {
            if (!currentUser.capabilities.includes('access_links_manage')) {
                return <Navigate replace to="/home" />;
            }
            return <Suspense fallback={null}><OriginalAccessLinksPage appearance={appearance} /></Suspense>;
        }

        if (
            supportPanel &&
            new URLSearchParams(location.search).get('support') ===
                'platform-feedback'
        ) {
            if (
                !currentUser.capabilities.includes('platform_feedback_view')
            ) {
                return <Navigate replace to="/home" />;
            }

            return (
                <Suspense fallback={null}>
                    <OriginalPlatformFeedbackReviewPage
                        appearance={appearance}
                        canReview={currentUser.capabilities.includes(
                            'platform_feedback_review',
                        )}
                    />
                </Suspense>
            );
        }

        if (
            supportPanel &&
            new URLSearchParams(location.search).get('support') ===
                'organization-icons'
        ) {
            if (!currentUser.capabilities.includes('organization_icons_moderate')) {
                return <Navigate replace to="/home" />;
            }
            return <Suspense fallback={null}><OriginalOrganizationIconModerationPage appearance={appearance} /></Suspense>;
        }

        if (
            supportPanel &&
            new URLSearchParams(location.search).get('support') ===
                'feedback-requests'
        ) {
            const canViewJournalFeedback = currentUser.capabilities.includes(
                'journal_feedback_view',
            );
            const canManageJournalFeedbackPolicy =
                currentUser.capabilities.includes(
                    'journal_feedback_policy_manage',
                );
            if (!canViewJournalFeedback && !canManageJournalFeedbackPolicy) {
                return <Navigate replace to="/home" />;
            }

            return (
                <Suspense fallback={null}>
                    <OriginalJournalFeedbackReviewPage
                        appearance={appearance}
                        canManagePolicy={canManageJournalFeedbackPolicy}
                        canRespond={currentUser.capabilities.includes(
                            'journal_feedback_review',
                        )}
                        canView={canViewJournalFeedback}
                    />
                </Suspense>
            );
        }

        if (!supportPanel) {
            if (
                new URLSearchParams(location.search).get('personal') ===
                'language'
            ) {
                return <OriginalPersonalLanguagePage appearance={appearance} />;
            }
            if (
                new URLSearchParams(location.search).get('personal') ===
                'feedback'
            ) {
                return <OriginalPersonalFeedbackPage appearance={appearance} />;
            }
            if (
                new URLSearchParams(location.search).get('personal') ===
                'notifications'
            ) {
                return (
                    <OriginalPersonalNotificationsPage
                        appearance={appearance}
                    />
                );
            }
            if (
                new URLSearchParams(location.search).get('personal') === 'sound'
            ) {
                return <OriginalPersonalSoundPage appearance={appearance} />;
            }
            if (
                new URLSearchParams(location.search).get('personal') ===
                'security'
            ) {
                return <OriginalPersonalSecurityPage appearance={appearance} />;
            }
            if (
                new URLSearchParams(location.search).get('personal') ===
                'delete-account'
            ) {
                return (
                    <OriginalPersonalDeleteAccountPage
                        appearance={appearance}
                        onDeleted={() => {
                            // The source ends the session and redirects home.
                            // A document navigation also prevents the
                            // protected-settings guard from winning a React
                            // state race during this destructive transition.
                            window.location.replace('/');
                        }}
                    />
                );
            }
            if (
                new URLSearchParams(location.search).get('personal') ===
                'appearance'
            ) {
                return (
                    <OriginalPersonalAppearancePage
                        appearance={appearance}
                        onAppearanceChange={saveAppearance}
                    />
                );
            }
            return <OriginalPersonalProfilePage appearance={appearance} />;
        }

        if (
            !currentUser.roles.some(
                (role) =>
                    role === 'learning_support' ||
                    role === 'platform_administrator',
            )
        ) {
            return <Navigate replace to="/home" />;
        }

        return (
            <Suspense fallback={null}>
                <OriginalLearningSupportModerationPage
                    appearance={appearance}
                />
            </Suspense>
        );
    }

    const playerMatch = location.pathname.match(
        /^\/learning\/nodes\/([^/]+)\/play$/,
    );
    if (playerMatch) {
        return (
            <OriginalOpenPracticePage
                appearance={appearance}
                nodeSlug={decodeURIComponent(playerMatch[1])}
                playRunId={new URLSearchParams(location.search).get('run')}
            />
        );
    }

    if (location.pathname === '/source') {
        return (
            <PublicSourceCodePage
                appearance={appearance}
                presentation={presentation!}
            />
        );
    }

    const publicInformationSlug = location.pathname.slice(1);
    if (
        publicSlugs.includes(
            publicInformationSlug as (typeof publicSlugs)[number],
        )
    ) {
        return (
            <PublicInformationPage
                appearance={appearance}
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
            <p
                aria-live={state === 'loading' ? 'polite' : undefined}
                role={state === 'unavailable' ? 'alert' : undefined}
            >
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

        return {
            kind: 'loaded',
            // The fallback keeps older mocked contract responses harmless while
            // live API responses always carry the documented preference.
            appearance: data.appearance === 'dark' ? 'dark' : 'light',
            capabilities: data.capabilities,
            email: data.email,
            roles: data.roles,
            subjectId: data.subject_id,
        };
    } catch {
        return { kind: 'unavailable' };
    }
}
