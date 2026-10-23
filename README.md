# The Earth Migration Project · 地球迁移计划

> 献给《流浪地球》的电影级交互式 WebGL 双页体验 —— 太阳即将熄灭，人类建造上万台行星发动机推动整个地球离开太阳系，前往 4.37 光年外的比邻星。

**非官方同人作品 · 受《流浪地球》启发 · 与原著影视无任何关联**

- **在线体验**：https://yjj0339.github.io/earth-migration/
- **第二部**：https://yjj0339.github.io/earth-migration/beyond.html

## 运行（完全离线可用）

双击 `serve.py`（或 `python serve.py`），浏览器自动打开 `http://localhost:8080`。
任意静态服务器亦可：`npx serve .` / `python -m http.server`。

> ⚠️ 不能直接双击 index.html（`file://` 下 ES Modules 被浏览器禁止，看门狗会给出指引）。

## 两部作品

| | 第一部 · The Earth Migration Project | 第二部 · Beyond the Wandering Earth |
| :-- | :-- | :-- |
| 入口 | `index.html` | `beyond.html` |
| 尺度 | 地球轨道（1 单位 ≈ 63.7 km） | 三层尺度阶梯：行星 → 太阳系 → 银河，100 km 连续拉到 100,000 光年 |
| 影片 | 62 秒 · 六幕（2061 → 第 2500 年） | 2 分 54 秒 · 六幕（2078 → 4578 年） |
| 探索 | 9 个地标 · 第一人称 · 电影巡航 | 25 个目的地 · 时间压缩 · 实时遥测 · 26 条事件日志 |

### 第一部（index.html）

- **六幕影片**：垂死的太阳 / 点火 / 刹住地球 / 太空电梯 / 木星 / 长夜 —— 可暂停、跳章、点进度条
- **9 个地标**：数字键 `1–9` 直达（地球总览 · 发动机集群017 · 赤道转向阵列 · 电梯锚点 · 天枢空间站 · 极光号居住环 · KUIPER-7 · 深空阵列 · 月球）
- **五种 HUD 实时面板**：轨道位置（内嵌 SVG 逃逸轨迹图）/ 行星发动机（24 格仪表 + 按洲推力分配）/ 太空电梯 / 行星系统 / 观察者
- **操作**：拖拽环绕 · 滚轮缩放 · 点击全息标记飞抵 · `C` 电影巡航 · `F` 第一人称（WASD + E/Q 升降 + Shift 加速）· `J` 影片 · `H` 隐藏 HUD · `G` 特效档

### 第二部（beyond.html）

- **三层尺度阶梯**：L0 行星层（63.7 km/单位）→ L1 太阳系层（艺术化 AU 轨道）→ L2 银河层（光年），拉远时星空视差 → 3D 银河连续交接无跳变
- **25 个目的地**：地球与舰队 9 · 太阳系 11 · 星际 5（南门二 · 本星际云 · 昴星团 · 猎户座大星云 · 船底座）
- **宇宙阶梯**：左侧标尺 PLANET → ORBIT → 1 AU → HELIOPAUSE → 1 LIGHT-YEAR → LOCAL ARM → MILKY WAY，点击直达该尺度
- **时间压缩**：VOYAGE 时间轴 2078–4578 可拖，公转四档 REAL TIME / 1 年:25 秒 / 1 年:3 秒 / TIME-LAPSE
- **影片内滚轮 = 穿越时间**（SCROLLING THROUGH TIME）
- **实时遥测**：引擎状态 · 速度 · 距太阳 · 光行时（8.3 分钟起算）· 区域 · 银河坐标 · 任务年 · 26 条事件日志随剧情滚动

## 技术

- three.js r170（vendored，零 CDN、零构建、可离线）
- ES Modules + importmap；`boot.js` 看门狗（file:// 检测 / 20s 超时 / SYSTEM FAULT 面板）
- **全程序化资产**：地球昼夜/云/月面/气巨/恒星贴图均由 canvas 噪声生成，无外部图片与模型
- **特效**：ray-marching 体积等离子光柱 · 点火冲击波（凝聚云穹 + 尘埃环）· Rayleigh+Mie 大气散射 · 行星尺度空气透视 · 三平面 PBR + 程序化窗灯 · kitbash 合并（数百零件 → 个位数 draw call）
- **后期**：HDR 帧一次解析 → 泛光（双滤波 mip 链）→ ACES tone mapping + 调色
- **生成式配乐**：纯 Web Audio（Dm → Fmaj7 → Am → Eb利底亚 → D 和弦垫 + 次低音 + 引擎隆隆 + 点火轰鸣），无任何音频文件
- 字体：Orbitron / Rajdhani / JetBrains Mono（SIL OFL，本地 woff2/ttf）

## 目录

```
index.html beyond.html          两部入口
css/app.css css/beyond.css      HUD 样式
js/app.js                       第一部主逻辑
js/fx/                          特效与资产工厂（kit/triplanar/volplume/smoke/shock/atmosphere/aerial/models）
js/beyond/                      第二部（main/earth/solar/galaxy/story/dash/craft/post/audio/util）
vendor/three/                   three.js r170 + addons（本地化）
serve.py                        静态服务器（正确 MIME / no-store / 自动开浏览器）
tools/shot1.js tools/shot2.js   Playwright 冒烟测试
```

## 浏览器

桌面 Chrome / Edge / Firefox / Safari，独立显卡最佳；移动端自动降档（低分辨率、少粒子、无泛光）。
