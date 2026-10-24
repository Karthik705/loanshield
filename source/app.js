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
const state = {
  truth: null, flip: null,
  chain: store.get('loanshield_chain_v2', []),
  myReports: store.get('loanshield_reports_v2', []),
  graph: null, mode: 'sample',
  live: { on: false, db: null, uid: null, canWrite: false, reports: [] },
  downloads: null, sample: null
};

let toastEl, toastT;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

/* ---------------- Fear → Fact ---------------- */
const FACTS = {
  legal:    { who: 'Fake legal threat', head: 'No one can arrest you over a WhatsApp message.', body: 'Police do not send FIRs, warrants or “digital arrest” notices by chat. Not repaying a loan is usually a civil matter, not a crime. Using fake police threats to make you pay is itself an offence.' },
  image:    { who: 'Photo threat', head: 'A morphed photo is fake, and making it is a crime.', body: 'Editing your photo and sending it to others is punishable under the IT Act. Tell your contacts first. If an image is shared, report it at cybercrime.gov.in.' },
  contacts: { who: 'Contact threat', head: 'Your contacts owe them nothing, and neither do you to them.', body: 'RBI rules bar recovery agents from harassing your family, friends or workplace. Warn your contacts before they do, and the message loses its power.' },
  shame:    { who: 'Name-calling', head: 'Being behind on a loan does not make you a fraud.', body: 'Calling you a thief or fraud to other people can be defamation. You have done nothing criminal.' },
  violence: { who: 'Threat of harm', head: 'This is criminal intimidation. Your safety comes first.', body: 'If you feel unsafe right now, call 112. Then report the number to 1930. Do not meet anyone they send.' },
  urgency:  { who: 'Pressure', head: 'The deadline is made up to stop you thinking.', body: 'Paying an illegal app usually brings new demands, not peace. Save the message first. You have time to get help.' },
  fees:     { who: 'Extra charges', head: 'Charges you never agreed to are a warning sign.', body: 'Regulated lenders must show every charge in a Key Fact Statement before you sign. New “penalties” that appear later are how the debt keeps growing.' }
};
const ORDER = ['violence', 'image', 'legal', 'contacts', 'shame', 'urgency', 'fees'];
const EXAMPLES = [
  LSDATA.EXAMPLE_MESSAGE,
  'Final notice from Cyber Cell: FIR registered against you for loan fraud. Non-bailable warrant will be issued today. Pay Rs 4800 to recovery.desk@fakebank within 1 hour to cancel. Call 9000012345.',
  '10:40 pm call from 9000033118. He said tum chor ho, ghar walon ko bata denge, and they will come to your house tomorrow.'
];
const RULE_FOR = { legal: ['bns351', 'rbi_conduct'], image: ['it67', 'bns351'], contacts: ['rbi_conduct'], shame: ['bns356'], violence: ['bns351'], urgency: [], fees: [] };

function quote(text, phrase) {
  const t = text.replace(/\s+/g, ' ');
  const i = t.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return esc(phrase);
  let a = Math.max(0, t.lastIndexOf(' ', Math.max(0, i - 28))), b = t.indexOf(' ', Math.min(t.length, i + phrase.length + 28));
  if (b < 0) b = t.length;
  const s = t.slice(a, b).trim();
  const re = new RegExp('(' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'i');
  return (a > 0 ? '…' : '') + s.split(re).map((p, k) => k % 2 ? `<mark>${esc(p)}</mark>` : esc(p)).join('') + (b < t.length ? '…' : '');
}

