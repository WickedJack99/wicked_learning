import { Link, usePage } from '@inertiajs/react';
import { Bell, ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { mapControlCssVariables } from '@/features/world/map-control-theme';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
    mapThemed?: boolean;
};

export function LearnerAccountControls({
    className,
    mapThemed = false,
}: Props) {
    const { props } = usePage();
    const { auth } = props;
    const initials = useInitials();
    const t = usePlatformTranslation();
    const { resolvedAppearance } = useAppearance();

    const mapControlVariables = mapThemed
        ? mapControlCssVariables(
              props.menuTheme?.backgroundConfig,
              resolvedAppearance,
          )
        : null;
    const menuStyle: CSSProperties | undefined = mapControlVariables
        ? {
              background:
                  mapControlVariables['--map-side-control-panel-background'] ??
                  'rgb(17 24 32 / 0.98)',
              borderColor:
                  mapControlVariables[
                      '--map-side-control-panel-border-color'
                  ] ?? 'rgb(51 65 85)',
              color:
                  mapControlVariables['--map-side-control-text-color'] ??
                  'rgb(226 232 240)',
          }
        : undefined;

    return (
        <div
            className={cn(
                'ml-auto flex shrink-0 items-center gap-2',
                className,
            )}
        >
            <Button
                asChild
                aria-label={t(
                    'home.learning_desk.notifications',
                    'Notifications',
                )}
                className="rounded-lg border border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/9 dark:hover:text-white"
                size="icon"
                variant="ghost"
            >
                <Link href="/settings?panel=personal&personal=notifications">
                    <Bell className="size-4" />
                </Link>
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        className="h-10 gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-900 shadow-none hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/9"
                        variant="ghost"
                    >
                        <Avatar className="size-7">
                            <AvatarImage
                                alt={auth.user?.name ?? ''}
                                src={auth.user?.avatar ?? undefined}
                            />
                            <AvatarFallback className="bg-violet-500/20 text-xs text-violet-700 dark:text-violet-200">
                                {initials(auth.user?.name ?? '')}
                            </AvatarFallback>
                        </Avatar>
                        <span className="hidden max-w-32 truncate text-sm sm:block">
                            {auth.user?.name}
                        </span>
                        <ChevronDown className="hidden size-3.5 text-slate-400 sm:block" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className={cn('w-60', mapThemed && 'backdrop-blur-xl')}
                    style={menuStyle}
                >
                    {auth.user ? <UserMenuContent user={auth.user} /> : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function LearnerBrand() {
    const { props } = usePage();

    return (
        <Link className="flex shrink-0 items-center gap-3" href="/home">
            <AppLogoIcon className="size-8 text-violet-600 dark:text-violet-400" />
            <span className="hidden text-sm font-semibold tracking-wide text-slate-900 sm:block dark:text-slate-100">
                {props.name}
            </span>
        </Link>
    );
}
