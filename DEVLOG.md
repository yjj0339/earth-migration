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
- [x] 2026-10-23 第一部完成（六幕 62s / 9 地标 / HUD 五面板 / C·O·F·J 交互 / Web Audio 配乐）
- [x] 2026-10-23 fx 九件套（kit/triplanar/volplume/smoke/shock/atmosphere/aerial/models + boot 看门狗）
- [x] 2026-10-23 第二部完成（三层尺度 / 25 目的地 / 2:54 六幕 / 宇宙阶梯 / 时间压缩 / 遥测 + 26 事件日志）
- [x] 2026-10-23 双页 Playwright 冒烟零报错 + 关键画面目验通过（倒计时环/木星/银河/天枢站/体积光柱）
- [x] 2026-10-23 部署 https://yjj0339.github.io/earth-migration/ （200+MIME 验证、二维码、导航主页卡片、手机截图）

## 坑与决策记录

1. **logarithmicDepthBuffer + 自定义 ShaderMaterial**：logdepth 块不自动注入自定义 shader，
   必须手动 `#include <common>` + `<logdepthbuf_pars_*>` + `<logdepthbuf_*>` 四件套，
   否则自定义材质与标准材质深度不一致（光柱/大气全错）。common 块提供 isPerspectiveMatrix。
2. **r170 npm 包的 three.module.js 无 three.core.js 依赖**（grep=0），canghai 的坑在本包不存在；但
   EffectComposer 链隐式依赖 `examples/jsm/shaders/`（CopyShader/LuminosityHighPassShader/OutputShader），
   忘 vendor 会 404 白屏。
3. `vnoise(vec2)` 无重载：GLSL 值噪声只有 vec3 签名，传 .xy 要包 vec3(x,0)。
4. jQuery 肌肉记忆 `$('#id')` 会 null 崩——本项目 `$` 是 getElementById。
5. **Object.assign(group, {position})** 覆盖 Object3D 只读 getter 直接 TypeError，改 `.position.set/y=`。
6. bindUI 在 boot（渲染器创建）之前执行 → renderer undefined；启动顺序 = boot().then(buildPickMap+bindUI+loop)，
   并给 updateLabels 加 lm.el 守卫。
7. git-bash 无 python/py，用 `C:/Users/HUAWEI/AppData/Local/Programs/Python/Python312/python.exe`；
   serve.py 加 NO_OPEN 环境变量防测试时弹真浏览器（静默测试铁律）。
8. _nav 主页 rebase 冲突：远端同日新增浮光方界卡片；解法=checkout origin/main 版本后重套编辑，
   标签体系已带后缀（最新作品 · xxx），直接插卡片不动他人标签。
9. 尺度体系：L1 用艺术化 AU（r→2.2·r^0.75），LY=26 单位；太阳放 -X（SUN_POS=-2.2,0,0），
   夜面/尾随半球=+X——影片镜头要放 +X 侧才能拍到点亮的发动机群。
10. 公转速度标定：orbSpeed 定义为"365 天行星的 rad/s"，各行星按 365.25/days 比例缩放，
    四档 REAL / 2π/25 / 2π/3 / 2π/0.4。
