const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(__dirname, 'output_comprehensive_v3');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = process.env.VIDEO_BASE_URL || 'http://127.0.0.1:4173';
const TARGET_SECONDS = 165;
const VIDEO_LANG = (process.env.VIDEO_LANG || 'zh').toLowerCase();
const LANG_TAG = VIDEO_LANG.startsWith('zh') ? 'zhCN' : 'enUS';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SCENES = [
  {
    id: 's00_intro_background',
    url: `${BASE_URL}/`,
    durationMs: 18000,
    readySelector: '.page-title',
    readyText: 'Mission Control',
    subtitleTimeline: [
      { atMs: 0, text: '高价值农业最大的痛点不是“不会种”，\n而是高不确定性下关键决策没人敢担责。' },
      { atMs: 6000, text: '天气、病虫害、合规窗口同时变化，\n晚几小时就可能从Grade A降级。' },
      { atMs: 12000, text: 'Sentinel把风险识别、执行编排、责任审计串成一体，\n把经验决策升级为可验证系统决策。' },
    ],
    actions: async (page) => {
      await delay(1000);
      await clickButtonByText(page, 'Run AI Analysis');
      await delay(1000);
      await scrollToText(page, 'Structural Revenue Leakage');
      await delay(1200);
      await scrollToText(page, 'Autonomous Agent Mesh');
      await delay(1200);
      await scrollToText(page, 'Live System Stream');
    },
  },
  {
    id: 's01_sensors_proactive',
    url: `${BASE_URL}/sensors`,
    durationMs: 12000,
    readySelector: '.page-title',
    readyText: 'Sensor Telemetry',
    subtitleTimeline: [
      { atMs: 0, text: 'Sentinel每秒汇聚传感器、虫情、影像与环境数据，\n先做数据一致性校验，再进入风险判断。' },
      { atMs: 5000, text: '当湿度、叶面湿润时长、虫口密度共同上升，\n系统会提前触发主动防御，而不是事后报警。' },
      { atMs: 9000, text: '这一步直接解决“发现太晚”问题，\n把被动救火改成提前控损。' },
    ],
    actions: async (page) => {
      await delay(700);
      await clickButtonByText(page, '7d');
      await delay(800);
      await clickButtonByText(page, '30d');
      await delay(700);
      await clickButtonByText(page, '24h');
      await delay(700);
      await page.evaluate(() => {
        const firstCard = document.querySelector('.sensor-detail-card');
        if (firstCard) firstCard.click();
      });
      await delay(800);
      await scrollToText(page, 'Threshold Breach Log');
      await delay(900);
      await scrollToText(page, 'Pest Monitoring Station');
    },
  },
  {
    id: 's02_reasoning_part1',
    url: `${BASE_URL}/risk`,
    durationMs: 22000,
    readySelector: '.page-title',
    readyText: 'Risk Assessment Engine',
    subtitleTimeline: [
      { atMs: 0, text: 'AI推理 Step 1：定位异常与影响地块，\n先确认“哪里有问题”。' },
      { atMs: 5000, text: 'Step 2：汇总多模态证据，\n交叉验证“是不是噪声”。' },
      { atMs: 10000, text: 'Step 3：构建风险假设，\n预测不处理会损失多少与何时损失。' },
      { atMs: 16000, text: 'Step 4：输出风险窗口与优先级，\n把“看见风险”变成“可执行时序”。' },
    ],
    actions: async (page) => {
      await delay(700);
      await clickButtonByText(page, 'Generate Risk Report');
      await waitForText(page, 'Risk Assessment Report', 18000);
      await delay(900);
      await scrollToText(page, 'Multimodal Evidence Board');
      await delay(1100);
      await scrollToText(page, 'Risk Assessment Report');
      await delay(1100);
      await scrollToText(page, '7-Day Risk Trend');
      await delay(1000);
      await smoothScroll(page, 260, 1, 900);
    },
  },
  {
    id: 's03_reasoning_part2',
    url: `${BASE_URL}/prescription`,
    durationMs: 24000,
    readySelector: '.page-title',
    readyText: 'Prescription Builder',
    subtitleTimeline: [
      { atMs: 0, text: 'AI推理 Step 5：生成多候选方案，\n比较速度、成本、覆盖率与副作用。' },
      { atMs: 6000, text: 'Step 6：执行约束校验，\n自动检查PHI、禁限药、风速、缓冲区。' },
      { atMs: 12000, text: 'Step 7：淘汰不可执行方案，\n保留可落地且合规的优先路径。' },
      { atMs: 18000, text: 'Step 8：输出结构化处方+备选方案+成本收益，\n让决策具备可执行性和可审计性。' },
    ],
    actions: async (page) => {
      await delay(800);
      await clickButtonByText(page, 'Generate Prescription');
      await delay(2800);
      if (page.url().includes('/execution')) {
        await page.goto(`${BASE_URL}/prescription`, { waitUntil: 'networkidle2', timeout: 60000 });
        await delay(1200);
      }
      await scrollToText(page, 'AI Reasoning  - Factors Considered');
      await delay(1100);
      await scrollToText(page, 'Constraint Checks');
      await delay(1100);
      await scrollToText(page, 'Alternatives Considered & Rejected');
      await delay(1000);
      await scrollToText(page, 'Cost-Benefit Analysis');
      await delay(1000);
      await smoothScroll(page, 250, 1, 900);
    },
  },
  {
    id: 's04_agents_dashboard',
    url: `${BASE_URL}/`,
    durationMs: 20000,
    readySelector: '.page-title',
    readyText: 'Mission Control',
    subtitleTimeline: [
      { atMs: 0, text: 'Sentinel不是单模型回答器，\n而是多智能体协同企业系统。' },
      { atMs: 6000, text: '感知Agent持续巡检，\n看门狗Agent做阈值预警与升级。' },
      { atMs: 12000, text: '决策Agent和合规Agent联合会签，\n财务Agent同步评估ROI与风险敞口。' },
      { atMs: 17000, text: '你看到的是一个“持续开会并执行”的AI组织，\n不是一个静态图标。' },
    ],
    actions: async (page) => {
      await delay(900);
      await scrollToText(page, 'Autonomous Agent Mesh');
      await delay(1100);
      await clickButtonByText(page, 'Run AI Analysis');
      await delay(1200);
      await scrollToText(page, 'Live System Stream');
      await delay(1100);
      await smoothScroll(page, 230, 1, 900);
      await delay(1000);
      await smoothScroll(page, -220, 1, 900);
    },
  },
  {
    id: 's05_agents_scenario',
    url: `${BASE_URL}/scenarios`,
    durationMs: 18000,
    readySelector: '.page-title',
    readyText: 'Scenario Control Center',
    subtitleTimeline: [
      { atMs: 0, text: '场景推进时，多个Agent并行接力：\n有人识别威胁，有人设计处方，有人盯执行。' },
      { atMs: 7000, text: '你可以直接看到Agent Activity流水，\n每个动作都有来源与时间戳。' },
      { atMs: 13000, text: '这解决了传统农业“信息断层”问题，\n让跨部门协同变成分钟级闭环。' },
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
      await smoothScroll(page, 250, 1, 900);
      await delay(900);
      await smoothScroll(page, -220, 1, 900);
    },
  },
  {
    id: 's06_execution_collaboration',
    url: `${BASE_URL}/execution`,
    durationMs: 16000,
    readySelector: '.page-title',
    readyText: 'Execution Command Center',
    subtitleTimeline: [
      { atMs: 0, text: '进入执行阶段后，无人机、设备、人团队、外部服务商\n被统一编排进一张执行网络。' },
      { atMs: 7000, text: '系统持续对比“处方 vs 实际执行”，\n实时生成Execution Fingerprint。' },
      { atMs: 13000, text: '这一步确保方案不是“纸面正确”，\n而是“现场可控且可验证”。' },
    ],
    actions: async (page) => {
      await delay(800);
      await clickButtonByText(page, 'AI Analysis');
      await delay(1800);
      await clickButtonByText(page, 'Complete Execution');
      await delay(900);
      await scrollToText(page, 'Execution Fingerprint');
      await delay(1000);
      await scrollToText(page, 'Execution Progress  - Step by Step');
      await delay(1000);
      await scrollToText(page, 'AI Agent Activity Feed');
    },
  },
  {
    id: 's07_audit_and_benefit',
    url: `${BASE_URL}/audit`,
    durationMs: 20000,
    readySelector: '.page-title',
    readyText: 'Audit Report',
    subtitleTimeline: [
      { atMs: 0, text: '执行后自动生成审计链：\n依据、动作、结果、责任全部结构化留存。' },
      { atMs: 7000, text: '系统明确责任边界：\n决策有效性问题，还是执行偏差问题。' },
      { atMs: 13000, text: '然后回到历史面板看收益：\n风险更低、响应更快、Grade A占比更高。' },
      { atMs: 17500, text: '客户收益是可量化现金流改进，\n不是抽象AI概念。' },
    ],
    actions: async (page) => {
      await delay(900);
      await clickButtonByText(page, 'Generate Audit Report');
      await delay(5200);
      await scrollToText(page, 'Auto-Generated Audit Report');
      await delay(1100);
      await scrollToText(page, 'Decision Loop  - Provenance Trail');
      await delay(1000);
      await page.goto(`${BASE_URL}/history`, { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(1000);
      await scrollToText(page, 'Cumulative Revenue Protected');
      await delay(1000);
      await scrollToText(page, 'ROI');
    },
  },
  {
    id: 's08_close_cta',
    url: `${BASE_URL}/`,
    durationMs: 15000,
    readySelector: '.page-title',
    readyText: 'Mission Control',
    subtitleTimeline: [
      { atMs: 0, text: 'Sentinel把农业中的不确定性，\n转化为可管理、可审计、可复制的增长系统。' },
      { atMs: 7000, text: '对投资人，这是可规模化的决策基础设施；\n对客户，这是确定性利润引擎。' },
      { atMs: 12000, text: '从“风险被动应对”到“收益主动解锁”，\nSentinel给出完整闭环答案。' },
    ],
    actions: async (page) => {
      await delay(900);
      await scrollToText(page, 'Structural Revenue Leakage');
      await delay(1200);
      await page.evaluate(() => {
        const title = document.querySelector('.page-title');
        if (title) {
          title.style.transition = 'all 0.9s ease';
          title.style.transform = 'scale(1.04)';
          title.style.filter = 'drop-shadow(0 0 20px rgba(56,189,248,0.45))';
        }
      });
      await delay(1100);
      await scrollToText(page, 'Autonomous Agent Mesh');
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
    videoCrf: 20,
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
      'left:6%',
      'right:6%',
      'bottom:12%',
      'z-index:2147483647',
      'display:flex',
      'justify-content:center',
      'pointer-events:none',
      'box-sizing:border-box',
    ].join(';');

    const textEl = document.createElement('div');
    textEl.id = 'video-subtitle-text';
    textEl.textContent = '';
    textEl.style.cssText = [
      'display:inline-block',
      'max-width:88%',
      'padding:10px 14px',
      'border-radius:10px',
      'background:rgba(0,0,0,0.76)',
      'backdrop-filter:blur(2px)',
      'color:#ffffff',
      'text-align:center',
      'white-space:pre-line',
      'font-family:"Noto Sans SC","Microsoft YaHei","PingFang SC","Segoe UI",sans-serif',
      'font-size:30px',
      'font-weight:600',
      'line-height:1.38',
      'letter-spacing:0.15px',
      'text-shadow:0 2px 8px rgba(0,0,0,0.6)',
      'border:1px solid rgba(255,255,255,0.18)',
      'box-sizing:border-box',
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

function getSceneSubtitleTimeline(scene) {
  if (VIDEO_LANG.startsWith('zh')) {
    return scene.subtitleTimelineZh || scene.subtitleTimeline || [];
  }
  return scene.subtitleTimelineEn || scene.subtitleTimeline || [];
}

async function waitForSceneReady(page, scene) {
  try {
    if (scene.readySelector) {
      await page.waitForSelector(scene.readySelector, { timeout: 25000 });
    }
    if (scene.readyText) {
      await waitForText(page, scene.readyText, 18000);
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
  const subtitlePromise = runSubtitleTimeline(page, getSceneSubtitleTimeline(scene), scene.durationMs).catch((err) => {
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
    const listPath = path.join(OUTPUT_DIR, 'concat_comprehensive_v3.txt');
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
  console.log('--- Sentinel Comprehensive Renderer v3 Started ---');
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

  const finalPath = path.join(OUTPUT_DIR, `sentinel_investor_comprehensive_v3_165s_${LANG_TAG}.mp4`);
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
