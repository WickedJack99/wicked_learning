import { Suspense, lazy, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { useLocation } from 'react-router';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';

import { apiClient } from './api/client';
import type { components } from './api/schema';
import { SourcePageProjectionProvider } from './page-props';
import {
    loadPersonalSettingsProjection,
    type PersonalSettingsProjection,
} from './personal-settings-projection';

type SettingsBootstrap = components['schemas']['SettingsBootstrap'];
type RootSettingsProps = {
    accessCapabilities: SettingsBootstrap['access_capabilities'];
    canAccessAdministration: boolean;
    personalSettings: PersonalSettingsProjection['props'] & { initialSection: 'profile' };
    publicPresentation: PersonalSettingsProjection['props']['publicPresentation'];
    settingsNotifications: {
        pendingFeedbackRequests: number;
        pendingOrganizationIconReports: number;
        reportedOrganizations: Array<{
            iconUrl: string | null;
            id: string;
            name: string;
        }>;
    };
};

const sourceSettingsModules = import.meta.glob<{
    default: ComponentType<Record<string, unknown>>;
}>('../../canonical-source/resources/js/pages/settings/index.tsx');
const loadSettingsIndex = sourceSettingsModules[
    '../../canonical-source/resources/js/pages/settings/index.tsx'
];

if (!loadSettingsIndex) {
    throw new Error('The copied Settings index source module is unavailable.');
}

const SourceSettingsIndex = lazy(loadSettingsIndex);

type LoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | {
          bootstrap: SettingsBootstrap;
          kind: 'ready';
          personal: PersonalSettingsProjection;
      };

const personalPanelAliases = new Set([
    null,
    'appearance',
    'notifications',
    'personal',
    'profile',
    'security',
]);

/**
 * Activates the copied root Settings document only for its complete Personal
 * panel. Admin panels are intercepted before the source page receives any
 * absent panel data; they remain explicit unavailable routes until each has a
 * separately audited document projection.
 */
export function SettingsRootRoute() {
    const [state, setState] = useState<LoadState>({ kind: 'loading' });
    const location = useLocation();
    const selectedPanel = new URLSearchParams(location.search).get('panel');

    useEffect(() => {
        if (!personalPanelAliases.has(selectedPanel)) {
            return;
        }

        let isMounted = true;

        void Promise.all([
            apiClient.GET('/settings/bootstrap'),
            loadPersonalSettingsProjection(),
        ])
            .then(([bootstrap, personal]) => {
                if (!isMounted) {
                    return;
                }

                if (!bootstrap.response.ok || !bootstrap.data || !personal) {
                    setState({ kind: 'unavailable' });

                    return;
                }

                setState({
                    bootstrap: bootstrap.data,
                    kind: 'ready',
                    personal,
                });
            })
            .catch(() => {
                if (isMounted) {
                    setState({ kind: 'unavailable' });
                }
            });

        return () => {
            isMounted = false;
        };
    }, [selectedPanel]);

    if (!personalPanelAliases.has(selectedPanel)) {
        return <UnavailableSettingsPanel />;
    }

    if (state.kind === 'loading') {
        return (
            <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
                <Spinner className="size-6" />
            </main>
        );
    }

    if (state.kind === 'unavailable') {
        return <UnavailableSettingsPanel />;
    }

    return <MountedSettingsRoot bootstrap={state.bootstrap} personal={state.personal} />;
}

function MountedSettingsRoot({
    bootstrap,
    personal,
}: Pick<Extract<LoadState, { kind: 'ready' }>, 'bootstrap' | 'personal'>) {
    useAppearancePageSync(true, personal.appearance);

    const props: RootSettingsProps = {
        accessCapabilities: bootstrap.access_capabilities,
        canAccessAdministration: bootstrap.can_access_administration,
        personalSettings: {
            ...personal.props,
            initialSection: 'profile',
        },
        publicPresentation: personal.props.publicPresentation,
        settingsNotifications: {
            pendingFeedbackRequests: bootstrap.notifications.pending_feedback_requests,
            pendingOrganizationIconReports:
                bootstrap.notifications.pending_organization_icon_reports,
            // The copied component consumes this opaque value only as React's
            // stable key. Preserve Rust's UUID rather than fabricating a
            // Laravel numeric organization identifier.
            reportedOrganizations: bootstrap.notifications.reported_organizations.map(
                (organization) => ({
                    iconUrl: organization.icon_url,
                    id: organization.id,
                    name: organization.name,
                }),
            ),
        },
    };

    return (
        <SourcePageProjectionProvider
            value={{
                component: 'settings/index',
                props: {
                    ...personal.props,
                    ...props,
                },
            }}
        >
            {/*
              The copied page's type includes every lazily loaded admin panel.
              This route admits only Personal, so no absent admin prop is read;
              unprojected selections never mount this component.
            */}
            <Suspense
                fallback={
                    <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
                        <Spinner className="size-6" />
                    </main>
                }
            >
                <SourceSettingsIndex {...(props as unknown as Record<string, unknown>)} />
            </Suspense>
        </SourcePageProjectionProvider>
    );
}

function UnavailableSettingsPanel() {
    return (
        <main className="flex min-h-svh items-center justify-center bg-background p-6">
            <div className="w-full max-w-xl">
                <AlertError
                    title="Settings are unavailable."
                    errors={[
                        'This Settings panel does not yet have an audited Rust page projection.',
                    ]}
                />
            </div>
        </main>
    );
}