function flip(text, opts) {
  text = text.trim();
  const box = $('#result');
  if (!text) { box.innerHTML = ''; state.flip = null; return; }
  const scan = LS.scanMessage(text);
  const rights = LS.rightsFor(scan, text);
  const late = LS.callTimes(text).filter(t => t.outside);
  state.flip = { text, scan, rights, late, saved: state.chain.some(e => e.text === text) };
  const hits = scan.hits.slice().sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat));
  const pairs = hits.map(h => {
    const f = FACTS[h.cat]; if (!f) return '';
    const laws = (RULE_FOR[h.cat] || []).map(id => LS.RIGHTS[id].short);
    if (h.cat === 'urgency' || h.cat === 'contacts') { if (rights.some(r => r.id === 'bns308')) laws.push(LS.RIGHTS.bns308.short); }
    return `<li class="flip"><div class="said"><span class="who">${esc(f.who)}</span><q>${quote(text, h.phrases[0])}</q></div><span class="arrow" aria-hidden="true">→</span>
      <div class="fact"><b>${esc(f.head)}</b><p>${esc(f.body)}</p>${laws.length ? `<div class="laws">${[...new Set(laws)].map(l => `<span class="law">${esc(l)}</span>`).join('')}</div>` : ''}</div></li>`;
  });
  late.forEach(t => pairs.push(`<li class="flip"><div class="said"><span class="who">Call time</span><q><mark>${esc(t.raw)}</mark></q></div><span class="arrow" aria-hidden="true">→</span>
    <div class="fact"><b>Recovery calls at this hour are not allowed.</b><p>RBI rules let recovery agents call only between 8 am and 7 pm. Note every late call; each one counts.</p><div class="laws"><span class="law">RBI calling hours</span></div></div></li>`));
  const nThreat = hits.filter(h => FACTS[h.cat]).length + late.length;
  box.innerHTML = `
    <div class="verdict"><span class="pill ${scan.level}">${esc(scan.levelLabel)}</span>
      <span class="small muted">${nThreat ? `${nThreat} threat${nThreat > 1 ? 's' : ''} flipped · ${rights.length} rule${rights.length === 1 ? '' : 's'} this may break` : 'No threat words found'}</span></div>
    ${pairs.length ? `<ul class="flip-list">${pairs.join('')}</ul>` : `<div class="none"><b>No threat words found.</b> <span class="muted">If the message still frightened you, save it anyway. The word list misses new wording${state.sample ? '; you can ask the AI below' : ''}.</span></div>`}
    ${scan.needsSupport ? `<div class="support"><span>You are not alone, and you do not have to pay to make this stop.</span><span><b class="n">1930</b> cybercrime</span><span><b class="n">14416</b> Tele-MANAS</span>${hits.some(h => h.cat === 'violence') ? '<span><b class="n">112</b> danger</span>' : ''}</div>` : ''}
    <div class="case" id="case"></div>
    ${state.sample ? `<div class="ai" id="ai-box"><button class="link-btn" type="button" id="ai-btn">Ask AI to read it (any language)</button> <span class="small muted">Sends the text to Claude.</span></div>` : ''}`;
  renderCase();
  const ai = $('#ai-btn'); if (ai) ai.addEventListener('click', () => askAI(text));
  if (opts && opts.scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function matchCluster(ids) {
  if (!state.graph) return null;
  return state.graph.clusters.find(c => c.upi.some(u => ids.upi.includes(u)) || c.phones.some(p => ids.phones.includes(p))) || null;
}
function renderCase() {
  const el = $('#case'); if (!el || !state.flip) return;
  const f = state.flip, ids = f.scan.ids;
  const saved = state.chain.find(e => e.text === f.text);
  const idx = saved ? state.chain.indexOf(saved) + 1 : 0;
  const cl = matchCluster(ids);
  const hasIds = ids.upi.length + ids.phones.length > 0;
  const reported = state.myReports.some(r => r.text === f.text);
  const opLine = cl ? `Same ${cl.upi.some(u => ids.upi.includes(u)) ? 'UPI ID' : 'number'} as <b>${esc(cl.id)}</b>: ${cl.reporters} ${cl.reporters > 1 ? 'people' : 'person'}, ${cl.apps.length} app name${cl.apps.length > 1 ? 's' : ''} (${cl.apps.map(esc).join(', ')}). ${cl.published ? 'Published.' : `Held until ${LS.PUBLISH_THRESHOLD} people report it.`}`
    : hasIds ? `${[...ids.upi, ...ids.phones.map(LS.maskPhone)].map(x => `<code>${esc(x)}</code>`).join(', ')}. No match yet.` : 'No UPI ID or number in this message.';
  const steps = [
    { on: !!saved, icon: 'i-lock', t: saved ? `Sealed as evidence item #${idx}` : 'Seal it as evidence', d: saved ? `SHA-256 <code>${saved.hash.slice(0, 16)}…</code> · stored on this device` : 'Timestamped and hash-chained, so it holds up later.',
      act: saved ? `<button class="btn ghost sm" type="button" data-open="dlg-vault">View (${state.chain.length})</button>` : `<button class="btn primary sm" type="button" id="seal">Add to my case</button>` },
    { on: f.rights.length > 0, icon: 'i-scale', t: f.rights.length ? `${f.rights.length} rule${f.rights.length > 1 ? 's' : ''} this may break` : 'No rule matched', d: f.rights.length ? f.rights.map(r => esc(r.short)).join(' · ') : 'Legal aid can still advise you.', act: '' },
    { on: !!cl || reported, icon: 'i-link', t: cl ? 'Linked to an operator' : 'Operator', d: opLine,
      act: hasIds ? (reported ? '<span class="small muted">Shared</span>' : `<button class="btn ghost sm" type="button" id="report">Share identifiers</button>`) : '' },
    { on: !!state.shieldSent, icon: 'i-users', t: 'Warn your contacts first', d: 'A ready message in English, Hindi or Tamil.', act: `<button class="btn ghost sm" type="button" data-open="dlg-shield">Write it</button>` },
    { on: false, icon: 'i-doc', t: 'Complaint packet', d: 'Everything above, ready for legal aid or 1930.', act: `<button class="btn ghost sm" type="button" data-open="dlg-packet">Build it</button>` }
  ];
  const strength = steps.filter(s => s.on).length;
  el.innerHTML = `<div class="case-head"><h3>Your case</h3><span class="small muted num">${strength} of 5 in place</span></div>
    <ol class="case-steps">${steps.map(s => `<li><span class="dot ${s.on ? 'on' : ''}">${ico(s.on ? 'i-check' : s.icon)}</span><div><div class="t">${s.t}</div><div class="d">${s.d}</div></div><div class="act">${s.act}</div></li>`).join('')}</ol>
    ${hasIds && !reported ? `<p class="small muted" style="padding:0 1.2rem 1rem">Sharing adds only the UPI IDs, numbers and wording to the operator map${state.live.canWrite ? ' for everyone with this link' : ' on this device'}. Never your name or contacts.</p>` : ''}`;
  const s = $('#seal'); if (s) s.addEventListener('click', async () => { await addToVault('message', f.text); });
  const r = $('#report'); if (r) r.addEventListener('click', () => reportFlip());
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) openDlg(o.dataset.open);
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
});
function openDlg(id) {
  const d = document.getElementById(id);
  if (id === 'dlg-packet') refreshPacket();
  if (id === 'dlg-vault') renderVault();
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('#flip-form').addEventListener('submit', e => { e.preventDefault(); flip($('#msg').value, { scroll: true }); });
$$('[data-ex]').forEach(b => b.addEventListener('click', () => { $('#msg').value = EXAMPLES[+b.dataset.ex]; flip($('#msg').value, { scroll: true }); }));

async function askAI(text) {
  const box = $('#ai-box'); if (!box || !state.sample) return;
  box.innerHTML = '<p class="small muted">Asking Claude…</p>';
  const prompt = 'You help victims of illegal Indian loan apps. Read the message below. Reply with JSON only: {"harassment": true|false, "language": "<language in English>", "summary": "<one plain English sentence on what it threatens>", "truth": "<one or two calm sentences on what is actually true for the victim>"}. Do not invent facts.\n\nMESSAGE:\n' + text.slice(0, 3000);
  try {
    const a = await state.sample.json(prompt, { modelTier: 'quick' });
    box.innerHTML = `<div class="flip"><div class="said"><span class="who">${esc(a.language || 'Message')}</span><q>${esc(a.summary || '')}</q></div><span class="arrow" aria-hidden="true">→</span><div class="fact"><b>${a.harassment ? 'This is harassment.' : 'This does not read as harassment.'}</b><p>${esc(a.truth || '')}</p></div></div><p class="small muted" style="margin-top:.4rem">AI reading by Claude. The word-list result above is what goes into your evidence.</p>`;
  } catch (e) {
    box.innerHTML = `<p class="small muted">${e && e.code === 'rate_limited' ? 'Too many requests. Try again in a minute.' : 'The AI reading isn’t available right now.'}</p>`;
  }
}

/* ---------------- report to operator map ---------------- */
function guessApp(text) { const names = [...new Set(LSDATA.SAMPLE_REPORTS.map(r => r.app))]; return names.find(n => text.toLowerCase().includes(n.toLowerCase())); }
async function reportFlip() {
  const f = state.flip; if (!f) return;
  const ids = f.scan.ids, app = guessApp(f.text) || 'Unnamed app';
  if (state.live.canWrite) {
    const ok = await pushLiveReport({ app, upi: ids.upi.slice(0, 5), phones: ids.phones.slice(0, 5), script: LS.normaliseScript(f.text), ts: Date.now() });
    if (ok) {
      state.myReports.push({ reporter: 'YOU', app, day: 0, upi: ids.upi, phones: ids.phones, text: f.text, mine: true, shared: true });
      store.set('loanshield_reports_v2', state.myReports); setGraphMode('live'); renderCase(); toast('Shared with the operator map'); return;
    }
  }
  state.myReports.push({ reporter: 'YOU', app, day: 40, upi: ids.upi, phones: ids.phones, text: f.text, mine: true });
  store.set('loanshield_reports_v2', state.myReports);
  setGraphMode('sample'); renderCase();
  const c = matchCluster(ids); toast(c && c.apps.length > 1 ? `Linked to ${c.id}: ${c.reporters} people, ${c.apps.length} app names` : 'Added to the operator map');
}

/* ---------------- Contact Shield ---------------- */
function shieldText() { return LS.shieldMessage($('input[name=sh-lang]:checked').value, $('#sh-name').value); }
function renderShield() { $('#sh-out').value = shieldText(); $('#sh-wa').href = 'https://wa.me/?text=' + encodeURIComponent(shieldText()); }
$$('input[name=sh-lang]').forEach(r => r.addEventListener('change', renderShield));
$('#sh-name').addEventListener('input', renderShield);
$('#sh-copy').addEventListener('click', () => copyText(shieldText(), $('#sh-out'), 'Copied. Paste it to your contacts.'));
async function shieldSent() { if (state.shieldSent) return; state.shieldSent = true; await addToVault('note', 'Warned my contacts that loan-app messages about me are false.'); }
$('#sh-wa').addEventListener('click', shieldSent);
$('#sh-log').addEventListener('click', async () => { await shieldSent(); $('#dlg-shield').close(); });
renderShield();

/* ---------------- evidence vault ---------------- */
async function addToVault(kind, text) {
  state.chain = await LS.appendEntry(state.chain, { ts: Date.now(), kind, text });
  if (!store.set('loanshield_chain_v2', state.chain)) toast('Saved for this visit only. Your browser blocked storage.'); else toast('Sealed and added to your case');
  renderCase(); if ($('#dlg-vault').open) renderVault();
}
async function renderVault(broken) {
  const n = state.chain.length, list = $('#vault-list');
  $('#verify-btn').disabled = $('#tamper-btn').disabled = $('#clear-vault').disabled = n === 0;
  if (!n) { list.innerHTML = '<li class="muted">Nothing saved yet. Flip a threat and press <b>Add to my case</b>, or log a call below.</li>'; $('#chain-status').innerHTML = ''; return; }
  const items = broken && broken.copy ? broken.copy : state.chain;
  list.innerHTML = items.map((e, i) => {
    const bad = broken && broken.at > -1 && i >= broken.at;
    return `<li class="${bad ? 'bad' : ''}"><div class="meta"><span>#${i + 1}</span><span>${esc(new Date(e.ts).toLocaleString('en-IN'))}</span><span>${e.kind === 'note' ? 'Note' : 'Message'}</span>${bad ? '<b style="color:var(--threat)">Hash mismatch</b>' : ''}</div><div>${esc(e.text)}</div><div class="hash">SHA-256 ${e.hash}</div></li>`;
  }).join('');
  if (!broken) await verify(state.chain);
}
async function verify(chain, label) {
  const v = await LS.verifyChain(chain);
  $('#chain-status').innerHTML = v.ok ? `<p class="status ok">${ico('i-check')}Chain intact: ${chain.length} item${chain.length > 1 ? 's' : ''}, none changed since saving.</p>`
    : `<p class="status bad">${ico('i-x')}${label || 'Chain broken'} at item ${v.brokenAt + 1}.</p>`;
  return v;
}
$('#verify-btn').addEventListener('click', () => renderVault());
$('#tamper-btn').addEventListener('click', async () => {
  const copy = state.chain.map(e => ({ ...e }));
  copy[0] = { ...copy[0], text: copy[0].text.replace(/\d/, d => String((+d + 1) % 10)) + (/\d/.test(copy[0].text) ? '' : ' (edited)') };
  const v = await verify(copy, 'Tampering detected'); await renderVault({ copy, at: v.brokenAt });
  $('#chain-status').insertAdjacentHTML('beforeend', '<p class="small muted">This edited a copy to show the effect. Your saved items are unchanged.</p>');
});
$('#clear-vault').addEventListener('click', () => { $('#clear-confirm').hidden = false; });
$('#clear-no').addEventListener('click', () => { $('#clear-confirm').hidden = true; });
$('#clear-yes').addEventListener('click', async () => { state.chain = []; store.del('loanshield_chain_v2'); $('#clear-confirm').hidden = true; await renderVault(); renderCase(); toast('All saved items deleted'); });
$('#note-form').addEventListener('submit', async e => {
  e.preventDefault(); const t = $('#note-text').value.trim();
  if (t.length < 8) { $('#note-error').textContent = 'Write the time, the number and what was said.'; return; }
  $('#note-error').textContent = ''; await addToVault('note', t); $('#note-text').value = '';
  const late = LS.callTimes(t).filter(x => x.outside); if (late.length) toast(`${late[0].raw}: RBI bars recovery calls before 8 am or after 7 pm`);
});

/* ---------------- complaint packet ---------------- */
async function refreshPacket() {
  const texts = state.chain.map(e => e.text); if (state.flip) texts.push(state.flip.text);
  const ids = { upi: [], phones: [], links: [] }, rights = new Map();
  texts.forEach(t => { const x = LS.extractIdentifiers(t); ids.upi.push(...x.upi); ids.phones.push(...x.phones); ids.links.push(...x.links); LS.rightsFor(LS.scanMessage(t), t).forEach(r => rights.set(r.id, r)); });
  Object.keys(ids).forEach(k => ids[k] = [...new Set(ids[k])]);
  const v = await LS.verifyChain(state.chain), cl = matchCluster(ids);
  $('#packet-out').value = LS.buildPacket({ date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    name: $('#pk-name').value.trim(), city: $('#pk-city').value.trim(), summary: $('#pk-summary').value.trim(), truth: state.truth,
    apps: cl ? cl.apps : (state.truth && state.truth.app ? [state.truth.app] : []), ids, cluster: cl && cl.published ? cl : null,
    evidence: state.chain, chainOk: v.ok, brokenAt: v.brokenAt, rights: [...rights.values()] });
}
['#pk-name', '#pk-city', '#pk-summary'].forEach(id => $(id).addEventListener('input', refreshPacket));
$('#packet-copy').addEventListener('click', () => copyText($('#packet-out').value, $('#packet-out'), 'Packet copied'));
$('#packet-save').addEventListener('click', () => saveFile('loanshield-complaint-packet.txt', $('#packet-out').value));
async function saveFile(name, data) {
  if (state.downloads) {
    try { await state.downloads.save({ filename: name, data }); toast('Saved ' + name); }
    catch (e) { if (!e || e.code !== 'declined') toast('Saving isn’t available here. Use Copy instead.'); }
    return;
  }
  try { const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  catch (e) { toast('Saving is blocked here. Use Copy instead.'); }
}
$$('[data-deck]').forEach(b => b.addEventListener('click', async () => {
  const f = b.dataset.deck; if (!state.downloads) { location.href = 'downloads/' + f; return; }
  b.disabled = true;
  try { const res = await fetch('downloads/' + f); if (!res.ok) throw 0; await saveFile(f, await res.blob()); } catch (e) { toast('Couldn’t load the file. Try again.'); }
  b.disabled = false;
}));
function copyText(t, el, msg) {
  const fail = () => { if (el && el.select) { el.focus(); el.select(); toast('Selected. Press Ctrl+C to copy.'); } else toast('Copy blocked. Select the text by hand.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(() => toast(msg || 'Copied'), fail); else fail();
}

/* ---------------- Before you borrow ---------------- */
LS.RED_FLAG_QUESTIONS.forEach(q => $('#c-questions').insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" value="${q.id}"><span>${esc(q.q)}</span></label>`));
function runCheck() {
  const v = id => $(id).value.replace(/[,\s₹]/g, '');
  const input = { promised: v('#c-promised'), received: v('#c-received'), repay: v('#c-repay'), days: v('#c-days'), answers: $$('#c-questions input:checked').map(i => i.value) };
  const r = LS.truthCheck(input), out = $('#check-out');
  if (r.error) { out.innerHTML = `<p class="muted">${esc(r.error)}</p>`; state.truth = null; return; }
  state.truth = { promised: +input.promised, received: +input.received, repay: +input.repay, days: +input.days, apr: r.apr, app: '' };
  const apr = Math.round(r.apr), scale = Math.max(apr, 40);
  const bars = [['This app', apr, 'them'], ['Credit card, about', 42, ''], ['SHG / microfinance, up to', 26, '']];
  out.innerHTML = `<p class="eyebrow">Real yearly cost</p>
    <div class="apr ${r.verdict}" style="margin-top:.5rem">${LS.fmt(apr)}%</div>
    <p class="apr-sub">You pay ₹${LS.fmt(r.totalCost)} on top of the ₹${LS.fmt(+input.received)} that reaches you. That is ₹${LS.fmt(Math.round(r.perDay))} a day.</p>
    <div class="compare">${bars.map(([l, x, c]) => `<div class="bar ${c}"><span>${l}</span><span class="track"><i style="width:${Math.max(2, Math.min(100, x / scale * 100))}%"></i></span><span class="v">${LS.fmt(x)}%</span></div>`).join('')}</div>
    ${r.flags.length ? `<ul class="flag-list">${r.flags.slice(0, 4).map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
    <p class="small muted" style="margin-top:1rem">${r.verdict === 'ok' ? 'No major warning signs. Still ask for the Key Fact Statement.' : 'A safer route: ask your self-help group or a microfinance institution, or check the lender in RBI’s Digital Lending Apps directory.'}</p>`;
}
['#c-promised', '#c-received', '#c-repay', '#c-days'].forEach(id => $(id).addEventListener('input', runCheck));
$('#c-questions').addEventListener('change', runCheck);
$('#check-form').addEventListener('submit', e => { e.preventDefault(); runCheck(); });

/* ---------------- pipeline ---------------- */
const STAGES = [
  { n: 'Prevent', app: false, who: 'SHGs · MFIs · volunteers', p: 'Remove the reason people borrow from scam apps.', items: ['Truth Check camps at SHG meetings', 'Fair small loans from SHGs and MFIs', 'WhatsApp / IVR lender check for basic phones'] },
  { n: 'Detect', app: true, who: 'App · victims’ reports', p: 'Find the operator behind the app names.', items: ['Link reports by UPI ID, number, wording', 'Public only after 3 different people'] },
  { n: 'Protect', app: true, who: 'App · counsellors', p: 'Answer each threat with the facts, in the moment.', items: ['Fear → fact for every threat', 'Contact warning in 3 languages', 'Counsellor callback for severe cases'] },
  { n: 'Respond', app: false, who: 'Legal-aid clinics · cyber cells', p: 'Turn sealed evidence into a filed case.', items: ['Clinics help file at 1930', 'One bundled case per operator'] },
  { n: 'Reform', app: false, who: 'Students · RBI · MeitY · Google Play', p: 'Make the numbers public so systems respond.', items: ['Public dashboard of operators', 'Quarterly brief to regulators'] }
];
$('#pipe').innerHTML = STAGES.map(s => `<li class="${s.app ? 'app' : ''}"><h3>${s.n}</h3><p class="who">${s.who}</p><p>${s.p}</p><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>${s.app ? '<span class="tag">In this app</span>' : ''}</li>`).join('');

/* ---------------- operator map ---------------- */
function allReports() { return state.mode === 'live' ? state.live.reports : LSDATA.SAMPLE_REPORTS.concat(state.myReports.filter(r => !r.shared)); }
function renderGraph() {
  const reports = allReports();
  state.graph = LS.buildGraph(reports);
  $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  const live = state.mode === 'live', people = new Set(reports.map(r => r.reporter)).size;
  $('#graph-status').innerHTML = live ? (state.live.on ? `<span class="live-dot"></span>Live: ${reports.length} report${reports.length === 1 ? '' : 's'} from ${people} ${people === 1 ? 'person' : 'people'}` : 'Live reports need this page opened through its Claude link.')
    : 'Sample: 8 fictional reports, plus any you add on this device.';
  const cl = state.graph.clusters, pub = cl.filter(c => c.published);
  $('#stats').innerHTML = [[reports.length, 'reports'], [new Set(reports.map(r => r.app)).size, 'app names'], [cl.length, 'operators found'], [pub.length, 'published (3+ people)']].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  $('#ops').innerHTML = live && !reports.length ? '<div class="op"><h3>No live reports yet</h3><p class="muted small" style="margin-top:.3rem">Flip a threat that contains a UPI ID or number, then press <b>Share identifiers</b>. It appears here for everyone with this link.</p></div>'
    : cl.map(c => opCard(c, reports)).join('');
  renderCase();
}
function setGraphMode(m) { state.mode = m; renderGraph(); }
$$('.seg button').forEach(b => b.addEventListener('click', () => setGraphMode(b.dataset.mode)));
function opCard(c, reports) {
  const rs = c.idx.map(i => reports[i]), mine = rs.some(r => r.mine);
  const ids = c.upi.map(u => ({ k: 'upi', v: u })).concat(c.phones.map(p => ({ k: 'phone', v: p })));
  const rows = Math.max(c.apps.length, ids.length, 1), RH = 40, H = rows * RH + 16, W = 720, AX = 230, IX = 470;
  const ay = i => 20 + i * RH + (rows - c.apps.length) * RH / 2, iy = i => 20 + i * RH + (rows - ids.length) * RH / 2;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.id)}: ${c.apps.length} app names linked by ${ids.length} identifiers">`;
  const seen = new Set();
  rs.forEach(r => { const a = c.apps.indexOf(r.app); (r.upi || []).concat(r.phones || []).forEach(v => { const j = ids.findIndex(x => x.v === v), k = a + ':' + j; if (a > -1 && j > -1 && !seen.has(k)) { seen.add(k); svg += `<line x1="${AX + 8}" y1="${ay(a)}" x2="${IX - 8}" y2="${iy(j)}" stroke="var(--line)" stroke-width="2"/>`; } }); });
  c.apps.forEach((a, i) => { const you = rs.some(r => r.mine && r.app === a); svg += `<circle cx="${AX}" cy="${ay(i)}" r="8" fill="${you ? 'var(--marigold)' : 'var(--teal)'}"/><text x="${AX - 16}" y="${ay(i) + 5}" text-anchor="end" font-size="15" font-weight="700" fill="var(--ink)" font-family="var(--body)">${esc(a)}</text>`; });
  ids.forEach((x, j) => svg += `<rect x="${IX - 7}" y="${iy(j) - 7}" width="14" height="14" rx="3" fill="${x.k === 'upi' ? 'var(--threat)' : 'var(--mute)'}"/><text x="${IX + 16}" y="${iy(j) + 5}" font-size="13" fill="var(--ink)" font-family="var(--mono)">${esc(x.k === 'phone' ? LS.maskPhone(x.v) : x.v)}</text>`);
  if (!ids.length) svg += `<text x="${IX - 7}" y="${iy(0) + 5}" font-size="13" fill="var(--mute)" font-family="var(--body)">linked by the same wording</text>`;
  svg += '</svg>';
  return `<article class="op ${mine ? 'you' : ''}"><div class="op-head"><h3>${esc(c.id)}${mine ? ' <span class="pill watch" style="font-size:.72rem">Includes yours</span>' : ''}</h3><span class="pill ${c.published ? 'high' : ''}">${c.published ? 'Published' : `Held · ${c.reporters} of ${LS.PUBLISH_THRESHOLD} people`}</span></div>
    <p class="op-meta">${c.reports} report${c.reports > 1 ? 's' : ''} · ${c.reporters} ${c.reporters > 1 ? 'people' : 'person'} · ${c.apps.length} app name${c.apps.length > 1 ? 's' : ''}</p><div class="graph-wrap">${svg}</div></article>`;
}

/* live shared graph */
async function pushLiveReport(rep) {
  try {
    const ref = state.live.db.doc('reports/' + state.live.uid), snap = await ref.get();
    const items = (snap.exists && Array.isArray(snap.data().items) ? snap.data().items.slice() : []).slice(-49); items.push(rep);
    await ref.set({ items, updated: Date.now() }); return true;
  } catch (e) {
    if (e && e.code === 'invalid_argument') state.live.canWrite = false;
    toast('Couldn’t reach the shared map. Saved on this device instead.'); return false;
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
  if (sample && state.flip) flip(state.flip.text);
  if (!db || !user) { $('.seg button[data-mode=live]').disabled = true; return; }
  const uid = await user.id().catch(() => null), can = await user.can('data.write').catch(() => null);
  Object.assign(state.live, { db, uid, on: true, canWrite: !!uid && can !== false });
  db.collection('reports').onSnapshot(snap => { state.live.reports = liveToReports(snap.docs); if (state.mode === 'live') renderGraph(); }, () => { state.live.on = false; });
}

/* validation line */
(function () {
  let tp = 0, fp = 0, fn = 0;
  LSDATA.TEST_SET.forEach(([y, m]) => { const p = LS.scanMessage(m).score >= 40 ? 1 : 0; if (p && y) tp++; else if (p) fp++; else if (y) fn++; });
  $('#val-line').textContent = `Threat scanner on 50 test messages: ${Math.round(tp / (tp + fn) * 100)}% recall, ${Math.round(tp / (tp + fp) * 100)}% precision.`;
})();

/* boot */
renderGraph();
runCheck();
$('#msg').value = EXAMPLES[0];
flip(EXAMPLES[0]);
startLive();
})();
