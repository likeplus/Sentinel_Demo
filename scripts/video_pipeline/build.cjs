const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const googleTTS = require('google-tts-api');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const SCENES = [
    {
        id: 'scene1_intro',
        url: 'http://localhost:5173/',
        text: '欢迎感受 Sentinel 强大的数字生命力。它通过全维度物联网感知，为你直接开启高端市场的利润大门。',
        durationMs: 9000,
        actions: async (page) => {
            // Wait for load
            await page.waitForSelector('.sensor-card-name', { timeout: 10000 }).catch(() => { });
            // Hover a sensor card to show some action
            await delay(1000);
            await page.hover('.sensor-card-name').catch(() => { });
            await delay(2000);
            // Scroll down a bit
            await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
        }
    },
    {
        id: 'scene2_radar',
        url: 'http://localhost:5173/risk-assessment',
        text: '滴答，这是蓝莓在严苛化学禁喷期即将来临的倒计时。Sentinel 绝不等待，极具攻击性的提前预判危机。',
        durationMs: 9000,
        actions: async (page) => {
            await delay(1000);
            await page.evaluate(() => {
                // Visualize AI Radar Thinking
                const aiDiv = document.createElement('div');
                aiDiv.innerHTML = `
                    <div style="position:fixed; top:40%; left:50%; transform:translate(-50%,-50%); 
                                z-index:9999; background:rgba(239, 68, 68, 0.2); 
                                border:2px solid #ef4444; border-radius:50%; 
                                width:150px; height:150px; display:flex; 
                                align-items:center; justify-content:center;
                                box-shadow: 0 0 30px #ef4444;
                                font-family:monospace; color:#ef4444; font-weight:bold;
                                animation: pulse 1s infinite;">
                        <span style="font-size:12px; background:#000; padding:2px 4px; border-radius:4px;">THREAT LOCKED</span>
                    </div>
                    <style>
                        @keyframes pulse {
                            0% { transform: translate(-50%, -50%) scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                            70% { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
                            100% { transform: translate(-50%, -50%) scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                        }
                    </style>
                `;
                document.body.appendChild(aiDiv);
            });
            await delay(3000);
            await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
        }
    },
    {
        id: 'scene3_ai_team',
        url: 'http://localhost:5173/prescription',
        text: '警报拉响，全域模块化 AI 组织沸腾。CFO、供应链专家组火力全开，几秒钟敲定执行金牌策略。',
        durationMs: 9000,
        actions: async (page) => {
            await delay(1000);
            // Simulate AI agents "Thinking" in the DOM
            await page.evaluate(() => {
                const thought = document.createElement('div');
                thought.innerHTML = `
                    <div style="position:fixed; bottom: 120px; right: 20px; z-index:9999;
                                background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981;
                                border-radius: 8px; padding: 12px; color: #10b981;
                                font-family: monospace; font-size: 14px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.5); width: 250px;">
                        <div style="font-weight:bold; margin-bottom: 4px;">> AI_TEAM_SYNC</div>
                        <div id="ai-log">Initializing CFO agent...</div>
                    </div>
                `;
                document.body.appendChild(thought);

                let step = 0;
                const msgs = ["Evaluating margins...", "Checking supply chain...", "Validating chemical PHI...", "Consensus Reached!"];
                setInterval(() => {
                    if (step < msgs.length) {
                        document.getElementById('ai-log').innerText = msgs[step];
                        step++;
                    }
                }, 1200);
            });
            await delay(3000);
            await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
        }
    },
    {
        id: 'scene4_execution',
        url: 'http://localhost:5173/execution',
        text: '中枢指挥网立即激活！全面排布人类与无人机作业阵型，极具动感的执行，绝不留任何死角。',
        durationMs: 8000,
        actions: async (page) => {
            await delay(2000);
            // Click Map switch if present
            await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
            await delay(2000);
        }
    },
    {
        id: 'scene5_profit',
        url: 'http://localhost:5173/dashboard',
        text: '所有的极致运转，最终只为你带来纯粹的生机勃勃的财富。保护超高溢价，让利润直接爆发！',
        durationMs: 8000,
        actions: async (page) => {
            // Scroll to financial metrics
            await page.evaluate(() => window.scrollBy({ top: 600, behavior: 'smooth' }));
            await delay(3000);
        }
    }
];

