import Register from '@/pages/auth/register';
import AuthLayout from '@/layouts/auth-layout';
import { LoginRoute } from './login-route';

/** Registration has the same audited public shell as Login; its source form
 * selects the explicit `/registration` action from the narrow auth facade. */
export function RegisterRoute() {
    return <LoginRoute render={(props) => <AuthLayout title="Create an account" description="Enter your details below to create your account"><Register passwordRules="minlength: 12" registrationToken={null} /></AuthLayout>} />;
}
