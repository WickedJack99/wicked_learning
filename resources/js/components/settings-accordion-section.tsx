import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function SettingsAccordionSection({
    children,
    defaultOpen = false,
    description,
    title,
}: {
    children: ReactNode;
    defaultOpen?: boolean;
    description: string;
    title: string;
}) {
    return (
        <Collapsible
            className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/5"
            defaultOpen={defaultOpen}
        >
            <CollapsibleTrigger className="group flex w-full items-start justify-between gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:hover:bg-teal-200/10 dark:focus-visible:ring-teal-200">
                <span>
                    <span className="block text-sm font-semibold text-slate-950 dark:text-white">
                        {title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </span>
                </span>
                <ChevronDown className="mt-0.5 size-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180 dark:text-slate-400" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-slate-200 px-4 py-4 dark:border-white/10">
                <div className="grid gap-4">{children}</div>
            </CollapsibleContent>
        </Collapsible>
    );
}
