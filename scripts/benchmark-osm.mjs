import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const label = process.argv[2] ?? 'baseline';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8081';
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const browser = await chromium.launch();
const runs = [];
try {
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const performance = await context.newCDPSession(page);
    await performance.send('Performance.enable');
    const taskDuration = async () => {
      const { metrics } = await performance.send('Performance.getMetrics');
      return metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0;
    };
    let glbRequests = 0,
      mapRequests = 0,
      mapBytes = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('.glb')) glbRequests++;
      if (request.url().includes('/api/places/map?')) mapRequests++;
    });
    page.on('response', async (response) => {
      if (response.url().includes('/api/places/map?')) {
        try {
          mapBytes += (await response.body()).length;
        } catch {}
      }
    });
    await page.route('https://tile.openstreetmap.org/**', (route) =>
      route.fulfill({ contentType: 'image/png', body: tile }),
    );
    await page.addInitScript(() => {
      sessionStorage.setItem('pawmap:intro-seen:v1', '1');
      window.__osmBench = { first: 0, longTasks: [], frames: [], phase: 'load' };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__osmBench.longTasks.push({
            duration: entry.duration,
            phase: window.__osmBench.phase,
          });
      }).observe({ type: 'longtask', buffered: true });
      let previous = 0;
      function frame(time) {
        if (previous && window.__osmBench.phase === 'pan')
          window.__osmBench.frames.push(time - previous);
        previous = time;
        if (
          !window.__osmBench.first &&
          (document.querySelector('.pawmap-osm-marker') ||
            Number(
              document
                .querySelector('[data-osm-rendered-points]')
                ?.getAttribute('data-osm-rendered-points'),
            ) > 0)
        )
          window.__osmBench.first = time;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    const initialTaskDuration = await taskDuration();
    await page.goto(baseURL + '/explore?view=osm');
    await page.waitForFunction(() => window.__osmBench.first > 0, { timeout: 60000 });
    await page.waitForTimeout(6500);
    const loadTaskDuration = await taskDuration();
    await page.evaluate(() => {
      window.__osmBench.phase = 'pan';
    });
    const canvas = page.locator('.maplibregl-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Map canvas missing');
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * (i % 2 ? 0.4 : 0.6), box.y + box.height * 0.6, {
        steps: 25,
      });
      await page.mouse.up();
      await page.waitForTimeout(350);
    }
    await page.evaluate(() => {
      window.__osmBench.phase = 'done';
    });
    const panTaskDuration = await taskDuration();
    const measurement = await page.evaluate(() => ({
      ...window.__osmBench,
      domMarkers: document.querySelectorAll('.pawmap-osm-marker').length,
      buttons: document.querySelectorAll('button').length,
    }));
    const frames = measurement.frames.sort((a, b) => a - b);
    runs.push({
      firstMarkerMs: measurement.first,
      loadTaskDurationMs: (loadTaskDuration - initialTaskDuration) * 1000,
      panTaskDurationMs: (panTaskDuration - loadTaskDuration) * 1000,
      loadMainThreadMs: measurement.longTasks
        .filter((item) => item.phase === 'load')
        .reduce((sum, item) => sum + item.duration, 0),
      panLongTaskMaxMs: Math.max(
        0,
        ...measurement.longTasks
          .filter((item) => item.phase === 'pan')
          .map((item) => item.duration),
      ),
      panFrameP95Ms: frames[Math.floor(frames.length * 0.95)] ?? null,
      domMarkers: measurement.domMarkers,
      buttons: measurement.buttons,
      glbRequests,
      mapRequests,
      mapBytes,
    });
    console.log(JSON.stringify({ run, ...runs.at(-1) }));
    await context.close();
  }
} finally {
  await browser.close();
}
await mkdir('test-results', { recursive: true });
await writeFile(
  `test-results/osm-${label}.json`,
  JSON.stringify({ baseURL, viewport: '1440x900', runs }, null, 2),
);
