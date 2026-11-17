import { useEffect } from 'react';

import TwoFactorChallenge from '@/pages/auth/two-factor-challenge';
import AuthLayout from '@/layouts/auth-layout';
import { LoginRoute } from './login-route';
import {
    resetTwoFactorLayoutProps,
    useTwoFactorLayoutProps,
} from './two-factor-layout';

function TwoFactorChallengeLayout() {
    const layout = useTwoFactorLayoutProps();

    useEffect(() => {
        resetTwoFactorLayoutProps();
    }, []);

    return <AuthLayout title={layout.title} description={layout.description}><TwoFactorChallenge /></AuthLayout>;
}

export function TwoFactorRoute() {
    return <LoginRoute component="auth/two-factor-challenge" render={() => <TwoFactorChallengeLayout />} />;
}
