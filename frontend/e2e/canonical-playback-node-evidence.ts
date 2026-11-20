import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext } from '@playwright/test';

export async function verifyPlaybackNode(owner: BrowserContext, peer: BrowserContext, path: string, nodeId: string, mapId: string) {
    const world = randomUUID(); const area = randomUUID(); const topic = randomUUID(); const sound = randomUUID(); const media = randomUUID();
    const originalWorld = uuid(sql(`SELECT world_id FROM learning_maps WHERE id='${mapId}'`).trim());
    const principal = await principalId(owner); const peerPrincipal = await principalId(peer);
    try {
        sql(`INSERT INTO learning_worlds (id,slug,title,description,published_at) VALUES ('${world}','${world}','Other published World','',NOW());
        INSERT INTO learning_topic_areas (id,slug,title) VALUES ('${area}','${area}','Fixture area');
        INSERT INTO learning_topics (id,area_id,slug,title,published_at) VALUES ('${topic}','${area}','${topic}','Node topic',NOW());
        INSERT INTO learning_sounds (id,slug,name,url,published_at) VALUES ('${sound}','${sound}','Node interaction','/sounds/soft-chime.wav',NOW());
        UPDATE learning_maps SET world_id='${world}',topic_id='${topic}' WHERE id='${mapId}';
        INSERT INTO learner_node_bookmarks (principal_id,node_id) VALUES ('${peerPrincipal}','${nodeId}');
        UPDATE learning_nodes SET state='active',position_q=4,position_r=-3,visual_config='${JSON.stringify({ dark: { imageUrl: `/api/v1/admin/media-assets/${media}/content` }, sounds: { click: { enabled: true, soundId: sound } }, unlock: { enabled: true, rules: { type: 'node_completed', nodeId } } })}' WHERE id='${nodeId}'`);
        const explorer = await owner.request.get('/api/v1/learner/world');
        expect(explorer.status()).toBe(200);
        expect((await explorer.json()).graph.maps.some((map) => map.id === mapId)).toBe(false);
        const read = async () => { const response = await owner.request.get(path); expect(response.status()).toBe(200); return (await response.json()).node; };
        const node = await read();
        expect(node).toMatchObject({ id: nodeId, map_id: mapId, state: 'active', q: 4, r: -3, topic: { slug: topic, title: 'Node topic' }, is_bookmarked: false });
        expect(node.visual_config.dark.imageUrl).toBe(`/api/v1/learner/media-assets/${media}/content`);
        expect(node.visual_config.sounds.click).toEqual({ enabled: true, url: '/sounds/soft-chime.wav' });
        expect(node.visual_config.unlock).not.toHaveProperty('rules');
        expect(node.visual_config.unlock.requirements).toMatchObject({ type: 'node_completed', mapSlug: node.map_slug, nodeSlug: node.slug, nodeTitle: node.title });
        sql(`INSERT INTO learner_node_bookmarks (principal_id,node_id) VALUES ('${principal}','${nodeId}'); UPDATE learning_topics SET published_at=NULL WHERE id='${topic}'; UPDATE learning_sounds SET published_at=NULL WHERE id='${sound}'`);
        const changed = await read();
        expect(changed.is_bookmarked).toBe(true);
        expect(changed.topic).toBeNull();
        expect(changed.visual_config.sounds.click).toEqual({ enabled: true, url: null });
    } finally {
        sql(`UPDATE learning_maps SET world_id='${originalWorld}',topic_id=NULL WHERE id='${mapId}'; UPDATE learning_nodes SET state='available',position_q=0,position_r=0,visual_config='{}' WHERE id='${nodeId}'; DELETE FROM learner_node_bookmarks WHERE node_id='${nodeId}'; DELETE FROM learning_worlds WHERE id='${world}'; DELETE FROM learning_topic_areas WHERE id='${area}'; DELETE FROM learning_sounds WHERE id='${sound}'`);
    }
}

