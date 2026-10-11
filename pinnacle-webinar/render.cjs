// Renders index.html to an MP4, frame by frame, so every frame is exact.
// Usage: NODE_PATH=$(npm root -g) node render.cjs [--fps 30] [--workers 4] [--out pinnacle-webinar.mp4]
//        NODE_PATH=$(npm root -g) node render.cjs --stills 3,12,40   (PNG stills at those seconds)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 30);
const WORKERS = +arg('workers', 4);
const OUT = path.resolve(arg('out', 'pinnacle-webinar.mp4'));
const STILLS = arg('stills', null);
const URL = 'file://' + path.join(__dirname, 'index.html') + '?render=1';
const TMP = path.join(__dirname, '.render');

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  return { ff, done };
}

async function worker(browser, idx, from, to) {
  const page = await openPage(browser);
  const file = path.join(TMP, `seg${idx}.mp4`);
  const { ff, done } = encoder(file);
  for (let f = from; f < to; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (idx === 0 && (f - from) % 150 === 0) console.log(`worker0 ${Math.round((f - from) / (to - from) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  return file;
}

(async () => {
  const browser = await chromium.launch();
  if (STILLS) {
    const page = await openPage(browser);
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const s of STILLS.split(',').map(Number)) {
      await page.evaluate(t => window.renderAt(t), s);
      await page.screenshot({ path: path.join(__dirname, 'stills', `t${String(s).padStart(5, '0')}.png`) });
    }
    await browser.close();
    return;
  }
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
  const page = await openPage(browser);
  const total = Math.round(await page.evaluate(() => window.DURATION) * FPS);
  await page.close();
  console.log(`rendering ${total} frames @ ${FPS}fps with ${WORKERS} workers`);
  const per = Math.ceil(total / WORKERS);
  const files = await Promise.all([...Array(WORKERS)].map((_, i) => worker(browser, i, i * per, Math.min(total, (i + 1) * per))));
  await browser.close();
  fs.writeFileSync(path.join(TMP, 'list.txt'), files.map(f => `file '${f}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'),
    '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('concat failed'))));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('wrote ' + OUT);
})();
