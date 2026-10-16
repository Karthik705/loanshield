// LoanShield 10-slide final deck, macOS style. node deck_mac.js
const pptxgen = require('pptxgenjs'); const path = require('path');
const pres = new pptxgen(); pres.layout = 'LAYOUT_16x9'; pres.title = 'LoanShield';
const LINK = 'https://claude.ai/artifact/RvuocA8TjtWS3NRL1imJfX';
const BG = 'F5F5F7', W = 'FFFFFF', INK = '1D1D1F', MU = '6E6E73', LN = 'E5E5EA', BLUE = '007AFF', RED = 'E5352B', GRN = '1F9D55', ORG = 'FF9500', AMB = 'C77700';
const SDG = { 1: 'E5243B', 8: 'A21942', 10: 'DD1367', 16: '00689D' };
const F = 'Helvetica Neue';
const IMG = n => path.join(__dirname, 'deckimg', n);
const M = 0.6, CW = 8.8; // margin, content width

function slide(title, sub) {
  const s = pres.addSlide(); s.background = { color: BG };
  if (title) s.addText(title, { x: M, y: 0.32, w: CW, h: 0.55, fontFace: F, bold: true, fontSize: 26, color: INK, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: M, y: 0.86, w: CW, h: 0.3, fontFace: F, fontSize: 13, color: MU, margin: 0, isTextBox: true });
  return s;
}
function t(s, text, x, y, w, h, o = {}) { s.addText(text, Object.assign({ x, y, w, h, fontFace: F, fontSize: 12, color: INK, margin: 0, valign: 'top', isTextBox: true }, o)); }
function card(s, x, y, w, h, fill) { s.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: fill || W }, line: { color: LN, width: 0.75 }, shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 10, offset: 2, angle: 90 } }); }
// macOS window: white body, grey title bar, traffic lights, centred title
function win(s, x, y, w, h, title) {
  card(s, x, y, w, h);
  s.addShape('roundRect', { x, y, w, h: 0.34, rectRadius: 0.1, fill: { color: 'ECECEE' }, line: { color: LN, width: 0.75 } });
  s.addShape('rect', { x: x + 0.01, y: y + 0.2, w: w - 0.02, h: 0.14, fill: { color: 'ECECEE' }, line: { color: 'ECECEE', width: 0 } });
  s.addShape('line', { x, y: y + 0.34, w, h: 0, line: { color: LN, width: 0.75 } });
  ['FF5F57', 'FEBC2E', '28C840'].forEach((c, i) => s.addShape('ellipse', { x: x + 0.14 + i * 0.19, y: y + 0.11, w: 0.12, h: 0.12, fill: { color: c }, line: { color: c, width: 0 } }));
  if (title) t(s, title, x + 0.7, y + 0.06, w - 1.4, 0.22, { fontSize: 10.5, bold: true, color: MU, align: 'center', valign: 'middle' });
  return { x: x + 0.22, y: y + 0.5, w: w - 0.44, h: h - 0.65 };
}
function pill(s, text, x, y, fill, w, color) { w = w || text.length * 0.075 + 0.3; s.addText(text, { x, y, w, h: 0.24, shape: 'roundRect', rectRadius: 0.12, fill: { color: fill }, color: color || W, fontFace: F, bold: true, fontSize: 9, align: 'center', valign: 'middle', margin: 0, isTextBox: true }); return w; }
function list(s, items, x, y, w, h, o = {}) { s.addText(items.map((it, j) => ({ text: it, options: { bullet: { indent: 12 }, breakLine: j < items.length - 1 } })), Object.assign({ x, y, w, h, fontFace: F, fontSize: 11, color: INK, valign: 'top', margin: 0, paraSpaceAfter: 4, isTextBox: true }, o)); }
function shot(s, file, x, y, w, title) { const h = w / 1.6; const b = win(s, x, y, w, h + 0.34, title); s.addImage({ path: IMG(file), x: x + 0.005, y: y + 0.35, w: w - 0.01, h: h - 0.01 }); }

