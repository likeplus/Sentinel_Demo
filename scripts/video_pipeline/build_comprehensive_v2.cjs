const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, 'output_comprehensive_v2');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:4173';
const TARGET_SECONDS = 150;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENES = [
  {
    id: 's00_intro_painpoints',
    url: `${BASE_URL}/`,
    durationMs: 22000,
    readyText: 'Mission Control',
    subtitleTimeline: [
      { atMs: 0, text: '农业最大难题不是产量，\n而是高不确定性下没人敢负责决策。' },
      { atMs: 7000, text: '病虫害、天气与合规窗口同时变化，\n传统靠经验经常错过关键几小时。' },
      { atMs: 14000, text: 'Sentinel把风险、执行和责任放进同一系统，\n把“靠天吃饭”改为“有证据地增长”。' },
    ],
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'Run AI Analysis');
      await delay(1200);
      await scrollToText(page, 'Structural Revenue Leakage');
      await delay(1500);
      await scrollToText(page, 'Autonomous Agent Mesh');
      await delay(1500);
      await scrollToText(page, 'Live System Stream');
      await delay(1200);
      await smoothScroll(page, -260, 1, 1000);
    },
  },
  {
    id: 's01_solution_loop',
    url: `${BASE_URL}/scenarios`,
    durationMs: 16000,
    readyText: 'Scenario Control Center',
    subtitleTimeline: [
      { atMs: 0, text: '这不是单点工具，而是五段闭环：\n感知→推理→处方→执行→审计。' },
      { atMs: 6000, text: '先加载真实场景，再推进每一步，\n每个动作都会留下可追溯记录。' },
      { atMs: 12000, text: '投资人看到的是可复制流程，\n客户得到的是稳定落地能力。' },
    ],
    actions: async (page) => {
      await delay(900);
      await page.evaluate(() => {
        const firstScenarioCard = document.querySelector('.grid.grid-2 .card');
        if (firstScenarioCard) firstScenarioCard.click();
      });
      await waitForText(page, 'Pipeline Journey', 15000);
      await delay(700);
      await clickButtonByText(page, 'Step');
      await delay(900);
      await clickButtonByText(page, 'Step');
      await delay(900);
      await clickButtonByText(page, 'Step');
      await delay(1000);
      await scrollToText(page, 'Pipeline Journey');
    },
  },
  {
    id: 's02_sensor_telemetry',
    url: `${BASE_URL}/sensors`,
    durationMs: 14000,
    readyText: 'Sensor Telemetry',
    subtitleTimeline: [
      { atMs: 0, text: '传感器、虫情、环境和图像数据持续接入，\n系统每秒做一致性校验。' },
      { atMs: 6000, text: '当湿度、叶面湿润、虫口密度同时抬升，\n系统会判定风险正在逼近阈值。' },
      { atMs: 11000, text: '这一步解决了“看见问题太晚”的痛点，\n把被动救火改为提前预防。' },
    ],
    actions: async (page) => {
      await delay(800);
      await clickButtonByText(page, '7d');
      await delay(900);
      await clickButtonByText(page, '30d');
      await delay(900);
      await clickButtonByText(page, '24h');
      await delay(800);
      await page.evaluate(() => {
        const card = document.querySelector('.sensor-detail-card');
        if (card) card.click();
      });
      await delay(900);
      await scrollToText(page, 'Threshold Breach Log');
      await delay(1000);
      await scrollToText(page, 'Pest Monitoring Station');
    },
  },
  {
    id: 's03_iterative_reasoning_risk',
    url: `${BASE_URL}/risk`,
    durationMs: 16000,
    readyText: 'Risk Assessment Engine',
    subtitleTimeline: [
      { atMs: 0, text: '迭代推理 Step 1：识别异常并定位影响区域。' },
      { atMs: 5000, text: 'Step 2：聚合多模态证据，\n验证异常不是偶发噪声。' },
      { atMs: 10000, text: 'Step 3：构建风险假设并给出时间窗口，\n判断现在不处理会损失多少。' },
    ],
    actions: async (page) => {
      await delay(800);
      await clickButtonByText(page, 'Generate Risk Report');
      await waitForText(page, 'Risk Assessment Report', 15000);
      await delay(700);
      await scrollToText(page, 'Multimodal Evidence Board');
      await delay(1000);
      await scrollToText(page, 'Risk Assessment Report');
      await delay(800);
      await smoothScroll(page, 250, 1, 900);
    },
  },
  {
    id: 's04_iterative_reasoning_prescription',
    url: `${BASE_URL}/prescription`,
    durationMs: 18000,
    readyText: 'Prescription Builder',
    subtitleTimeline: [
      { atMs: 0, text: 'Step 4：生成候选方案并逐一对比成本、效果、速度。' },
      { atMs: 6000, text: 'Step 5：校验PHI、禁限药、风速、缓冲区等约束，\n自动剔除不可执行方案。' },
      { atMs: 12000, text: '最终输出结构化处方与备选路径，\n把“AI建议”变成可执行、可审计决策。' },
    ],
    actions: async (page) => {
      await delay(800);
      await clickButtonByText(page, 'Generate Prescription');
      await delay(2600);
      if (page.url().includes('/execution')) {
        await page.goto(`${BASE_URL}/prescription`, { waitUntil: 'networkidle2', timeout: 60000 });
        await waitForText(page, 'Prescription Builder', 15000);
      }
      await delay(700);
      await scrollToText(page, 'AI Reasoning  - Factors Considered');
      await delay(900);
      await scrollToText(page, 'Constraint Checks');
      await delay(900);
      await scrollToText(page, 'Alternatives Considered & Rejected');
      await delay(700);
      await scrollToText(page, 'Cost-Benefit Analysis');
    },
  },
  {
    id: 's05_multi_agents',
    url: `${BASE_URL}/scenarios`,
    durationMs: 20000,
    readyText: 'Scenario Control Center',
    subtitleTimeline: [
      { atMs: 0, text: 'Sentinel不是一个模型，而是多智能体协作网络。' },
      { atMs: 6000, text: '农艺Agent、看门狗Agent、合规Agent、执行Agent、\n审计Agent、财务Agent持续并行分工。' },
      { atMs: 13000, text: '它们像一个高速作战会议：\n有人发现风险，有人算约束，有人签发执行。' },
    ],
    actions: async (page) => {
      await delay(900);
      await page.evaluate(() => {
        const firstScenarioCard = document.querySelector('.grid.grid-2 .card');
        if (firstScenarioCard) firstScenarioCard.click();
      });
      await waitForText(page, 'Pipeline Journey', 15000);
      await delay(700);
      await clickButtonByText(page, 'Auto-Play');
      await delay(4500);
      await scrollToText(page, 'AI Agent Activity');
      await delay(1000);
      await smoothScroll(page, 240, 1, 1000);
      await delay(900);
      await smoothScroll(page, -200, 1, 900);
    },
  },
  {
    id: 's06_execution_orchestration',
    url: `${BASE_URL}/execution`,
    durationMs: 14000,
    readyText: 'Execution Command Center',
    subtitleTimeline: [
      { atMs: 0, text: '处方下发后，无人机、设备、人团队和外部服务商\n被一次性编排进同一执行链。' },
      { atMs: 7000, text: '系统实时比对“处方 vs 实际执行”，\n生成Execution Fingerprint防止偏差失控。' },
      { atMs: 12000, text: '这一步解决了“方案好但落地走样”的痛点。' },
    ],
    actions: async (page) => {
      await delay(900);
      await clickButtonByText(page, 'AI Analysis');
      await delay(1700);
      await clickButtonByText(page, 'Complete Execution');
      await delay(900);
      await scrollToText(page, 'Execution Fingerprint');
      await delay(900);
      await scrollToText(page, 'Execution Progress  - Step by Step');
      await delay(900);
      await scrollToText(page, 'AI Agent Activity Feed');
    },
  },
  {
    id: 's07_audit_responsibility',
    url: `${BASE_URL}/audit`,
    durationMs: 14000,
    readyText: 'Audit Report',
    subtitleTimeline: [
      { atMs: 0, text: '执行结束后，审计引擎自动汇总数据、理由、动作和结果。' },
      { atMs: 6000, text: '报告会标注责任边界：\n是决策问题，还是执行偏差。' },
      { atMs: 11000, text: '这让分润、对赌和监管沟通有证据基础，\n避免无限责任。' },
    ],
    actions: async (page) => {
      await delay(900);
      await clickButtonByText(page, 'Generate Audit Report');
      await delay(5200);
      await scrollToText(page, 'Auto-Generated Audit Report');
      await delay(900);
      await scrollToText(page, 'Decision Loop  - Provenance Trail');
      await delay(900);
      await scrollToText(page, 'Report Distribution');
    },
  },
  {
    id: 's08_roi_benefits',
    url: `${BASE_URL}/history`,
    durationMs: 10000,
    readyText: 'Analytics & History',
    subtitleTimeline: [
      { atMs: 0, text: '历史面板展示长期结果：\n风险下降、响应提速、化学投入下降。' },
      { atMs: 5000, text: '更关键的是Grade A占比提升，\n收入从波动转向可预测。' },
      { atMs: 9000, text: '客户关心的不是AI术语，\n而是每季能多赚多少、少亏多少。' },
    ],
    actions: async (page) => {
      await delay(700);
      await clickButtonByText(page, 'Success');
      await delay(700);
      await clickButtonByText(page, 'All');
      await delay(700);
      await scrollToText(page, 'Cumulative Revenue Protected');
      await delay(800);
      await scrollToText(page, 'Decision Log');
    },
  },
  {
    id: 's09_close_statement',
    url: `${BASE_URL}/`,
    durationMs: 6000,
    readyText: 'Mission Control',
    subtitleTimeline: [
      { atMs: 0, text: 'Sentinel的价值是把不确定性变成可管理变量，\n把决策能力沉淀为可审计资产。' },
      { atMs: 3000, text: '对投资人，这是可复制的增长引擎；\n对客户，这是确定性利润系统。' },
    ],
    actions: async (page) => {
      await delay(800);
      await page.evaluate(() => {
        const title = document.querySelector('.page-title');
        if (title) {
          title.style.transition = 'all 0.9s ease';
          title.style.transform = 'scale(1.04)';
          title.style.filter = 'drop-shadow(0 0 20px rgba(56,189,248,0.45))';
        }
      });
      await delay(1400);
      await scrollToText(page, 'Structural Revenue Leakage');
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
    videoCrf: 21,
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

async function scrollToText(page, text) {
  await page.evaluate((targetText) => {
    const all = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,span,div,button,td,th'));
    const target = all.find((el) => (el.innerText || '').includes(targetText));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, text);
}

async function ensureSubtitleContainer(page) {
  await page.evaluate(() => {
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
    textEl.textContent = '';
    textEl.style.cssText = [
      'display:inline-block',
      'max-width:100%',
      'padding:10px 14px',
      'border-radius:10px',
      'background:rgba(0,0,0,0.74)',
      'color:#ffffff',
      'text-align:center',
      'white-space:pre-line',
      'font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif',
      'font-size:34px',
      'font-weight:600',
      'line-height:1.34',
      'letter-spacing:0.2px',
      'text-shadow:0 2px 8px rgba(0,0,0,0.55)',
      'border:1px solid rgba(255,255,255,0.16)',
    ].join(';');
    container.appendChild(textEl);
    document.body.appendChild(container);
  });
}

async function setSubtitleText(page, text) {
  await page.evaluate((nextText) => {
    const el = document.getElementById('video-subtitle-text');
    if (el) el.textContent = nextText;
  }, text);
}

async function runSubtitleTimeline(page, subtitleTimeline, durationMs) {
  if (!subtitleTimeline || subtitleTimeline.length === 0) return;
  const sorted = [...subtitleTimeline].sort((a, b) => a.atMs - b.atMs);
  const start = Date.now();

  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const elapsed = Date.now() - start;
    const waitMs = Math.max(0, item.atMs - elapsed);
    if (waitMs > 0) await delay(waitMs);
    await setSubtitleText(page, item.text);
  }

  const left = Math.max(0, durationMs - (Date.now() - start));
  if (left > 0) await delay(left);
}

async function waitForSceneReady(page, scene) {
  try {
    if (scene.readyText) {
      await waitForText(page, scene.readyText, 25000);
      return;
    }
    if (scene.readySelector) {
      await page.waitForSelector(scene.readySelector, { timeout: 25000 });
    }
  } catch (err) {
    console.warn(`[ready-check] ${scene.id}: ${err.message}`);
    await delay(1200);
  }
}

async function recordScene(browser, scene) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(scene.url, { waitUntil: 'networkidle2', timeout: 60000 });
  await waitForSceneReady(page, scene);
  await delay(350);

  await ensureSubtitleContainer(page);

  const outPath = path.join(OUTPUT_DIR, `${scene.id}.mp4`);
  const recorder = new PuppeteerScreenRecorder(page, getRecorderConfig());

  await recorder.start(outPath);
  console.log(`[record] ${scene.id} start (${scene.durationMs}ms)`);

  const actionPromise = (scene.actions ? scene.actions(page) : Promise.resolve()).catch((err) => {
    console.warn(`[scene-actions] ${scene.id}: ${err.message}`);
  });
  const subtitlePromise = runSubtitleTimeline(page, scene.subtitleTimeline, scene.durationMs).catch((err) => {
    console.warn(`[subtitle] ${scene.id}: ${err.message}`);
  });

  await Promise.all([actionPromise, subtitlePromise, delay(scene.durationMs)]);
  await recorder.stop();
  await page.close();

  console.log(`[record] ${scene.id} saved -> ${outPath}`);
  return outPath;
}

function concatWithSilentAudio(videoPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const listPath = path.join(OUTPUT_DIR, 'concat_comprehensive_v2.txt');
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

async function copyToDesktop(srcPath) {
  const desktop = path.join(process.env.USERPROFILE || path.join('C:', 'Users', 'Public'), 'OneDrive', 'Desktop');
  if (!fs.existsSync(desktop)) return null;
  const outPath = path.join(desktop, path.basename(srcPath));
  fs.copyFileSync(srcPath, outPath);
  return outPath;
}

async function main() {
  console.log('--- Sentinel Comprehensive Renderer v2 Started ---');
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

  const finalPath = path.join(OUTPUT_DIR, 'sentinel_investor_comprehensive_v2_150s.mp4');
  await concatWithSilentAudio(captured, finalPath);

  const deliverablePath = await copyToDeliverables(finalPath);
  const desktopPath = await copyToDesktop(finalPath);

  console.log(`[done] ${finalPath}`);
  console.log(`[deliverable] ${deliverablePath}`);
  if (desktopPath) console.log(`[desktop] ${desktopPath}`);
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
