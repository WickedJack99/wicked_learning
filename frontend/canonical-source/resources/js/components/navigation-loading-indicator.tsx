import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type NavigationLoadingIndicatorProps = {
    className?: string;
};

export function NavigationLoadingIndicator({
    className,
}: NavigationLoadingIndicatorProps) {
    const isLoading = useNavigationLoading();

    return (
        <div
            aria-live="polite"
            className={cn(
                'grid size-10 shrink-0 place-items-center rounded-lg border border-transparent text-slate-500 dark:text-slate-300',
                className,
            )}
        >
            {isLoading ? (
                <Spinner aria-label="Loading content" className="size-5" />
            ) : null}
        </div>
    );
}

function useNavigationLoading(): boolean {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const start = router.on('start', () => setIsLoading(true));
        const finish = router.on('finish', () => setIsLoading(false));
        const cancel = router.on('cancel', () => setIsLoading(false));

        return () => {
            start();
            finish();
            cancel();
        };
    }, []);

    return isLoading;
}
