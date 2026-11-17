import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`copied Register submits its invitation at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        let registrations = 0;
        await page.route('**/api/v1/public/welcome', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(welcome()) }));
        await page.route('**/api/v1/security/csrf', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'csrf' }) }));
        await page.route('**/api/v1/registration', async r => { registrations++; expect(r.request().headers()['x-csrf-token']).toBe('csrf'); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ authenticated: true, subject_id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7', two_factor_required: false }) }); });
        await page.goto('/register');
        for (const [name, value] of Object.entries({ name: 'Learner', email: 'learner@example.test', registration_token: 'invite', password: 'correct horse battery staple', password_confirmation: 'correct horse battery staple' })) await page.locator(`input[name="${name}"]`).fill(value);
        const submit = page.getByRole('button', { name: 'Create account' });
        const box = await submit.boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        await submit.click(); await expect.poll(() => registrations).toBe(1);
    });
}
function welcome() { const t={background_color:'#07111f',background_image:null,background_overlay:'none',border_line_color:'#fff',button_text_color:'#fff',input_background:'#07111f',panel_background:'#07111f'},p={accent_text:'#5eead4',accent_text_opacity:100,body_text:'#e2e8f0',body_text_opacity:100,control_border:'#fff',control_border_opacity:100,control_text:'#fff',control_text_opacity:100,heading_text:'#fff',heading_text_opacity:100,muted_text:'#94a3b8',muted_text_opacity:100,welcome_overlay:'#020617',welcome_overlay_opacity:62}; return {appearance:'light',auth:{user:null},publicPresentation:{branding:{logo:'/images/logo.png'},auth:{login:{dark:t,light:t},register:{dark:t,light:t},welcome:{dark:t,light:t}},cursors:{},welcome:{pages:[]},information_pages:[],public_palette:{dark:p,light:p},settings_palette:{dark:{},light:{}}}}; }
