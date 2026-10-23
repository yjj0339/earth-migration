# DEVLOG · The Earth Migration Project（地球迁移计划）

> 《流浪地球》同人 · 电影级交互式 WebGL 双页体验。从零构建，依据提示词
> `D:/WokBuddy/2026-10-23-12-02-03/prompts/提示词-地球迁移计划-earth-migration.md`。

## v2 升级（2026-10-24 · 晨光星图版）

用户要求全面升级：画质 / 流畅度 / 稳定性 / **浅色主题** / **原生中文**。
- 浅色方向定调「晨光星图」：白底淡青宇宙、深青墨线框、白玻璃面板、天体深青描边
  （天文图鉴/制图美学）。与全局浅色偏好对齐，深空黑底按用户直接指令废弃。
- **关键技术：加法混合在浅色背景上会隐形（加色→更白）**。光柱/大气/冲击波/弓形激波/
  日冕/彗尾/银河粒子全部改 NormalBlending 并输出 (color, alpha)，颜色加深。
  bloom 阈值提到 1.0 只对 HDR>1 发光体生效，白底不过曝。
- 原生中文：全部 HUD/字幕/按钮/遥测/事件日志中文化；--zh 字体栈（PingFang/雅黑）；
  Orbitron 只用于数字点缀；中文标题+英文副题反转排版。
- 画质：地球贴图 1024→2048（脊线大陆+双频云+双层夜灯）、球体 128→160 段、
  光柱 ray-march 步数 20→24。
- 流畅度：DRS 自适应分辨率（2/1.6/1.3/1.05 四档，<42fps 降、>57fps 升，localStorage 记忆）、
  HUD 10Hz 节流、标签 15Hz 节流、volplume tick 零 clone、renderFrame 真实 dt（原 1/60 硬编码）。
- 稳定性：safeAnimate 单帧异常不炸（3 连击才停机降级重启）、webglcontextlost/restored、
  visibilitychange 静音+丢帧、dash 括号笔误回归检查。
- 回归：双部 Playwright 零报错；浅色截图目验通过（地球/光柱/面板中文/银河星图风/手机端）。

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

## 坑与决策记录（v1 + v2）

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
11. **浅色主题下 AdditiveBlending 隐形**：加法混合向白收敛，浅底上特效全部消失。
    解法=全部换 NormalBlending，shader 输出 (color, clamp(luma,0,.9)) 作 alpha；
    bloom 阈值 1.0 + 强度 .38。
12. **中文字体栈**：Rajdhani/Orbitron 无 CJK，body 加 --zh 回退栈；标题中文大字+英文小字反转。
13. **DRS 别忘 composer.setSize**：只调 pixelRatio 不重设 composer 会让泛光通道尺寸失配。
14. dash.js 手滑 `['..', '延时')` 括号笔误——每次 vm.SourceTextModule 语法检查兜住。