async function generateTTS(text, id) {
    const audioPath = path.join(OUTPUT_DIR, `${id}.mp3`);
    try {
        const audioBase64 = await googleTTS.getAudioBase64(text, { lang: 'zh-CN', slow: false });
        fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));
        console.log(`[TTS] Generated ${audioPath}`);
        return audioPath;
    } catch (e) {
        console.error(`[TTS Error] ${e}`);
        return null;
    }
}

async function recordScene(browser, scene) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

    // Inject Subtitle CSS early
    await page.evaluateOnNewDocument(() => {
        window.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.innerHTML = `
                #video-subtitle-container {
                    position: fixed;
                    bottom: 20px;
                    left: 0;
                    width: 100%;
                    text-align: center;
                    z-index: 2147483647; /* absolute top */
                    pointer-events: none;
                }
                #video-subtitle-text {
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    font-size: 24px;
                    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
                    padding: 8px 16px;
                    border-radius: 8px;
                    display: inline-block;
                    line-height: 1.4;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    max-width: 80%;
                }
            `;
            document.head.appendChild(style);
        });
    });

    console.log(`[Load] ${scene.url}`);
    await page.goto(scene.url, { waitUntil: 'networkidle2' });

    // Inject subtitle text
    await page.evaluate((text) => {
        const container = document.createElement('div');
        container.id = 'video-subtitle-container';
        container.innerHTML = `<div id="video-subtitle-text">${text}</div>`;
        document.body.appendChild(container);
    }, scene.text);

    const videoPath = path.join(OUTPUT_DIR, `${scene.id}_raw.mp4`);

    // Start recording
    const recorder = new PuppeteerScreenRecorder(page, { fps: 30, videoFrame: { width: 1280, height: 720 } });
    await recorder.start(videoPath);
    console.log(`[Record] Started ${scene.id} for ${scene.durationMs}ms`);

    // Perform actions
    const actionPromise = scene.actions(page);
    await Promise.all([
        actionPromise,
        delay(scene.durationMs)
    ]);

    await recorder.stop();
    await page.close();
    console.log(`[Record] Saved ${videoPath}`);
    return videoPath;
}

function mergeAudioVideo(video, audio, outPath) {
    return new Promise((resolve, reject) => {
        console.log(`[FFmpeg] Merging ${path.basename(video)} + ${path.basename(audio)} -> ${path.basename(outPath)}`);
        ffmpeg()
            .input(video)
            .input(audio)
            .outputOptions([
                '-map 0:v:0',
                '-map 1:a:0',
                '-c:v copy',
                '-c:a aac',
                '-shortest' // Trims to shortest stream (usually the audio)
            ])
            .save(outPath)
            .on('end', () => resolve(outPath))
            .on('error', (err) => reject(err));
    });
}

function concatVideos(videoPaths, outPath) {
    return new Promise((resolve, reject) => {
        console.log(`[FFmpeg] Concatenating ${videoPaths.length} videos -> ${path.basename(outPath)}`);

        // create concat.txt
        const listPath = path.join(OUTPUT_DIR, 'concat.txt');
        const listContent = videoPaths.map(p => `file '${path.relative(OUTPUT_DIR, p).replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listPath, listContent);

        ffmpeg()
            .input(listPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .save(outPath)
            .on('end', () => resolve(outPath))
            .on('error', (err) => reject(err));
    });
}

async function main() {
    console.log('--- Sentinel Promo Video Pipeline Started ---');

    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: null,
        args: ['--window-size=1280,720']
    });

    const finalScenes = [];

    for (const scene of SCENES) {
        // 1. Generate Audio
        const audioPath = await generateTTS(scene.text, scene.id);
        if (!audioPath) throw new Error("TTS Failed");

        // 2. Record UI (Visuals + Subtitles + Overlay)
        const videoPath = await recordScene(browser, scene);

        // 3. Combine them
        const mergedPath = path.join(OUTPUT_DIR, `${scene.id}_merged.mp4`);
        await mergeAudioVideo(videoPath, audioPath, mergedPath);
        finalScenes.push(mergedPath);
    }

    await browser.close();

    // 4. Concat all scenes
    const finalOut = path.join(OUTPUT_DIR, 'sentinel_investor_promo_v1.mp4');
    await concatVideos(finalScenes, finalOut);

    console.log(`\n=== SUCCESS ===\nVideo saved to: ${finalOut}`);
}

main().catch(console.error);
