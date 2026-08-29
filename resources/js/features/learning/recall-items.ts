import { deleteJson, postJson } from '@/features/world/api';

export async function queueRecallQuestion(questionId: number): Promise<void> {
    await postJson(`/learning/questions/${questionId}/recall`, {});
}

export async function removeRecallQuestion(questionId: number): Promise<void> {
    await deleteJson(`/learning/questions/${questionId}/recall`);
}
