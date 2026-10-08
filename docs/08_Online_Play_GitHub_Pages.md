# 在线试玩与自动更新：GitHub Pages

目标：团队通过固定网页地址试玩，每次 main 更新后自动构建发布，不需要下载 ZIP、解压或本地安装。

## 地址和一次性启用

- 农场游戏：<https://likeplus.github.io/Sentinel_Demo/#/game>
- 原演示应用：<https://likeplus.github.io/Sentinel_Demo/>
- 发布记录：<https://github.com/likeplus/Sentinel_Demo/actions/workflows/pages.yml>

这些地址在 Pages 首次部署成功后才可用。需要仓库管理员在 [Settings → Pages](https://github.com/likeplus/Sentinel_Demo/settings/pages) 的 Build and deployment 区域，将 Source 设为 **GitHub Actions**。如合并后的首次部署已因未开启 Pages 失败，在 Actions 打开 Publish online farm demo，重新运行失败的任务，或选择 Run workflow → main。

当前 Codex GitHub 连接无法管理 Pages 设置：创建 Pages API 返回 403 Resource not accessible by integration。该限制属于 GitHub 连接权限，代码配置不能替代管理员的这一步设置。

## 自动发布规则

`.github/workflows/pages.yml` 在 main 更新时安装锁定依赖、运行自动测试、生成 Pages 构建并发布。PR 只构建验证，不发布生产网站；手动 Run workflow 只允许 main 发布。采用环境权限与 GitHub OIDC 发布，不需将个人访问令牌写入仓库。

每次成功发布后，团队访问同一个链接。页面已打开时刷新以加载新版本；发布构建失败时不会替换上一份成功上线的版本。发布不表示页面中的个人存档自动兼容新规则，仍遵循当前存档版本策略。

## 兼容实现

Pages 将项目托管在 `/Sentinel_Demo/` 子目录。`npm run build:pages` 设置 Vite 静态资源前缀，选择 HashRouter，因此游戏地址为 `#/game`。刷新只请求项目入口 HTML，不需要服务器提供 SPA 重写。

原 `npm run dev` / `npm run build` 仍使用根路径与 BrowserRouter，适用于已有 Vercel 配置和本地开发。旧 Demo 的图标、相机与多模态图片统一通过 `src/publicAsset.js` 跟随构建前缀，避免部署后图片请求落到站点根目录而 404。

构建输出包含 `build-info.json`，记录发布提交和构建时间，可用来确认在线版本。GitHub Pages 仅托管构建产物；本版游戏逻辑和存档继续在浏览器中运行，没有新增服务端、多玩家同步或云存档。

## 验证和排障

```sh
npm test
npm run build:pages
npm run test:pages
npm run lint:baseline
```

`test:pages` 使用不提供 SPA 回退的严格静态服务器，检查八个游戏视图、实际排程执行、刷新恢复、语言持久化、返回旧 Demo、九条原路由和图片，以及提交标识。浏览器检查需要 Chromium；可设置 PUPPETEER_EXECUTABLE_PATH。

若页面 404：确认 Pages Source、工作流 deploy 状态、项目地址大小写和 `#/game`。若资源 404：确认构建前缀与仓库名一致。若 Actions 不运行：检查仓库 Actions 设置或 Pages 环境部署审批；不要误认为源码已推送就等于网站已发布。

参考：[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Vite Pages 部署](https://vite.dev/guide/static-deploy.html#github-pages)。
