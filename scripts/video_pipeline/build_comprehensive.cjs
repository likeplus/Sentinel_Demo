const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, 'output_comprehensive');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:4173';
const TARGET_SECONDS = 120;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENES = [
  {
    id: 's00_dashboard_boot',
    url: `${BASE_URL}/`,
    durationMs: 10000,
    readyText: 'Mission Control',
    subtitle: 'Sentinel不是报表系统，\n而是持续运转的决策OS。',
    actions: async (page) => {
      await delay(1200);
      await clickButtonByText(page, 'Run AI Analysis');
      await smoothScroll(page, 260, 2, 1200);
      await smoothScroll(page, 300, 1, 1400);
    },
  },
  {
    id: 's01_scenario_start',
    url: `${BASE_URL}/scenarios`,
    durationMs: 12000,
    readyText: 'Scenario Control Center',
    subtitle: '先加载真实场景，\n再按步骤推进决策闭环。',
    actions: async (page) => {
      await delay(900);
      await page.evaluate(() => {
        const firstScenarioCard = document.querySelector('.grid.grid-2 .card');
        if (firstScenarioCard) firstScenarioCard.click();
      });
      await waitForText(page, 'Pipeline Journey', 15000);
      await delay(600);
      await clickButtonByText(page, 'Auto-Play');
      await delay(6500);
    },
  },
  {
    id: 's02_sensor_telemetry',
    url: `${BASE_URL}/sensors`,
    durationMs: 12000,
    readyText: 'Sensor Telemetry',
    subtitle: '多源传感器每秒回传，\n系统实时校验风险信号。',
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, '7d');
      await delay(1200);
      await page.evaluate(() => {
        const card = document.querySelector('.sensor-detail-card');
        if (card) card.click();
      });
      await smoothScroll(page, 320, 2, 1300);
      await smoothScroll(page, 360, 1, 1200);
    },
  },
  {
    id: 's03_risk_assessment',
    url: `${BASE_URL}/risk`,
    durationMs: 14000,
    readyText: 'Risk Assessment Engine',
    subtitle: '风险还未爆发，\nAI已提前进入主动防御。',
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'Generate Risk Report');
      await waitForText(page, 'Risk Assessment Report', 15000);
      await delay(800);
      await smoothScroll(page, 320, 2, 1300);
      await smoothScroll(page, 260, 1, 1200);
    },
  },
  {
    id: 's04_prescription_reasoning',
    url: `${BASE_URL}/prescription`,
    durationMs: 14000,
    readyText: 'Prescription Builder',
    subtitle: 'Sentinel AI迭代推理，\n比较方案并约束合规。',
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'Generate Prescription');
      await delay(2500);
      if (page.url().includes('/execution')) {
        await page.goto(`${BASE_URL}/prescription`, { waitUntil: 'networkidle2', timeout: 45000 });
        await waitForText(page, 'Prescription Builder', 15000);
      }
      await clickButtonByText(page, 'JSON View');
      await delay(900);
      await clickButtonByText(page, 'Card View');
      await smoothScroll(page, 360, 2, 1300);
    },
  },
  {
    id: 's05_execution_orchestration',
    url: `${BASE_URL}/execution`,
    durationMs: 14000,
    readyText: 'Execution Command Center',
    subtitle: '无人机、设备与人力被统一调度，\n形成可追踪执行指纹。',
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'AI Analysis');
      await delay(2200);
      await clickButtonByText(page, 'Complete Execution');
      await smoothScroll(page, 320, 2, 1300);
      await smoothScroll(page, 360, 1, 1200);
    },
  },
  {
    id: 's06_audit_chain',
    url: `${BASE_URL}/audit`,
    durationMs: 12000,
    readyText: 'Audit Report',
    subtitle: '审计引擎自动生成证据链，\n把结果与责任清晰标注。',
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'Generate Audit Report');
      await delay(6500);
      await smoothScroll(page, 300, 1, 1200);
      await smoothScroll(page, 300, 1, 1200);
    },
  },
  {
    id: 's07_history_roi',
    url: `${BASE_URL}/history`,
    durationMs: 10000,
    readyText: 'Analytics & History',
    subtitle: '长期结果可量化：\nROI提升、用药下降、等级上升。',
    actions: async (page) => {
      await delay(900);
      await clickButtonByText(page, 'Success');
      await delay(700);
      await clickButtonByText(page, 'Issues');
      await delay(700);
      await clickButtonByText(page, 'All');
      await delay(900);
      await page.evaluate(() => {
        const clickable = Array.from(document.querySelectorAll('div.card')).find((el) => {
          const style = window.getComputedStyle(el);
          return style.cursor === 'pointer';
        });
        if (clickable) clickable.click();
      });
      await smoothScroll(page, 340, 1, 1200);
    },
  },
  {
    id: 's08_admin_governance',
    url: `${BASE_URL}/admin`,
    durationMs: 10000,
    readyText: 'Admin & Configuration',
    subtitle: '阈值、PHI与禁限药规则可配置，\n系统主动但始终可治理。',
    actions: async (page) => {
      await delay(1000);
      await smoothScroll(page, 320, 2, 1300);
      await smoothScroll(page, 320, 1, 1200);
    },
  },
  {
    id: 's09_dashboard_close',
    url: `${BASE_URL}/`,
    durationMs: 12000,
    readyText: 'Mission Control',
    subtitle: 'Sentinel把不确定农业，\n转化为可审计的确定性增长。',
    actions: async (page) => {
      await delay(1200);
      await smoothScroll(page, 260, 1, 1200);
      await page.evaluate(() => {
        const title = document.querySelector('.page-title');
        if (title) {
          title.style.transition = 'all 0.8s ease';
          title.style.transform = 'scale(1.03)';
          title.style.filter = 'drop-shadow(0 0 18px rgba(56,189,248,0.35))';
        }
      });
      await delay(2200);
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
    videoCrf: 22,
    videoCodec: 'libx264',
    videoPreset: 'veryfast',
  };
}

