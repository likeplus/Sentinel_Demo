# 代码安全与隐私审查（2026-11-07）

## 范围与方法

基线：main `c43627786b347ecc23036430ac8d81b04817276c`。仓库是公开仓库；在线应用为静态前端。通过 GitHub API 检查完整文件清单（3,902 个文件），读取全部 249 个当前文本文件，复核网络调用、构建与部署配置、Git 提交元数据。基线 main 有 34 个可达提交；查询到的 10 个分支纳入后续完整历史扫描。

本地执行器不可用，因此通过 GitHub Actions 运行实际扫描与测试，不把静态阅读当成已执行命令。自动扫描覆盖 Gitleaks 全部可达历史、当前文件、PDF 提取文本、DOCX/ZIP 内文本和实际 Pages 构建目录。日志仅输出规则与位置，不含命中原文。完整扫描已通过首轮 CI；下方记录实际运行。

## 已确认的发现与处理

| 风险 | 位置／范围 | 处理 |
| --- | --- | --- |
| 个人电脑用户名／目录泄露（中） | scripts/video_pipeline 的 5 份 concat 清单，共 40 行 | 当前文件改为同目录相对路径；同时修改 5 个生成脚本，防止再次生成个人绝对路径；新增可移植性检查 |
| 历史提交身份可被读取（低至中，取决于账户公开偏好） | 基线 25 个提交涉及 2 个非匿名邮箱身份 | 本报告不复述邮箱。未改写共享历史。建议相关提交者启用 GitHub 的 Keep my email addresses private，并在本机使用 GitHub 提供的 noreply 提交地址 |
| 凭据文件防误提交不足（中） | 原 .gitignore 未覆盖所有 .env、私钥和登录状态文件 | 补充忽略；已跟踪文件仍必须扫描，不能靠 .gitignore 处理历史 |
| 没有固定的 PR 安全检查（中） | 原来只有 Pages 测试／构建 | 增加根目录 AGENTS.md、仓库技能、PR 模板及每个 PR 自动运行的 security-review 工作流 |
| 第三方字体请求带来浏览器 IP／来源暴露（低） | index.html 的 Google Fonts 链接 | 删除外部字体加载，使用现有字体回退；补充 no-referrer 元信息 |
| 公开参考资料含联系方式（信息项） | 公开研究论文及其提取文本、package-lock.json 上游包说明 | 与本项目用户资料区分。保留必要引用，例外绑定精确文件与 Git blob SHA，仅适用于 email/phone；文件变化必须重新复核，不屏蔽密钥检测 |

当前文本初筛与完整历史 Gitleaks 均未发现 API key、私钥、JWT 或带密码连接串；不能据此保证图片、视频或所有类型的秘密均不存在。前端无业务 API 凭据配置，AI 为本地模拟；存档在浏览器 localStorage，不是安全保险箱，未来不能存真实凭据或个人资料。

## 检查如何持续生效

- 根目录 [AGENTS.md](../../AGENTS.md) 要求每次创建、更新或合并 PR 前读取 [.agents/skills/security-review/SKILL.md](../../.agents/skills/security-review/SKILL.md)。
- [.github/workflows/security-review.yml](../../.github/workflows/security-review.yml) 对所有 PR 自动运行，没有文件路径过滤，同时检查 main 推送。Gitleaks 固定 8.30.1，校验发布资产 SHA-256；Actions 固定提交 SHA，工作流只读，不需要业务密钥。
- 扫描覆盖当前文件与全部可达 Git 历史，构建后再扫描 dist；例外只针对已核验公开联系资料，不能屏蔽任何秘密规则。
- 私密报告、机器输出和登录状态禁止提交。新增截图、视频和文档仍需人工复核。
- CI 自动运行不等于配置了 GitHub 平台强制门禁；本次读取 main 的 protected=false，未修改管理员级 ruleset／branch protection。要防止其他人绕过检查，应把 security-review 设置为 main 的 required status check。

## 范围限制与后续处理

清理当前路径不会删除旧提交、Fork、克隆或缓存中的旧内容。旧个人目录与提交邮箱仍可能从历史中读取。没有擅自 force push 或重写公开历史；如需清理，应先确认影响并协调已有克隆。

