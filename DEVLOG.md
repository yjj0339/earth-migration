# DEVLOG · The Earth Migration Project（地球迁移计划）

> 《流浪地球》同人 · 电影级交互式 WebGL 双页体验。从零构建，依据提示词
> `D:/WokBuddy/2026-10-23-12-02-03/prompts/提示词-地球迁移计划-earth-migration.md`。

## 基本盘

- 目录：`E:\ZCODE\earth-migration`
- 部署目标：GitHub Pages `yjj0339.github.io/earth-migration`（全局默认规则）
- three.js：r170（本地 node_modules vendor，比提示词的 r160 新，API 兼容；
  此包 `three.module.js` 自包含，无 three.core.js 依赖，已验证 grep 为 0）
- 字体：已下载到 `assets/fonts/`（orbitron-var.woff2 / rajdhani-600.ttf / jbmono-400/700.woff2）
- 贴图策略：**全程序化 canvas 生成**（提示词要求"加载失败必须有程序化兜底"，直接以程序化为主路径，
  保证零外链、离线可跑、Pages 部署小仓库）
- 模型策略：kitbash 基元拼装 + 按材质合并（提示词明确指定，NASA GLB 非必需）

## 尺度体系（第一部）

1 unit = 63.7 km → 地球半径 = 100.0 units（正好）
- 同步轨道 35,786 km ≈ 562 units（天枢站）
- 光柱 11,000 km ≈ 172.7 units
- 月球艺术化近距（真实 6034 units 太远）

## 进度

- [x] 2026-10-23 项目立项、vendor three r170、字体下载
- [ ] 第一部 index.html（六幕 62s 影片 + 9 地标 + HUD 五面板）
- [ ] fx 特效模块九件套
- [ ] 第二部 beyond.html（三层尺度阶梯 + 25 目的地 + 2:54 影片）
- [ ] 本地测试（截图验收）
- [ ] 部署 + 收尾六件事（200/MIME、README、二维码、导航主页、记忆、手机截图）

## 坑与决策记录

- （待记）