export async function verifyPlaybackPortals(admin: BrowserContext, owner: BrowserContext, headers: Record<string,string>, path: string, source: string, target: string) {
    const world = randomUUID(); const second = randomUUID(); const input = randomUUID();
    let map: string | undefined;
    const sourceNode = uuid(sql(`SELECT source_node_id FROM learning_portal_links WHERE source_activity_id='${source}'`).trim());
    const targetNode = uuid(sql(`SELECT target_node_id FROM learning_portal_links WHERE source_activity_id='${source}'`).trim());
    try {
        const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Portal target ${randomUUID()}`, description: null, slug: null } });
        expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
        const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers, data: { title: 'Portal destination', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
        expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
        sql(`INSERT INTO learning_worlds (id,slug,title,description,published_at) VALUES ('${world}','${world}','Portal World','',NOW()); UPDATE learning_maps SET world_id='${world}',published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
        UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${input}',id,'arrival','Arrival','',0,NOW(),'portal','{"portalMode":"input"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${second}',route_id,'second-portal','Second portal','',1,NOW(),'portal','{"portalMode":"output"}' FROM learning_activities WHERE id='${source}';
        INSERT INTO learning_portal_links (source_activity_id,target_activity_id,source_node_id,target_node_id,label,description) VALUES ('${second}','${input}','${sourceNode}','${node.node_id}','Other exit','A different destination');`);
        const read = async () => { const response=await owner.request.get(path); expect(response.status()).toBe(200); return (await response.json()).node.outgoing_portal_links; };
        const links = await read();
        expect(links).toHaveLength(2);
        expect(links).toContainEqual(expect.objectContaining({ id: source, source_activity_id: source, target_activity_id: target, target_node_id: targetNode }));
        expect(links).toContainEqual(expect.objectContaining({ id: second, source_activity_id: second, target_activity_id: input, target_map_id: map, target_node_id: node.node_id, target_node_slug: 'portal-destination', label: 'Other exit', description: 'A different destination' }));
        expect(links.find((link) => link.source_activity_id === source).target_node_slug).toBe('portal-destination');
        for (const state of ['locked','hidden','active','completed']) {
            sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
            expect((await read()).find((link) => link.source_activity_id === second).target_node_state).toBe(state);
        }
        sql(`UPDATE learning_nodes SET state='available',visual_config='{"schedule":{"lockAt":"2000-01-01T00:00:00Z"}}' WHERE id='${node.node_id}'`);
        expect((await read()).find((link) => link.source_activity_id === second).target_node_state).toBe('locked');
        sql(`UPDATE learning_nodes SET visual_config='{}' WHERE id='${node.node_id}'`);
        for (const [hide, restore] of [
            [`UPDATE learning_maps SET access_roles='["unassigned-fixture-role"]' WHERE id='${map}'`, `UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`],
            [`UPDATE learning_maps SET published_at=NULL WHERE id='${map}'`, `UPDATE learning_maps SET published_at=NOW() WHERE id='${map}'`],
            [`UPDATE learning_nodes SET published_at=NULL WHERE id='${node.node_id}'`, `UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'`],
            [`UPDATE learning_map_assets SET published_at=NULL WHERE id='${node.asset_id}'`, `UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'`],
            [`UPDATE learning_routes SET published_at=NULL WHERE map_asset_id='${node.asset_id}'`, `UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'`],
            [`UPDATE learning_activities SET published_at=NULL WHERE id='${input}'`, `UPDATE learning_activities SET published_at=NOW() WHERE id='${input}'`],
            [`UPDATE learning_activities SET activity_config='{"portalMode":"output"}' WHERE id='${input}'`, `UPDATE learning_activities SET activity_config='{"portalMode":"input"}' WHERE id='${input}'`],
            [`UPDATE learning_activities SET published_at=NULL WHERE id='${second}'`, `UPDATE learning_activities SET published_at=NOW() WHERE id='${second}'`],
        ]) {
            sql(hide); expect((await read()).map((link) => link.source_activity_id)).toEqual([source]); sql(restore);
        }
        expect(await read()).toHaveLength(2);
    } finally {
        sql(`DELETE FROM learning_activities WHERE id='${second}'`);
        if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers })).status()).toBe(204);
        sql(`DELETE FROM learning_worlds WHERE id='${world}'`);
    }
}
async function principalId(context: BrowserContext) { const subject=uuid((await (await context.request.get('/api/v1/me')).json()).subject_id); return uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${subject}'`).trim()); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker',['exec','-i','wicked_learning-application-db-1','psql','-tA','-v','ON_ERROR_STOP=1','-U','wicked_application','-d','wicked_application'],{ input,encoding:'utf8',stdio:['pipe','pipe','pipe'] }); }
