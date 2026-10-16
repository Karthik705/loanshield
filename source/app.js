(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = id => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------------- shared state ---------------- */
const state = {
  truth: null,          // last loan check {promised, received, repay, days, apr, app}
  lastScan: null,       // {text, result}
  chain: store.get('loanshield_chain_v2', []),
  myReports: store.get('loanshield_reports_v2', []),
  graph: null,
  mode: 'sample',
  live: { on: false, db: null, uid: null, canWrite: false, reports: [] },
  downloads: null,
  sample: null
};

/* ---------------- toast ---------------- */
let toastEl, toastT;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ---------------- toolkit tabs ---------------- */
const tabs = $$('.app-tab');
function selectTab(i, focus) {
  tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tabs[i].focus();
  if (tabs[i].id === 't-packet') refreshPacket();
}
tabs.forEach((t, i) => t.addEventListener('click', () => selectTab(i)));
$('#app-tabs').addEventListener('keydown', e => {
  const i = tabs.indexOf(document.activeElement); if (i < 0) return;
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1;
  if (n !== null) { e.preventDefault(); selectTab(n, true); }
});
$$('[data-open-tab]').forEach(a => a.addEventListener('click', () => selectTab(+a.dataset.openTab)));

/* ---------------- 1. loan truth check ---------------- */
const qBox = $('#c-questions');
const preTicked = ['apk', 'perms'];
LS.RED_FLAG_QUESTIONS.forEach(q => {
  qBox.insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" value="${q.id}" ${preTicked.includes(q.id) ? 'checked' : ''}><span>${esc(q.q)}</span></label>`);
});
function runCheck() {
  const v = id => $(id).value;
  const answers = $$('#c-questions input:checked').map(i => i.value);
  const input = { promised: v('#c-promised'), received: v('#c-received'), repay: v('#c-repay'), days: v('#c-days'), answers };
  const r = LS.truthCheck(input);
  const box = $('#check-result');
  if (r.error) { box.className = 'result'; box.innerHTML = `<p style="margin:0">${esc(r.error)}</p>`; state.truth = null; return; }
  state.truth = { promised: +input.promised, received: +input.received, repay: +input.repay, days: +input.days, apr: r.apr, app: v('#c-app').trim() };
  const label = { danger: 'High risk. Don’t borrow here.', caution: 'Be careful. Ask questions first.', ok: 'No major warning signs.' }[r.verdict];
  box.className = 'result ' + r.verdict;
  box.innerHTML = `
    <div><span class="pill ${r.verdict}">${esc(label)}</span></div>
    <div><div class="big-figure">${LS.fmt(Math.round(r.apr))}%<small>a year, the real cost</small></div></div>
    <div class="minis">
      <div class="mini"><b>₹${LS.fmt(r.totalCost)}</b><span>you pay on top of what you got</span></div>
      <div class="mini"><b>₹${LS.fmt(r.upfrontCut)}</b><span>cut before it reached you</span></div>
      <div class="mini"><b>₹${LS.fmt(Math.round(r.perDay))}</b><span>cost per day</span></div>
    </div>
    ${r.flags.length ? `<ul class="flags">${r.flags.map(f => `<li><span class="sev s${f.sev}" aria-hidden="true"></span><span>${esc(f.text)}</span></li>`).join('')}</ul>` : ''}
    <p class="small muted" style="margin:0">${r.verdict === 'ok'
      ? 'Still ask for the Key Fact Statement and keep a copy.'
      : 'A safer route: ask your SHG or a microfinance institution for a small loan, or check RBI’s DLA directory for a listed lender.'}</p>`;
}
['#c-promised', '#c-received', '#c-repay', '#c-days', '#c-app'].forEach(id => $(id).addEventListener('input', runCheck));
qBox.addEventListener('change', runCheck);
$('#check-form').addEventListener('submit', e => { e.preventDefault(); runCheck(); });

/* ---------------- 2. threat scanner ---------------- */
function highlight(text, hits) {
  const phrases = hits.flatMap(h => h.phrases).sort((a, b) => b.length - a.length);
  if (!phrases.length) return esc(text);
  const re = new RegExp('(' + phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return text.split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
}
function idChips(ids) {
  const c = [];
  ids.upi.forEach(u => c.push(`<span class="chip"><span class="k">UPI</span>${esc(u)}</span>`));
  ids.phones.forEach(p => c.push(`<span class="chip"><span class="k">Phone</span>${esc(p)}</span>`));
  ids.links.forEach(l => c.push(`<span class="chip"><span class="k">Link</span>${esc(l)}</span>`));
  return c.join('');
}
function alreadyReported(text) { return state.myReports.some(r => r.text === text); }
function runScan() {
  const text = $('#scan-input').value.trim();
  const box = $('#scan-result');
  if (!text) {
    box.className = 'result';
    box.innerHTML = '<div class="empty" style="border:0;padding:.5rem">Paste a message on the left, then press <b>Scan message</b>.</div>';
    state.lastScan = null; return;
  }
  const r = LS.scanMessage(text);
  state.lastScan = { text, result: r };
  const hasIds = r.ids.upi.length + r.ids.phones.length + r.ids.links.length > 0;
  const canReport = (r.ids.upi.length + r.ids.phones.length) > 0;
  const reported = alreadyReported(text);
  box.className = 'result ' + r.level;
  box.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;justify-content:space-between">
      <span class="pill ${r.level}">${esc(r.levelLabel)}</span>
      <span class="num small muted">Threat score ${r.score} / 100</span>
    </div>
    <div class="meter ${r.level}" role="img" aria-label="Threat score ${r.score} out of 100"><i style="width:${r.score}%"></i></div>
    <div class="preview">${highlight(text, r.hits)}</div>
    ${r.hits.length ? `<ul class="flags">${r.hits.map(h => `<li><span class="sev ${h.w >= 40 ? 's3' : ''}" aria-hidden="true"></span><span><b>${esc(h.label)}</b> · “${h.phrases.map(esc).join('”, “')}”</span></li>`).join('')}</ul>` : '<p class="muted small" style="margin:0">No threat words found. If it still feels wrong, save it anyway.</p>'}
    ${hasIds ? `<div><p class="small" style="margin:0 0 .4rem;font-weight:700">Identifiers the harassers used</p><div class="chips">${idChips(r.ids)}</div></div>` : ''}
    ${(() => { const rights = LS.rightsFor(r, text); return rights.length ? `<div><p class="small" style="margin:0 0 .45rem;font-weight:700">Rules this may break</p><ul class="rights">${rights.map(x => `<li><span class="law">${esc(x.short)}</span><span>${esc(x.text.replace(/^[^:]+:\s*/, ''))}</span></li>`).join('')}</ul></div>` : ''; })()}
    ${r.needsSupport ? `<div class="support"><p><b>This is a crime, and you are not alone.</b> Don’t pay more to make it stop. Save it, then report.</p><div class="nums"><span>Cybercrime helpline <b>1930</b></span><span>Tele-MANAS, free 24×7 <b>14416</b></span></div><p style="margin:.6rem 0 0"><button class="link-btn" type="button" id="go-shield">Warn your contacts before they do →</button></p></div>` : ''}
    <div class="actions">
      <button class="btn g" type="button" id="save-scan">${ico('i-lock')}Save to evidence vault</button>
      ${canReport ? `<button class="btn ghost" type="button" id="report-scan" ${reported ? 'disabled' : ''}>${ico('i-link')}${reported ? 'Added to scam graph' : 'Add to scam graph'}</button>` : ''}
    </div>
    ${canReport && !reported ? `<p class="small muted" style="margin:0">${state.live.canWrite ? 'Adds the UPI IDs, numbers and wording to the shared graph. Never your name or contacts.' : 'Adds the UPI IDs, numbers and wording to the graph on this device.'}</p>` : ''}
    ${state.sample ? `<div class="ai-box" id="ai-box"><button class="btn ghost" type="button" id="ai-btn">${ico('i-brain')}Ask AI for a second opinion</button><p class="small muted" style="margin:.4rem 0 0">For Tamil, Telugu, Bengali or any language the word list misses. This sends the message text to Claude.</p></div>` : ''}`;
  $('#save-scan').addEventListener('click', () => addToVault('message', text));
  const rep = $('#report-scan'); if (rep) rep.addEventListener('click', () => reportScan(text, r));
  const gs = $('#go-shield'); if (gs) gs.addEventListener('click', () => selectTab(tabs.findIndex(t => t.id === 't-shield'), true));
  const ai = $('#ai-btn'); if (ai) ai.addEventListener('click', () => askAI(text));
}

/* ---------------- AI second opinion (optional, sends text to Claude) ---------------- */
let aiCtl = null;
async function askAI(text) {
  const box = $('#ai-box'); if (!box || !state.sample) return;
  if (aiCtl) aiCtl.abort(); aiCtl = new AbortController();
  box.innerHTML = '<p class="small muted" style="margin:0">Asking Claude…</p>';
  const prompt = 'You review messages that victims of illegal Indian loan apps receive. Decide whether the message below is harassment by a loan recovery agent. ' +
    'Reply with JSON only, in this exact shape: {"harassment": true|false, "language": "<language name in English>", "threats": ["<short English phrase>", ...], "summary": "<one or two plain English sentences on what the message says and threatens>", "advice": "<one sentence of practical advice for the victim>"}. ' +
    'Threat phrases can include: threat to message contacts, threat to misuse photos, fake legal or police threat, name-calling, threat of violence, pressure to pay, extra charges. Do not invent facts.\n\nMESSAGE:\n' + text.slice(0, 3000);
  try {
    const a = await state.sample.json(prompt, { modelTier: 'quick', signal: aiCtl.signal });
    const threats = Array.isArray(a.threats) ? a.threats : [];
    box.innerHTML = `<div class="ai-answer"><p style="margin:0 0 .35rem"><span class="pill ${a.harassment ? 'high' : 'clear'}">${a.harassment ? 'AI: harassment' : 'AI: not harassment'}</span> <span class="small muted">${esc(a.language || '')}</span></p>
      <p style="margin:0 0 .4rem">${esc(a.summary || '')}</p>
      ${threats.length ? `<div class="chips" style="margin-bottom:.4rem">${threats.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <p class="small" style="margin:0"><b>Advice:</b> ${esc(a.advice || '')}</p>
      <p class="small muted" style="margin:.4rem 0 0">A second opinion from Claude. The word-list result above is what goes into your evidence.</p></div>`;
  } catch (e) {
    const msg = e && e.code === 'rate_limited' ? 'Too many requests. Try again in a minute.'
      : e && (e.code === 'not_granted' || e.code === 'declined') ? 'AI second opinion is off for this page. The word-list result above still stands.'
      : 'The AI second opinion isn’t available right now. The word-list result above still stands.';
    box.innerHTML = `<p class="small muted" style="margin:0">${msg}</p>`;
  }
}
$('#scan-input').value = LSDATA.EXAMPLE_MESSAGE;
$('#scan-btn').addEventListener('click', runScan);
$('#scan-clear').addEventListener('click', () => { $('#scan-input').value = ''; runScan(); $('#scan-input').focus(); });

async function reportScan(text, r) {
  if (alreadyReported(text)) return;
  const app = guessApp(text) || (state.truth && state.truth.app) || 'Unnamed app';
  const script = LS.normaliseScript(text);
  if (state.live.canWrite) {
    const ok = await pushLiveReport({ app: app.slice(0, 60), upi: r.ids.upi.slice(0, 5), phones: r.ids.phones.slice(0, 5), script, ts: Date.now() });
    if (ok) {
      state.myReports.push({ reporter: 'YOU', app, day: 0, upi: r.ids.upi, phones: r.ids.phones, text, mine: true, shared: true });
      store.set('loanshield_reports_v2', state.myReports);
      setGraphMode('live'); runScan();
      const c = state.graph.clusters.find(c => c.idx.some(i => allReports()[i].mine));
      toast(c && c.apps.length > 1 ? `Linked to ${c.id}: ${c.reporters} people, ${c.apps.length} app names` : 'Added to the shared scam graph');
      return;
    }
  }
  state.myReports.push({ reporter: 'YOU', app, day: 40, upi: r.ids.upi, phones: r.ids.phones, text, mine: true });
  store.set('loanshield_reports_v2', state.myReports);
  setGraphMode('sample');
  const c = state.graph.clusters.find(c => c.idx.some(i => allReports()[i].mine && allReports()[i].text === text));
  runScan();
  if (c && c.apps.length > 1) toast(`Linked to ${c.id}: ${c.reporters} people, ${c.apps.length} app names`);
  else toast('Added to the scam graph as a new operator');
}
function guessApp(text) {
  const names = [...new Set(LSDATA.SAMPLE_REPORTS.map(r => r.app))];
  return names.find(n => text.toLowerCase().includes(n.toLowerCase()));
}


/* ---------------- Contact Shield ---------------- */
function shieldText() { return LS.shieldMessage($('input[name=sh-lang]:checked').value, $('#sh-name').value); }
function renderShield() { $('#sh-out').value = shieldText(); $('#sh-wa').href = 'https://wa.me/?text=' + encodeURIComponent(shieldText()); }
$$('input[name=sh-lang]').forEach(r => r.addEventListener('change', renderShield));
$('#sh-name').addEventListener('input', renderShield);
$('#sh-copy').addEventListener('click', () => { copyText(shieldText(), $('#sh-out'), 'Warning copied. Paste it to your contacts.'); });
$('#sh-wa').addEventListener('click', () => {
  if (!state.shieldLogged) { state.shieldLogged = true; addToVault('note', 'Sent a warning to my contacts that loan-app messages about me are false (' + new Date().toLocaleString('en-IN') + ').'); }
});
$('#sh-log').addEventListener('click', async () => { await addToVault('note', 'Sent a warning to my contacts that loan-app messages about me are false.'); });
renderShield();

/* ---------------- 3. evidence vault ---------------- */
function saveChain() { if (!store.set('loanshield_chain_v2', state.chain)) toast('Saved for this visit only. Your browser blocked storage.'); }
async function addToVault(kind, text) {
  state.chain = await LS.appendEntry(state.chain, { ts: Date.now(), kind, text });
  saveChain();
  await renderVault();
  toast('Saved to evidence vault');
}
async function renderVault(brokenFrom) {
  const list = $('#vault-list');
  const n = state.chain.length;
  const count = $('#vault-count'); count.hidden = n === 0; count.textContent = n;
  $('#verify-btn').disabled = $('#tamper-btn').disabled = $('#clear-vault').disabled = n === 0;
  if (!n) {
    list.innerHTML = '<li class="empty">Nothing saved yet. Scan a message and press <b>Save to evidence vault</b>, or log a call on the right.</li>';
    $('#chain-status').innerHTML = '';
    return;
  }
  const items = brokenFrom && brokenFrom.copy ? brokenFrom.copy : state.chain;
  list.innerHTML = items.map((e, i) => {
    const bad = brokenFrom && brokenFrom.at > -1 && i >= brokenFrom.at;
    return `<li class="vault-item ${bad ? 'bad' : ''}">
      <div class="meta"><span>#${i + 1}</span><span>${esc(new Date(e.ts).toLocaleString('en-IN'))}</span><span>${esc(e.kind === 'note' ? 'Call or event note' : 'Message')}</span>${bad ? '<span style="color:var(--red-lt);font-weight:700">Hash mismatch</span>' : ''}</div>
      <div class="txt">${esc(e.text)}</div>
      ${(() => { const rr = LS.rightsFor(LS.scanMessage(e.text), e.text); return rr.length ? `<div class="law-row">${rr.map(x => `<span class="law" title="${esc(x.text)}">${esc(x.short)}</span>`).join('')}</div>` : ''; })()}
      <div class="hash">SHA-256 <b>${e.hash}</b></div>
      <div class="hash">covers previous ${e.prev === LS.GENESIS ? '(start of chain)' : e.prev.slice(0, 16) + '…'}</div>
    </li>`;
  }).join('');
}
async function verify(chain, label) {
  const v = await LS.verifyChain(chain);
  $('#chain-status').innerHTML = v.ok
    ? `<span class="badge sm g">${ico('i-check')}</span><span>Chain intact. ${chain.length} item${chain.length > 1 ? 's' : ''}, none changed since saving.</span>`
    : `<span class="badge sm">${ico('i-x')}</span><span>${label || 'Chain broken'} at item ${v.brokenAt + 1}. Everything from there on can no longer be trusted.</span>`;
  return v;
}
$('#verify-btn').addEventListener('click', async () => { await renderVault(); await verify(state.chain); });
$('#tamper-btn').addEventListener('click', async () => {
  const copy = state.chain.map(e => ({ ...e }));
  copy[0] = { ...copy[0], text: copy[0].text.replace(/\d/, d => String((+d + 1) % 10)) + (/\d/.test(copy[0].text) ? '' : ' (edited)') };
  const v = await verify(copy, 'Tampering detected');
  await renderVault({ copy, at: v.brokenAt });
  $('#chain-status').insertAdjacentHTML('beforeend', '<span class="small muted" style="font-weight:400">This edited a copy. Your saved items are unchanged; press Verify chain to see them.</span>');
});
$('#clear-vault').addEventListener('click', () => { $('#clear-confirm').hidden = false; $('#clear-no').focus(); });
$('#clear-no').addEventListener('click', () => { $('#clear-confirm').hidden = true; });
$('#clear-yes').addEventListener('click', async () => {
  state.chain = []; store.del('loanshield_chain_v2');
  $('#clear-confirm').hidden = true; await renderVault(); toast('All saved items deleted');
});
$('#note-form').addEventListener('submit', async e => {
  e.preventDefault();
  const t = $('#note-text').value.trim();
  if (t.length < 8) { $('#note-error').textContent = 'Write at least a few words: the time, the number and what was said.'; return; }
  $('#note-error').textContent = '';
  await addToVault('note', t); $('#note-text').value = '';
  const late = LS.callTimes(t).filter(x => x.outside);
  if (late.length) toast(`${late[0].raw}: RBI bars recovery calls before 8 am or after 7 pm`);
});

/* ---------------- 4. complaint packet ---------------- */
function packetIds() {
  const ids = { upi: [], phones: [], links: [] };
  const texts = state.chain.map(e => e.text);
  if (state.lastScan) texts.push(state.lastScan.text);
  texts.forEach(t => { const x = LS.extractIdentifiers(t); ids.upi.push(...x.upi); ids.phones.push(...x.phones); ids.links.push(...x.links); });
  Object.keys(ids).forEach(k => ids[k] = [...new Set(ids[k])]);
  return ids;
}
function matchCluster(ids) {
  const rs = allReports();
  return state.graph.clusters.find(c => c.upi.some(u => ids.upi.includes(u)) || c.phones.some(p => ids.phones.includes(p)))
      || null;
}
function packetRights() {
  const texts = state.chain.map(e => e.text); if (state.lastScan) texts.push(state.lastScan.text);
  const seen = new Map();
  texts.forEach(t => LS.rightsFor(LS.scanMessage(t), t).forEach(x => seen.set(x.id, x)));
  return [...seen.values()];
}
async function refreshPacket() {
  const ids = packetIds();
  const v = await LS.verifyChain(state.chain);
  const cluster = matchCluster(ids);
  const apps = [...new Set([state.truth && state.truth.app, ...(cluster ? [] : [])].filter(Boolean))];
  const txt = LS.buildPacket({
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    name: $('#pk-name').value.trim(), contact: $('#pk-contact').value.trim(), city: $('#pk-city').value.trim(), summary: $('#pk-summary').value.trim(),
    truth: state.truth, apps: apps.length ? apps : (cluster ? cluster.apps : []), ids, cluster: cluster && cluster.published ? cluster : null,
    evidence: state.chain, chainOk: v.ok, brokenAt: v.brokenAt, rights: packetRights()
  });
  $('#packet-out').value = txt;
  const items = [
    [!!state.truth, state.truth ? `Loan check: ${LS.fmt(Math.round(state.truth.apr))}% a year` : 'No loan check yet (step 1)'],
    [state.chain.length > 0, state.chain.length ? `${state.chain.length} evidence item${state.chain.length > 1 ? 's' : ''}, chain ${v.ok ? 'intact' : 'broken'}` : 'No evidence saved yet (step 3)'],
    [ids.upi.length + ids.phones.length > 0, `${ids.upi.length} UPI ID${ids.upi.length === 1 ? '' : 's'}, ${ids.phones.length} phone number${ids.phones.length === 1 ? '' : 's'}`],
    [!!(cluster && cluster.published), cluster ? (cluster.published ? `Linked to ${cluster.id} (${cluster.reporters} people)` : `Matches ${cluster.id}, not yet published (${cluster.reporters} of ${LS.PUBLISH_THRESHOLD} people)`) : 'No linked operator']
  ];
  $('#packet-inputs').innerHTML = items.map(([ok, t]) => `<li><span class="sev" style="background:${ok ? 'var(--green)' : 'var(--line-d)'}" aria-hidden="true"></span><span>${esc(t)}</span></li>`).join('');
}
$('#packet-form').addEventListener('submit', e => { e.preventDefault(); refreshPacket().then(() => toast('Packet built. Read it through before filing.')); });
$('#packet-copy').addEventListener('click', () => copyText($('#packet-out').value, $('#packet-out'), 'Packet copied'));
$('#packet-save').addEventListener('click', () => saveFile('loanshield-complaint-packet.txt', $('#packet-out').value));
async function saveFile(name, data) {
  if (state.downloads) {
    try { await state.downloads.save({ filename: name, data }); toast('Saved ' + name); }
    catch (e) { if (!e || e.code !== 'declined') toast(e && e.code === 'rate_limited' ? 'A save is already open. Try again in a moment.' : 'Saving isn\u2019t available here. Use Copy instead.'); }
    return;
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { toast('Saving is blocked here. Use Copy instead.'); }
}
$$('[data-deck]').forEach(b => b.addEventListener('click', async () => {
  const f = b.dataset.deck;
  if (!state.downloads) { location.href = 'downloads/' + f; return; }
  b.disabled = true;
  try { const res = await fetch('downloads/' + f); if (!res.ok) throw 0; await saveFile(f, await res.blob()); }
  catch (e) { toast('Couldn\u2019t load the deck. Try again.'); }
  b.disabled = false;
}));
function copyText(t, fallbackEl, msg) {
  const done = () => toast(msg || 'Copied');
  const fail = () => { if (fallbackEl && fallbackEl.select) { fallbackEl.focus(); fallbackEl.select(); toast('Selected. Press Ctrl+C or long-press to copy.'); } else toast('Copy blocked. Select the text by hand.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fail); else fail();
}
$$('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy, null, 'Copied ' + b.dataset.copy)));

/* ---------------- scam graph ---------------- */
function allReports() {
  if (state.mode === 'live') return state.live.reports;
  return LSDATA.SAMPLE_REPORTS.concat(state.myReports.filter(r => !r.shared));
}
function renderGraph() {
  const reports = allReports();
  state.graph = LS.buildGraph(reports);
  $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  const live = state.mode === 'live';
  $('#graph-status').innerHTML = live
    ? (state.live.on ? `<span class="live-dot" aria-hidden="true"></span>Live: ${state.live.reports.length} report${state.live.reports.length === 1 ? '' : 's'} from ${new Set(state.live.reports.map(r => r.reporter)).size} ${new Set(state.live.reports.map(r => r.reporter)).size === 1 ? 'person' : 'people'}, updating as they arrive.${state.live.canWrite ? '' : ' You can read this graph; adding reports needs Contributor access.'}`
                     : 'Live reports need you to open this page signed in to Claude. Showing nothing until then.')
    : 'Sample data: 8 fictional reports, plus any you add on this device.';
  if (live && !reports.length) {
    $('#ops').innerHTML = `<div class="card empty-live"><h3>No live reports yet</h3><p>Scan a threatening message in the toolkit, then press <b>Add to scam graph</b>. It appears here for everyone with this link, and links to any operator that used the same UPI ID, number or script.</p></div>`;
  } else {
    $('#ops').innerHTML = state.graph.clusters.map(c => opCard(c, reports)).join('');
  }
  renderDash();
}
function setGraphMode(m) { state.mode = m; renderGraph(); }
$$('.seg button').forEach(b => b.addEventListener('click', () => setGraphMode(b.dataset.mode)));

/* ---------------- live shared graph (db capability) ---------------- */
async function pushLiveReport(rep) {
  try {
    const ref = state.live.db.doc('reports/' + state.live.uid);
    const snap = await ref.get();
    const items = (snap.exists && Array.isArray(snap.data().items) ? snap.data().items.slice() : []).slice(-49);
    items.push(rep);
    await ref.set({ items, updated: Date.now() });
    return true;
  } catch (e) {
    if (e && e.code === 'invalid_argument') { state.live.canWrite = false; toast('You can read the shared graph, but not add to it. Saved on this device instead.'); }
    else if (e && e.code === 'quota_exceeded') toast('The shared graph is full. Saved on this device instead.');
    else toast('Couldn\u2019t reach the shared graph. Saved on this device instead.');
    return false;
  }
}
function liveToReports(docs) {
  const out = [];
  docs.forEach(d => { const b = d.data() || {}; (Array.isArray(b.items) ? b.items : []).forEach(it => {
    if (!it || typeof it !== 'object') return;
    out.push({ reporter: d.id, app: String(it.app || 'Unnamed app').slice(0, 60), ts: +it.ts || 0,
      upi: (Array.isArray(it.upi) ? it.upi : []).map(String).filter(u => /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(u)).slice(0, 5),
      phones: (Array.isArray(it.phones) ? it.phones : []).map(String).filter(p => /^[6-9]\d{9}$/.test(p)).slice(0, 5),
      text: String(it.script || '').slice(0, 600), mine: d.id === state.live.uid });
  }); });
  const t0 = Math.min(...out.map(r => r.ts).filter(Boolean), Date.now());
  out.forEach(r => { r.day = Math.max(0, Math.round((r.ts - t0) / 864e5)); });
  return out;
}
async function startLive() {
  const cl = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
  const use = async n => { try { return cl ? await cl.use(n) : null; } catch (e) { return null; } };
  const [db, user, downloads, sample] = await Promise.all([use('db'), use('user'), use('downloads'), use('sample')]);
  state.downloads = downloads; state.sample = sample;
  if (sample && state.lastScan) runScan();
  if (!db || !user) { renderGraph(); return; }
  const uid = await user.id().catch(() => null);
  const can = await user.can('data.write').catch(() => null);
  state.live.db = db; state.live.uid = uid; state.live.on = true; state.live.canWrite = !!uid && can !== false;
  db.collection('reports').onSnapshot(snap => {
    state.live.reports = liveToReports(snap.docs);
    if (state.mode === 'live') renderGraph();
  }, () => { state.live.on = false; if (state.mode === 'live') renderGraph(); });
  setGraphMode('live');
}
function opCard(c, reports) {
  const rs = c.idx.map(i => reports[i]);
  const mine = rs.some(r => r.mine);
  const ids = c.upi.map(u => ({ k: 'upi', v: u })).concat(c.phones.map(p => ({ k: 'phone', v: p })));
  const rows = Math.max(c.apps.length, ids.length, 1), RH = 46, H = rows * RH + 24, W = 760;
  const ay = i => 24 + i * RH + (rows - c.apps.length) * RH / 2;
  const iy = i => 24 + i * RH + (rows - ids.length) * RH / 2;
  const AX = 250, IX = 520;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.id)}: ${c.apps.length} app names linked by ${ids.length} identifiers">`;
  const seen = new Set();
  rs.forEach(r => {
    const a = c.apps.indexOf(r.app);
    (r.upi || []).concat(r.phones || []).forEach(v => {
      const j = ids.findIndex(x => x.v === v); const key = a + ':' + j;
      if (a > -1 && j > -1 && !seen.has(key)) { seen.add(key); svg += `<line x1="${AX + 10}" y1="${ay(a)}" x2="${IX - 8}" y2="${iy(j)}" stroke="var(--mute-l)" stroke-width="1.5"/>`; }
    });
  });
  const scriptPairs = new Set();
  c.links.filter(l => l.why === 'same message script').forEach(l => {
    const a = c.apps.indexOf(reports[l.a].app), b = c.apps.indexOf(reports[l.b].app);
    if (a > -1 && b > -1 && a !== b) { const k = Math.min(a, b) + '-' + Math.max(a, b); if (!scriptPairs.has(k)) { scriptPairs.add(k); const y1 = ay(a), y2 = ay(b); svg += `<path d="M${AX} ${y1} C ${AX + 90} ${y1}, ${AX + 90} ${y2}, ${AX} ${y2}" fill="none" stroke="var(--mute-l)" stroke-width="2" stroke-dasharray="5 4"/>`; } }
  });
  c.apps.forEach((a, i) => {
    const you = rs.some(r => r.mine && r.app === a);
    svg += `<circle cx="${AX}" cy="${ay(i)}" r="9" fill="${you ? 'var(--green)' : 'var(--ink)'}"/><text x="${AX - 18}" y="${ay(i) + 5}" text-anchor="end" font-size="15" font-weight="700" fill="var(--ink)" font-family="var(--body)">${esc(a)}</text>`;
  });
  ids.forEach((x, j) => {
    const label = x.k === 'phone' ? LS.maskPhone(x.v) : x.v;
    svg += `<rect x="${IX - 8}" y="${iy(j) - 8}" width="16" height="16" rx="3" fill="${x.k === 'upi' ? 'var(--red)' : 'var(--amber)'}"/><text x="${IX + 18}" y="${iy(j) + 5}" font-size="14" fill="var(--ink)" font-family="var(--mono)">${esc(label)}</text>`;
  });
  if (!ids.length) svg += `<text x="${IX - 8}" y="${iy(0) + 5}" font-size="14" fill="var(--mute-l)" font-family="var(--body)">no shared identifiers yet</text>`;
  svg += '</svg>';
  return `<article class="card op ${mine ? 'you' : ''}">
    <div class="op-head">
      <h3>${esc(c.id)}${mine ? ' <span class="tag g flat" style="font-size:.7rem;vertical-align:middle">Includes your report</span>' : ''}</h3>
      <span class="pill ${c.published ? 'danger' : 'watch'}">${c.published ? 'Published' : `Held: ${c.reporters} of ${LS.PUBLISH_THRESHOLD} people`}</span>
    </div>
    <p class="op-meta">${c.reports} report${c.reports > 1 ? 's' : ''} from ${c.reporters} ${c.reporters > 1 ? 'people' : 'person'} · ${c.apps.length} app name${c.apps.length > 1 ? 's' : ''} · first reported on day ${c.firstSeen}</p>
    <div class="graph-wrap">${svg}</div>
  </article>`;
}
function daysToPublish(c, reports) {
  const rs = c.idx.map(i => reports[i]).sort((a, b) => a.day - b.day);
  const seen = new Set();
  for (const r of rs) { seen.add(r.reporter); if (seen.size >= LS.PUBLISH_THRESHOLD) return r.day - rs[0].day; }
  return null;
}
function renderDash() {
  const reports = allReports(), cl = state.graph.clusters;
  const pub = cl.filter(c => c.published);
  const apps = new Set(reports.map(r => r.app));
  const dtp = pub.map(c => daysToPublish(c, reports)).filter(x => x !== null).sort((a, b) => a - b);
  const median = dtp.length ? dtp[Math.floor((dtp.length - 1) / 2)] : '–';
  const pubApps = pub.reduce((s, c) => s + c.apps.length, 0);
  const tiles = [
    [reports.length, 'reports received'],
    [apps.size, 'app names seen'],
    [`${pub.length} of ${cl.length}`, 'operators published'],
    [pub.length ? (pubApps / pub.length).toFixed(1) : '–', 'app names per published operator'],
    [median, 'median days from first report to publishing']
  ];
  $('#dash').innerHTML = tiles.map(([b, s]) => `<div class="card"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
}

/* ---------------- ecosystem ---------------- */
const STAGES = [
  { name: 'Prevent', icon: 'i-calc', kind: 'community', color: 'r', sub: 'Before borrowing',
    tagline: 'Remove the reason people reach for scam apps.',
    tech: 'Loan Truth Check and a WhatsApp or IVR line that checks a lender against RBI’s DLA directory. Works on basic phones.',
    people: 'SHGs and microfinance institutions offer a fair small-loan route. Student volunteers run Truth Check camps at SHG meetings.',
    roles: [['Borrowers', 'check a loan before taking it'], ['SHGs and MFIs', 'offer the fair alternative'], ['Banks and NBFCs', 'keep their apps listed with RBI']],
    sdg: [['s1', '1.4'], ['s1', '1.5'], ['s8', '8.10']] },
  { name: 'Detect', icon: 'i-link', kind: 'tech', color: 'g', sub: 'Link the rebrands',
    tagline: 'Find the operator, not just the app name.',
    tech: 'The scam graph links reports by UPI ID, phone number and message script, then publishes an operator after 3 different people report it.',
    people: 'Victims’ own reports are the sensor. The 3-person rule stops anyone from listing a rival out of spite.',
    roles: [['Borrowers', 'report identifiers with consent'], ['Google Play', 'takes down lookalikes of a listed operator'], ['Telecoms', 'act on numbers reported through Chakshu']],
    sdg: [['s16', '16.4']] },
  { name: 'Protect', icon: 'i-shield', kind: 'tech', color: 'g', sub: 'During harassment',
    tagline: 'Help in the moment, without reading your private messages.',
    tech: 'Share-in threat scanner, Contact Shield warnings, call screening for numbers linked to an operator, and a hash-chained evidence vault.',
    people: 'A severe threat shows the 1930 and Tele-MANAS numbers and offers a volunteer callback.',
    roles: [['Borrowers', 'share and save what scares them'], ['NGO counsellors', 'call back within a day']],
    sdg: [['s10', '10.2'], ['s16', '16.3']] },
  { name: 'Respond', icon: 'i-doc', kind: 'community', color: 'r', sub: 'Get justice',
    tagline: 'Evidence, plus a person who listens.',
    tech: 'A complaint packet that names the rules broken (RBI, BNS, IT Act), lists SHA-256 hashes for a Section 63 certificate, and bundles one case per operator.',
    people: 'Legal-aid clinics and trained volunteers help victims file. Victims of the same operator are filed together.',
    roles: [['Cyber cells and I4C', 'receive one case per operator'], ['Legal-aid clinics', 'help file and follow up'], ['Volunteers', 'reduce the shame that stops reporting']],
    sdg: [['s16', '16.3']] },
  { name: 'Reform', icon: 'i-chart', kind: 'tech', color: 'g', sub: 'Close the loop',
    tagline: 'What gets counted in public gets fixed.',
    tech: 'A public dashboard: operators, app names per operator, and days from first report to action.',
    people: 'Students publish a quarterly brief for RBI, MeitY and Google Play. Hotspots decide where the next Prevent camps go.',
    roles: [['RBI and MeitY', 'block operators, not single names'], ['Google Play', 'reports its response time'], ['Media and researchers', 'keep pressure on']],
    sdg: [['s16', '16.6']] }
];
const stagesEl = $('#stages');
STAGES.forEach((s, i) => {
  stagesEl.insertAdjacentHTML('beforeend', `<li><button class="stage-btn" type="button" aria-pressed="false" data-i="${i}"><span class="badge lg ${s.color === 'g' ? 'g' : ''}" style="transform:rotate(${i % 2 ? 4 : -4}deg)">${ico(s.icon)}</span><span><span class="nm">${s.name}</span><span class="sub">${s.sub}</span></span></button>${i < 4 ? '<span class="arrow" aria-hidden="true">→</span>' : ''}</li>`);
});
function showStage(i) {
  const s = STAGES[i];
  $$('.stage-btn').forEach((b, j) => b.setAttribute('aria-pressed', i === j));
  $('#stage-panel').innerHTML = `<h3>${s.name} <span class="tag ${s.kind === 'community' ? '' : 'g'}">${s.kind === 'community' ? 'Community-led' : 'Tech-led'}</span></h3>
    <p style="margin:0">${esc(s.tagline)}</p>
    <div class="split"><div class="half t"><h4>Tech</h4><p>${esc(s.tech)}</p></div><div class="half c"><h4>People</h4><p>${esc(s.people)}</p></div></div>
    <ul class="roles">${s.roles.map(([w, r]) => `<li><b>${esc(w)}</b> ${esc(r)}</li>`).join('')}</ul>
    <p style="margin:1rem 0 0" class="small">SDG targets: ${s.sdg.map(([c, t]) => `<span class="sdg-mini ${c}">${t}</span>`).join('')}</p>`;
}
stagesEl.addEventListener('click', e => { const b = e.target.closest('.stage-btn'); if (b) showStage(+b.dataset.i); });
showStage(0);

/* ---------------- validation (live) ---------------- */
function renderValidation() {
  let tp = 0, fp = 0, tn = 0, fn = 0; const wrong = [];
  const rows = LSDATA.TEST_SET.map(([y, m]) => {
    const r = LS.scanMessage(m), p = r.score >= 40 ? 1 : 0;
    if (p && y) tp++; else if (p && !y) { fp++; wrong.push({ type: 'False alarm', m, r }); } else if (!p && !y) tn++; else { fn++; wrong.push({ type: 'Missed', m, r }); }
    return { y, m, p, r };
  });
  const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1), f1 = 2 * prec * rec / (prec + rec || 1);
  const pc = x => Math.round(x * 100) + '%';
  $('#val-scores').innerHTML = `<div><b>${pc(rec)}</b><span>of harassment caught (recall)</span></div><div><b>${pc(prec)}</b><span>of flags were right (precision)</span></div><div><b>${f1.toFixed(2)}</b><span>F1 score</span></div>`;
  $('#val-cm').innerHTML = `<div class="h"></div><div class="h">Flagged</div><div class="h">Not flagged</div>
    <div class="h" style="text-align:right">Harassment</div><div class="good"><span class="v">${tp}</span></div><div class="badc"><span class="v">${fn}</span></div>
    <div class="h" style="text-align:right">Ordinary</div><div class="badc"><span class="v">${fp}</span></div><div class="good"><span class="v">${tn}</span></div>`;
  $('#val-miss').innerHTML = wrong.length ? wrong.map(w => {
    const why = w.type === 'False alarm'
      ? `One cue on its own (${w.r.hits.map(h => '“' + h.phrases[0] + '”').join(', ')}) with no threat around it. The scanner reads words, not intent.`
      : `Scored ${w.r.score}. The threat is there but uses words not yet in the list.`;
    return `<li><span class="pill ${w.type === 'Missed' ? 'high' : 'watch'}" style="margin-bottom:.4rem">${w.type} · score ${w.r.score}</span><br>“${esc(w.m)}”<span class="why">${esc(why)}</span></li>`;
  }).join('') : '<li>No errors on this set.</li>';
  $('#val-set').innerHTML = rows.map(x => `<li><span class="lbl" style="background:${x.y ? 'var(--red)' : 'var(--green)'}">${x.y ? 'Harassment' : 'Ordinary'}</span>${esc(x.m)} <span class="muted">(score ${x.r.score}${x.p === x.y ? '' : ', wrong'})</span></li>`).join('');
}

/* ---------------- nav highlight ---------------- */
const navLinks = $$('nav.top a.l');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
}

/* ---------------- boot ---------------- */
runCheck();
runScan();
renderGraph();
renderVault().then(() => { if (state.chain.length) verify(state.chain); });
renderValidation();
refreshPacket();
startLive();
})();
