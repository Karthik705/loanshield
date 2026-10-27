/* LoanShield core logic — pure functions shared by the website and the tests.
   No network calls. Everything runs on the user's own device. */
(function (root) {
'use strict';

/* ------------------------------------------------------------------
   1. LOAN TRUTH CHECK  (Prevent · SDG 1.4)
   Turns "₹5,000 loan" marketing into the real yearly cost.
------------------------------------------------------------------ */
function truthCheck(o) {
  const promised = +o.promised, received = +o.received, repay = +o.repay, days = +o.days;
  if (!(promised > 0 && received > 0 && repay > 0 && days > 0)) return { error: 'Fill in all four amounts with numbers above zero.' };
  if (received > promised) return { error: 'The amount you received can’t be more than the amount promised.' };
  if (repay < received) return { error: 'The repayment should be at least the amount you received.' };
  const upfrontCut = promised - received;                 // fees taken before the money reaches you
  const totalCost = repay - received;                      // everything you pay on top of what you got
  const periodRate = totalCost / received;
  const apr = periodRate * (365 / days) * 100;             // simple annualised rate, same basis lenders must show in a KFS
  const flags = [];
  if (upfrontCut > 0) flags.push({ id: 'upfront', sev: 2, text: `₹${fmt(upfrontCut)} (${pct(upfrontCut / promised)}) was cut before the money reached you.` });
  if (days <= 60) flags.push({ id: 'short', sev: 3, text: `Repayment in ${days} days. Google Play does not allow personal-loan apps that demand full repayment in 60 days or less.` });
  if (apr >= 100) flags.push({ id: 'apr', sev: 3, text: `The real yearly cost is ${fmt(Math.round(apr))}%. The loan costs more than its own amount every year.` });
  else if (apr >= 36) flags.push({ id: 'apr', sev: 2, text: `The real yearly cost is ${fmt(Math.round(apr))}%. Ask for a Key Fact Statement and compare.` });
  (o.answers || []).forEach(a => { const r = RED_FLAG_QUESTIONS.find(q => q.id === a); if (r) flags.push({ id: r.id, sev: r.sev, text: r.why }); });
  const risk = Math.min(100, flags.reduce((s, f) => s + f.sev * 12, 0));
  const verdict = risk >= 60 ? 'danger' : risk >= 25 ? 'caution' : 'ok';
  return { upfrontCut, totalCost, apr, perDay: totalCost / days, flags, risk, verdict };
}
const RED_FLAG_QUESTIONS = [
  { id: 'notInDla', sev: 3, q: 'The app is not in RBI’s Digital Lending Apps directory', why: 'Not in RBI’s DLA directory. Since July 2025 RBI lists every app run by a regulated lender. Google Play India also requires a listed app.' },
  { id: 'apk', sev: 3, q: 'I installed it from a link (WhatsApp, Telegram, SMS), not the Play Store', why: 'Installed from a link. Play Store rules don’t protect you outside the store.' },
  { id: 'perms', sev: 3, q: 'It asked to read my contacts, photos or files', why: 'Asked for contacts, photos or files. Google Play bans these permissions for personal-loan apps.' },
  { id: 'noKfs', sev: 2, q: 'I didn’t get a Key Fact Statement showing the APR', why: 'No Key Fact Statement. RBI’s Digital Lending Directions require one, with the APR, before you sign.' },
  { id: 'noLender', sev: 2, q: 'The app doesn’t name the bank or NBFC behind the loan', why: 'No named bank or NBFC. Legitimate apps must disclose the regulated lender.' }
];

/* ------------------------------------------------------------------
   2. THREAT SCANNER  (Protect · SDG 16.3)
   Weighted lexicon in English + romanised Hindi (Hinglish).
   Shared-in text only: the app never reads SMS or WhatsApp in the background.
------------------------------------------------------------------ */
const LEXICON = [
  { cat: 'contacts', label: 'Threat to message your contacts', w: 40, terms: ['your contacts','your contact list','all your contacts','contact list','your family','your relatives','your office','your boss','your colleagues','your friends','everyone in your phone','everyone you know','message everyone','send to all','tere contacts','tumhare contacts','sabko bhej','sab ko bhej','sabko bata','ghar walon','gharwalon','gharwalo','rishtedaar','office mein bata','tumhare boss','குடும்ப','உறவினர்','நண்பர்கள்','அலுவலக','எல்லோருக்கும் அனுப்','परिवार','रिश्तेदार','दोस्तों','ऑफिस','सबको भेज'] },
  { cat: 'image', label: 'Threat to misuse your photos', w: 55, terms: ['morph','morphed','edited photo','nude','obscene','photo viral','viral kar','make viral','leak your photo','photo leak','gandi photo','tumhari photo','your photo will','புகைப்பட','போட்டோ','படத்தை','फोटो','फ़ोटो','तस्वीर','वायरल'] },
  { cat: 'legal', label: 'Fake legal or police threat', w: 40, terms: ['fir','arrest','warrant','legal notice','court notice','digital arrest','cbi','cyber cell','police case','police complaint','jail','giraftaar','case darj','non-bailable','கைது','போலீஸ்','காவல்','வழக்கு','வாரண்ட்','गिरफ्तार','गिरफ़्तार','पुलिस','वारंट','केस दर्ज','जेल'] },
  { cat: 'shame', label: 'Name-calling or public shaming', w: 35, terms: ['fraud','fraudster','thief','chor','cheater','defaulter','beggar','bhikari','shameless','besharam','loser','திருடன்','மோசடி','ஏமாற்று','चोर','धोखेबाज़','धोखेबाज','फ्रॉड'] },
  { cat: 'violence', label: 'Threat of physical harm', w: 60, terms: ['kill you','beat you','break your','maar denge','jaan se','dekh lenge','we know where you live','ghar aa jayenge','come to your house','hurt you','கொன்று','அடிப்போம்','வீட்டுக்கு வருவோம்','मार देंगे','जान से','घर आ जाएंगे'] },
  { cat: 'urgency', label: 'Pressure to pay right now', w: 10, terms: ['pay now','pay immediately','pay today','final warning','last warning','final notice','within 1 hour','within 2 hours','within 24 hours','abhi pay','turant','last chance','உடனே','இன்றே','இப்போதே','अभी','तुरंत','आज ही'] },
  { cat: 'fees', label: 'Extra charges', w: 8, terms: ['penalty','late fee','extra charge','processing fee','double the amount','overdue charge'] }
];
const LEVELS = [
  { min: 70, id: 'critical', label: 'Severe harassment' },
  { min: 40, id: 'high', label: 'Harassment' },
  { min: 20, id: 'watch', label: 'Pressure, keep watching' },
  { min: 0, id: 'clear', label: 'Looks like a routine message' }
];
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const LEX_RE = LEXICON.map(c => ({ ...c, re: new RegExp('(?:^|[^a-z0-9])(' + c.terms.map(escRe).sort((a, b) => b.length - a.length).join('|') + ')(?=$|[^a-z0-9])', 'gi') }));

function scanMessage(text) {
  const t = String(text || '');
  const hits = [];
  let score = 0;
  LEX_RE.forEach(c => {
    c.re.lastIndex = 0;
    const found = new Set();
    let m;
    while ((m = c.re.exec(t)) !== null) { found.add(m[1]); if (c.re.lastIndex === m.index) c.re.lastIndex++; }
    if (found.size) { hits.push({ cat: c.cat, label: c.label, w: c.w, phrases: [...found] }); score += c.w; }
  });
  score = Math.min(100, score);
  const level = LEVELS.find(l => score >= l.min);
  return { score, level: level.id, levelLabel: level.label, hits, ids: extractIdentifiers(t), needsSupport: score >= 40 };
}

/* Identifiers the scammer cannot cheaply change. These, not the app name, link rebrands. */
function extractIdentifiers(text) {
  const t = String(text || '');
  const upi = uniq((t.match(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b(?!\.[a-z])/gi) || []).map(s => s.toLowerCase()));
  const phones = uniq((t.match(/(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g) || []).map(normPhone));
  const links = uniq((t.match(/\bhttps?:\/\/[^\s<>"]+|\b[\w-]+\.apk\b/gi) || []).map(s => s.toLowerCase().replace(/[).,]+$/, '')));
  return { upi, phones, links };
}
/* Audio/screenshot to info: the key details of a story, for the complaint. */
function extractFacts(text) {
  const t = String(text || '');
  const amounts = uniq((t.match(/(?:₹|rs\.?|inr|rupees?)\s?([\d,]{3,})|([\d,]{3,})\s?(?:rupees|rs\b|ரூபாய்|रुपये)/gi) || []).map(m => +(m.replace(/[^\d]/g, ''))).filter(n => n >= 100 && n < 1e7));
  const times = callTimes(t).map(x => ({ raw: x.raw, outside: x.outside }));
  const appM = t.match(/\b([A-Z][A-Za-z]+(?:\s?[A-Z][a-z]+)?)\s+(?:recovery|loan app|app|loans?)\b/);
  const ids = extractIdentifiers(t);
  return { amounts, times, app: appM ? appM[1] : '', upi: ids.upi, phones: ids.phones };
}
function normPhone(p) { const d = p.replace(/\D/g, ''); return d.slice(-10); }

/* ------------------------------------------------------------------
   3. TEMPLATE FINGERPRINT  (Detect)
   Scam call-centres reuse scripts. Same script + different app name = likely same operator.
------------------------------------------------------------------ */
function normaliseTemplate(text) {
  return String(text || '').toLowerCase()
    .replace(/\b[a-z0-9._-]{2,}@[a-z]{2,}\b/g, ' upi ')
    .replace(/(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, ' phone ')
    .replace(/(rs\.?|inr|₹)\s*[\d,]+/g, ' amount ')
    .replace(/\d+/g, ' n ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter(Boolean);
}
function normaliseScript(text) { return normaliseTemplate(text).join(' ').slice(0, 600); }
function shingles(words, k) { const s = new Set(); for (let i = 0; i + k <= words.length; i++) s.add(words.slice(i, i + k).join(' ')); return s; }
function templateSimilarity(a, b) {
  const A = shingles(normaliseTemplate(a), 3), B = shingles(normaliseTemplate(b), 3);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

/* ------------------------------------------------------------------
   4. SCAM GRAPH  (Detect + Reform · SDG 16.4)
   Union-find over reports. Two reports join the same operator when they share
   a UPI collection ID, a recovery phone number, or a near-identical script.
   An operator is published only after K distinct reporters, so one angry
   person can't get a rival listed.
------------------------------------------------------------------ */
const PUBLISH_THRESHOLD = 3;
const TEMPLATE_LINK = 0.5;
function buildGraph(reports) {
  const n = reports.length, parent = reports.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a, b, why) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; edges.push({ a, b, why }); };
  const edges = [];
  const byKey = {};
  reports.forEach((r, i) => {
    (r.upi || []).forEach(u => (byKey['upi:' + u] = byKey['upi:' + u] || []).push(i));
    (r.phones || []).forEach(p => (byKey['phone:' + p] = byKey['phone:' + p] || []).push(i));
  });
  Object.entries(byKey).forEach(([k, idx]) => { for (let j = 1; j < idx.length; j++) union(idx[0], idx[j], k.startsWith('upi') ? 'same UPI ID' : 'same phone number'); });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (reports[i].text && reports[j].text && templateSimilarity(reports[i].text, reports[j].text) >= TEMPLATE_LINK) union(i, j, 'same message script');
  }
  const groups = {};
  reports.forEach((r, i) => { const g = find(i); (groups[g] = groups[g] || []).push(i); });
  const clusters = Object.values(groups).map((idx, ci) => {
    const rs = idx.map(i => reports[i]);
    const reporters = uniq(rs.map(r => r.reporter));
    const apps = uniq(rs.map(r => r.app).filter(Boolean));
    const firstSeen = Math.min(...rs.map(r => r.day || 0));
    return {
      idx, apps,
      upi: uniq(rs.flatMap(r => r.upi || [])), phones: uniq(rs.flatMap(r => r.phones || [])),
      reports: rs.length, reporters: reporters.length,
      published: reporters.length >= PUBLISH_THRESHOLD,
      firstSeen,
      links: edges.filter(e => idx.includes(e.a))
    };
  }).sort((a, b) => b.reporters - a.reporters || b.apps.length - a.apps.length);
  clusters.forEach((c, i) => { c.id = 'OP-' + String(i + 1).padStart(2, '0'); });
  return { clusters, edges };
}

/* ------------------------------------------------------------------
   5. EVIDENCE CHAIN  (Protect + Respond · SDG 16.3)
   Each entry's SHA-256 covers the previous entry's hash, so editing or deleting
   any earlier item breaks every hash after it. The Bharatiya Sakshya Adhiniyam
   Section 63 certificate (Schedule, Part A) asks for a hash of the electronic record.
------------------------------------------------------------------ */
const GENESIS = '0'.repeat(64);
async function sha256Hex(str, subtle) {
  const s = subtle || (root.crypto && root.crypto.subtle);
  const buf = await s.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function entryPayload(prev, e) { return [prev, e.ts, e.kind, e.text].join('|'); }
async function appendEntry(chain, e, subtle) {
  const prev = chain.length ? chain[chain.length - 1].hash : GENESIS;
  const entry = { ts: e.ts, kind: e.kind, text: e.text, prev };
  entry.hash = await sha256Hex(entryPayload(prev, entry), subtle);
  return chain.concat([entry]);
}
async function verifyChain(chain, subtle) {
  let prev = GENESIS;
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (e.prev !== prev) return { ok: false, brokenAt: i };
    const h = await sha256Hex(entryPayload(prev, e), subtle);
    if (h !== e.hash) return { ok: false, brokenAt: i };
    prev = e.hash;
  }
  return { ok: true, brokenAt: -1 };
}

/* ------------------------------------------------------------------
   6. COMPLAINT PACKET  (Respond · SDG 16.3)
   Builds text the victim files themselves. It never auto-files.
------------------------------------------------------------------ */
function buildPacket(o) {
  const L = [];
  const line = s => L.push(s);
  line('LOAN APP HARASSMENT — COMPLAINT PACKET');
  line('Prepared with LoanShield on ' + o.date + '. Review every line before you file.');
  line('');
  line('1. COMPLAINANT');
  line('Name: ' + (o.name || '[your name]'));
  line('Phone / email for contact: ' + (o.contact || '[your contact]'));
  line('City / district: ' + (o.city || '[your city]'));
  line('');
  line('2. WHAT HAPPENED');
  line(o.summary || '[Describe in your own words: when you borrowed, what you received, when the threats began.]');
  if (o.truth) {
    line('Loan amount promised: Rs ' + fmt(o.truth.promised) + '. Amount actually received: Rs ' + fmt(o.truth.received) + '.');
    line('Repayment demanded: Rs ' + fmt(o.truth.repay) + ' in ' + o.truth.days + ' days (effective yearly cost about ' + fmt(Math.round(o.truth.apr)) + '%).');
  }
  line('App name(s) used by the lender: ' + ((o.apps && o.apps.length) ? o.apps.join(', ') : '[app name]'));
  line('');
  line('3. IDENTIFIERS USED BY THE HARASSERS');
  line('UPI IDs they asked me to pay: ' + (o.ids.upi.length ? o.ids.upi.join(', ') : 'none recorded'));
  line('Phone numbers that called or messaged me: ' + (o.ids.phones.length ? o.ids.phones.map(maskPhone).join(', ') : 'none recorded') + ' (full numbers in the evidence below)');
  line('Links or APK files they sent: ' + (o.ids.links.length ? o.ids.links.join(', ') : 'none recorded'));
  if ((o.rights || []).length) {
    line('');
    line('RULES THAT MAY HAVE BEEN BROKEN (to be confirmed by legal aid or police)');
    o.rights.forEach(r => line('- ' + r.text));
  }
  if (o.cluster) {
    line('');
    line('4. LINKED REPORTS');
    line('These identifiers match community operator ' + o.cluster.id + ': ' + o.cluster.reports + ' reports from ' + o.cluster.reporters + ' people, across ' + o.cluster.apps.length + ' app names (' + o.cluster.apps.join(', ') + ').');
  }
  line('');
  line((o.cluster ? '5' : '4') + '. EVIDENCE (hash-chained, SHA-256)');
  line('Chain check: ' + (o.chainOk ? 'intact, no entry altered since it was saved.' : 'BROKEN at entry ' + (o.brokenAt + 1) + '. Do not rely on entries from that point.'));
  (o.evidence || []).forEach((e, i) => {
    line('[' + (i + 1) + '] ' + new Date(e.ts).toISOString() + ' | ' + e.kind);
    line('    "' + e.text.replace(/\s+/g, ' ').slice(0, 280) + '"');
    line('    SHA-256: ' + e.hash);
  });
  if (!(o.evidence || []).length) line('No evidence saved yet. Save each threatening message in the evidence vault first.');
  line('');
  line('WHERE TO FILE');
  line('- National Cybercrime Helpline: call 1930, or file at cybercrime.gov.in (category: financial fraud / online harassment).');
  line('- Report the calls or messages on Chakshu: sancharsaathi.gov.in.');
  line('- If the lender claimed to be a bank or NBFC, check the RBI DLA directory and tell the RBI.');
  line('- For a court, ask for a Section 63 certificate (Bharatiya Sakshya Adhiniyam, 2023). It records the hash values listed above.');
  return L.join('\n');
}

/* ------------------------------------------------------------------
   7. RIGHTS MAP  (Respond · SDG 16.3)
   Each threat type is matched to the rule it appears to break, so the
   victim and the police see the offence, not just the insult.
   Shown as "may apply"; legal aid confirms.
------------------------------------------------------------------ */
const RIGHTS = {
  rbi_conduct: { short: 'RBI recovery rules', text: 'RBI rules for recovery agents (12 Aug 2022): no intimidation, threats, anonymous or persistent calls.' },
  rbi_hours:   { short: 'RBI calling hours',  text: 'RBI rules for recovery agents (12 Aug 2022): no calls before 8 am or after 7 pm.' },
  bns351:      { short: 'BNS Sec. 351',       text: 'Bharatiya Nyaya Sanhita Sec. 351: criminal intimidation.' },
  bns308:      { short: 'BNS Sec. 308',       text: 'Bharatiya Nyaya Sanhita Sec. 308: extortion (a threat used to make you pay).' },
  bns356:      { short: 'BNS Sec. 356',       text: 'Bharatiya Nyaya Sanhita Sec. 356: defamation (calling you a fraud or thief to others).' },
  it67:        { short: 'IT Act Sec. 67',     text: 'Information Technology Act Sec. 67: sending obscene material electronically.' }
};
const CAT_RIGHTS = { contacts: ['rbi_conduct', 'bns351'], image: ['bns351', 'it67'], legal: ['bns351', 'rbi_conduct'], shame: ['bns356'], violence: ['bns351'] };
const THREAT_CATS = ['contacts', 'image', 'legal', 'shame', 'violence'];
function rightsFor(scan, text) {
  const ids = new Set();
  scan.hits.forEach(h => (CAT_RIGHTS[h.cat] || []).forEach(r => ids.add(r)));
  const threat = scan.hits.some(h => THREAT_CATS.includes(h.cat) && h.cat !== 'shame');
  const demand = scan.hits.some(h => h.cat === 'urgency') || scan.ids.upi.length > 0 || /\b(pay|paisa|bhejo|transfer|repay)\b/i.test(text || '');
  if (threat && demand) ids.add('bns308');
  callTimes(text).filter(t => t.outside).length && ids.add('rbi_hours');
  return [...ids].map(id => ({ id, ...RIGHTS[id] }));
}

/* Times written in a note ("10:40 pm", "22:40", "6 am") checked against RBI's 8 am to 7 pm window. */
function callTimes(text) {
  const out = [];
  const t = String(text || '');
  const re12 = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/gi;
  let m;
  while ((m = re12.exec(t)) !== null) {
    let h = +m[1] % 12; const min = +(m[2] || 0);
    if (/p/i.test(m[3])) h += 12;
    if (+m[1] <= 12) out.push({ raw: m[0], minutes: h * 60 + min });
  }
  const re24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(am|pm|a\.m|p\.m))/gi;
  while ((m = re24.exec(t)) !== null) out.push({ raw: m[0], minutes: +m[1] * 60 + +m[2] });
  return out.map(x => ({ ...x, outside: x.minutes < 8 * 60 || x.minutes > 19 * 60 }));
}

/* ------------------------------------------------------------------
   8. CONTACT SHIELD  (Protect · SDG 10.2)
   The scammers' strongest weapon is your contact list. Warn your
   contacts first, so their messages arrive already discredited.
------------------------------------------------------------------ */
const SHIELD_TEXT = {
  en: n => `Important: an illegal loan app is harassing me. They may send you messages or edited (morphed) photos about me, or call me a fraud. All of it is false, and it is a crime. Please don't reply, don't pay anything and don't forward it. Take a screenshot and send it to me so I can add it to my police complaint. Thank you for standing with me.${n ? ' — ' + n : ''}`,
  hi: n => `ज़रूरी सूचना: एक गैरकानूनी लोन ऐप मुझे परेशान कर रहा है। हो सकता है वे आपको मेरे बारे में संदेश या बदली हुई (मॉर्फ की गई) तस्वीरें भेजें, या मुझे धोखेबाज़ कहें। यह सब झूठ है और अपराध है। कृपया जवाब न दें, कोई पैसा न भेजें और कुछ भी आगे न भेजें। उसका स्क्रीनशॉट लेकर मुझे भेज दें, ताकि मैं उसे पुलिस शिकायत में जोड़ सकूँ।${n ? ' — ' + n : ''}`,
  ta: n => `முக்கிய அறிவிப்பு: ஒரு சட்டவிரோத கடன் செயலி என்னைத் துன்புறுத்துகிறது. அவர்கள் என்னைப் பற்றி உங்களுக்குச் செய்திகள் அல்லது மாற்றியமைக்கப்பட்ட புகைப்படங்களை அனுப்பலாம், அல்லது நான் மோசடி செய்பவர் என்று சொல்லலாம். இவை அனைத்தும் பொய்; இது ஒரு குற்றம். தயவுசெய்து பதில் அனுப்ப வேண்டாம், பணம் அனுப்ப வேண்டாம், எதையும் பகிர வேண்டாம். அதை ஸ்கிரீன்ஷாட் எடுத்து எனக்கு அனுப்புங்கள்; நான் அதை என் காவல்துறை புகாரில் சேர்க்கிறேன்.${n ? ' — ' + n : ''}`
};
function shieldMessage(lang, name) { return (SHIELD_TEXT[lang] || SHIELD_TEXT.en)(String(name || '').trim().slice(0, 60)); }

/* ---------- helpers ---------- */
function uniq(a) { return [...new Set(a)]; }
function fmt(n) { return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function pct(x) { return Math.round(x * 100) + '%'; }
function maskPhone(p) { const d = String(p); return d.length === 10 ? d.slice(0, 2) + 'xxxxx' + d.slice(7) : d; }

const API = { extractFacts, normaliseScript, RIGHTS, rightsFor, callTimes, shieldMessage, truthCheck, RED_FLAG_QUESTIONS, LEXICON, scanMessage, extractIdentifiers, templateSimilarity, buildGraph, PUBLISH_THRESHOLD, GENESIS, sha256Hex, appendEntry, verifyChain, buildPacket, fmt, maskPhone };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LS = API;
})(typeof window !== 'undefined' ? window : globalThis);
