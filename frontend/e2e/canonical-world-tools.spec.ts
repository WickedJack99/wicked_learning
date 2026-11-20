import { expect, test } from '@playwright/test';
const evidence = process.env.TOOL_EVIDENCE_BASE_URL;

test('World tool transport keeps per-projection identities and discriminated source results', async ({ page }) => {
    test.skip(!evidence, 'Requires the canonical Vite evidence server.');
    const writes: { path: string; tool: string }[] = [];
    let invalid = false;
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'tool-test' } }));
    await page.route('**/api/v1/learner/maps/*/nodes/*/use-tool', (route) => {
        expect(route.request().headers()['x-csrf-token']).toBe('tool-test');
        writes.push({ path: new URL(route.request().url()).pathname, tool: route.request().postDataJSON().tool_slug });
        return route.fulfill({ json: invalid ? { is_useful: true } : { discovered: false, is_unlocked: true, is_useful: false } });
    });
    await page.goto(evidence!);
    const result = await page.evaluate(async () => {
        const api = await import('/src/platform/world-tools.ts');
        const tool = { id: '11111111-1111-4111-8111-111111111111', slug: 'lens' };
        const first = { id: '22222222-2222-4222-8222-222222222222', mapSlug: 'first-map', slug: 'same-node' };
        const second = { id: '33333333-3333-4333-8333-333333333333', mapSlug: 'second-map', slug: 'same-node' };
        const worlds = [first, second].map((node) => ({ maps: [{ slug: node.mapSlug, nodes: [node] }] }));
        worlds.forEach((world) => api.registerToolWorld(world, [tool]));
        const rejected: number[] = [];
        for (const [node, selected, path] of [
            [{ ...first }, tool, `/learning/nodes/${first.id}/reveal-tool`],
            [first, { ...tool, id: 'unknown' }, `/learning/nodes/${first.id}/reveal-tool`],
            [first, { ...tool, slug: 'forged' }, `/learning/nodes/${first.id}/reveal-tool`],
            [first, tool, `/learning/nodes/${second.id}/reveal-tool`],
            [first, tool, 'https://example.test/learning/nodes/1/reveal-tool'],
        ]) {
            try { await api.useWorldNodeTool(node, selected, path); } catch (error) { rejected.push(error.status); }
        }
        const reveal = await api.useWorldNodeTool(first, tool, `/learning/nodes/${first.id}/reveal-tool`);
        const unlock = await api.useWorldNodeTool(second, tool, `/learning/nodes/${second.id}/unlock-tool`);
        const reloads = [0, 0];
        worlds.forEach((world, index) => api.bindWorldReload(world, () => reloads[index]++));
        api.reloadWorld(first);
        api.reloadWorld(second);
        window.toolEvidence = { node: first, tool };
        return { rejected, reveal, unlock, reloads };
    });
    expect(result.rejected).toEqual([409, 409, 409, 409, 409]);
    expect(result.reveal.result).toMatchObject({ discovered: false, isUseful: false });
    expect(result.reveal.result).not.toHaveProperty('isUnlocked');
    expect(result.unlock.result).toMatchObject({ isUnlocked: true, isUseful: false });
    expect(result.unlock.result).not.toHaveProperty('discovered');
    expect(result.reloads).toEqual([1, 1]);
    expect(writes).toEqual([{ path: '/api/v1/learner/maps/first-map/nodes/same-node/use-tool', tool: 'lens' }, { path: '/api/v1/learner/maps/second-map/nodes/same-node/use-tool', tool: 'lens' }]);
    invalid = true;
    expect(await page.evaluate(async () => {
        const { useWorldNodeTool } = await import('/src/platform/world-tools.ts');
        const { node, tool } = window.toolEvidence;
        try { await useWorldNodeTool(node, tool, `/learning/nodes/${node.id}/reveal-tool`); return 200; } catch (error) { return error.status; }
    })).toBe(503);
});