// 1 TITLE
let s = slide();
pill(s, 'SOCIAL WORK & SUSTAINABILITY', M, 0.85, RED, 2.6);
t(s, [{ text: 'Loan', options: { color: INK } }, { text: 'Shield', options: { color: BLUE } }], M, 1.25, 4.6, 0.9, { fontSize: 46, bold: true });
t(s, 'Fighting illegal loan app harassment by following the money, not the app name.', M, 2.2, 4.2, 0.7, { fontSize: 16, color: INK });
t(s, 'A five-stage system: community programmes, a shared scam graph, a victim toolkit, legal-aid support and a public dashboard.', M, 3.0, 4.2, 0.7, { fontSize: 12, color: MU });
s.addText([{ text: 'Live toolkit  ', options: { bold: true, color: INK } }, { text: LINK, options: { color: BLUE, hyperlink: { url: LINK } } }], { x: M, y: 3.95, w: 4.6, h: 0.3, fontFace: F, fontSize: 10, margin: 0, isTextBox: true });
t(s, '[Team names] · [Course code] · [Institution]', M, 4.75, 4.4, 0.3, { fontSize: 10.5, color: MU });
shot(s, 'm_hero.jpg', 5.25, 1.15, 4.15, 'LoanShield');
s.addNotes('LoanShield is a socio-technical system. The website is one part of it; the rest is community and institutional work.');

// 2 PROBLEM + SDGs
s = slide('The problem', 'Illegal instant-loan apps trap first-time, low-income borrowers, then blackmail them');
[['Contact blackmail', 'Family and employers get threats'], ['Morphed photos', 'Edited images sent to contacts'], ['Fake legal threats', '"FIR", "digital arrest"'], ['Hidden cost', '₹5,000 promised, ₹3,500 paid, 7 days']].forEach((c, i) => {
  const w = (CW - 0.6) / 4, x = M + i * (w + 0.2); card(s, x, 1.4, w, 1.0); t(s, c[0], x + 0.18, 1.55, w - 0.36, 0.3, { bold: true, fontSize: 13 }); t(s, c[1], x + 0.18, 1.88, w - 0.36, 0.45, { fontSize: 11, color: MU }); });
[['87', 'illegal apps blocked by MeitY (Dec 2025)'], ['2,000+', 'loan apps removed from Play Store'], ['67.8%', 'of cybercrime complaints are financial fraud']].forEach((c, i) => {
  const w = (CW - 0.4) / 3, x = M + i * (w + 0.2); card(s, x, 2.6, w, 1.0); t(s, c[0], x + 0.18, 2.7, w - 0.36, 0.45, { bold: true, fontSize: 24, color: i === 0 ? RED : INK }); t(s, c[1], x + 0.18, 3.17, w - 0.36, 0.35, { fontSize: 10.5, color: MU }); });
t(s, 'Sustainable Development Goals affected', M, 3.85, CW, 0.25, { bold: true, fontSize: 12 });
[[1, 'No Poverty', 'Debt spirals over 2,000%/yr'], [8, 'Decent Work', 'Threats reach the workplace'], [10, 'Equality', 'Least literate targeted most'], [16, 'Justice', 'Victims stay silent']].forEach((c, i) => {
  const w = (CW - 0.6) / 4, x = M + i * (w + 0.2); s.addShape('roundRect', { x, y: 4.18, w, h: 0.95, rectRadius: 0.1, fill: { color: SDG[c[0]] }, line: { color: SDG[c[0]], width: 0 } });
  t(s, 'SDG ' + c[0] + ' · ' + c[1], x + 0.15, 4.27, w - 0.3, 0.3, { bold: true, fontSize: 11.5, color: W }); t(s, c[2], x + 0.15, 4.6, w - 0.3, 0.4, { fontSize: 10.5, color: W }); });
t(s, 'Sources: PIB Dec 2025; Rajya Sabha Q.263, Feb 2024; NCRB via Business Standard.', M, 5.25, CW, 0.2, { fontSize: 8.5, color: MU });
s.addNotes('Four harms, three verified numbers, four SDGs. Telangana police linked 6–8 suicides to loan app harassment in two years.');

