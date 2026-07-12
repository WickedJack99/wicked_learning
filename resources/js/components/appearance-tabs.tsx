import type { LucideIcon } from 'lucide-react';
import { Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

export default function AppearanceToggleTab({
    className = '',
    variant = 'default',
    ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'subtle' }) {
    const { resolvedAppearance, updateAppearance } = useAppearance();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
    ];

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-lg p-1',
                variant === 'subtle'
                    ? 'border border-white/18 bg-white/7 backdrop-blur-md'
                    : 'bg-neutral-100 dark:bg-neutral-800',
                className,
            )}
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
                                ? 'bg-white/12 text-white shadow-xs'
                                : 'text-white/72 hover:bg-white/8 hover:text-white'
                            : resolvedAppearance === value
                              ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                              : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                    )}
                >
                    <Icon className="-ml-1 h-4 w-4" />
                    <span className="ml-1.5 text-sm">{label}</span>
                </button>
            ))}
        </div>
    );
}
