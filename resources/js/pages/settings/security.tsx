import { Form, Head } from '@inertiajs/react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useRef } from 'react';
import { useState } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import ManageTwoFactor from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/security';

type Props = {
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

type SecuritySection = 'password' | 'passkeys' | 'two-factor';

export default function Security(props: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const [section, setSection] = useState<SecuritySection>('password');

    return (
        <>
            <Head title="Security settings" />

            <SettingsConfigurationShell
                eyebrow="Personal"
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active={section === 'password'}
                            description="Change your account password."
                            icon={LockKeyhole}
                            id="password"
                            label="Password"
                            onSelect={setSection}
                        />
                        <SettingsSectionButton
                            active={section === 'two-factor'}
                            description="Manage one-time codes."
                            icon={ShieldCheck}
                            id="two-factor"
                            label="Two-factor"
                            onSelect={setSection}
                        />
                        <SettingsSectionButton
                            active={section === 'passkeys'}
                            description="Passwordless sign-in keys."
                            icon={KeyRound}
                            id="passkeys"
                            label="Passkeys"
                            onSelect={setSection}
                        />
                    </SettingsSidebar>
                }
                title="Security"
            >
                <SettingsContentPane>
                    {section === 'password' ? (
                        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                            <div>
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                    Password
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    Update password
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    Use a long, random password to keep your
                                    account secure.
                                </p>
                            </div>

                            <Form
                                {...SecurityController.update.form()}
                                className="grid gap-5"
                                onError={(errors) => {
                                    if (errors.password) {
                                        passwordInput.current?.focus();
                                    }

                                    if (errors.current_password) {
                                        currentPasswordInput.current?.focus();
                                    }
                                }}
                                options={{
                                    preserveScroll: true,
                                }}
                                resetOnError={[
                                    'password',
                                    'password_confirmation',
                                    'current_password',
                                ]}
                                resetOnSuccess
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="current_password">
                                                Current password
                                            </Label>

                                            <PasswordInput
                                                autoComplete="current-password"
                                                className="mt-1 block w-full"
                                                id="current_password"
                                                name="current_password"
                                                placeholder="Current password"
                                                ref={currentPasswordInput}
                                            />

                                            <InputError
                                                message={
                                                    errors.current_password
                                                }
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="password">
                                                New password
                                            </Label>

                                            <PasswordInput
                                                autoComplete="new-password"
                                                className="mt-1 block w-full"
                                                id="password"
                                                name="password"
                                                passwordrules={
                                                    props.passwordRules
                                                }
                                                placeholder="New password"
                                                ref={passwordInput}
                                            />

                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="password_confirmation">
                                                Confirm password
                                            </Label>

                                            <PasswordInput
                                                autoComplete="new-password"
                                                className="mt-1 block w-full"
                                                id="password_confirmation"
                                                name="password_confirmation"
                                                passwordrules={
                                                    props.passwordRules
                                                }
                                                placeholder="Confirm password"
                                            />

                                            <InputError
                                                message={
                                                    errors.password_confirmation
                                                }
                                            />
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <Button
                                                data-test="update-password-button"
                                                disabled={processing}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </section>
                    ) : null}
                    {section === 'two-factor' ? (
                        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                            <ManageTwoFactor
                                canManageTwoFactor={props.canManageTwoFactor}
                                requiresConfirmation={
                                    props.requiresConfirmation
                                }
                                twoFactorEnabled={props.twoFactorEnabled}
                            />
                        </section>
                    ) : null}
                    {section === 'passkeys' ? (
                        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                            <ManagePasskeys
                                canManagePasskeys={props.canManagePasskeys}
                                passkeys={props.passkeys}
                            />
                        </section>
                    ) : null}
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

Security.layout = {
    breadcrumbs: [
        {
            title: 'Security settings',
            href: edit(),
        },
    ],
};
