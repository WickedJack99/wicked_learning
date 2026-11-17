import { deleteJson, postJson } from '@/features/world/api';

export async function queueRecallQuestion(questionId: number): Promise<void> {
    await postJson(`/learning/questions/${questionId}/recall`, {});
}

export async function removeRecallQuestion(questionId: number): Promise<void> {
    await deleteJson(`/learning/questions/${questionId}/recall`);
}

export async function postponeRecallQuestion(
    questionId: number,
): Promise<{ nextReviewAt: string }> {
    return postJson<{ nextReviewAt: string }>(
        `/learning/questions/${questionId}/recall/postpone`,
        {},
    );
}

export async function saveRecallFeedback(
    questionId: number,
    confidenceAfterFeedback: string,
): Promise<{ updated: boolean }> {
    return postJson<{ updated: boolean }>(
        `/learning/questions/${questionId}/recall/feedback`,
        { confidence_after_feedback: confidenceAfterFeedback },
    );
}
