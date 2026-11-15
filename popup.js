const DEFAULTS = {
  hideShorts:true,
  hideRecommendations:true,
  hideComments:true,
  focusUntil:0,
  studyList:[],
  notes:[],
  dailyTime:{}
};
let state = { ...DEFAULTS };
let activeTab = null;
let videoInfo = null;

const $ = id => document.getElementById(id);

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function durationLabel(seconds) {
  const value = Math.max(0,Number(seconds)||0);
  if (value === 0) return '0 min';
  const totalMinutes = Math.floor(value/60);
  if (totalMinutes < 1) return 'under 1 min';
  const hours = Math.floor(totalMinutes/60), minutes = totalMinutes%60;
  if (!hours) return `${totalMinutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}
function clockLabel(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds)||0));
  return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
}
function showMessage(element, text, good = false) {
  element.textContent = text;
  element.style.color = good ? '#36734e' : '#8c3a36';
}
async function loadState() {
  state = { ...DEFAULTS, ...await chrome.storage.local.get(DEFAULTS) };
  render();
}
async function getCurrentVideoInfo() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  activeTab = tab || null;
  videoInfo = null;
  if (!activeTab?.url || !/^(https:\/\/)?([\w-]+\.)?youtube\.com\//i.test(activeTab.url)) {
    $('currentVideo').textContent = 'Open a YouTube video to add it here.';
    return;
  }
  try { videoInfo = await chrome.tabs.sendMessage(activeTab.id, { type:'GET_VIDEO_INFO' }); }
  catch (_) { /* The current page may still be loading. */ }
  if (!videoInfo?.videoId) {
    $('currentVideo').textContent = 'Open a video watch page, then add it to your study list.';
    return;
  }
  $('currentVideo').textContent = videoInfo.title || 'Current YouTube video';
}
function render() {
  $('todayTime').textContent = durationLabel(state.dailyTime[localDayKey()] || 0);
  const remaining = Number(state.focusUntil) - Date.now();
  $('focusStatus').textContent = remaining > 0
    ? `Unlocked · ${Math.ceil(remaining/60000)} min left`
    : 'YouTube is locked';
  for (const key of ['hideShorts','hideRecommendations','hideComments']) $(key).checked = !!state[key];
  renderStudyList();
  renderNotes();
}
function makeAction(text, className, action, id) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = `item-action ${className||''}`.trim();
  button.textContent = text; button.addEventListener('click', () => action(id));
  return button;
}
function renderStudyList() {
  const list = $('studyList'); list.replaceChildren();
  $('studyEmpty').hidden = state.studyList.length > 0;
  for (const item of state.studyList) {
    const li = document.createElement('li'); li.className = 'item-row';
    const label = document.createElement('div'); label.className = 'item-name'; label.textContent = item.title || 'Untitled video';
    const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = 'YouTube study video'; label.append(meta);
    li.append(label, makeAction('Open','play',openStudyVideo,item.id));
    list.append(li);
  }
}
function renderNotes() {
  const list = $('notesList'); list.replaceChildren();
  $('notesEmpty').hidden = state.notes.length > 0;
  for (const note of [...state.notes].sort((a,b) => b.createdAt-a.createdAt)) {
    const li = document.createElement('li'); li.className = 'item-row';
    const label = document.createElement('div'); label.className = 'item-name';
    label.textContent = note.text;
    const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = `${clockLabel(note.seconds)} · ${note.title||'YouTube video'}`; label.append(meta);
    li.append(label, makeAction('Jump','play',jumpToNote,note.id));
    list.append(li);
  }
}
async function setStorage(patch) {
  await chrome.storage.local.set(patch);
  state = { ...state, ...patch };
  render();
}
async function addCurrentVideo() {
  const output = $('unlockMessage');
  if (!videoInfo?.videoId) { showMessage(output,'Open a YouTube video watch page first.'); return; }
  const current = state.studyList.find(item => item.id === videoInfo.videoId);
  if (current) { showMessage(output,'That video is already in your study list.',true); return; }
  const entry = {
    id:videoInfo.videoId,
    title:videoInfo.title || 'YouTube video',
    url:`https://www.youtube.com/watch?v=${encodeURIComponent(videoInfo.videoId)}`,
    addedAt:Date.now()
  };
  await setStorage({ studyList:[entry,...state.studyList] });
  showMessage(output,'Added to your study list.',true);
}
async function openStudyVideo(id) {
  const item = state.studyList.find(row => row.id===id);
  if (item && activeTab) await chrome.tabs.update(activeTab.id,{ url:item.url });
}
async function jumpToNote(id) {
  const note = state.notes.find(row => row.id===id);
  if (!note) return;
  if (activeTab?.id && videoInfo?.videoId === note.videoId) {
    try { await chrome.tabs.sendMessage(activeTab.id,{type:'SEEK_TO',seconds:note.seconds}); return; }
    catch (_) { /* The video may be navigating; use its timestamp URL. */ }
  }
  if (activeTab?.id) await chrome.tabs.update(activeTab.id,{url:`https://www.youtube.com/watch?v=${encodeURIComponent(note.videoId)}&t=${Math.floor(note.seconds)}s`});
}
async function unlock() {
  const reason = $('reasonInput').value.trim();
  if (!reason) { showMessage($('unlockMessage'),'Enter a reason first.'); return; }
  const response = await chrome.runtime.sendMessage({type:'UNLOCK_YOUTUBE',reason});
  if (!response?.ok) { showMessage($('unlockMessage'),response?.error||'Could not unlock YouTube.'); return; }
  $('reasonInput').value = '';
  await loadState();
  showMessage($('unlockMessage'),'Unlocked for 60 minutes. Your reason was not saved.',true);
}
async function addCurrentNote(event) {
  event.preventDefault();
  const message = $('noteMessage');
  const text = $('noteInput').value.trim();
  if (!text) { showMessage(message,'Write a note first.'); return; }
  if (!videoInfo?.videoId || !Number.isFinite(videoInfo.currentTime)) {
    showMessage(message,'Open a playing YouTube video and wait for its controls to load.'); return;
  }
  const note = {
    id:crypto.randomUUID(),
    videoId:videoInfo.videoId,
    title:videoInfo.title||'YouTube video',
    seconds:Math.max(0,Number(videoInfo.currentTime)),
    text,
    createdAt:Date.now()
  };
  await setStorage({notes:[note,...state.notes]});
  $('noteInput').value='';
  showMessage(message,`Saved at ${clockLabel(note.seconds)}.`,true);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  await getCurrentVideoInfo();
  for (const key of ['hideShorts','hideRecommendations','hideComments']) {
    $(key).addEventListener('change', async event => {
      state[key]=event.target.checked;
      await chrome.storage.local.set({[key]:event.target.checked});
      render();
    });
  }
  $('unlockForm').addEventListener('submit',event => { event.preventDefault(); unlock(); });
  $('addVideo').addEventListener('click',addCurrentVideo);
  $('noteForm').addEventListener('submit',addCurrentNote);
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area!=='local') return;
    for (const [key,change] of Object.entries(changes)) state[key]=change.newValue;
    render();
  });
});
