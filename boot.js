/* The Earth Migration Project - boot watchdog.
   Classic script, loaded before any module. Keeps the loading screen honest. */
(function () {
  var boot = window.__boot = { started: false, fail: null };
  function fault(reason) {
    if (boot.fail) return; boot.fail = reason;
    var el = document.getElementById('boot-fault');
    if (!el) return;
    el.style.display = 'block';
    var msg = document.getElementById('boot-fault-msg');
    if (msg) msg.textContent = reason;
  }
  window.addEventListener('error', function (e) {
    fault((e.message || 'SCRIPT ERROR') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    fault('PROMISE REJECTION · ' + ((e.reason && (e.reason.message || e.reason)) || 'unknown'));
  });
  if (location.protocol === 'file:')
    fault('FILE:// DETECTED · 请通过本地 HTTP 服务器打开（双击 serve.py 或 python serve.py）');
  setTimeout(function () { if (!boot.started) fault('TIMEOUT 20S · 引擎未能启动，请检查控制台'); }, 20000);
})();
