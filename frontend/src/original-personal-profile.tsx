import { Download, Image, Save, Upload, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';

type Profile = {
    email: string;
    name: string;
    profileImageId: string | null;
    profileImageUrl: string | null;
    username: string;
};

/** Source-adapted from PersonalSettingsContent and ProfileSettingsPanel. */
export function OriginalPersonalProfilePage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const t = usePlatformTranslation();
    const [profile, setProfile] = useState<Profile>({
        email: '',
        name: '',
        profileImageId: null,
        profileImageUrl: null,
        username: '',
    });
    const [saved, setSaved] = useState(profile);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const changed = JSON.stringify(profile) !== JSON.stringify(saved);

    useEffect(() => {
        void apiClient
            .GET('/account/profile')
            .then(({ data, response }) => {
                if (!response.ok || !data) {
                    setMessage('Profile details could not be loaded.');
                    return;
                }

                const next = profileFromResponse(data);
                setProfile(next);
                setSaved(next);
            })
            .catch(() => setMessage('Profile details could not be loaded.'))
            .finally(() => setLoading(false));
    }, []);

    async function uploadProfileImage(file: File): Promise<void> {
        setUploading(true);
        setImageError(null);
        try {
            const token = await getCsrfToken();
            const form = new FormData();
            form.set('file', file);
            const response = await fetch('/api/v1/account/profile/image', {
                body: form,
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': token },
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error('The profile image could not be uploaded.');
            }

            const result = (await response.json()) as {
                profile_image_id?: string;
                url?: string;
            };
            if (!result.profile_image_id || !result.url) {
                throw new Error('The profile image could not be uploaded.');
            }

            setProfile((current) => ({
                ...current,
                profileImageId: result.profile_image_id!,
                profileImageUrl: result.url!,
            }));
        } catch (error) {
            setImageError(
                error instanceof Error
                    ? error.message
                    : 'The profile image could not be uploaded.',
            );
        } finally {
            setUploading(false);
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (saving || uploading || !changed) {
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/account/profile',
                {
                    body: {
                        email: profile.email,
                        name: profile.name,
                        profile_image_id: profile.profileImageId,
                        username: profile.username || null,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                setMessage('The profile could not be updated with these details.');
                return;
            }

            const next = profileFromResponse(data);
            setProfile(next);
            setSaved(next);
            setMessage('Profile updated.');
        } catch {
            setMessage('The profile could not be updated right now.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <OriginalPersonalSettingsShell activeSection="profile" appearance={appearance}>
            <section className="grid gap-5">
                <header className="flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                            <UserRound className="size-5" />
                            <p className="text-xs font-medium tracking-[0.18em] uppercase">
                                {t('settings.personal.sections.profile', 'Profile')}
                            </p>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-normal text-[var(--settings-primary-text)]">
                            {t('settings.personal.profile.title', 'Profile details')}
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.personal.profile.description',
                                'Update account details and the public identity shown to other people later on.',
                            )}
                        </p>
                    </div>
                </header>
                {loading ? (
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        Loading profile details...
                    </p>
                ) : (
                    <form
                        className="grid w-full min-w-0 gap-5 lg:max-w-[45%]"
                        onSubmit={(event) => void submit(event)}
                    >
                        <ProfileImageField
                            error={imageError}
                            onChange={() =>
                                setProfile((current) => ({
                                    ...current,
                                    profileImageId: null,
                                    profileImageUrl: null,
                                }))
                            }
                            onUpload={(file) => void uploadProfileImage(file)}
                            uploading={uploading}
                            url={profile.profileImageUrl}
                        />
                        <Field
                            autoComplete="name"
                            label="Name"
                            onChange={(value) =>
                                setProfile((current) => ({
                                    ...current,
                                    name: value,
                                }))
                            }
                            required
                            value={profile.name}
                        />
                        <Field
                            autoComplete="nickname"
                            hint="Optional. Use letters, numbers, dashes and underscores. This is the name intended for public learning spaces."
                            label="Public username"
                            onChange={(value) =>
                                setProfile((current) => ({
                                    ...current,
                                    username: value,
                                }))
                            }
                            value={profile.username}
                        />
                        <Field
                            autoComplete="username"
                            label="Email address"
                            onChange={(value) =>
                                setProfile((current) => ({
                                    ...current,
                                    email: value,
                                }))
                            }
                            required
                            type="email"
                            value={profile.email}
                        />
                        <button
                            className="inline-flex w-fit items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                            data-test="update-profile-button"
                            disabled={saving || uploading || !changed}
                            type="submit"
                        >
                            <Save className="mr-2 size-4" />
                            {saving ? 'Saving...' : 'Save profile'}
                        </button>
                    </form>
                )}
                {message ? (
                    <p
                        className={
                            message === 'Profile updated.'
                                ? 'text-sm text-emerald-600 dark:text-emerald-300'
                                : 'text-sm text-red-500'
                        }
                        role="status"
                    >
                        {message}
                    </p>
                ) : null}
            </section>
        </OriginalPersonalSettingsShell>
    );
}

function profileFromResponse(response: {
    email: string;
    name: string;
    profile_image_id: string | null;
    profile_image_url: string | null;
    username: string | null;
}): Profile {
    return {
        email: response.email,
        name: response.name,
        profileImageId: response.profile_image_id,
        profileImageUrl: response.profile_image_url,
        username: response.username ?? '',
    };
}

function ProfileImageField({
    error,
    onChange,
    onUpload,
    uploading,
    url,
}: {
    error: string | null;
    onChange: () => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    url: string | null;
}) {
    const uploadId = 'profile-image-upload';

    return (
        <div className="grid gap-4 border-b border-[var(--settings-border-color)] pb-5">
            <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    <Image className="size-5" />
                </span>
                <div className="min-w-0">
                    <label className="text-sm font-medium" htmlFor={uploadId}>
                        Profile image
                    </label>
                    <p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">
                        Upload an image that can represent you in shared learning
                        spaces. The image is saved only when you press Save profile.
                    </p>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[5rem_minmax(0,1fr)] md:items-center">
                <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-[var(--settings-border-color)] bg-[var(--settings-content-background)]">
                    {url ? (
                        <img alt="" className="h-full w-full object-cover" src={url} />
                    ) : (
                        <UserRound className="size-8 text-[var(--settings-muted-text)]" />
                    )}
                </div>
                <div className="grid min-w-0 gap-2">
                    {error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}
                    <div className="flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium disabled:opacity-50" htmlFor={uploadId}>
                            <Upload className="mr-2 size-4" />
                            {uploading ? 'Uploading...' : 'Upload'}
                        </label>
                        <input accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp" className="sr-only" disabled={uploading} id={uploadId} onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) onUpload(file);
                            event.currentTarget.value = '';
                        }} type="file" />
                        <a className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium ${url ? '' : 'pointer-events-none opacity-50'}`} download href={url ?? '#'}>
                            <Download className="mr-2 size-4" />
                            Download
                        </a>
                        <button className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50" disabled={!url || uploading} onClick={onChange} type="button">
                            Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({
    autoComplete,
    hint,
    label,
    onChange,
    required,
    type = 'text',
    value,
}: {
    autoComplete: string;
    hint?: string;
    label: string;
    onChange: (value: string) => void;
    required?: boolean;
    type?: 'email' | 'text';
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '_');

    return (
        <label className="grid gap-2" htmlFor={id}>
            <span className="text-sm font-medium">{label}</span>
            <input autoComplete={autoComplete} className="block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-active-background)]" id={id} onChange={(event) => onChange(event.target.value)} placeholder={label === 'Name' ? 'Full name' : label} required={required} type={type} value={value} />
            {hint ? <span className="text-xs leading-5 text-[var(--settings-muted-text)]">{hint}</span> : null}
        </label>
    );
}
