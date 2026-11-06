import { Moon, Sun } from 'lucide-react';

/**
 * Source-adapted from `components/appearance-tabs.tsx`.
 *
 * The public/authentication control updates the document immediately. A fresh
 * invitation registration includes that resolved choice in its Rust request;
 * the authenticated Personal-settings writer remains a separate source UI
 * slice. The visible control, labels, focus behavior, and selected-state
 * structure remain the original component's subtle variant.
 */
export function OriginalAppearanceToggle({
    appearance,
    onAppearanceChange,
}: {
    appearance: 'dark' | 'light';
    onAppearanceChange: (appearance: 'dark' | 'light') => void;
}) {
    const tabs = [
        { icon: Sun, label: 'Light', value: 'light' as const },
        { icon: Moon, label: 'Dark', value: 'dark' as const },
    ];

    return (
        <div
            className="mr-2 inline-flex gap-1 rounded-lg border bg-white/7 p-1 shadow-lg backdrop-blur-md"
            style={{
                borderColor:
                    'var(--public-control-border,rgba(255,255,255,0.18))',
                color: 'var(--public-control-text,#ffffff)',
            }}
        >
            {tabs.map(({ icon: Icon, label, value }) => (
                <button
                    className={`flex items-center rounded-md px-3.5 py-1.5 transition-colors ${
                        appearance === value
                            ? 'bg-current/12 shadow-xs'
                            : 'opacity-70 hover:bg-current/8 hover:opacity-100'
                    }`}
                    key={value}
                    onClick={() => onAppearanceChange(value)}
                    type="button"
                >
                    <Icon className="-ml-1 h-4 w-4" />
                    <span className="ml-1.5 text-sm">{label}</span>
                </button>
            ))}
        </div>
    );
}
