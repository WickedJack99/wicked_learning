import { Form } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import type { ComponentProps, Ref } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManageTwoFactor from '@/components/manage-two-factor';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';
import {
    SettingsFormColumn,
    SettingsPanelHeader,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type SecuritySettingsProps = {
    formId?: string;
    hideSaveButton?: boolean;
    onSaveActionChange?: (action: SettingsSaveAction | null) => void;
    passwordRules: string;
} & ManagePasskeysProps &
    ManageTwoFactorProps;

export function SecuritySettingsPanel(props: SecuritySettingsProps) {
    const t = usePlatformTranslation();
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <div className="grid gap-5">
            <section className="grid gap-5">
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
                <SettingsFormColumn>
                    <Form
                        {...SecurityController.update.form()}
                        className="grid gap-5"
                        id={props.formId}
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
                        {({ errors, processing, isDirty }) => (
                            <SecurityPasswordFormContent
                                errors={errors}
                                formId={props.formId}
                                hideSaveButton={props.hideSaveButton ?? false}
                                isDirty={isDirty}
                                onSaveActionChange={props.onSaveActionChange}
                                passwordInput={passwordInput}
                                passwordRules={props.passwordRules}
                                processing={processing}
                                currentPasswordInput={currentPasswordInput}
                            />
                        )}
                    </Form>
                </SettingsFormColumn>
            </section>
            {props.canManageTwoFactor ? (
                <SettingsFormColumn>
                    <section className="border-t border-[var(--settings-border-color)] pt-5">
                        <ManageTwoFactor {...props} />
                    </section>
                </SettingsFormColumn>
            ) : null}
            {props.canManagePasskeys ? (
                <SettingsFormColumn>
                    <section className="border-t border-[var(--settings-border-color)] pt-5">
                        <ManagePasskeys {...props} />
                    </section>
                </SettingsFormColumn>
            ) : null}
        </div>
    );
}

function SecurityPasswordFormContent({
    currentPasswordInput,
    errors,
    formId,
    hideSaveButton,
    isDirty,
    onSaveActionChange,
    passwordInput,
    passwordRules,
    processing,
}: {
    currentPasswordInput: Ref<HTMLInputElement>;
    errors: Record<string, string>;
    formId?: string;
    hideSaveButton: boolean;
    isDirty: boolean;
    onSaveActionChange?: (action: SettingsSaveAction | null) => void;
    passwordInput: Ref<HTMLInputElement>;
    passwordRules: string;
    processing: boolean;
}) {
    const t = usePlatformTranslation();

    useEffect(() => {
        if (!onSaveActionChange || !formId) {
            return;
        }

        onSaveActionChange({
            disabled: processing || !isDirty,
            form: formId,
            label: t('common.save', 'Save'),
            saving: processing,
            savingLabel: t('common.saving', 'Saving...'),
        });

        return () => onSaveActionChange(null);
    }, [formId, isDirty, onSaveActionChange, processing, t]);

    return (
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
                passwordrules={passwordRules}
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
                passwordrules={passwordRules}
                placeholder={t(
                    'settings.personal.security.confirm_password',
                    'Confirm password',
                )}
            />
            {!hideSaveButton ? (
                <Button
                    data-test="update-password-button"
                    disabled={processing || !isDirty}
                >
                    {t('settings.personal.security.save', 'Save password')}
                </Button>
            ) : null}
        </>
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
