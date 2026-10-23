/* ═══════════════════════════════════════════════════════════
   beyond/post.js — 合成与后期
   单次解析的多重采样 HDR 帧 → 三个全屏通道：
   ① RenderPass（HDR 采样，logdepth 稳定） ② UnrealBloom（双滤波
   mip 链泛光 = 云隙光感） ③ OutputPass（ACES tone mapping + 调色）。
   比每层各自 4×MSAA 的旧方案省 ~8 个半浮点全屏通道。
   ═══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function buildPost(renderer, scene, camera, quality = 'high') {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // 浅色场景：阈值 1.0 —— 只有 HDR>1 的发光体产生泛光，白底不过曝
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    quality === 'high' ? .4 : .3,   // strength
    quality === 'high' ? .5 : .35,  // radius
    1.0                             // threshold
  );
  if (quality === 'high') composer.addPass(bloom);
  const output = new OutputPass();
  composer.addPass(output);
  composer.setSize(innerWidth, innerHeight);
  return { composer, bloom, output };
}
