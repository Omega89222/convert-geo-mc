import { chromium, devices } from 'playwright';

const url = process.env.VERIFY_URL || 'http://127.0.0.1:5173/';

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 },
  { name: 'mobile', ...devices['Pixel 7'] },
];

const browser = await chromium.launch();

try {
  for (const config of viewports) {
    const context = await browser.newContext(config);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(700);

    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl =
        canvas.getContext('webgl2', { preserveDrawingBuffer: true }) ||
        canvas.getContext('webgl', { preserveDrawingBuffer: true });
      if (!gl) return { ok: false, reason: 'No WebGL context' };

      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (Math.abs(r - g) > 8 || Math.abs(g - b) > 8 || r < 220) colored += 1;
      }

      return {
        ok: colored > width * height * 0.015,
        colored,
        width,
        height,
      };
    });

    if (!result.ok) {
      throw new Error(`${config.name} preview check failed: ${JSON.stringify(result)}`);
    }

    await page.screenshot({ path: `preview-${config.name}.png`, fullPage: true });
    await context.close();
    console.log(`${config.name}: ${result.colored} non-background pixels`);
  }
} finally {
  await browser.close();
}
