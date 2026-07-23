import { Form, Link, usePage } from '@inertiajs/react';
import { Download, Image, Upload, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/input-error';
import { SettingsPanelHeader } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { normalizeMediaUrl } from '@/lib/media-url';
import { uploadMediaFile } from '@/lib/media-upload';
import { send } from '@/routes/verification';
import type { User } from '@/types';

type ProfileSettingsPanelProps = {
    mustVerifyEmail: boolean;
    status?: string;
};

type PageProps = {
    auth: {
        user: User;
    };
};

export function ProfileSettingsPanel({
    mustVerifyEmail,
    status,
}: ProfileSettingsPanelProps) {
    const t = usePlatformTranslation();
    const { auth } = usePage<PageProps>().props;
    const [profileImage, setProfileImage] = useState(
        auth.user.profile_image ?? auth.user.avatar ?? '',
    );
    const [profileImageError, setProfileImageError] = useState<string | null>(
        null,
    );
    const [isUploadingProfileImage, setIsUploadingProfileImage] =
        useState(false);
    const profileImageUploadError = t(
        'settings.personal.profile.image.upload_error',
        'The profile image could not be uploaded.',
    );

    const uploadProfileImage = async (file: File) => {
        setIsUploadingProfileImage(true);
        setProfileImageError(null);

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/profile/image',
                errorMessage: profileImageUploadError,
                file,
            });

            setProfileImage(payload.url);
        } catch (error) {
            setProfileImageError(
                error instanceof Error
                    ? error.message
                    : profileImageUploadError,
            );
        } finally {
            setIsUploadingProfileImage(false);
        }
    };

    return (
        <div className="grid gap-5">
            <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                <SettingsPanelHeader
                    description={t(
                        'settings.personal.profile.description',
                        'Update account details and the public identity shown to other people later on.',
                    )}
                    eyebrow={t('settings.personal.profile.eyebrow', 'Account')}
                    title={t(
                        'settings.personal.profile.title',
                        'Profile details',
                    )}
                />

                <Form
                    {...ProfileController.update.form()}
                    className="grid gap-5"
                    options={{ preserveScroll: true }}
                >
                    {({ processing, errors }) => (
                        <>
                            <ProfileImageField
                                error={
                                    errors.profile_image ?? profileImageError
                                }
                                onChange={setProfileImage}
                                onUpload={uploadProfileImage}
                                uploading={isUploadingProfileImage}
                                value={profileImage}
                            />
                            <input
                                name="profile_image"
                                type="hidden"
                                value={profileImage}
                            />

                            <Field
                                autoComplete="name"
                                defaultValue={auth.user.name}
                                error={errors.name}
                                id="name"
                                label={t(
                                    'settings.personal.profile.name',
                                    'Name',
                                )}
                                name="name"
                                placeholder={t(
                                    'settings.personal.profile.name.placeholder',
                                    'Full name',
                                )}
                                required
                            />
                            <Field
                                autoComplete="nickname"
                                defaultValue={auth.user.username ?? ''}
                                error={errors.username}
                                hint={t(
                                    'settings.personal.profile.username.hint',
                                    'Optional. Use letters, numbers, dashes and underscores. This is the name intended for public learning spaces.',
                                )}
                                id="username"
                                label={t(
                                    'settings.personal.profile.username',
                                    'Public username',
                                )}
                                name="username"
                                placeholder={t(
                                    'settings.personal.profile.username.placeholder',
                                    'Visible handle, for example WickedJack99',
                                )}
                            />
                            <Field
                                autoComplete="username"
                                defaultValue={auth.user.email}
                                error={errors.email}
                                id="email"
                                label={t(
                                    'settings.personal.profile.email',
                                    'Email address',
                                )}
                                name="email"
                                placeholder={t(
                                    'settings.personal.profile.email.placeholder',
                                    'Email address',
                                )}
                                required
                                type="email"
                            />

                            {mustVerifyEmail &&
                            auth.user.email_verified_at === null ? (
                                <div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {t(
                                            'settings.personal.profile.email_unverified',
                                            'Your email address is unverified.',
                                        )}{' '}
                                        <Link
                                            as="button"
                                            className="text-slate-950 underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:text-white dark:decoration-neutral-500"
                                            href={send()}
                                        >
                                            {t(
                                                'settings.personal.profile.email_resend',
                                                'Re-send the verification email.',
                                            )}
                                        </Link>
                                    </p>
                                    {status === 'verification-link-sent' ? (
                                        <div className="mt-2 text-sm font-medium text-green-600">
                                            {t(
                                                'settings.personal.profile.email_sent',
                                                'A new verification link has been sent to your email address.',
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

                            <Button
                                data-test="update-profile-button"
                                disabled={processing}
                            >
                                {t(
                                    'settings.personal.profile.save',
                                    'Save profile',
                                )}
                            </Button>
                        </>
                    )}
                </Form>
            </section>
        </div>
    );
}

function Field({
    error,
    hint,
    label,
    ...input
}: ComponentProps<typeof Input> & {
    error?: string;
    hint?: string;
    label: string;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={input.id}>{label}</Label>
            <Input className="block w-full" {...input} />
            {hint ? (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            ) : null}
            <InputError message={error} />
        </div>
    );
}

function ProfileImageField({
    error,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    error?: string | null;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const t = usePlatformTranslation();
    const uploadId = 'profile-image-upload';
    const previewUrl = normalizeMediaUrl(value);

    return (
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    <Image className="size-5" />
                </span>
                <div className="min-w-0">
                    <Label htmlFor="profile-image">
                        {t('settings.personal.profile.image', 'Profile image')}
                    </Label>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.personal.profile.image.description',
                            'Upload an image that can represent you in shared learning spaces. The file path is saved only when you press Save.',
                        )}
                    </p>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)] md:items-center">
                <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5">
                    {previewUrl ? (
                        <img
                            alt=""
                            className="h-full w-full object-cover"
                            src={previewUrl}
                        />
                    ) : (
                        <UserRound className="size-8 text-slate-400" />
                    )}
                </div>
                <div className="grid min-w-0 gap-2">
                    <Input
                        id="profile-image"
                        onChange={(event) =>
                            onChange(event.currentTarget.value)
                        }
                        placeholder={t(
                            'settings.personal.profile.image.placeholder',
                            '/storage/profiles/images/example.webp',
                        )}
                        value={value}
                    />
                    <InputError message={error ?? undefined} />
                    <div className="flex flex-wrap gap-2">
                        <Button
                            asChild
                            disabled={uploading}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            <label htmlFor={uploadId}>
                                <Upload className="size-4" />
                                {uploading
                                    ? t('common.uploading', 'Uploading...')
                                    : t('common.upload', 'Upload')}
                            </label>
                        </Button>
                        <input
                            accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                            className="sr-only"
                            disabled={uploading}
                            id={uploadId}
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];

                                if (file) {
                                    onUpload(file);
                                }

                                event.currentTarget.value = '';
                            }}
                            type="file"
                        />
                        <Button
                            asChild
                            disabled={!previewUrl}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            <a
                                download
                                href={previewUrl || '#'}
                                rel="noreferrer"
                            >
                                <Download className="size-4" />
                                {t('common.download', 'Download')}
                            </a>
                        </Button>
                        <Button
                            onClick={() => onChange('')}
                            size="sm"
                            type="button"
                            variant="ghost"
                        >
                            {t('common.clear', 'Clear')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
