const DEFAULTS = {
  hideShorts: true,
  hideRecommendations: true,
  hideComments: true,
  focusUntil: 0,
  studyList: [],
  notes: [],
  dailyTime: {}
};

let timeWriteQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'UNLOCK_YOUTUBE') {
    const reason = String(message.reason || '').trim();
    if (!reason) {
      sendResponse({ ok: false, error: 'Enter a reason first.' });
      return false;
    }
    const focusUntil = Date.now() + 60 * 60 * 1000;
    chrome.storage.local.set({ focusUntil })
      .then(() => sendResponse({ ok: true, focusUntil }))
      .catch(() => sendResponse({ ok: false, error: 'Could not save the 60-minute unlock.' }));
    return true;
  }

  if (message?.type === 'ADD_YOUTUBE_TIME') {
    const seconds = Math.max(0, Math.min(30, Number(message.seconds) || 0));
    timeWriteQueue = timeWriteQueue.then(async () => {
      const day = localDayKey();
      const { dailyTime = {} } = await chrome.storage.local.get({ dailyTime: {} });
      const updated = { ...dailyTime, [day]: (Number(dailyTime[day]) || 0) + seconds };
      await chrome.storage.local.set({ dailyTime: updated });
    });
    timeWriteQueue.then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'GET_FOCUS_STATE') {
    chrome.storage.local.get({ focusUntil: DEFAULTS.focusUntil })
      .then(({ focusUntil }) => sendResponse({ focusUntil }))
      .catch(() => sendResponse({ focusUntil: 0 }));
    return true;
  }
  return false;
});

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(DEFAULTS).then(current => chrome.storage.local.set({
    hideShorts: current.hideShorts,
    hideRecommendations: current.hideRecommendations,
    hideComments: current.hideComments,
    focusUntil: current.focusUntil,
    studyList: current.studyList,
    notes: current.notes,
    dailyTime: current.dailyTime
  }));
});
