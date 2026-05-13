import { chromium, devices } from 'playwright';

const url = process.env.VERIFY_URL || 'http://127.0.0.1:5173/';

const viewports = [
  { name: 'desktop', viewport: { width: 1440, height: 920 }, deviceScaleFactor: 1 },
  { name: 'mobile', ...devices['Pixel 7'] },
];

const bedrockFixture = {
  format_version: '1.12.0',
  'minecraft:geometry': [
    {
      description: {
        identifier: 'geometry.bedrock_sample',
        texture_width: 64,
        texture_height: 64,
      },
      bones: [
        {
          name: 'root',
          pivot: [0, 0, 0],
          cubes: [
            {
              origin: [-5, 0, -4],
              size: [10, 11, 8],
              uv: {
                north: { uv: [0, 0], uv_size: [10, 11] },
                south: { uv: [10, 0], uv_size: [10, 11] },
                east: { uv: [20, 0], uv_size: [8, 11] },
                west: { uv: [28, 0], uv_size: [8, 11] },
                up: { uv: [36, 0], uv_size: [10, 8] },
                down: { uv: [46, 0], uv_size: [10, 8] },
              },
            },
          ],
        },
      ],
    },
  ],
};

const browser = await chromium.launch();

try {
  for (const config of viewports) {
    const context = await browser.newContext(config);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');

    await assertWaitingForClick(page, config.name);

    await page.click('#convertButton');
    await page.waitForFunction(() =>
      document.querySelector('#exportStatus')?.textContent?.includes('Conversion réussie'),
    );
    await page.waitForTimeout(1400);

    const bedrockConversion = await page.evaluate(() => {
      const output = JSON.parse(document.querySelector('#outputJson').value);
      const geometry = output['minecraft:geometry']?.[0];
      const bones = geometry?.bones || [];
      const cubes = bones.flatMap((bone) => bone.cubes || []);
      const metricCubeCount = Number(document.querySelector('#cubeCount').textContent);
      const metricBoneCount = Number(document.querySelector('#boneCount').textContent);
      const status = document.querySelector('#exportStatus').textContent;
      const notice = document.querySelector('#conversionNoticeTitle').textContent;
      const title = document.querySelector('#outputTitle').textContent;

      return {
        ok:
          output.format_version === '1.12.0' &&
          geometry?.description?.identifier === 'geometry.converted_model' &&
          cubes.length === 4 &&
          bones.length === 1 &&
          metricCubeCount === cubes.length &&
          metricBoneCount === bones.length &&
          status.includes('Conversion réussie') &&
          notice === 'Conversion réussie' &&
          title === 'Bedrock .geo.json',
        identifier: geometry?.description?.identifier,
        cubes: cubes.length,
        bones: bones.length,
        metricCubeCount,
        metricBoneCount,
        status,
        notice,
        title,
      };
    });

    if (!bedrockConversion.ok) {
      throw new Error(`${config.name} Java to Bedrock check failed: ${JSON.stringify(bedrockConversion)}`);
    }

    const bedrockPixels = await assertPreviewHasPixels(page, config.name, 'Java to Bedrock');

    await page.setInputFiles('#modelInput', {
      name: 'bedrock_sample.geo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bedrockFixture)),
    });
    await page.waitForFunction(() => document.querySelector('#conversionDirection')?.value === 'to-java');
    await assertWaitingForClick(page, config.name);

    await page.click('#convertButton');
    await page.waitForFunction(() =>
      document.querySelector('#exportStatus')?.textContent?.includes('Conversion réussie'),
    );
    await page.waitForTimeout(1400);

    const javaConversion = await page.evaluate(() => {
      const output = JSON.parse(document.querySelector('#outputJson').value);
      const [element] = output.elements || [];
      const status = document.querySelector('#exportStatus').textContent;
      const notice = document.querySelector('#conversionNoticeTitle').textContent;
      const title = document.querySelector('#outputTitle').textContent;
      const direction = document.querySelector('#conversionDirection').value;

      return {
        ok:
          !output['minecraft:geometry'] &&
          output.textures?.[0] === 'minecraft:block/converted_texture' &&
          output.elements?.length === 1 &&
          JSON.stringify(element?.from) === JSON.stringify([3, 0, 4]) &&
          JSON.stringify(element?.to) === JSON.stringify([13, 11, 12]) &&
          element?.faces?.north?.texture === '#0' &&
          JSON.stringify(element?.faces?.north?.uv) === JSON.stringify([0, 0, 10, 11]) &&
          status.includes('Conversion réussie') &&
          notice === 'Conversion réussie' &&
          title === 'Java model JSON' &&
          direction === 'to-java',
        elementCount: output.elements?.length || 0,
        firstFrom: element?.from,
        firstTo: element?.to,
        northUv: element?.faces?.north?.uv,
        status,
        notice,
        title,
        direction,
      };
    });

    if (!javaConversion.ok) {
      throw new Error(`${config.name} Bedrock to Java check failed: ${JSON.stringify(javaConversion)}`);
    }

    const javaPixels = await assertPreviewHasPixels(page, config.name, 'Bedrock to Java');

    await page.screenshot({ path: `preview-${config.name}.png`, fullPage: true });
    await context.close();
    console.log(
      `${config.name}: Bedrock ${bedrockConversion.cubes} cubes/${bedrockConversion.bones} bones, Java ${javaConversion.elementCount} elements, ${bedrockPixels}/${javaPixels} preview pixels`,
    );
  }
} finally {
  await browser.close();
}

async function assertWaitingForClick(page, viewportName) {
  const waiting = await page.evaluate(() => ({
    output: document.querySelector('#outputJson').value,
    status: document.querySelector('#exportStatus').textContent,
    notice: document.querySelector('#conversionNoticeTitle').textContent,
    copyDisabled: document.querySelector('#copyOutput').disabled,
    downloadDisabled: document.querySelector('#downloadOutput').disabled,
  }));

  const ok =
    waiting.output === '' &&
    waiting.status === 'En attente' &&
    waiting.notice === 'Prêt à convertir' &&
    waiting.copyDisabled &&
    waiting.downloadDisabled;

  if (!ok) {
    throw new Error(`${viewportName} waiting state check failed: ${JSON.stringify(waiting)}`);
  }
}

async function assertPreviewHasPixels(page, viewportName, label) {
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
    throw new Error(`${viewportName} ${label} preview check failed: ${JSON.stringify(result)}`);
  }

  return result.colored;
}
