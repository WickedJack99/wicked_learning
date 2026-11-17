import type { LucideIcon } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export default function AppearanceToggleTab({
    className = '',
    variant = 'default',
    style,
    ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'subtle' }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();
    const t = usePlatformTranslation();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        {
            value: 'light',
            icon: Sun,
            label: t('common.appearance.light', 'Light'),
        },
        {
            value: 'dark',
            icon: Moon,
            label: t('common.appearance.dark', 'Dark'),
        },
    ];

    return (
        <div
            className={cn(
                'settings-rounded-control inline-flex gap-1 rounded-lg p-1',
                variant === 'subtle'
                    ? 'border bg-white/7 backdrop-blur-md'
                    : 'border border-[var(--settings-border-color,transparent)] bg-[var(--settings-appearance-switch-background,var(--settings-active-background,#f5f5f5))]',
                className,
            )}
            style={
                variant === 'subtle'
                    ? {
                          borderColor:
                              'var(--public-control-border,rgba(255,255,255,0.18))',
                          color: 'var(--public-control-text,#ffffff)',
                          ...style,
                      }
                    : style
            }
            {...props}
        >
            {tabs.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value)}
                    className={cn(
                        'flex items-center rounded-md px-3.5 py-1.5 transition-colors',
                        variant === 'subtle'
                            ? resolvedAppearance === value
                                ? 'bg-current/12 shadow-xs'
                                : 'opacity-70 hover:bg-current/8 hover:opacity-100'
                            : resolvedAppearance === value
                              ? 'bg-[var(--settings-appearance-switch-active-background,var(--settings-panel-background,#ffffff))] text-[var(--settings-appearance-switch-active-text,var(--settings-accent,#111827))] shadow-xs'
                              : 'text-[var(--settings-appearance-switch-inactive-text,var(--settings-muted-text,#737373))] hover:bg-[var(--settings-active-background,rgba(0,0,0,0.08))] hover:text-[var(--settings-accent,#111827)]',
                    )}
                >
                    <Icon className="-ml-1 h-4 w-4" />
                    <span className="ml-1.5 text-sm">{label}</span>
                </button>
            ))}
        </div>
    );
}
