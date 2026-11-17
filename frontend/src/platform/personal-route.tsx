import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useLocation, useNavigate } from 'react-router';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import { PersonalSettingsContent } from '@/pages/settings/personal';
import type { PersonalSection } from '@/pages/settings/personal';

import { SourcePageProjectionProvider } from './page-props';
import {
    loadPersonalSettingsProjection,
    type PersonalPageProps,
} from './personal-settings-projection';

const personalSections: PersonalSection[] = [
    'appearance',
    'delete-account',
    'feedback',
    'language',
    'notifications',
    'profile',
    'security',
    'sound',
];

type LoadState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; appearance: 'dark' | 'light'; props: PersonalPageProps };

export function PersonalRoute() {
    const [state, setState] = useState<LoadState>({ kind: 'loading' });
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const requestedSection = params.get('personal');
    const activeSection = personalSections.includes(requestedSection as PersonalSection)
        ? (requestedSection as PersonalSection)
        : 'profile';

    useEffect(() => {
        let isMounted = true;
        void loadPersonalSettingsProjection().then((projection) => {
            if (!isMounted) return;
            if (!projection) {
                setState({ kind: 'unavailable' });
                return;
            }
            setState({
                kind: 'ready',
                appearance: projection.appearance,
                props: projection.props,
            });
        }).catch(() => { if (isMounted) setState({ kind: 'unavailable' }); });
        return () => { isMounted = false; };
    }, []);

    if (state.kind === 'loading') return <main className="flex min-h-svh items-center justify-center bg-background text-foreground"><Spinner className="size-6" /></main>;
    if (state.kind === 'unavailable') return <main className="flex min-h-svh items-center justify-center bg-background p-6"><div className="w-full max-w-xl"><AlertError title="Personal settings are unavailable." errors={['The Personal settings projection is currently unavailable.']} /></div></main>;

    return <MountedPersonal activeSection={activeSection} navigate={navigate} props={state.props} appearance={state.appearance} />;
}

function MountedPersonal({ activeSection, appearance, navigate, props }: { activeSection: PersonalSection; appearance: 'dark' | 'light'; navigate: ReturnType<typeof useNavigate>; props: PersonalPageProps }) {
    useAppearancePageSync(true, appearance);
    return <SourcePageProjectionProvider value={{ component: 'settings/personal', props }}><PersonalSettingsContent {...(props as unknown as ComponentProps<typeof PersonalSettingsContent>)} activeSection={activeSection} initialSection={activeSection} onSelectSection={(section) => navigate(`/settings?panel=personal&personal=${section}`)} /></SourcePageProjectionProvider>;
}
