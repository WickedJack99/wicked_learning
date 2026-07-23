import { Form } from '@inertiajs/react';
import { useRef } from 'react';
import type { ComponentProps, Ref } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManageTwoFactor from '@/components/manage-two-factor';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';
import { SettingsPanelHeader } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type SecuritySettingsProps = {
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

export function SecuritySettingsPanel(props: SecuritySettingsProps) {
    const t = usePlatformTranslation();
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <div className="grid gap-5">
            <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                <SettingsPanelHeader
                    description={t(
                        'settings.personal.security.description',
                        'Use a long, random password to keep your account secure.',
                    )}
                    eyebrow={t(
                        'settings.personal.security.eyebrow',
                        'Security',
                    )}
                    title={t(
                        'settings.personal.security.title',
                        'Update password',
                    )}
                />
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
                    options={{ preserveScroll: true }}
                    resetOnError={[
                        'password',
                        'password_confirmation',
                        'current_password',
                    ]}
                    resetOnSuccess
                >
                    {({ errors, processing }) => (
                        <>
                            <PasswordField
                                autoComplete="current-password"
                                error={errors.current_password}
                                id="current_password"
                                inputRef={currentPasswordInput}
                                label={t(
                                    'settings.personal.security.current_password',
                                    'Current password',
                                )}
                                name="current_password"
                                placeholder={t(
                                    'settings.personal.security.current_password',
                                    'Current password',
                                )}
                            />
                            <PasswordField
                                autoComplete="new-password"
                                error={errors.password}
                                id="password"
                                inputRef={passwordInput}
                                label={t(
                                    'settings.personal.security.new_password',
                                    'New password',
                                )}
                                name="password"
                                passwordrules={props.passwordRules}
                                placeholder={t(
                                    'settings.personal.security.new_password',
                                    'New password',
                                )}
                            />
                            <PasswordField
                                autoComplete="new-password"
                                error={errors.password_confirmation}
                                id="password_confirmation"
                                label={t(
                                    'settings.personal.security.confirm_password',
                                    'Confirm password',
                                )}
                                name="password_confirmation"
                                passwordrules={props.passwordRules}
                                placeholder={t(
                                    'settings.personal.security.confirm_password',
                                    'Confirm password',
                                )}
                            />
                            <Button
                                data-test="update-password-button"
                                disabled={processing}
                            >
                                {t(
                                    'settings.personal.security.save',
                                    'Save password',
                                )}
                            </Button>
                        </>
                    )}
                </Form>
            </section>
            {props.canManageTwoFactor ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                    <ManageTwoFactor {...props} />
                </section>
            ) : null}
            {props.canManagePasskeys ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                    <ManagePasskeys {...props} />
                </section>
            ) : null}
        </div>
    );
}

function PasswordField({
    error,
    inputRef,
    label,
    ...input
}: ComponentProps<typeof PasswordInput> & {
    error?: string;
    inputRef?: Ref<HTMLInputElement>;
    label: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={input.id}>{label}</Label>
            <PasswordInput className="block w-full" ref={inputRef} {...input} />
            <InputError message={error} />
        </div>
    );
}