// 3 OBJECTIVES
s = slide('Objectives', 'What LoanShield sets out to do');
[['Prevent borrowing from scam apps', 'Show the real cost of a loan and offer a fair alternative through SHGs and microfinance.'], ['Unmask the operator', 'Link rebranded apps through shared UPI IDs, phone numbers and scripts.'], ['Protect victims and their contacts', 'Flag threats and warn contacts first, without reading private messages.'], ['Make evidence and complaints count', 'Tamper-evident evidence, the law each threat breaks, and bundled complaints.'], ['Hold systems to account', 'A public dashboard of operators and time-to-action for regulators.'], ['Leave no one out', 'Indian languages, basic phones (WhatsApp/IVR) and human volunteers.']].forEach((o, i) => {
  const w = (CW - 0.4) / 3, h = 1.75, x = M + (i % 3) * (w + 0.2), y = 1.4 + Math.floor(i / 3) * (h + 0.2);
  card(s, x, y, w, h); s.addShape('ellipse', { x: x + 0.2, y: y + 0.2, w: 0.42, h: 0.42, fill: { color: BLUE }, line: { color: BLUE, width: 0 } });
  t(s, String(i + 1), x + 0.2, y + 0.2, 0.42, 0.42, { bold: true, fontSize: 14, color: W, align: 'center', valign: 'middle' });
  t(s, o[0], x + 0.2, y + 0.72, w - 0.4, 0.45, { bold: true, fontSize: 12, valign: 'bottom' }); t(s, o[1], x + 0.2, y + 1.2, w - 0.4, 0.55, { fontSize: 10.5, color: MU }); });
s.addNotes('Objectives 1 and 5 are delivered mostly by people and partners; the website delivers parts of 2, 3 and 4.');

// 4 WHY EXISTING APPS FALL SHORT
s = slide('There are many scam apps. Why another?', 'Each existing tool protects one phone or one complaint. None connects victims to the operator.');
const b4 = win(s, M, 1.35, CW, 3.85, 'Comparison');
const hd = o => ({ bold: true, color: MU, fontSize: 10, fill: { color: 'FAFAFC' } });
const rows = [['Existing tool', 'What it does', 'What it misses'],
  ['Truecaller, Google spam filters', 'Block known spam numbers on one phone', 'Agents rotate SIMs; contacts still get blackmailed'],
  ['Bank fraud alerts, MuleHunter.AI', 'Flag suspicious accounts inside banks', 'Never see the victim’s threats or evidence'],
  ['RBI DLA list, MeitY Sec. 69A bans', 'List legal apps; block named apps', 'One name at a time; operators rebrand in weeks'],
  ['1930, cybercrime.gov.in, Chakshu', 'Take complaints', 'Each complaint stands alone, with weak evidence'],
  ['LoanShield', 'Links victims’ reports by money trail; protects contacts; organises community help', 'Gives all of the above one operator-level, verified case']];
s.addTable(rows.map((r, i) => r.map(c => ({ text: c, options: i === 0 ? { bold: true, color: MU, fontSize: 10, fill: { color: 'FAFAFC' } } : { fontSize: 11, color: INK, bold: i === 5 && r[0] === c, fill: { color: i === 5 ? 'EAF3FF' : W } } }))),
  { x: b4.x, y: b4.y, w: b4.w, colW: [2.4, 3.0, b4.w - 5.4], fontFace: F, border: { type: 'solid', pt: 0.5, color: LN }, margin: [0.08, 0.1, 0.08, 0.1], valign: 'middle', autoPage: false });
s.addNotes('This is our positioning: we do not compete with Truecaller or bank systems. We sit between victims and these institutions.');

// 5 PIPELINE
s = slide('The LoanShield pipeline', 'Five stages. The website covers parts of three; people and partners carry the rest.');
const st = [['Prevent', 'Community', ORG, ['Truth Check camps at SHGs', 'Fair micro-loans via MFIs', 'WhatsApp / IVR lender check'], false],
  ['Detect', 'Tech', BLUE, ['Shared scam graph', 'Link by UPI, phone, script', 'Public only at 3 reporters'], true],
  ['Protect', 'Tech + people', BLUE, ['Threat scanner', 'Contact Shield warning', 'Counsellor callback'], true],
  ['Respond', 'Community', ORG, ['Hash-chained evidence', 'Legal-aid filing help', 'Bundled case per operator'], true],
  ['Reform', 'Tech', BLUE, ['Public dashboard', 'Quarterly brief to RBI, MeitY', 'Hotspots guide Prevent'], false]];
