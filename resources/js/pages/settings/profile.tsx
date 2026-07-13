import { Form, Head, usePage } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import { Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { User } from '@/types';

type PageProps = {
    auth: {
        user: User;
    };
};

type ProfileSection = 'details' | 'danger';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    const [section, setSection] = useState<ProfileSection>('details');

    return (
        <>
            <Head title="Profile settings" />

            <SettingsConfigurationShell
                eyebrow="Personal"
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active={section === 'details'}
                            description="Name and email address."
                            icon={UserRound}
                            id="details"
                            label="Profile details"
                            onSelect={setSection}
                        />
                        <SettingsSectionButton
                            active={section === 'danger'}
                            danger
                            description="Delete this account."
                            icon={Trash2}
                            id="danger"
                            label="Danger zone"
                            onSelect={setSection}
                        />
                    </SettingsSidebar>
                }
                title="Profile"
            >
                <SettingsContentPane>
                    {section === 'details' ? (
                        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                            <div>
                                <p className="text-xs font-medium tracking-[0.18em] text-cyan-700 uppercase dark:text-teal-200/70">
                                    Account
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    Profile details
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    Update your name and email address.
                                </p>
                            </div>

                            <Form
                                {...ProfileController.update.form()}
                                className="grid gap-5"
                                options={{
                                    preserveScroll: true,
                                }}
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Name</Label>

                                            <Input
                                                autoComplete="name"
                                                className="mt-1 block w-full"
                                                defaultValue={auth.user.name}
                                                id="name"
                                                name="name"
                                                placeholder="Full name"
                                                required
                                            />

                                            <InputError
                                                className="mt-2"
                                                message={errors.name}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email">
                                                Email address
                                            </Label>

                                            <Input
                                                autoComplete="username"
                                                className="mt-1 block w-full"
                                                defaultValue={auth.user.email}
                                                id="email"
                                                name="email"
                                                placeholder="Email address"
                                                required
                                                type="email"
                                            />

                                            <InputError
                                                className="mt-2"
                                                message={errors.email}
                                            />
                                        </div>

                                        {mustVerifyEmail &&
                                            auth.user.email_verified_at ===
                                                null && (
                                                <div>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                                        Your email address is
                                                        unverified.{' '}
                                                        <Link
                                                            as="button"
                                                            className="text-slate-950 underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:text-white dark:decoration-neutral-500"
                                                            href={send()}
                                                        >
                                                            Re-send the
                                                            verification email.
                                                        </Link>
                                                    </p>

                                                    {status ===
                                                        'verification-link-sent' && (
                                                        <div className="mt-2 text-sm font-medium text-green-600">
                                                            A new verification
                                                            link has been sent
                                                            to your email
                                                            address.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        <div className="flex items-center gap-4">
                                            <Button
                                                data-test="update-profile-button"
                                                disabled={processing}
                                            >
                                                Save
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </section>
                    ) : (
                        <DeleteUser />
                    )}
                </SettingsContentPane>
            </SettingsConfigurationShell>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [
        {
            title: 'Profile settings',
            href: edit(),
        },
    ],
};
