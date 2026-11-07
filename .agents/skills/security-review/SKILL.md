---
name: security-review
description: Required security and privacy review for every Sentinel_Demo pull request, including source, history, screenshots, documents, dependencies and public builds.
---

# 每次 PR 的安全与隐私审查

每次创建、更新或准备合并 PR 时执行。先告知用户正在使用本技能；这是仓库级技能，由根目录 AGENTS.md 引用。用户已授权的正常审查、修复和测试不重复索取许可。

## 1. 明确范围，保护证据

确认当前分支、base/head SHA、工作区未提交改动及远端差异。先读项目原有说明，保留他人改动。检查 diff 之外仍会被公开的文件：Git 历史、public、构建产物、日志、存档样本、截图、视频、PDF、Office 文档和压缩包。

只记录相对路径、行号、规则、风险和处理状态；不复制密钥、令牌、私人邮箱、电话号码、个人目录、会话 Cookie 或原始检测报告。不要调用外部接口测试凭据是否有效。

## 2. 运行检查

安装 Gitleaks 8.30.1，必须核对官方发布资产的 SHA-256：
`551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`（Linux x64）。

使用 Python 3.10+，准备 pdftotext。然后执行：

```sh
python3 -m unittest discover -s scripts/security -p 'test_*.py' -v
python3 scripts/security/review.py
npm ci --ignore-scripts
npm run build:pages
python3 scripts/security/review.py --directory dist
npm test
```

首个扫描组合执行 Gitleaks 全部可达 Git 历史、当前已跟踪文件和文档／压缩包检查。构建后单独扫描真正部署的 dist。CI 下载器固定版本和校验值；不要求任何业务 API key，不运行 pull_request_target，不使用写权限或存储库机密。

## 3. 人工判断

- 密钥／账号：API key、令牌、私钥、Webhook 密钥、带密码连接串、.env、云凭据、Cookie、浏览器登录状态。
- 个人信息：真实姓名、私人邮箱／电话、详细地址／定位、设备标识、个人电脑目录、截图和视频中的浏览器账号、客户或员工资料。普通正则不能可靠判断这些内容，必须人工复核新增媒体。
- 文档：检查作者元数据、批注、修订、嵌入对象与附件。自动扫描提取 PDF 文本、DOCX/ZIP 内文本，但不做完整 OCR、不理解所有二进制格式，也不保证识别人名和地址。
- 前端：VITE_* 与 public 中内容会公开；不能保存服务端密钥。检查网络请求、第三方追踪、localStorage、错误日志和导出。不要把模拟数据、公开论文作者联系方式或上游包维护者信息错误解释为本项目用户泄露。
- 依赖与 CI：依赖或 lockfile 有变化时运行 npm audit 并判断适用性；检查安装脚本、Actions 权限、固定版本／校验、未受信任 PR 输入与日志。
- Git：提交邮箱本来就在历史中；发现后说明范围并建议开启 GitHub 提交邮箱隐私。清理当前文件不会删除历史，不擅自 force push。

## 4. 处理与复测

疑似有效凭据：停止继续传播，指出位置和服务，安排撤销／轮换后再判断解决。测试使用运行时拼接的合成值。个人电脑路径改为可移植相对路径，并修正产生它的脚本。

公开资料的必要联系方式可使用 scripts/security/privacy-exceptions.json：必须精确路径、Git blob SHA、仅 email/phone 规则和公开来源理由。文件内容变化即失效；例外不能屏蔽 Gitleaks、私钥或其他秘密规则。不得新增全目录忽略或将真实泄漏写进基线。

修复后重跑扫描及相关回归；检查日志没有复述原值。PR 描述写出检查命令、实际结果、范围、人工媒体检查和未解决风险。所有适用检查通过后才能准备合并；不以“扫描未发现”承诺绝无泄漏。

## 5. 持续执行与边界

.github/workflows/security-review.yml 对所有 PR 自动运行，无路径过滤，并检查 main 推送。AGENTS.md、模板和本技能约束人工／代理流程；是否禁止管理员或其他人绕过检查，由 GitHub ruleset / branch protection 决定。若没有管理权限，明确报告，不能声称已经设为平台强制门禁。
