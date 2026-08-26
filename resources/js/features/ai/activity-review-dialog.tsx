import { Bot, CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { SettingsConfigurationDialog } from '@/components/settings-configuration-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ActivityReviewTemplate } from '@/pages/settings/worlds/edit-node-activity-types';
import { reviewActivity } from './activity-review-client';
import type {
    ActivityReviewAlignment,
    ActivityReview,
    ActivityReviewResult,
} from './activity-review-client';

type ReviewableActivity = {
    aiReview: ActivityReview | null;
    aiReviewStatus: string;
    aiReviewedAt: string | null;
    id: number;
    title: string;
    type: string;
    updatedAt: string | null;
};

export function ActivityReviewDialog({
    activity,
    onClose,
    onReviewed,
    templates,
}: {
    activity: ReviewableActivity | null;
    onClose: () => void;
    onReviewed: (result: ActivityReviewResult) => void;
    templates: ActivityReviewTemplate[];
}) {
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [lastResult, setLastResult] = useState<ActivityReviewResult | null>(
        null,
    );
    const result = activity
        ? lastResult?.activityId === activity.id
            ? lastResult.aiReview
            : activity.aiReview
        : null;
    const templateId = selectedTemplateId || templates[0]?.id.toString() || '';

    const runReview = async () => {
        if (!activity || templateId === '') {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const nextResult = await reviewActivity(
                activity.id,
                Number(templateId),
            );
            setLastResult(nextResult);
            onReviewed(nextResult);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : 'The activity review request failed.',
            );
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open && !processing) {
                    onClose();
                }
            }}
            open={activity !== null}
        >
            <SettingsConfigurationDialog className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="size-5 text-[var(--settings-accent)]" />
                        Review activity with AI
                    </DialogTitle>
                    <DialogDescription>
                        The review looks at this activity and its immediate
                        route connections only. It does not inspect learner data
                        or change the activity.
                    </DialogDescription>
                </DialogHeader>

                {activity ? (
                    <div className="grid gap-5">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">
                                    {activity.type}
                                </p>
                                <span
                                    className={
                                        activity.aiReviewStatus === 'reviewed'
                                            ? 'text-xs font-medium text-emerald-700 dark:text-emerald-300'
                                            : 'text-xs font-medium text-amber-700 dark:text-amber-300'
                                    }
                                >
                                    {reviewStatusLabel(activity.aiReviewStatus)}
                                </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold">
                                {activity.title}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {activity.updatedAt
                                    ? `Edited ${formatReviewDate(activity.updatedAt)}`
                                    : 'Edit time unavailable'}{' '}
                                ·{' '}
                                {activity.aiReviewedAt
                                    ? `AI reviewed ${formatReviewDate(activity.aiReviewedAt)}`
                                    : 'AI review not run yet'}
                            </p>
                        </div>

                        {result ? (
                            <ActivityReviewResultView review={result} />
                        ) : (
                            <div className="grid gap-4">
                                {templates.length > 1 ? (
                                    <div className="grid gap-2">
                                        <label
                                            className="text-sm font-medium"
                                            htmlFor="activity-review-template"
                                        >
                                            Review helper
                                        </label>
                                        <Select
                                            onValueChange={
                                                setSelectedTemplateId
                                            }
                                            value={templateId}
                                        >
                                            <SelectTrigger id="activity-review-template">
                                                <SelectValue placeholder="Choose a review helper" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map((template) => (
                                                    <SelectItem
                                                        key={template.id}
                                                        value={template.id.toString()}
                                                    >
                                                        {template.name}
                                                        {template.providerLabel
                                                            ? ` · ${template.providerLabel}`
                                                            : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : null}
                                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                                    Ask for a structured reading of the
                                    activity&apos;s learning purpose, strengths,
                                    possible adjustments, and autonomy,
                                    competence, and relatedness support.
                                </p>
                            </div>
                        )}
                        {error ? (
                            <p className="border-l-2 border-red-500 pl-3 text-sm text-red-600 dark:text-red-300">
                                {error}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <DialogFooter>
                    <Button
                        disabled={processing}
                        onClick={onClose}
                        type="button"
                        variant="outline"
                    >
                        Close
                    </Button>
                    {activity ? (
                        <Button
                            disabled={processing || templateId === ''}
                            onClick={runReview}
                            type="button"
                        >
                            <Sparkles className="size-4" />
                            {processing
                                ? 'Reviewing…'
                                : result
                                  ? 'Review again'
                                  : 'Review activity'}
                        </Button>
                    ) : null}
                </DialogFooter>
            </SettingsConfigurationDialog>
        </Dialog>
    );
}

function reviewStatusLabel(status: string): string {
    return status === 'reviewed' ? 'AI review current' : 'Needs AI review';
}

function formatReviewDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
}

function ActivityReviewResultView({ review }: { review: ActivityReview }) {
    const dimensions = [
        ['Autonomy', review.review.sdt.autonomy],
        ['Competence', review.review.sdt.competence],
        ['Relatedness', review.review.sdt.relatedness],
    ] as const;

    return (
        <div className="grid gap-5">
            <div>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {review.review.summary}
                </p>
            </div>
            <ReviewList items={review.review.strengths} title="Strengths" />
            <ReviewList
                items={review.review.suggestions}
                title="Possible adjustments"
            />
            {review.review.learningDesign ? (
                <div className="grid gap-3">
                    <p className="text-sm font-semibold">
                        Learning design alignment
                    </p>
                    <div className="grid gap-3">
                        <AlignmentView
                            alignment={review.review.learningDesign.purpose}
                            label="Learning purpose"
                        />
                        <AlignmentView
                            alignment={review.review.learningDesign.topics}
                            label="Competence topics"
                        />
                    </div>
                </div>
            ) : null}
            <div className="grid gap-3">
                <p className="text-sm font-semibold">SDT support signals</p>
                <div className="grid gap-3">
                    {dimensions.map(([label, dimension]) => (
                        <div
                            className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
                            key={label}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">{label}</p>
                                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                    {dimension.signal}
                                </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {dimension.note}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="size-3.5" />
                This is a suggestion for the tutor. No activity changes were
                applied.
            </p>
        </div>
    );
}

function AlignmentView({
    alignment,
    label,
}: {
    alignment: ActivityReviewAlignment;
    label: string;
}) {
    return (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{label}</p>
                <span className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {alignment.signal}
                </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {alignment.note}
            </p>
        </div>
    );
}

function ReviewList({ items, title }: { items: string[]; title: string }) {
    return (
        <div className="grid gap-2">
            <p className="text-sm font-semibold">{title}</p>
            {items.length > 0 ? (
                <ul className="grid gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {items.map((item, index) => (
                        <li className="flex gap-2" key={`${title}-${index}`}>
                            <span className="text-[var(--settings-accent)]">
                                •
                            </span>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    None recorded.
                </p>
            )}
        </div>
    );
}
