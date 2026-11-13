import {
    ArrowLeft,
    Bell,
    Brush,
    KeyRound,
    Languages,
    Save,
    UserRound,
    Volume2,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsNavigation } from './original-personal-settings-navigation';
import { platformTranslationChangedEvent } from './original-platform-translation';

type LanguagePreference = {
    available_languages: { code: string; name: string; native_name: string }[];
    locale: string;
};

/** Source-adapted from PersonalSettingsContent and LanguageSettingsPanel. */
export function OriginalPersonalLanguagePage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const [preference, setPreference] = useState<LanguagePreference>({
        available_languages: [],
        locale: 'en',
    });
    const [savedLocale, setSavedLocale] = useState('en');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        void apiClient
            .GET('/learner/language-preference')
            .then(({ data, response }) => {
                if (!response.ok || !data) throw new Error();
                setPreference(data);
                setSavedLocale(data.locale);
            })
            .catch(() => setError('Language preferences could not be loaded.'));
    }, []);
    async function save() {
        if (saving || preference.locale === savedLocale) return;
        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/language-preference',
                {
                    body: { locale: preference.locale },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) throw new Error();
            setPreference(data);
            setSavedLocale(data.locale);
            window.dispatchEvent(new Event(platformTranslationChangedEvent));
        } catch {
            setError('Language preferences could not be saved.');
        } finally {
            setSaving(false);
        }
    }
    return (
        <main
            className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link
                            className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]"
                            to="/home"
                        >
                            <ArrowLeft className="size-4" />
                            Settings
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Personal
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Language
                        </h1>
                    </div>
                </header>
                <section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                    <OriginalPersonalSettingsNavigation activeSection="language" />
                    <div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7">
                        <section className="grid max-w-2xl gap-5">
                            <header>
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Language
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    Current language
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                                    Choose the language used for platform
                                    controls and learner-visible activity copy.
                                </p>
                            </header>
                            <label
                                className="grid gap-2 border-t border-[var(--settings-border-color)] pt-5"
                                htmlFor="language"
                            >
                                <span className="text-sm font-medium">
                                    Current language
                                </span>
                                <select
                                    className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm"
                                    id="language"
                                    onChange={(event) =>
                                        setPreference((current) => ({
                                            ...current,
                                            locale: event.target.value,
                                        }))
                                    }
                                    value={preference.locale}
                                >
                                    {preference.available_languages.map(
                                        (language) => (
                                            <option
                                                key={language.code}
                                                value={language.code}
                                            >
                                                {language.name} (
                                                {language.native_name})
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>
                            <button
                                className="inline-flex w-fit items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                                disabled={
                                    saving || preference.locale === savedLocale
                                }
                                onClick={() => void save()}
                                type="button"
                            >
                                <Save className="mr-2 size-4" />
                                {saving ? 'Saving...' : 'Save language'}
                            </button>
                            {error ? (
                                <p
                                    className="text-sm text-red-500"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            ) : null}
                        </section>
                    </div>
                </section>
            </div>
        </main>
    );
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgba(45, 212, 191, 0.12)'
            : '#ccfbf1',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
