import { Head, router } from '@inertiajs/react';
import { Check, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
    link: {
        note: string | null;
        purpose: string;
        token: string;
    };
};

export default function Redeem({ link }: Props) {
    return (
        <>
            <Head title="Redeem access link" />
            <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
                <section className="w-full rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-50 shadow-xl">
                    <div className="flex items-center gap-3 text-teal-300">
                        <Link className="size-5" />
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase">
                            Access link
                        </p>
                    </div>
                    <h1 className="mt-4 text-2xl font-semibold">
                        {link.purpose}
                    </h1>
                    {link.note ? (
                        <p className="mt-3 text-sm text-slate-300">
                            {link.note}
                        </p>
                    ) : null}
                    <p className="mt-4 text-sm text-slate-400">
                        This link can be used once and expires at the time set
                        by its creator.
                    </p>
                    <Button
                        className="mt-6"
                        onClick={() =>
                            router.post(`/access-links/${link.token}/redeem`)
                        }
                    >
                        <Check className="size-4" />
                        Redeem link
                    </Button>
                </section>
            </main>
        </>
    );
}
