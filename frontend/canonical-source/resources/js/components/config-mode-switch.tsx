import { Moon, Sun } from 'lucide-react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type ConfigThemeMode = 'dark' | 'light';

type ConfigModeSwitchProps = {
    className?: string;
    mode: ConfigThemeMode;
    onChange: (mode: ConfigThemeMode) => void;
    size?: 'default' | 'large';
};

export function ConfigModeSwitch({
    className,
    mode,
    onChange,
    size = 'default',
}: ConfigModeSwitchProps) {
    const t = usePlatformTranslation();
    const buttonSize = size === 'large' ? 'size-11' : 'size-10';
    const iconSize = size === 'large' ? 'size-5' : 'size-4';

    return (
        <div
            aria-label={t('common.configuration.mode', 'Configuration mode')}
            className={cn(
                'inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-slate-950/80',
                className,
            )}
            onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                    onChange('dark');
                }

                if (event.key === 'ArrowRight') {
                    onChange('light');
                }
            }}
            role="tablist"
        >
            {[
                {
                    icon: Moon,
                    label: t(
                        'common.configuration.dark',
                        'Dark configuration',
                    ),
                    value: 'dark',
                },
                {
                    icon: Sun,
                    label: t(
                        'common.configuration.light',
                        'Light configuration',
                    ),
                    value: 'light',
                },
            ].map((option) => {
                const Icon = option.icon;
                const value = option.value as ConfigThemeMode;

                return (
                    <button
                        aria-label={option.label}
                        aria-selected={mode === value}
                        className={cn(
                            'grid place-items-center rounded-xl transition',
                            buttonSize,
                            mode === value
                                ? 'text-white dark:text-slate-950'
                                : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white',
                        )}
                        key={value}
                        onClick={() => onChange(value)}
                        role="tab"
                        style={
                            mode === value
                                ? {
                                      background: 'var(--settings-accent)',
                                      color: 'var(--settings-accent-foreground)',
                                  }
                                : undefined
                        }
                        type="button"
                    >
                        <Icon className={iconSize} />
                        <span className="sr-only">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
