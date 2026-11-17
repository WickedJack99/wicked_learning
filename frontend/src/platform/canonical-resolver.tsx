import { useLocation } from 'react-router';

import Heading from '@/components/heading';

import { WelcomeRoute } from './welcome-route';
import { PublicInformationRoute } from './public-information-route';
import { SourceCodeRoute } from './source-code-route';
import { LoginRoute } from './login-route';
import { RegisterRoute } from './register-route';
import { ForgotPasswordRoute } from './forgot-password-route';

/**
 * The only presentation import in this bootstrap is copied from the pinned
 * Laravel source tree. Route families are deliberately not mounted until an
 * audited Rust page projection exists for each one.
 */
export function CanonicalSourceResolver() {
    const location = useLocation();

    if (location.pathname === '/') {
        return <WelcomeRoute />;
    }

    if (location.pathname === '/source') {
        return <SourceCodeRoute />;
    }

    if (location.pathname === '/login') {
        return <LoginRoute />;
    }
    if (location.pathname === '/register') {
        return <RegisterRoute />;
    }
    if (location.pathname === '/forgot-password') {
        return <ForgotPasswordRoute />;
    }

    if (
        location.pathname === '/about' ||
        location.pathname === '/imprint' ||
        location.pathname === '/data-protection'
    ) {
        return (
            <PublicInformationRoute
                slug={location.pathname.slice(1) as
                    | 'about'
                    | 'data-protection'
                    | 'imprint'}
            />
        );
    }

    return (
        <main className="min-h-svh bg-background px-6 py-12 text-foreground md:px-10">
            <section className="mx-auto max-w-2xl rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
                <Heading
                    title="This page is not available yet"
                    description="The canonical source interface is present, but this route has no audited Rust page projection."
                />
                <p className="text-sm text-muted-foreground">
                    Requested path: <code>{location.pathname}</code>
                </p>
            </section>
        </main>
    );
}
