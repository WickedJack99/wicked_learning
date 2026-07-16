import { router } from '@inertiajs/react';
import { Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type AvailableLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

export function LanguageSettingsPanel({
    availableLanguages,
    locale,
}: {
    availableLanguages: AvailableLanguage[];
    locale: string;
}) {
    const t = usePlatformTranslation();
    const [selectedLocale, setSelectedLocale] = useState(locale);
    const [saving, setSaving] = useState(false);

    const save = () => {
        setSaving(true);
        router.patch(
            '/settings/language',
            { locale: selectedLocale },
            {
                onFinish: () => setSaving(false),
                preserveScroll: true,
            },
        );
    };

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <p
                    className="text-xs font-medium tracking-[0.18em] uppercase"
                    style={{ color: 'var(--settings-accent)' }}
                >
                    {t('settings.personal.preference', 'Personal preference')}
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                    {t(
                        'settings.personal.language.current',
                        'Current language',
                    )}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {t(
                        'settings.personal.language.description',
                        'Choose the language used for platform controls and learner-visible activity copy.',
                    )}
                </p>
            </div>
            <div className="grid max-w-xl gap-2">
                <Label htmlFor="language">
                    {t(
                        'settings.personal.language.current',
                        'Current language',
                    )}
                </Label>
                <Select
                    onValueChange={setSelectedLocale}
                    value={selectedLocale}
                >
                    <SelectTrigger id="language">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {availableLanguages.map((language) => (
                            <SelectItem
                                key={language.code}
                                value={language.code}
                            >
                                {language.name} ({language.nativeName})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Button disabled={saving} onClick={save} type="button">
                <Save className="size-4" />
                {t('settings.personal.language.save', 'Save language')}
            </Button>
        </section>
    );
}
