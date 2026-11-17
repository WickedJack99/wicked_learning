import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import Login from '@/pages/auth/login';

import { apiClient } from './api/client';
import { SourcePageProjectionProvider } from './page-props';
import { toWelcomePageProps } from './welcome-projection';
import type { WelcomePageProps, WelcomeWireProjection } from './welcome-projection';

type LoginState =
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | { kind: 'ready'; props: WelcomePageProps };

export function LoginRoute({
    render,
    component = 'auth/login',
}: {
    render?: (props: WelcomePageProps) => ReactNode;
    component?: string;
} = {}) {
    const [state, setState] = useState<LoginState>({ kind: 'loading' });
    const [status] = useState(() => {
        const value = sessionStorage.getItem('wicked-login-status') ?? undefined;
        sessionStorage.removeItem('wicked-login-status');

        return value;
    });

    useEffect(() => {
        void apiClient.GET('/public/welcome').then(({ data, response }) => {
            setState(response.ok && data
                ? { kind: 'ready', props: toWelcomePageProps(data as WelcomeWireProjection) }
                : { kind: 'unavailable' });
        }).catch(() => setState({ kind: 'unavailable' }));
    }, []);

    if (state.kind === 'loading') {
        return <main className="flex min-h-svh items-center justify-center"><Spinner className="size-6" /></main>;
    }
    if (state.kind === 'unavailable') {
        return <main className="flex min-h-svh items-center justify-center p-6"><AlertError title="Login is unavailable." errors={['The public Login projection is currently unavailable.']} /></main>;
    }
    return <SourcePageProjectionProvider value={{ component, props: state.props }}>{render ? render(state.props) : <AuthLayout title="Log in to your account" description="Enter your email and password below to log in"><Login canResetPassword={false} status={status} /></AuthLayout>}</SourcePageProjectionProvider>;
}