const sw = (CW - 4 * 0.22) / 5;
st.forEach((c, i) => { const x = M + i * (sw + 0.22), y = 1.5; card(s, x, y, sw, 2.9);
  s.addShape('rect', { x: x + 0.01, y: y + 0.01, w: sw - 0.02, h: 0.07, fill: { color: c[2] }, line: { color: c[2], width: 0 } });
  t(s, (i + 1) + '  ' + c[0], x + 0.16, y + 0.22, sw - 0.3, 0.32, { bold: true, fontSize: 15 }); pill(s, c[1], x + 0.16, y + 0.6, c[2] === ORG ? 'FFF4E5' : 'EAF3FF', null, c[2] === ORG ? AMB : BLUE);
  list(s, c[3], x + 0.16, y + 1.0, sw - 0.3, 1.4, { fontSize: 10.5 });
  if (c[4]) pill(s, 'In the website', x + 0.16, y + 2.5, 'E8E8ED', 1.15, INK);
  if (i < 4) t(s, '›', x + sw + 0.02, y + 1.25, 0.2, 0.4, { fontSize: 20, color: MU, align: 'center' }); });
s.addShape('line', { x: M + sw / 2, y: 4.62, w: CW - sw, h: 0, line: { color: MU, width: 1, dashType: 'dash', beginArrowType: 'triangle' } });
t(s, 'Reform’s hotspots decide where the next Prevent camps run', M, 4.72, CW, 0.25, { fontSize: 11, color: MU, align: 'center' });
s.addShape('roundRect', { x: 3.3, y: 5.1, w: 0.18, h: 0.18, rectRadius: 0.04, fill: { color: ORG }, line: { color: ORG, width: 0 } }); t(s, 'Community-led', 3.55, 5.07, 1.3, 0.24, { fontSize: 10, color: MU });
s.addShape('roundRect', { x: 5.2, y: 5.1, w: 0.18, h: 0.18, rectRadius: 0.04, fill: { color: BLUE }, line: { color: BLUE, width: 0 } }); t(s, 'Tech-led', 5.45, 5.07, 1.3, 0.24, { fontSize: 10, color: MU });
s.addNotes('Walk left to right. Emphasise that Prevent and Reform are mostly people and policy work, not software.');

// 6 PREVENT + DETECT
s = slide('Stages 1–2: Prevent and Detect');
let b = win(s, M, 1.0, 4.3, 4.2, 'Prevent · community-led');
t(s, 'Remove the reason people borrow from scam apps.', b.x, b.y, b.w, 0.4, { bold: true, fontSize: 13 });
list(s, ['Truth Check camps at SHG meetings, colleges and ration shops: turn "₹5,000 loan" into its real yearly cost (2,235% in our example)', 'Fair-credit partners: SHG federations and microfinance institutions give a small, fast, legal loan instead', 'WhatsApp / IVR line checks a lender against RBI’s DLA directory, for basic phones', 'Student volunteers translate and run sessions in Tamil and Hindi'], b.x, b.y + 0.5, b.w, 2.6);
pill(s, 'SDG 1.4', b.x, b.y + 3.25, SDG[1], 0.75); pill(s, 'SDG 1.5', b.x + 0.85, b.y + 3.25, SDG[1], 0.75); pill(s, 'SDG 8.10', b.x + 1.7, b.y + 3.25, SDG[8], 0.8);
b = win(s, 5.1, 1.0, 4.3, 4.2, 'Detect · tech-led');
t(s, 'Find the operator, not just the app name.', b.x, b.y, b.w, 0.4, { bold: true, fontSize: 13 });
s.addImage({ path: IMG('m_graph.jpg'), x: b.x + 0.4, y: b.y + 0.4, w: b.w - 0.8, h: (b.w - 0.8) / 1.6 });
list(s, ['Reports that share a UPI ID, number or ≥50% of a script join one operator', 'Published only after 3 different people report it', 'Operators go to MeitY, Google Play and telecoms as one case'], b.x, b.y + 0.5 + (b.w - 0.8) / 1.6, b.w, 1.1, { fontSize: 10.5 });
s.addNotes('Prevent is entirely a community programme. Detect is the scam graph, which is live in the website and shared by everyone with the link.');

