import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002';
const browser = await chromium.launch();
await mkdir('test-results', { recursive: true });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => sessionStorage.setItem('pawmap:intro-seen:v1', '1'));
  let tiles = 0;
  page.on('response', (response) => {
    if (response.url().startsWith('https://tile.openstreetmap.org/') && response.ok()) tiles++;
  });
  for (const locale of ['th', 'en']) {
    for (const width of [1440, 768, 390]) {
      const previousTiles = tiles;
      await page.setViewportSize({ width, height: 900 });
      await page.goto(baseURL + (locale === 'en' ? '/en' : '') + '/explore?view=osm');
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector('[data-osm-rendered-points]')
              ?.getAttribute('data-osm-rendered-points'),
          ) > 0,
      );
      await page.waitForTimeout(2000);
      for (let attempt = 0; attempt < 30 && tiles === previousTiles; attempt++) {
        if ((await page.locator('[data-osm-ready]').getAttribute('data-osm-fallback')) === 'true')
          break;
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: `test-results/osm-live-${locale}-${width}.png`,
        fullPage: true,
      });
      console.log(
        JSON.stringify({
          width,
          locale,
          successfulTileResponses: tiles,
          dataset: await page
            .locator('[data-osm-ready]')
            .evaluate((element) => ({ ...element.dataset })),
        }),
      );
    }
  }
} finally {
  await browser.close();
}
