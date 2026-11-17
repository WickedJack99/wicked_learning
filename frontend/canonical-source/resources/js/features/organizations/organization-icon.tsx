import { Building2 } from 'lucide-react';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

export function OrganizationIcon({
    className,
    iconUrl,
    name,
}: {
    className?: string;
    iconUrl: string | null;
    name: string;
}) {
    const imageUrl = normalizeMediaUrl(iconUrl);

    return (
        <span
            className={cn(
                'grid overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
                className,
            )}
        >
            {imageUrl ? (
                <img
                    alt={`${name} icon`}
                    className="h-full w-full object-cover"
                    draggable={false}
                    src={imageUrl}
                />
            ) : (
                <span className="grid h-full w-full place-items-center">
                    <Building2 className="size-7" />
                </span>
            )}
        </span>
    );
}
