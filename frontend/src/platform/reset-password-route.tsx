import ResetPassword from '@/pages/auth/reset-password';
import AuthLayout from '@/layouts/auth-layout';
import { LoginRoute } from './login-route';

export function ResetPasswordRoute({ token }: { token: string }) {
    const email = new URLSearchParams(window.location.search).get('email') ?? '';
    return <LoginRoute component="auth/reset-password" render={() => <AuthLayout title="Reset password" description="Please enter your new password below"><ResetPassword token={token} email={email} passwordRules="minlength: 12" /></AuthLayout>} />;
}
