import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_BUNDLED === '1'
    ? {}
    : { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' }),
  headless: true,
});
const page = await browser.newPage();
const out = mkdtempSync(join(tmpdir(), 'voicestudio-sidebar-'));
const ui = process.env.VOICESTUDIO_UI_URL || 'http://localhost:3912';
try {
  await page.addInitScript(() => {
    localStorage.setItem('voicestudio.setup.complete.v1', '1');
    // The expanded navigation is under test, so keep it open beside the library.
    const saved = JSON.parse(localStorage.getItem('voicestudio.workspace-layout') || '{}');
    localStorage.setItem(
      'voicestudio.workspace-layout',
      JSON.stringify({ ...saved, autoCollapseSidebar: false }),
    );
  });
  await page.goto(ui + '/#/clone');
  const sidebar = page.locator('aside').first();
  const chooseView = async (name) => {
    // The view switch lives in the popover that the speed/quality label opens.
    const group = page.getByRole('radiogroup', { name: 'Tool settings', exact: true });
    if (!(await group.isVisible())) {
      await sidebar.locator('[data-slot=performance-trigger]').click();
      await group.waitFor();
    }
    await group.getByRole('radio', { name, exact: true }).click();
    const popup = page.locator('[data-slot=popover-content]');
    if (await popup.count()) {
      await page.keyboard.press('Escape');
      await popup.waitFor({ state: 'hidden' });
    }
  };
  const navigation = sidebar.getByRole('navigation', { name: 'Workspaces', exact: true });
  await navigation.waitFor();
  await sidebar.getByRole('slider', { name: 'Speed / quality', exact: true }).waitFor();
  // Simple keeps engine links out of the sidebar; they open from the slider's popover.
  assert.equal(await sidebar.locator('footer a:visible').count(), 0);
  assert.equal(await sidebar.locator('[data-slot=engine-row]').count(), 0);
  await chooseView('Models');
  const speechTool = sidebar.getByRole('link', { name: /^Text to speech: .*Change engine$/ });
  await speechTool.focus();
  assert.ok(await speechTool.evaluate((el) => el === document.activeElement));
  for (const label of [
    'Text to speech',
    'Speech to text',
    'Writing help',
    'Translation',
    'Voice typing',
    'Identify speakers',
  ]) {
    const tool = sidebar.getByRole('link', {
      name: new RegExp('^' + label + ': .*Change engine$'),
    });
    assert.ok(await tool.isVisible());
    assert.ok((await tool.innerText()).includes('\n'), 'Each tool shows a text status');
    assert.ok((await tool.boundingBox()).height >= 44, 'Tool has a touch-friendly target');
  }
  await speechTool.hover();
  assert.equal(await page.locator('[data-slot=tooltip-content][data-open]').count(), 0);
  await speechTool.blur();
  await page.mouse.move(800, 100);
  await chooseView('Simple');
  for (const [width, height] of [
    [1280, 720],
    [960, 600],
  ]) {
    await page.setViewportSize({ width, height });
    assert.equal(await navigation.getByRole('link').count(), 9);
    assert.equal(await page.getByRole('menu').count(), 0);
    const bounds = await navigation.boundingBox();
    assert.ok(bounds && bounds.width <= (await sidebar.boundingBox()).width);
    if (height >= 700) {
      assert.ok(
        await navigation.evaluate((el) => el.scrollHeight <= el.clientHeight),
        'Collapsed workspace navigation should fit without scrolling at standard window height',
      );
    }
    await page.screenshot({ path: join(out, 'navigation-' + height + '.png') });
    await chooseView('Models');
    await sidebar.locator('#sidebar-engine-details a').nth(5).waitFor();
    assert.equal(await sidebar.locator('#sidebar-engine-details a').count(), 6);
    const modelDetails = sidebar.locator('[data-slot=engine-selected-model]');
    assert.equal(await modelDetails.count(), 6);
    assert.ok(await modelDetails.first().isVisible());
    assert.ok(
      await sidebar
        .locator('#sidebar-engine-details')
        .evaluate(
          (el) => el.scrollHeight <= el.clientHeight || getComputedStyle(el).overflowY === 'auto',
        ),
    );
    const footer = await sidebar.getByRole('link', { name: 'Settings', exact: true }).boundingBox();
    assert.ok(
      footer && footer.y + footer.height <= height,
      `Settings footer escaped ${width}x${height}: ${JSON.stringify(footer)}`,
    );
    assert.ok(!(await sidebar.innerText()).includes('\u00c2'));
    await page.screenshot({ path: join(out, 'engines-' + height + '.png') });
    await chooseView('Simple');
    await page.screenshot({ path: join(out, 'compact-' + height + '.png') });
  }
  await navigation.getByRole('button', { name: 'Stories', exact: true }).click();
  await navigation.getByRole('link', { name: 'Stories', exact: true }).click();
  await page.waitForURL('**/#/stories');
  for (const width of [1920, 960]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto(ui + '/#/personas');
    const compactMain = page.locator('[data-slot=compact-main-sidebar]');
    await page.getByRole('heading', { name: 'Saved voices', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Saved voices', exact: true }).count(), 1);
    if (width === 1920) {
      // A wide window keeps the slim navigation column; the library belongs to the page.
      const slim = page.locator('.brand-sidebar').first();
      await slim.waitFor();
      assert.equal(await compactMain.count(), 0);
      const slimWidth = (await slim.boundingBox()).width;
      assert.ok(slimWidth >= 196 && slimWidth <= 288, `Slim navigation width ${slimWidth}`);
      await slim.getByRole('button', { name: 'Close' }).click();
      await compactMain.waitFor();
    } else {
      await compactMain.waitFor();
      assert.equal(Math.round((await compactMain.boundingBox()).width), 48);
      const openMain = compactMain.getByRole('button', { name: 'Toggle sidebar' });
      assert.equal(await openMain.locator('img').count(), 1);
    }
  }
  console.log(
    'Sidebar compact/expanded, 9 destinations, 6 engine links, visible models, non-duplicated Profiles, settings visibility and navigation passed. ' +
      out,
  );
} finally {
  await browser.close();
  if (process.env.VOICESTUDIO_KEEP_SMOKE_ARTIFACTS !== '1') {
    rmSync(out, { recursive: true, force: true });
  }
}