async function waitForText(page, text, timeoutMs = 12000) {
  await page.waitForFunction(
    (target) => document.body && document.body.innerText.includes(target),
    { timeout: timeoutMs },
    text,
  );
}

async function clickButtonByText(page, text) {
  await page.evaluate((targetText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((btn) => (btn.innerText || '').trim().includes(targetText));
    if (target && !target.disabled) target.click();
  }, text);
}

async function smoothScroll(page, deltaY, repeat = 1, pauseMs = 900) {
  for (let i = 0; i < repeat; i += 1) {
    await page.evaluate((delta) => {
      window.scrollBy({ top: delta, behavior: 'smooth' });
    }, deltaY);
    await delay(pauseMs);
  }
}

async function injectSubtitle(page, subtitleText) {
  await page.evaluate((text) => {
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
      'background:rgba(0,0,0,0.72)',
      'color:#ffffff',
      'text-align:center',
      'white-space:pre-line',
      'font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif',
      'font-size:34px',
      'font-weight:600',
      'line-height:1.35',
      'letter-spacing:0.2px',
      'text-shadow:0 2px 8px rgba(0,0,0,0.55)',
      'border:1px solid rgba(255,255,255,0.16)',
    ].join(';');
    container.appendChild(textEl);
    document.body.appendChild(container);
  }, subtitleText);
}

async function waitForSceneReady(page, scene) {
  if (scene.readyText) {
    await waitForText(page, scene.readyText, 20000);
    return;
  }
  if (scene.readySelector) {
    await page.waitForSelector(scene.readySelector, { timeout: 20000 });
  }
}

async function recordScene(browser, scene) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(scene.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitForSceneReady(page, scene);
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
    const listPath = path.join(OUTPUT_DIR, 'concat_comprehensive.txt');
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

async function copyToDeliverables(srcPath) {
  const outDir = path.join(ROOT, 'deliverables', 'video_comprehensive');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, path.basename(srcPath));
  fs.copyFileSync(srcPath, outPath);
  return outPath;
}

async function main() {
  console.log('--- Sentinel Comprehensive Renderer Started ---');
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

  const finalPath = path.join(OUTPUT_DIR, 'sentinel_investor_comprehensive_v1.mp4');
  await concatWithSilentAudio(captured, finalPath);

  const deliverablePath = await copyToDeliverables(finalPath);

  console.log(`[done] ${finalPath}`);
  console.log(`[deliverable] ${deliverablePath}`);
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