扫描不会对全部图片／视频 OCR，不保证识别任意人名、地址或加密／专有二进制信息。PDF／Office 作者元数据作为人工复核项报告，公开论文作者不能自动等同为泄漏。仓库包含大量参考文献图像及视频；本次不能声称逐帧人工核验了所有媒体。

业务 API key 若以后出现在静态前端、VITE_* 或 public 中都会公开；真正的服务端凭据必须留在服务端，泄露后须撤销／轮换，不能仅删文件。依赖漏洞审计按适用性另行判断，不能用“没有密钥”证明应用整体安全。

## 实际验证

- [首轮 security-review](https://github.com/likeplus/Sentinel_Demo/actions/runs/42416414017)：10 项测试通过；3,910 个当前文件的秘密／隐私扫描及完整可达历史 Gitleaks 通过；21 个 Pages 部署文件扫描通过，阻断项为0。
- [首轮 Pages CI](https://github.com/likeplus/Sentinel_Demo/actions/runs/42416414429)：151 项现有游戏测试与生产构建通过。
- 自动报告提示的人工复核项：BusinessPlan/Prototype执行摘要.docx 与 BusinessPlan/Sentinel白皮书V1.31_draft.docx 含作者元数据；BusinessPlan/TASE农业多模态大模型.pdf 无可提取文本，未完成 OCR。它们不是已确认的秘密泄漏，不能标成已完整审查。
- npm 安装报告另提示 29 项既有依赖漏洞（2 low、5 moderate、20 high、2 critical）。这与是否泄漏密钥是不同问题，仍需独立修复和回归验证。新增只输出公开包／公告信息的依赖审计；既有漏洞报告步骤明确为非阻断项，不能据此宣称依赖安全。完整包清单已由 npm audit 核实，见[公开依赖审计结果](security-dependencies-2026-11-07.json)。

### 加固后的验证

[第二轮 security-review](https://github.com/likeplus/Sentinel_Demo/actions/runs/42416777680) 对 `f2784ca89a1ee7abe15817ec625d2285bfebe423` 执行：

- **12 项扫描器测试通过**，包含真实 Gitleaks 对合成令牌的离线检测与完全脱敏，以及扫描器未生成报告时必须失败。
- **3,911 个已跟踪文件、37 个可达 Git 提交**；不是浅克隆。Gitleaks 与当前文本／文档扫描阻断项为0。
- **21 个实际 Pages 部署文件**扫描通过。
- npm audit 实际返回非零：**29 个存在漏洞的包项**（并不等于29条独立公告）。其中2 critical、20 high、5 moderate、2 low。工作流明确保留为需要后续处理的非阻断步骤，没有将其伪装为已修复。
- [第二轮 Pages CI](https://github.com/likeplus/Sentinel_Demo/actions/runs/42416777682)：**151 项游戏测试与生产构建通过**。

### 依赖风险的适用范围与建议

| 依赖／问题 | 当前用途与判断 | 建议顺序 |
| --- | --- | --- |
| vitest、tinypool（critical） | 开发／测试工具链，不是静态页面里的服务器；仍有测试 UI 服务及污染输入等适用条件，不能忽略开发者风险 | 优先更新到已修复兼容版本，禁止把测试 UI 服务暴露到不受信任网络 |
| vite 及构建工具（high 等） | 开发服务与构建输入风险；GitHub Pages 部署的是静态文件，不运行 Vite 开发服务 | 更新受影响构建链并回归本地预览与构建 |
| react-router／react-router-dom（high） | 本项目采用客户端 BrowserRouter／HashRouter，SSR／RSC 公告的条件与静态部署不同；重定向类问题还需逐项复核 | 更新兼容版本并验证导航、Hash 路由及旧 Demo |
| puppeteer、录屏、解压依赖及 google-tts-api／axios（high） | 自动化／视频脚本工具链，升级可能跨主版本；不是浏览器农场模拟本身的业务 API | 分离开发依赖，升级或替代旧录屏／语音链，不自动执行 npm audit fix --force |
| uuid（moderate） | 当前三个业务引用均使用 v4；公告主要指向提供 buffer 的 v3／v5／v6 路径 | 保留适用性记录，随兼容升级一并处理 |

本次不进行未经回归验证的批量依赖升级。新依赖或 lockfile 变化必须另外核对新引入的高危问题；“秘密与隐私扫描无阻断项”不等于“所有依赖漏洞已经清零”。
