import { Head, router } from '@inertiajs/react';
import { Download, FileUp, Languages, Plus, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    SettingsConfigurationShell,
    SettingsContentPane,
    SettingsSectionButton,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type Language = {
    code: string;
    isDefault: boolean;
    isEnabled: boolean;
    name: string;
    nativeName: string;
};

type LanguageAdministrationProps = {
    embedded?: boolean;
    languages: Language[];
};

type NewLanguageForm = {
    code: string;
    name: string;
    native_name: string;
};

export default function LanguageAdministration({
    embedded = false,
    languages,
}: LanguageAdministrationProps) {
    const t = usePlatformTranslation();
    const [selectedCode, setSelectedCode] = useState(
        languages[0]?.code ?? 'en',
    );
    const selected = useMemo(
        () =>
            languages.find((language) => language.code === selectedCode) ??
            languages[0],
        [languages, selectedCode],
    );
    const [name, setName] = useState(selected?.name ?? '');
    const [nativeName, setNativeName] = useState(selected?.nativeName ?? '');
    const [isEnabled, setIsEnabled] = useState(selected?.isEnabled ?? true);
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState<NewLanguageForm>({
        code: '',
        name: '',
        native_name: '',
    });

    useEffect(() => {
        setName(selected?.name ?? '');
        setNativeName(selected?.nativeName ?? '');
        setIsEnabled(selected?.isEnabled ?? true);
    }, [selected]);

    const save = () => {
        if (!selected || selected.isDefault) {
            return;
        }

        router.patch(
            `/settings/languages/${selected.code}`,
            { is_enabled: isEnabled, name, native_name: nativeName },
            { preserveScroll: true },
        );
    };

    const create = () => {
        router.post('/settings/languages', createForm, {
            onSuccess: () => {
                setCreateOpen(false);
                setCreateForm({ code: '', name: '', native_name: '' });
            },
            preserveScroll: true,
        });
    };

    const updateCreateForm = (field: keyof NewLanguageForm, value: string) => {
        setCreateForm((form) => ({ ...form, [field]: value }));
    };

    const importCatalog = (file: File) => {
        if (!selected || selected.isDefault) {
            return;
        }

        router.post(
            `/settings/languages/${selected.code}/import`,
            { catalog: file },
            { forceFormData: true, preserveScroll: true },
        );
    };

    const content = (
        <SettingsContentPane>
            <section className="grid min-h-full gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold">
                                {t(
                                    'settings.administration.languages.available',
                                    'Available languages',
                                )}
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {t(
                                    'settings.administration.languages.available_description',
                                    'English is the source catalog.',
                                )}
                            </p>
                        </div>
                        <Button
                            onClick={() => setCreateOpen((open) => !open)}
                            size="icon"
                            type="button"
                        >
                            <Plus className="size-4" />
                        </Button>
                    </div>

                    {createOpen ? (
                        <div className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/70">
                            <Input
                                onChange={(event) =>
                                    updateCreateForm(
                                        'code',
                                        event.currentTarget.value,
                                    )
                                }
                                placeholder={t(
                                    'settings.administration.languages.code_placeholder',
                                    'Code, e.g. ja',
                                )}
                                value={createForm.code}
                            />
                            <Input
                                onChange={(event) =>
                                    updateCreateForm(
                                        'name',
                                        event.currentTarget.value,
                                    )
                                }
                                placeholder={t(
                                    'settings.administration.languages.name_placeholder',
                                    'Name, e.g. Japanese',
                                )}
                                value={createForm.name}
                            />
                            <Input
                                onChange={(event) =>
                                    updateCreateForm(
                                        'native_name',
                                        event.currentTarget.value,
                                    )
                                }
                                placeholder={t(
                                    'settings.administration.languages.native_name_placeholder',
                                    'Native name, e.g. Japanese',
                                )}
                                value={createForm.native_name}
                            />
                            <Button onClick={create} size="sm" type="button">
                                {t(
                                    'settings.administration.languages.create',
                                    'Create',
                                )}
                            </Button>
                        </div>
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        {languages.map((language) => (
                            <button
                                className="mb-2 w-full rounded-lg border p-3 text-left transition"
                                key={language.code}
                                onClick={() => setSelectedCode(language.code)}
                                style={
                                    selectedCode === language.code
                                        ? {
                                              background:
                                                  'color-mix(in srgb, var(--settings-accent) 18%, transparent)',
                                              borderColor:
                                                  'var(--settings-accent)',
                                          }
                                        : undefined
                                }
                                type="button"
                            >
                                <span className="block text-sm font-medium">
                                    {language.name}
                                </span>
                                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                    {language.nativeName}
                                    {t(
                                        'settings.administration.languages.separator',
                                        ' / ',
                                    )}
                                    {language.code}
                                </span>
                            </button>
                        ))}
                    </div>
                </aside>

                {selected ? (
                    <section className="grid content-start gap-5 rounded-xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p
                                    className="text-xs font-medium tracking-[0.18em] uppercase"
                                    style={{
                                        color: 'var(--settings-accent)',
                                    }}
                                >
                                    {t(
                                        'settings.administration.languages.catalog',
                                        'Translation catalog',
                                    )}
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    {selected.name}
                                </h2>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.administration.languages.catalog_description',
                                        'Export English, translate its JSON values, then upload it here. The import keeps only learner-visible activity copy and ignores answer correctness or graph behavior.',
                                    )}
                                </p>
                            </div>
                            <Button asChild variant="secondary">
                                <a href="/settings/languages/export/english">
                                    <Download className="size-4" />
                                    {t(
                                        'settings.administration.languages.download_english',
                                        'Download English',
                                    )}
                                </a>
                            </Button>
                        </div>

                        {selected.isDefault ? (
                            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-white/15 dark:text-slate-300">
                                {t(
                                    'settings.administration.languages.default_notice',
                                    'English is the canonical source. Download it to prepare another language.',
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="language-name">
                                            {t(
                                                'settings.administration.languages.name',
                                                'Language name',
                                            )}
                                        </Label>
                                        <Input
                                            id="language-name"
                                            onChange={(event) =>
                                                setName(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            value={name}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="language-native-name">
                                            {t(
                                                'settings.administration.languages.native_name',
                                                'Native name',
                                            )}
                                        </Label>
                                        <Input
                                            id="language-native-name"
                                            onChange={(event) =>
                                                setNativeName(
                                                    event.currentTarget.value,
                                                )
                                            }
                                            value={nativeName}
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/70">
                                    <span>
                                        <span className="block text-sm font-medium">
                                            {t(
                                                'settings.administration.languages.enabled',
                                                'Enabled for learners',
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {t(
                                                'settings.administration.languages.enabled_description',
                                                'Disabled languages remain editable but cannot be selected by learners.',
                                            )}
                                        </span>
                                    </span>
                                    <input
                                        className="size-5 accent-[var(--settings-accent)]"
                                        checked={isEnabled}
                                        onChange={(event) =>
                                            setIsEnabled(
                                                event.currentTarget.checked,
                                            )
                                        }
                                        type="checkbox"
                                    />
                                </label>

                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={save} type="button">
                                        <Save className="size-4" />
                                        {t(
                                            'settings.administration.languages.save',
                                            'Save language',
                                        )}
                                    </Button>
                                    <Button asChild variant="secondary">
                                        <a
                                            href={`/settings/languages/${selected.code}/export`}
                                        >
                                            <Download className="size-4" />
                                            {t(
                                                'settings.administration.languages.download_current',
                                                'Download current catalog',
                                            )}
                                        </a>
                                    </Button>
                                    <Button asChild variant="secondary">
                                        <label htmlFor="translation-catalog">
                                            <FileUp className="size-4" />
                                            {t(
                                                'settings.administration.languages.import',
                                                'Upload translation catalog',
                                            )}
                                        </label>
                                    </Button>
                                    <input
                                        accept="application/json,.json"
                                        className="sr-only"
                                        id="translation-catalog"
                                        onChange={(event) => {
                                            const file =
                                                event.currentTarget.files?.[0];

                                            if (file) {
                                                importCatalog(file);
                                            }

                                            event.currentTarget.value = '';
                                        }}
                                        type="file"
                                    />
                                </div>
                            </>
                        )}
                    </section>
                ) : null}
            </section>
        </SettingsContentPane>
    );

    if (embedded) {
        return content;
    }

    return (
        <>
            <Head
                title={t(
                    'settings.administration.languages.head_title',
                    'Language administration',
                )}
            />
            <SettingsConfigurationShell
                eyebrow={t(
                    'settings.administration.languages.eyebrow',
                    'Administration',
                )}
                sidebar={
                    <SettingsSidebar>
                        <SettingsSectionButton
                            active
                            description={t(
                                'settings.administration.languages.sidebar_description',
                                'Catalogs and learner copy.',
                            )}
                            icon={Languages}
                            id="languages"
                            label={t(
                                'settings.administration.languages',
                                'Languages',
                            )}
                            onSelect={() => undefined}
                        />
                    </SettingsSidebar>
                }
                title={t(
                    'settings.administration.languages.title',
                    'Languages',
                )}
            >
                {content}
            </SettingsConfigurationShell>
        </>
    );
}
