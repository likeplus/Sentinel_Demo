const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, 'output_60s');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = process.env.VIDEO_BASE_URL || 'http://localhost:5174';
const TARGET_SECONDS = 60;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENES = [
  {
    id: 's00_intro',
    url: `${BASE_URL}/intro`,
    durationMs: 9000,
    subtitle: '面对高价值作物，传统的“感官加经验”正面临挑战。每一小时的决策迟疑，都在造成难以察觉的“结构性收入流失”（SRL）。',
    actions: async (page) => {
      await delay(4000);
      await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        if (h1) h1.style.transform = 'scale(1.05)';
      });
      await delay(3000);
    },
  },
  {
    id: 's01_mission_control',
    url: `${BASE_URL}/`,
    durationMs: 9000,
    subtitle: 'Sentinel 不是报表系统，而是农业决策操作系统。通过 24/7 不间断的主动监测，它将农业生产中的不确定性转化为确定性的利润。',
    actions: async (page) => {
      await delay(1500);
      await page.evaluate(() => {
        const card = document.querySelector('.card[style*="border-left: 4px solid rgb(239, 68, 68)"]');
        if (card) {
          card.style.boxShadow = '0 0 40px rgba(239, 68, 68, 0.6)';
          card.style.transform = 'scale(1.03)';
          card.style.transition = 'all 0.8s ease';
        }
      });
      await delay(3000);
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await delay(3000);
    },
  },
  {
    id: 's02_iterative_reasoning',
    url: `${BASE_URL}/?automate=true&round=1`,
    durationMs: 14000,
    subtitle: '当异常发生，Sentinel 启动“迭代推理”：从感知异常到分析关联模型，它能深度挖掘并验证隐藏在数据背后的潜在风险，而非简单报警。',
    actions: async (page) => {
      await delay(2000);
      await page.evaluate(() => {
        const overlay = document.querySelector('.reasoning-overlay-content');
        if (overlay) overlay.style.boxShadow = '0 0 60px rgba(56, 189, 248, 0.5)';
      });
      await delay(6000);
      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await delay(4000);
    },
  },
  {
    id: 's03_agent_mesh',
    url: `${BASE_URL}/?automate=true&round=2`,
    durationMs: 12000,
    subtitle: '这不是单点 AI，而是可协作的专家数字劳动力。农业、财务、供应与合规代理人实时对齐，在分钟级内达成跨部门的执行共识。',
    actions: async (page) => {
      await delay(2000);
      await page.evaluate(() => {
        const mesh = document.querySelector('.agent-mesh-layout');
        if (mesh) {
          mesh.style.border = '2px solid rgba(56, 189, 248, 0.6)';
          mesh.style.background = 'rgba(56, 189, 248, 0.05)';
        }
      });
      await delay(5000);
      await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
      await delay(3000);
    },
  },
  {
    id: 's04_connectivity',
    url: `${BASE_URL}/execution?automate=true&round=3`,
    durationMs: 12000,
    subtitle: '系统实时连接政府 API、外部供应商与客户门户。决策被即刻激活，转化为无人机与人力的协同行动，彻底终结“决策真空”。',
    actions: async (page) => {
      await delay(3000);
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await delay(4000);
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await delay(3000);
    },
  },
  {
    id: 's05_roi',
    url: `${BASE_URL}/audit`,
    durationMs: 9000,
    subtitle: 'Sentinel 让农业从“靠天吃饭”回归为“精准增长”。守护每一分 A 级品质，将风险管理转化为确定的商业超额收益。',
    actions: async (page) => {
      await delay(2000);
      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await delay(5000);
    },
  },
];

function getRecorderConfig() {
  return {
    followNewTab: false,
    fps: 25,
    videoFrame: {
      width: 1920,
      height: 1080,
    },
  };
}

async function injectSubtitle(page, subtitle) {
  await page.evaluate(
    (text) => {
      const old = document.getElementById('video-subtitle-container');
      if (old) old.remove();

      const container = document.createElement('div');
      container.id = 'video-subtitle-container';
      container.style.cssText = [
        'position:fixed',
        'left:8%',
        'right:8%',
        'bottom:10%',
        'z-index:2147483647',
        'display:flex',
        'justify-content:center',
        'pointer-events:none',
      ].join(';');

      const textEl = document.createElement('div');
      textEl.id = 'video-subtitle-text';
      textEl.textContent = text;
      textEl.style.cssText = [
        'display:inline-block',
        'max-width:100%',
        'padding:10px 14px',
        'border-radius:10px',
        'background:rgba(0,0,0,0.7)',
        'color:#ffffff',
        'text-align:center',
        'font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif',
        'font-size:36px',
        'font-weight:600',
        'line-height:1.3',
        'text-shadow:0 2px 8px rgba(0,0,0,0.55)',
        'border:1px solid rgba(255,255,255,0.14)',
      ].join(';');
      container.appendChild(textEl);
      document.body.appendChild(container);
    },
    subtitle,
  );
}

async function recordScene(browser, scene) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(scene.url, { waitUntil: 'networkidle2', timeout: 45000 });
  await delay(400);

  await injectSubtitle(page, scene.subtitle);

  const outPath = path.join(OUTPUT_DIR, `${scene.id}.mp4`);
  const recorder = new PuppeteerScreenRecorder(page, getRecorderConfig());
  await recorder.start(outPath);
  console.log(`[record] ${scene.id} start (${scene.durationMs}ms)`);

  const actionPromise = (scene.actions ? scene.actions(page) : Promise.resolve()).catch((err) => {
    console.warn(`[scene-actions] ${scene.id}: ${err.message}`);
  });

  await Promise.all([actionPromise, delay(scene.durationMs)]);
  await recorder.stop();
  await page.close();

  console.log(`[record] ${scene.id} saved -> ${outPath}`);
  return outPath;
}

function concatWithSilentAudio(videoPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = path.join(OUTPUT_DIR, 'concat_60s.txt');
    fs.writeFileSync(
      listPath,
      videoPaths.map((video) => `file '${path.relative(OUTPUT_DIR, video).replace(/\\/g, '/')}'`).join('\n'),
      'utf8',
    );

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .input('anullsrc=channel_layout=stereo:sample_rate=48000')
      .inputFormat('lavfi')
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v libx264',
        '-preset veryfast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-r 25',
        '-s 1920x1080',
        '-c:a aac',
        '-b:a 128k',
        `-t ${TARGET_SECONDS}`,
        '-shortest',
        '-movflags +faststart',
      ])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

function getDurationSeconds(targetFile) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(targetFile, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata?.format?.duration || 0);
    });
  });
}

async function main() {
  console.log('--- Sentinel 60s Renderer Started ---');
  console.log(`[base_url] ${BASE_URL}`);
  console.log(`[output] ${OUTPUT_DIR}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: null,
    args: ['--window-size=1920,1080', '--disable-dev-shm-usage'],
  });

  const captured = [];
  try {
    for (const scene of SCENES) {
      const sceneFile = await recordScene(browser, scene);
      captured.push(sceneFile);
    }
  } finally {
    await browser.close();
  }

  const finalPath = path.join(OUTPUT_DIR, 'sentinel_investor_60s_v2.mp4');
  await concatWithSilentAudio(captured, finalPath);

  console.log(`[done] ${finalPath}`);
  try {
    const duration = await getDurationSeconds(finalPath);
    console.log(`[duration] ${duration.toFixed(3)}s`);
  } catch (err) {
    console.warn('[duration-check] ffprobe unavailable; skipped duration print');
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
