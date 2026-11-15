(() => {
  'use strict';

  const DEFAULTS = {
    hideShorts: true,
    hideRecommendations: true,
    hideComments: true,
    focusUntil: 0
  };
  let settings = { ...DEFAULTS };
  let gateRoot = null;
  let gateTimer = 0;
  let routeTimer = 0;
  let observer = null;
  let lastRoute = location.href;
  let currentVideoId = readVideoId();

  function readVideoId() {
    if (location.pathname === '/watch') return new URL(location.href).searchParams.get('v');
    const short = location.pathname.match(/^\/shorts\/([^/?]+)/);
    return short ? short[1] : null;
  }

  function readVideoInfo() {
    const video = document.querySelector('video.html5-main-video, video');
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')?.textContent?.trim()
      || document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim();
    return {
      videoId: readVideoId(),
      title,
      url: location.href,
      currentTime: video && Number.isFinite(video.currentTime) ? video.currentTime : null,
      duration: video && Number.isFinite(video.duration) ? video.duration : null
    };
  }

  function applyHideSwitches() {
    const root = document.documentElement;
    root.classList.toggle('yfb-hide-shorts', !!settings.hideShorts);
    root.classList.toggle('yfb-hide-recommendations', !!settings.hideRecommendations);
    root.classList.toggle('yfb-hide-comments', !!settings.hideComments);
  }

  function isUnlocked() {
    return Number(settings.focusUntil) > Date.now();
  }

  function pauseVideoWhileLocked() {
    const video = document.querySelector('video.html5-main-video, video');
    if (video && !video.paused) video.pause();
  }

  function showGate() {
    if (gateRoot || !document.documentElement) return;
    const host = document.createElement('div');
    host.id = 'yfb-gate-root';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host { all:initial; }
        .scrim { position:fixed; inset:0; display:grid; place-items:center; padding:24px; box-sizing:border-box; background:rgba(12,18,27,.88); color:#202735; font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .card { width:min(440px,100%); box-sizing:border-box; padding:28px; border-radius:22px; background:#f7f7f4; box-shadow:0 24px 90px #0008; }
        .eyebrow { color:#4768d8; font-size:11px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
        h1 { margin:8px 0 8px; color:#202735; font-size:27px; line-height:1.15; }
        p { margin:0 0 20px; color:#5c6572; font-size:14px; }
        label { display:block; margin:0 0 7px; color:#303a48; font-size:13px; font-weight:750; }
        textarea { display:block; width:100%; min-height:88px; resize:vertical; padding:12px; box-sizing:border-box; border:1px solid #cbd1db; border-radius:12px; background:white; color:#202735; font:14px/1.4 system-ui,sans-serif; outline-color:#526ce0; }
        button { width:100%; margin-top:13px; padding:13px 16px; border:0; border-radius:12px; background:#526ce0; color:white; font:700 14px system-ui,sans-serif; cursor:pointer; }
        button:disabled { opacity:.6; cursor:wait; }
        .error { min-height:20px; margin:9px 0 0; color:#a33b39; font-size:12px; }
        .foot { margin-top:16px; color:#7d8591; font-size:11px; }
      </style>
      <div class="scrim">
        <section class="card" role="dialog" aria-modal="true" aria-labelledby="yfb-title">
          <div class="eyebrow">YouTube Focus Board</div>
          <h1 id="yfb-title">Why are you here?</h1>
          <p>Write a quick reason to unlock YouTube for 60 minutes.</p>
          <form>
            <label for="reason">Your reason</label>
            <textarea id="reason" maxlength="240" required placeholder="e.g. Revising thermodynamics"></textarea>
            <button type="submit">Unlock for 60 minutes</button>
            <div class="error" role="status"></div>
          </form>
          <div class="foot">Your reason is not saved or sent anywhere. The timer is stored on this device.</div>
        </section>
      </div>`;
    document.documentElement.appendChild(host);
    gateRoot = host;
    const form = shadow.querySelector('form');
    const textarea = shadow.querySelector('textarea');
    const button = shadow.querySelector('button');
    const error = shadow.querySelector('.error');
    form.addEventListener('submit', event => {
      event.preventDefault();
      const reason = textarea.value.trim();
      if (!reason) { error.textContent = 'Write a reason to continue.'; textarea.focus(); return; }
      button.disabled = true;
      chrome.runtime.sendMessage({ type:'UNLOCK_YOUTUBE', reason }, response => {
        button.disabled = false;
        if (chrome.runtime.lastError || !response?.ok) {
          error.textContent = response?.error || 'Could not start the timer. Try again.';
          return;
        }
        settings.focusUntil = response.focusUntil;
        removeGate();
      });
    });
    pauseVideoWhileLocked();
    queueMicrotask(() => textarea.focus());
  }

  function removeGate() {
    if (gateRoot) gateRoot.remove();
    gateRoot = null;
    document.documentElement.classList.remove('yfb-gated');
    clearTimeout(gateTimer);
    if (settings.focusUntil > Date.now()) {
      gateTimer = setTimeout(refreshGate, Math.min(settings.focusUntil - Date.now() + 20, 2147483000));
    }
  }

  function refreshGate() {
    if (isUnlocked()) {
      removeGate();
    } else {
      document.documentElement.classList.add('yfb-gated');
      showGate();
      pauseVideoWhileLocked();
    }
  }

  function syncPage() {
    applyHideSwitches();
    refreshGate();
    const videoId = readVideoId();
    if (videoId !== currentVideoId) currentVideoId = videoId;
  }

  function schedulePageSync() {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      if (location.href !== lastRoute) lastRoute = location.href;
      syncPage();
    }, 140);
  }

  function seekTo(seconds) {
    const target = Math.max(0, Number(seconds) || 0);
    const attempt = (remaining = 30) => {
      const video = document.querySelector('video.html5-main-video, video');
      if (video) {
        video.currentTime = target;
        video.play().catch(() => {});
        return true;
      }
      if (remaining > 0) setTimeout(() => attempt(remaining - 1), 250);
      return false;
    };
    return attempt();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_VIDEO_INFO') {
      sendResponse(readVideoInfo());
      return false;
    }
    if (message?.type === 'SEEK_TO') {
      const ok = seekTo(message.seconds);
      sendResponse({ ok });
      return false;
    }
    return false;
  });

  chrome.storage.local.get(DEFAULTS).then(values => {
    settings = { ...DEFAULTS, ...values };
    syncPage();
    if (!observer && document.documentElement) {
      observer = new MutationObserver(() => {
        applyHideSwitches();
        if (!isUnlocked()) pauseVideoWhileLocked();
      });
      observer.observe(document.documentElement, { childList:true, subtree:true });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    applyHideSwitches();
    refreshGate();
  });

  document.addEventListener('yt-navigate-finish', schedulePageSync, true);
  document.addEventListener('yt-page-data-updated', schedulePageSync, true);
  window.addEventListener('popstate', schedulePageSync);
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !document.hasFocus() || gateRoot || !isUnlocked()) return;
    chrome.runtime.sendMessage({ type:'ADD_YOUTUBE_TIME', seconds:15 }, () => void chrome.runtime.lastError);
  }, 15000);
})();