// 7 PROTECT + RESPOND
s = slide('Stages 3–4: Protect and Respond');
b = win(s, M, 1.0, 4.3, 4.2, 'Protect · tech + people');
s.addImage({ path: IMG('m_shield.jpg'), x: b.x, y: b.y, w: b.w, h: b.w / 1.6 });
list(s, ['Threat scanner names the threat and pulls out UPI IDs and numbers, from shared text only', 'Contact Shield: warn contacts first, in English, Hindi or Tamil, so blackmail loses its power', 'Severe threats show 1930 and Tele-MANAS 14416; NGO counsellors call back'], b.x, b.y + b.w / 1.6 + 0.12, b.w, 1.3, { fontSize: 10.5 });
b = win(s, 5.1, 1.0, 4.3, 4.2, 'Respond · community-led');
s.addImage({ path: IMG('m_vault.jpg'), x: b.x, y: b.y, w: b.w, h: b.w / 1.6 });
list(s, ['Evidence vault: SHA-256 hash chain proves nothing was edited (for a Sec. 63 BSA certificate)', 'Rights map: names the RBI rule, BNS or IT Act section each threat may break', 'Law-college legal-aid clinics help file; one bundled case per operator goes to the cyber cell'], b.x, b.y + b.w / 1.6 + 0.12, b.w, 1.3, { fontSize: 10.5 });
s.addNotes('Protect and Respond are where the website does most work, but the counsellors and legal-aid clinics are what make victims actually report.');

// 8 REFORM + WEBSITE + STACK
s = slide('Stage 5: Reform, and where the website fits');
b = win(s, M, 1.0, 2.75, 4.2, 'Reform · tech-led');
list(s, ['Public dashboard: operators, app names per operator, days from first report to action', 'Students publish a quarterly brief to RBI, MeitY and Google Play', 'Regional hotspots feed back into Prevent'], b.x, b.y, b.w, 2.4, { fontSize: 10.5 });
pill(s, 'SDG 16.4', b.x, b.y + 3.1, SDG[16], 0.8); pill(s, 'SDG 16.6', b.x + 0.9, b.y + 3.1, SDG[16], 0.8);
shot(s, 'm_scan.jpg', 3.55, 1.0, 3.3, 'Website (one part)');
t(s, 'Five working tools: loan check, threat scanner, Contact Shield, evidence vault, complaint packet, plus the live scam graph.', 3.55, 3.45, 3.3, 0.6, { fontSize: 10.5, color: MU });
s.addText([{ text: 'Open: ', options: { bold: true } }, { text: 'claude.ai/artifact/RvuocA8TjtWS3NRL1imJfX', options: { color: BLUE, hyperlink: { url: LINK } } }], { x: 3.55, y: 4.15, w: 3.3, h: 0.3, fontFace: F, fontSize: 9.5, color: INK, margin: 0, isTextBox: true });
b = win(s, 7.05, 1.0, 2.35, 4.2, 'Tech stack');
[['Web app', 'HTML, CSS, JS'], ['Graph', 'Union-find + Jaccard'], ['Evidence', 'SHA-256 Web Crypto'], ['Shared data', 'Artifact database'], ['Android (next)', 'Kotlin, TF Lite, ML Kit'], ['Basic phones', 'WhatsApp / IVR bot']].forEach((r, i) => {
  t(s, r[0], b.x, b.y + i * 0.55, b.w, 0.22, { bold: true, fontSize: 10.5 }); t(s, r[1], b.x, b.y + i * 0.55 + 0.22, b.w, 0.28, { fontSize: 9.5, color: MU }); });
