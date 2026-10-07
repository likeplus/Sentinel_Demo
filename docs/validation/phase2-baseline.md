# Phase 2 开发基线

日期：2026-10-04（Europe/Amsterdam）。目标仓库：`likeplus/Sentinel_Demo`。实施范围依据用户确认的 [Phase 2 网页试玩规格](../05_Farm_Sim_Phase2_Spec.md)，以及上传的两份项目设计 Word 文档；原始文档和可读转录保存在 `docs/design/`。

开始开发前检查了适用的 AGENTS.md，没有找到适用于本仓库的文件。读取了 Phase 0/1 规格、domain/simulation、云南蓝莓内容包、crop pack、已有测试、App/Layout 路由、package scripts 和原验收报告。工作区开始时干净。

## PR #1 与开发分支

用户授权判断并在需要时合并 PR #1。重新验证 Phase 0/1 分支提交 `7e3da91a506be8703dfff3e40e3e90037e2d1a58` 后，确认 PR 可合并、无冲突；GitHub 没有报告该 PR 的状态检查。

[PR #1](https://github.com/likeplus/Sentinel_Demo/pull/1) 于 `2026-10-04T21:13:02Z` 合并，main 合并提交为 `35ba47f5cefbe21e7dfac730aa326e67e17e3c56`。随后从该 main 新建 `feature/farm-sim-phase2`。本阶段新增 `/game`，保留九条原路由、六个 Demo 场景及旧 store/pages/engines。

## 基线检查

| 检查 | 开发前结果 |
| --- | --- |
| Node / npm | 24.19.0 / 11.9.0；沿用 onboarding 已安装的锁定依赖 |
| `npm test` | 48 项通过，5 个测试文件 |
| `npm run build` | 通过；原主包超过 500 kB，已有 Vite 体积警告 |
| `npm run lint` | 退出 1：原有 22 个错误、8 个警告 |
| `npm run lint:baseline` | 通过；诊断与 [原始记录](phase01-lint-baseline.json) 一致 |
| Windows Phase 0/1 | 用户确认三个检查均通过；此前 120 天测试已加入局部 30 秒超时预算 |

标准 lint 原有问题涉及旧 store、组件和页面的重复键、未使用变量及 React Hook 等规则。本阶段要求新增代码零诊断，使用精确基线比对防止新增问题；不修改 ESLint 规则来掩盖错误。

本阶段不新增依赖，`package-lock.json` 保持不变。最终验证及遗留问题见 [phase2-results.md](phase2-results.md)。
