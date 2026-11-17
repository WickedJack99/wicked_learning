import ForgotPassword from '@/pages/auth/forgot-password';
import AuthLayout from '@/layouts/auth-layout';
import { LoginRoute } from './login-route';

export function ForgotPasswordRoute() {
    const status = sessionStorage.getItem('wicked-password-reset-status') ?? undefined;
    sessionStorage.removeItem('wicked-password-reset-status');
    return <LoginRoute render={() => <AuthLayout title="Forgot password" description="Enter your email to receive a password reset link"><ForgotPassword status={status} /></AuthLayout>} />;
}
