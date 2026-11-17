import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import AlertError from '@/components/alert-error';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import ConfirmPassword from '@/pages/auth/confirm-password';

import { apiClient } from './api/client';
import { LoginRoute } from './login-route';

type ConfirmationAccess = 'authenticated' | 'loading' | 'unauthenticated' | 'unavailable';

export function ConfirmPasswordRoute() {
    const [access, setAccess] = useState<ConfirmationAccess>('loading');

    useEffect(() => {
        void apiClient.GET('/session').then(({ data, response }) => {
            setAccess(response.ok && data?.authenticated ? 'authenticated' : 'unauthenticated');
        }).catch(() => setAccess('unavailable'));
    }, []);

    if (access === 'loading') return <main className="flex min-h-svh items-center justify-center"><Spinner className="size-6" /></main>;
    if (access === 'unauthenticated') return <Navigate replace to="/" />;
    if (access === 'unavailable') return <main className="flex min-h-svh items-center justify-center p-6"><AlertError title="Password confirmation is unavailable." errors={['The current session could not be verified.']} /></main>;

    return <LoginRoute component="auth/confirm-password" render={() => <AuthLayout title="Confirm password" description="This is a secure area of the application. Please confirm your password before continuing."><ConfirmPassword /></AuthLayout>} />;
}