s.addNotes('Make clear the website is the digital front door. Reform depends on students and partners publishing and lobbying.');

// 9 NOVELTY + TESTING
s = slide('How we stand out', 'Our novelty, and the evidence it works');
const nov = [['Follows the money trail', 'Links ten app names to one operator by UPI ID, number and script.'], ['Three-person rule', 'Nothing goes public until 3 people report it, so no one can frame a rival.'], ['Disarms the contact list', 'Contact Shield warns family first. No spam app does this.'], ['Names the law broken', 'Each threat mapped to RBI, BNS or IT Act; late-night calls flagged.'], ['Court-ready evidence', 'A hash chain shows nothing was edited after saving.'], ['Community, not just code', 'SHG credit, legal aid and a public dashboard close the loop.']];
nov.forEach((n, i) => { const w = 2.75, h = 1.12, x = M + (i % 2) * (w + 0.2), y = 1.4 + Math.floor(i / 2) * (h + 0.18); card(s, x, y, w, h);
  t(s, n[0], x + 0.18, y + 0.15, w - 0.36, 0.3, { bold: true, fontSize: 12.5 }); t(s, n[1], x + 0.18, y + 0.48, w - 0.36, 0.6, { fontSize: 10.5, color: MU }); });
b = win(s, 6.55, 1.4, 2.85, 3.72, 'Scanner test');
[['100%', 'threats caught (recall)', GRN], ['86%', 'flags correct (precision)', AMB], ['0.93', 'F1 score', INK]].forEach((m, i) => { t(s, m[0], b.x, b.y + i * 0.78, b.w, 0.45, { bold: true, fontSize: 24, color: m[2] }); t(s, m[1], b.x, b.y + i * 0.78 + 0.43, b.w, 0.25, { fontSize: 10, color: MU }); });
t(s, '50 test messages written by the team; real accuracy measured in the pilot.', b.x, b.y + 2.4, b.w, 0.5, { fontSize: 9.5, color: MU, italic: true });
s.addNotes('If asked "Truecaller already exists": Truecaller blocks a number on one phone. We link every victim’s report to the operator and protect the people the scammers actually target, the contacts.');

// 10 CHALLENGES, LIMITATIONS, FUTURE SCOPE
s = slide('Challenges, limitations and future scope');
const cols = [['Challenges', RED, ['Apps rebrand in weeks → link by money trail', 'Android blocks SMS reading → share-in design', 'False reports → 3-person rule, masked numbers', 'Shame stops reporting → volunteers, Contact Shield']],
  ['Limitations', AMB, ['Keyword scanner misses new wording', 'Test set not from the field yet', 'Evidence stored only in the browser', 'Legal mapping is indicative, not advice']],
  ['Future scope', GRN, ['Android app with call screening and OCR', 'Trained model in Tamil, Telugu, Bengali', 'WhatsApp / IVR line for basic phones', 'Graph API for cyber cells and banks; 90-day district pilot']]];
cols.forEach((c, i) => { const w = (CW - 0.4) / 3, x = M + i * (w + 0.2); b = win(s, x, 1.0, w, 3.4, c[0]);
  list(s, c[2], b.x, b.y, b.w, 2.6, { fontSize: 11, paraSpaceAfter: 8 }); s.addShape('rect', { x: x + 0.01, y: 1.35, w: w - 0.02, h: 0.05, fill: { color: c[1] }, line: { color: c[1], width: 0 } }); });
card(s, M, 4.6, CW, 0.65);
t(s, [{ text: 'Safer loans. Stronger people.  ', options: { bold: true, fontSize: 14 } }, { text: 'Help: 1930 · cybercrime.gov.in · Tele-MANAS 14416', options: { fontSize: 11, color: MU } }], M + 0.25, 4.62, CW - 0.5, 0.6, { valign: 'middle' });
s.addNotes('Close with the pilot: one SHG federation, one legal-aid clinic and the district cyber cell, for 90 days.');

pres.writeFile({ fileName: path.join(__dirname, 'LoanShield_Final_10.pptx') }).then(() => console.log('ok'));
