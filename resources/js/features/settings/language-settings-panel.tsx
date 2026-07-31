import { router } from '@inertiajs/react';
import { Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    SettingsFormColumn,
    SettingsPanelHeader,
    type SettingsNavigationItem,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type AvailableLanguage = {
    code: string;
    name: string;
    nativeName: string;
};

export function LanguageSettingsPanel({
    availableLanguages,
    headingItem,
    hideSaveButton = false,
    locale,
    onSaveActionChange,
}: {
    availableLanguages: AvailableLanguage[];
    headingItem?: SettingsNavigationItem<string>;
    hideSaveButton?: boolean;
    locale: string;
    onSaveActionChange?: (action: SettingsSaveAction | null) => void;
}) {
    const t = usePlatformTranslation();
    const [selectedLocale, setSelectedLocale] = useState(locale);
    const [saving, setSaving] = useState(false);
    const hasChanges = useDirtyState(selectedLocale, locale);

    const save = useCallback(() => {
        if (!hasChanges) {
            return;
        }

        setSaving(true);
        router.patch(
            '/settings/language',
            { locale: selectedLocale },
            {
                onFinish: () => setSaving(false),
                preserveScroll: true,
            },
        );
    }, [hasChanges, selectedLocale]);

    useEffect(() => {
        if (!onSaveActionChange) {
            return;
        }

        onSaveActionChange({
            disabled: saving || !hasChanges,
            label: t('common.save', 'Save'),
            onClick: save,
            saving,
            savingLabel: t('common.saving', 'Saving...'),
        });

        return () => onSaveActionChange(null);
    }, [hasChanges, onSaveActionChange, save, saving, t]);

    return (
        <section className="grid gap-5">
            <SettingsPanelHeader
                description={t(
                    'settings.personal.language.description',
                    'Choose the language used for platform controls and learner-visible activity copy.',
                )}
                eyebrow={
                    headingItem
                        ? undefined
                        : t('settings.personal.sections.language', 'Language')
                }
                item={headingItem}
                title={t(
                    'settings.personal.language.current',
                    'Current language',
                )}
            />
            <SettingsFormColumn>
                <div className="grid gap-2">
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
            </SettingsFormColumn>
            {!hideSaveButton ? (
                <Button
                    disabled={saving || !hasChanges}
                    onClick={save}
                    type="button"
                >
                    <Save className="size-4" />
                    {t('settings.personal.language.save', 'Save language')}
                </Button>
            ) : null}
        </section>
    );
}
