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

/* ---------------- languages, read-aloud, helper mode ---------------- */
const T = {
  en: { h1: 'Their threats are <span class="flipword">your evidence.</span>', lede: 'Other tools try to block the threats. LoanShield turns each one into a fact for the victim and evidence against the operator.', cta: 'Flip a threat', listen: 'Listen', tryH2: 'Paste what they sent. Watch it flip.', msgLabel: 'Their message', flipBtn: 'Flip it', privacy: 'Checked on this device. Nothing is sent anywhere unless you choose to share it.', fact: 'The fact', tap: 'Tap to flip', back: 'Tap to see the threat', flipped: n => `${n} threat${n > 1 ? 's' : ''} flipped`, caseH: 'Your case is building', hero: 'Their threats are your evidence. A morphed photo is fake, and making it is a crime. No one can arrest you over a WhatsApp message.' },
  ta: { h1: 'அவர்களின் மிரட்டல்களே <span class="flipword">உங்கள் ஆதாரம்.</span>', lede: 'பயமுறுத்தும் ஒவ்வொரு செய்திக்கும் உண்மை என்ன, எந்தச் சட்டம் மீறப்படுகிறது என்று LoanShield சொல்லும். அந்தச் செய்தியே அவர்களுக்கு எதிரான ஆதாரமாகும்.', cta: 'மிரட்டலைச் சரிபார்', listen: 'கேளுங்கள்', tryH2: 'அவர்கள் அனுப்பியதை இங்கே ஒட்டுங்கள்.', msgLabel: 'அவர்கள் அனுப்பிய செய்தி', flipBtn: 'சரிபார்', privacy: 'இது உங்கள் போனிலேயே சரிபார்க்கப்படும். நீங்கள் பகிராமல் எதுவும் வெளியே போகாது.', fact: 'உண்மை', tap: 'திருப்ப தொடவும்', back: 'மிரட்டலைப் பார்க்க தொடவும்', flipped: n => `${n} மிரட்டல்கள் சரிபார்க்கப்பட்டன`, caseH: 'உங்கள் வழக்கு உருவாகிறது', hero: 'அவர்களின் மிரட்டல்களே உங்கள் ஆதாரம். மாற்றப்பட்ட புகைப்படம் போலியானது; அதை உருவாக்குவதே குற்றம். வாட்ஸ்அப் செய்தி மூலம் யாரும் உங்களைக் கைது செய்ய முடியாது.' },
  hi: { h1: 'उनकी धमकियाँ ही <span class="flipword">आपका सबूत हैं।</span>', lede: 'LoanShield हर डरावने मैसेज का सच बताता है, कौन-सा कानून टूटा है, और उसी मैसेज को उनके ख़िलाफ़ सबूत बना देता है।', cta: 'धमकी जाँचें', listen: 'सुनें', tryH2: 'उन्होंने जो भेजा, यहाँ चिपकाएँ।', msgLabel: 'उनका मैसेज', flipBtn: 'जाँचें', privacy: 'यह आपके फ़ोन पर ही जाँचा जाता है। आपकी मर्ज़ी के बिना कुछ भी बाहर नहीं जाता।', fact: 'सच', tap: 'पलटने के लिए छुएँ', back: 'धमकी देखने के लिए छुएँ', flipped: n => `${n} धमकियाँ जाँची गईं`, caseH: 'आपका केस बन रहा है', hero: 'उनकी धमकियाँ ही आपका सबूत हैं। बदली हुई फ़ोटो नकली है, और उसे बनाना अपराध है। WhatsApp मैसेज से कोई आपको गिरफ़्तार नहीं कर सकता।' }
};
const FACTS_L = {
  ta: {
    legal: ['போலி சட்ட மிரட்டல்', 'வாட்ஸ்அப் செய்தி மூலம் யாரும் உங்களைக் கைது செய்ய முடியாது.', 'காவல்துறை FIR அல்லது வாரண்டை சாட்டில் அனுப்பாது. கடனைத் திருப்பிச் செலுத்தாதது பொதுவாகக் குற்றம் அல்ல. இப்படிப் போலியாக மிரட்டுவதே குற்றம்.'],
    image: ['புகைப்பட மிரட்டல்', 'மாற்றப்பட்ட புகைப்படம் போலியானது; அதை உருவாக்குவதே குற்றம்.', 'உங்கள் தொடர்புகளிடம் முதலில் நீங்களே சொல்லுங்கள். அப்போது அவர்களின் மிரட்டல் பலனளிக்காது.'],
    contacts: ['தொடர்புகளுக்கு மிரட்டல்', 'உங்கள் குடும்பத்தையும் நண்பர்களையும் தொந்தரவு செய்ய அவர்களுக்கு உரிமை இல்லை.', 'அவர்கள் அனுப்பும் முன் உங்கள் தொடர்புகளுக்கு எச்சரிக்கை அனுப்புங்கள்.'],
    shame: ['அவமானப்படுத்துதல்', 'கடன் தாமதமானால் நீங்கள் மோசடிக்காரர் அல்ல.', 'உங்களை மற்றவர்களிடம் திருடன் என்று சொல்வது அவதூறு ஆகலாம். நீங்கள் எந்தக் குற்றமும் செய்யவில்லை.'],
    violence: ['உடல் தீங்கு மிரட்டல்', 'இது குற்றவியல் மிரட்டல். உங்கள் பாதுகாப்பே முதலில்.', 'இப்போது ஆபத்து என்றால் 112-ஐ அழையுங்கள். அவர்கள் அனுப்பும் யாரையும் சந்திக்க வேண்டாம்.'],
    urgency: ['அழுத்தம்', 'இந்தக் கெடு உங்களைப் பயமுறுத்தவே.', 'பணம் கட்டினால் இன்னும் அதிகக் கோரிக்கைகள் வரும். முதலில் இந்தச் செய்தியைச் சேமியுங்கள்.'],
    fees: ['கூடுதல் கட்டணம்', 'நீங்கள் ஒப்புக்கொள்ளாத கட்டணங்கள் எச்சரிக்கை அறிகுறி.', 'முறையான கடன் நிறுவனங்கள் எல்லாக் கட்டணங்களையும் கையெழுத்துக்கு முன்பே காட்ட வேண்டும்.'],
    time: ['அழைப்பு நேரம்', 'இந்த நேரத்தில் வசூல் அழைப்புகள் அனுமதிக்கப்படவில்லை.', 'காலை 8 மணி முதல் இரவு 7 மணி வரை மட்டுமே அழைக்கலாம். ஒவ்வொரு இரவு அழைப்பையும் குறித்து வையுங்கள்.']
  },
  hi: {
    legal: ['नकली कानूनी धमकी', 'WhatsApp मैसेज से कोई आपको गिरफ़्तार नहीं कर सकता।', 'पुलिस FIR या वारंट चैट पर नहीं भेजती। लोन न चुका पाना आम तौर पर अपराध नहीं है। ऐसी नकली धमकी देना खुद अपराध है।'],
    image: ['फ़ोटो की धमकी', 'बदली हुई (मॉर्फ़) फ़ोटो नकली है, और उसे बनाना अपराध है।', 'अपने संपर्कों को पहले खुद बता दें। फिर उनकी धमकी बेअसर हो जाएगी।'],
    contacts: ['संपर्कों को धमकी', 'आपके परिवार और दोस्तों को परेशान करने का उन्हें कोई हक़ नहीं।', 'उनके भेजने से पहले अपने संपर्कों को चेतावनी भेज दें।'],
    shame: ['गाली और बदनामी', 'लोन में देरी से आप धोखेबाज़ नहीं बन जाते।', 'दूसरों से आपको चोर कहना मानहानि हो सकता है। आपने कोई अपराध नहीं किया।'],
    violence: ['हिंसा की धमकी', 'यह आपराधिक धमकी है। आपकी सुरक्षा सबसे पहले।', 'अभी ख़तरा लगे तो 112 पर कॉल करें। उनके भेजे किसी से न मिलें।'],
    urgency: ['दबाव', 'यह समय-सीमा सिर्फ़ डराने के लिए है।', 'पैसे देने से और माँगें आती हैं। पहले यह मैसेज सेव करें।'],
    fees: ['अतिरिक्त शुल्क', 'जिन शुल्कों पर आपने सहमति नहीं दी, वे ख़तरे का संकेत हैं।', 'सही लोन कंपनियाँ सभी शुल्क साइन करने से पहले दिखाती हैं।'],
    time: ['कॉल का समय', 'इस समय वसूली कॉल की अनुमति नहीं है।', 'सिर्फ़ सुबह 8 से शाम 7 बजे तक कॉल की जा सकती है। हर देर रात की कॉल नोट करें।']
  }
};
FACTS.time = { who: 'Call time', head: 'Recovery calls at this hour are not allowed.', body: 'RBI rules allow recovery calls only between 8 am and 7 pm. Log every late call.' };
function factFor(cat) { const l = FACTS_L[state.lang]; if (l && l[cat]) return { who: l[cat][0], head: l[cat][1], body: l[cat][2] }; return FACTS[cat]; }
const tr = k => (T[state.lang] || T.en)[k];
state.lang = store.get('loanshield_lang', 'en');
function applyLang(l) {
  state.lang = T[l] ? l : 'en'; store.set('loanshield_lang', state.lang);
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach(e => { e.textContent = tr(e.dataset.i18n); });
  $$('[data-i18n-html]').forEach(e => { e.innerHTML = tr(e.dataset.i18nHtml); });
  $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === state.lang));
  if (state.flip) flip(state.flip.text);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) applyLang(b.dataset.lang); });

const VOICE = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('This phone can’t read aloud. A helper can read the cards instead.'); return; }
  const synth = window.speechSynthesis; synth.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = VOICE[state.lang]; u.rate = .92;
  const vs = synth.getVoices(), v = vs.find(x => x.lang && x.lang.toLowerCase().startsWith(state.lang));
  if (v) u.voice = v; else if (vs.length && state.lang !== 'en') toast('No ' + (state.lang === 'ta' ? 'Tamil' : 'Hindi') + ' voice on this phone. Install one in phone settings, or ask a helper.');
  synth.speak(u);
}
function speakFacts() {
  if (!state.flip) return speak(tr('hero'));
  const cats = state.flip.scan.hits.map(h => h.cat).filter(c => FACTS[c]);
  if (state.flip.late.length) cats.push('time');
  speak(cats.map(c => { const f = factFor(c); return f.head + ' ' + f.body; }).join(' '));
}
$('#hero-listen').addEventListener('click', () => speak(tr('hero')));
function setHelper(on) {
  document.documentElement.classList.toggle('helper', on); $('#helper-steps').hidden = !on;
}
$('#go-diy').addEventListener('click', () => { setHelper(false); $('#flip').scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('#msg').focus({ preventScroll: true }), 500); });
$('#go-helper').addEventListener('click', () => { setHelper(true); $('#flip').scrollIntoView({ behavior: 'smooth' }); toast('Helper mode on: bigger text and simple steps'); });
$('#go-callback').addEventListener('click', () => { state.callReason = 'threats'; openDlg('dlg-call'); });
function leakText() {
  const pf = $('#lk-platform').value, link = $('#lk-link').value.trim();
  return `To: ${pf} Grievance Officer\nSubject: Urgent removal: morphed intimate image of me, shared without consent\n\nI am the person shown in ${link ? 'this post: ' + link : 'an image posted on your platform'}. The image is fake (morphed) and was shared without my consent by people harassing me over an illegal loan app.\n\nUnder Rule 3(2)(b) of the IT Rules, 2021 (as amended), please remove it, and block copies of it, within the time the rules require. I can confirm my identity on request.\n\nDate: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}
function renderLeak() { $('#lk-out').value = leakText(); }
$('#lk-platform').addEventListener('change', renderLeak); $('#lk-link').addEventListener('input', renderLeak);
$('#lk-copy').addEventListener('click', () => copyText(leakText(), $('#lk-out'), 'Request copied. Paste it into the platform’s report form.'));
$('#go-leak').addEventListener('click', () => { renderLeak(); openDlg('dlg-leak'); });
$('#lk-call').addEventListener('click', () => { state.callReason = 'photo'; $('#dlg-leak').close(); $('#cb-woman').checked = true; openDlg('dlg-call'); });
$('#call-form').addEventListener('submit', async e => {
  e.preventDefault();
  const phone = $('#cb-phone').value.replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) { $('#cb-error').textContent = 'Enter a 10-digit mobile number, like 98765 43210.'; return; }
  $('#cb-error').textContent = '';
  const when = $('input[name=cb-time]:checked').value, langName = { en: 'English', ta: 'Tamil', hi: 'Hindi' }[state.lang];
  let saved = false;
  if (state.live.db && state.live.uid) {
    try { await state.live.db.doc('callbacks/' + state.live.uid).set({ name: $('#cb-name').value.trim().slice(0, 40), phone, lang: state.lang, when, woman: $('#cb-woman').checked, reason: state.callReason || 'threats', ts: Date.now() }); saved = true; } catch (x) { saved = false; }
  }
  $('#call-body').innerHTML = saved
    ? `<div class="sent"><span class="big">${ico('i-check')}</span><h3>Request sent</h3><p>A volunteer will call <b>${esc(LS.maskPhone(phone))}</b> in the ${esc(when.toLowerCase())}, in ${esc(langName)}. Meanwhile, don’t pay and don’t reply to them.</p><p class="small muted">They will never ask you for money, an OTP or bank details.</p><button class="btn ghost sm" type="button" data-close>Close</button></div>`
    : `<div class="sent"><span class="big">${ico('i-phone')}</span><h3>Call-backs run on the pilot link</h3><p>This copy of the site can’t send requests yet. Until then, visit the weekly help desk at your SHG meeting, or ask someone you trust to sit with you and choose <b>Someone is with me</b>.</p><button class="btn ghost sm" type="button" data-close>Close</button></div>`;
});
async function startInbox(user) {
  try { if (!user || !(await user.isOwner())) return; } catch (e) { return; }
  const box = $('#inbox'); box.hidden = false;
  state.live.db.collection('callbacks').onSnapshot(snap => {
    const rows = snap.docs.map(d => d.data() || {}).sort((x, y) => (y.ts || 0) - (x.ts || 0));
    box.innerHTML = `<h3><span>Volunteer inbox (only you see this)</span><span class="muted small">${rows.length} request${rows.length === 1 ? '' : 's'}</span></h3>` +
      (rows.length ? `<ul>${rows.map(r => `<li><b>${esc(r.name || 'No name')}</b><span>${esc(String(r.phone || ''))}</span><span>${esc({ en: 'English', ta: 'Tamil', hi: 'Hindi' }[r.lang] || '')}</span><span>${esc(r.when || '')}</span>${r.woman ? '<span>Woman volunteer</span>' : ''}${r.reason === 'photo' ? '<b style="color:var(--threat)">Leaked photo</b>' : ''}<span class="muted">${r.ts ? esc(new Date(r.ts).toLocaleString('en-IN')) : ''}</span></li>`).join('')}</ul>` : '<p class="small muted" style="margin-top:.4rem">No call-back requests yet.</p>');
  }, () => { box.hidden = true; });
}

/* ---------------- voice & screenshot to info, one tap ---------------- */
Object.assign(T.en, { startH2: 'How would you like to do this?', diyH: 'I can use my phone', diyP: 'Paste the message, speak it, or upload a screenshot. It takes about a minute.', diyBtn: 'Start', helpH: 'I need help with this', helpP: 'Pick your language. Everything can be read out loud.', withMe: 'Someone is with me', withMeSub: 'Big text, 4 simple steps, read aloud', callMe: 'Call me back', callMeSub: 'A trained volunteer calls you', cta: 'Get started' });
Object.assign(T.ta, { startH2: 'இதை எப்படிச் செய்ய விரும்புகிறீர்கள்?', diyH: 'நானே போனில் செய்வேன்', diyP: 'செய்தியை ஒட்டுங்கள், பேசுங்கள், அல்லது ஸ்கிரீன்ஷாட் பதிவேற்றுங்கள். ஒரு நிமிடம் போதும்.', diyBtn: 'தொடங்கு', helpH: 'எனக்கு உதவி வேண்டும்', helpP: 'உங்கள் மொழியைத் தேர்ந்தெடுங்கள். எல்லாவற்றையும் சத்தமாகப் படிக்கலாம்.', withMe: 'என்னுடன் ஒருவர் இருக்கிறார்', withMeSub: 'பெரிய எழுத்து, 4 எளிய படிகள்', callMe: 'என்னை அழையுங்கள்', callMeSub: 'பயிற்சி பெற்ற தன்னார்வலர் அழைப்பார்', cta: 'தொடங்குங்கள்' });
Object.assign(T.hi, { startH2: 'आप यह कैसे करना चाहेंगे?', diyH: 'मैं फ़ोन चला सकता/सकती हूँ', diyP: 'मैसेज चिपकाएँ, बोलकर बताएँ, या स्क्रीनशॉट डालें। लगभग एक मिनट लगता है।', diyBtn: 'शुरू करें', helpH: 'मुझे मदद चाहिए', helpP: 'अपनी भाषा चुनें। सब कुछ पढ़कर सुनाया जा सकता है।', withMe: 'कोई मेरे साथ है', withMeSub: 'बड़े अक्षर, 4 आसान कदम', callMe: 'मुझे कॉल करें', callMeSub: 'प्रशिक्षित वॉलंटियर कॉल करेगा', cta: 'शुरू करें' });
Object.assign(T.en, { speak: 'Speak it', shot: 'Upload a screenshot', understood: 'We understood', oneTap: 'Protect me in one tap', oneTapSub: 'Seals this message as evidence, adds their UPI ID and number to the operator map, and writes your contact warning and complaint.', protect: 'Protect me', doneH: 'Done. Now, in the next hour:', st1: 'Don’t pay and don’t reply. Paying brings new demands.', st2: 'Send the warning to your contacts before they do.', st3: 'Take the complaint to a legal-aid clinic or an NGO helpdesk.', wa: 'Send on WhatsApp', copy: 'Copy complaint', listening: 'Listening… speak now', reading: 'Reading the screenshot…' });
Object.assign(T.ta, { speak: 'பேசுங்கள்', shot: 'ஸ்கிரீன்ஷாட்', understood: 'நாங்கள் புரிந்தது', oneTap: 'ஒரே தொடுதலில் பாதுகாப்பு', oneTapSub: 'இந்தச் செய்தியை ஆதாரமாகச் சேமித்து, உங்கள் தொடர்புகளுக்கான எச்சரிக்கையையும் புகாரையும் தயார் செய்யும்.', protect: 'என்னைப் பாதுகா', doneH: 'முடிந்தது. அடுத்த ஒரு மணி நேரத்தில்:', st1: 'பணம் கட்ட வேண்டாம், பதில் அனுப்ப வேண்டாம்.', st2: 'அவர்கள் அனுப்பும் முன் உங்கள் தொடர்புகளுக்கு எச்சரிக்கை அனுப்புங்கள்.', st3: 'புகாரை சட்ட உதவி மையம் அல்லது NGO உதவி மையத்திடம் கொண்டு செல்லுங்கள்.', wa: 'வாட்ஸ்அப்பில் அனுப்பு', copy: 'புகாரை நகலெடு', listening: 'கேட்கிறது… இப்போது பேசுங்கள்', reading: 'ஸ்கிரீன்ஷாட்டைப் படிக்கிறது…' });
Object.assign(T.hi, { speak: 'बोलकर बताएँ', shot: 'स्क्रीनशॉट', understood: 'हमने समझा', oneTap: 'एक टैप में सुरक्षा', oneTapSub: 'यह मैसेज सबूत के रूप में सेव करता है, और आपके संपर्कों के लिए चेतावनी और शिकायत तैयार करता है।', protect: 'मुझे बचाएँ', doneH: 'हो गया। अब अगले एक घंटे में:', st1: 'पैसे न दें और जवाब न दें।', st2: 'उनसे पहले अपने संपर्कों को चेतावनी भेजें।', st3: 'शिकायत लीगल-एड क्लिनिक या NGO हेल्पडेस्क ले जाएँ।', wa: 'WhatsApp पर भेजें', copy: 'शिकायत कॉपी करें', listening: 'सुन रहा है… अब बोलिए', reading: 'स्क्रीनशॉट पढ़ रहा है…' });

function understoodHtml(text) {
  const f = LS.extractFacts(text), chips = [];
  if (f.app) chips.push(`<span class="chip"><i>App</i>${esc(f.app)}</span>`);
  f.amounts.forEach(a => chips.push(`<span class="chip"><i>Amount</i>₹${LS.fmt(a)}</span>`));
  f.upi.forEach(u => chips.push(`<span class="chip"><i>UPI</i>${esc(u)}</span>`));
  f.phones.forEach(p => chips.push(`<span class="chip"><i>Phone</i>${esc(LS.maskPhone(p))}</span>`));
  f.times.forEach(t => chips.push(`<span class="chip ${t.outside ? 'warn' : ''}"><i>Time</i>${esc(t.raw)}${t.outside ? ' · after 7 pm' : ''}</span>`));
  return chips.length ? `<div class="understood rise"><span class="lbl">${esc(tr('understood'))}</span>${chips.join('')}</div>` : '';
}
function oneTapHtml() {
  const done = state.oneTapDone === (state.flip && state.flip.text);
  if (!done) return `<div class="onetap rise" id="onetap"><div><h3>${ico('i-bolt')}${esc(tr('oneTap'))}</h3><p>${esc(tr('oneTapSub'))}</p></div><button class="btn gold" type="button" id="protect-btn">${ico('i-shield')}${esc(tr('protect'))}</button></div>`;
  return `<div class="onetap rise" id="onetap"><h3>${ico('i-check')}${esc(tr('doneH'))}</h3>
    <div class="hour"><div><b>1</b><p>${esc(tr('st1'))}</p></div>
    <div><b>2</b><p>${esc(tr('st2'))}</p><a class="btn gold sm" id="ot-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shieldText())}">${esc(tr('wa'))}</a></div>
    <div><b>3</b><p>${esc(tr('st3'))}</p><button class="btn line sm" type="button" id="ot-copy">${ico('i-copy')}${esc(tr('copy'))}</button></div></div></div>`;
}
function wireOneTap() {
  const b = $('#protect-btn'); if (b) b.addEventListener('click', protectAll);
  const w = $('#ot-wa'); if (w) w.addEventListener('click', () => { shieldSent(); });
  const c = $('#ot-copy'); if (c) c.addEventListener('click', async () => { await refreshPacket(); copyText($('#packet-out').value, $('#packet-out'), 'Complaint copied'); });
}
async function protectAll() {
  const f = state.flip; if (!f) return;
  const b = $('#protect-btn'); if (b) b.disabled = true;
  if (!state.chain.some(e => e.text === f.text)) await addToVault('message', f.text);
  const ids = f.scan.ids;
  if (ids.upi.length + ids.phones.length && !state.myReports.some(r => r.text === f.text)) await reportFlip();
  await refreshPacket();
  state.oneTapDone = f.text;
  $('#onetap').outerHTML = oneTapHtml(); wireOneTap(); renderCase();
  toast('Sealed, linked and ready');
}

/* voice: the phone's own speech-to-text, in the chosen language */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
$('#mic-btn').addEventListener('click', () => {
  const btn = $('#mic-btn'), st = $('#in-status');
  if (rec) { rec.stop(); return; }
  if (!SR) { toast('Voice typing needs Chrome on Android or desktop. You can also use the microphone on your keyboard.'); $('#msg').focus(); return; }
  rec = new SR(); rec.lang = VOICE[state.lang]; rec.interimResults = true; rec.continuous = true;
  const base = $('#msg').value.trim() && !EXAMPLES.includes($('#msg').value.trim()) ? $('#msg').value.trim() + ' ' : '';
  let finalText = '';
  rec.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; } $('#msg').value = base + finalText + interim; };
  rec.onerror = e => { toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The microphone is blocked here. Open the public link, or use the microphone on your keyboard.' : 'Couldn’t hear that. Try again.'); };
  rec.onend = () => { rec = null; btn.setAttribute('aria-pressed', 'false'); st.textContent = ''; if ($('#msg').value.trim()) flip($('#msg').value, { scroll: true }); };
  try { $('#msg').value = base; rec.start(); btn.setAttribute('aria-pressed', 'true'); st.textContent = tr('listening'); } catch (e) { rec = null; toast('Couldn’t start the microphone.'); }
});

/* screenshot: Claude reads the image (Claude link only) */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  } catch (e) { return file; }
}
$('#shot-in').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
  const st = $('#in-status');
  let ok = false; try { ok = !!(state.sample && (await state.sample.limits()).images); } catch (x) {}
  if (!ok) { toast('Reading screenshots works on the Claude link. Here, type or speak the message.'); return; }
  st.textContent = tr('reading');
  try {
    const img = await shrink(file);
    const a = await state.sample.json('This is a screenshot a victim of an illegal Indian loan app received (WhatsApp, SMS or call log). Copy out every message from the lender or recovery agent exactly as written, in its original language, including amounts, UPI IDs, phone numbers and times. Ignore phone UI chrome. Reply with JSON only: {"text": "<the messages, one per line>", "found": true|false}.', { images: [img], modelTier: 'quick' });
    if (!a || !a.found || !a.text) { toast('No message found in that image. Try a clearer screenshot.'); return; }
    $('#msg').value = String(a.text).slice(0, 3000); flip($('#msg').value, { scroll: true });
  } catch (x) { toast(x && x.code === 'rate_limited' ? 'Too many requests. Try again in a minute.' : 'Couldn’t read the screenshot. Type or speak the message instead.'); }
  finally { st.textContent = ''; }
});

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

const ICON = { legal: 'i-scale', image: 'i-image', contacts: 'i-users', shame: 'i-chat', violence: 'i-alert', urgency: 'i-clock', fees: 'i-rupee', time: 'i-clock' };
function card(kind, icon, quoteHtml, head, body, laws) {
  return `<button type="button" class="fcard" aria-label="${esc(kind)}: show the fact"><span class="inner">
    <span class="face front"><span class="kind"><span class="ic">${ico(icon)}</span>${esc(kind)}</span><q>${quoteHtml}</q><span class="turn">${ico('i-flip')}${tr('tap')}</span></span>
    <span class="face back"><span class="kind"><span class="ic">${ico('i-check')}</span>${tr('fact')}</span><b>${esc(head)}</b><p>${esc(body)}</p>${laws.length ? `<span class="laws">${laws.map(l => `<span class="law">${esc(l)}</span>`).join('')}</span>` : ''}<span class="turn">${ico('i-flip')}${tr('back')}</span></span>
  </span></button>`;
}
function flip(text, opts) {
  text = text.trim();
  const box = $('#result');
  if (!text) { box.innerHTML = ''; state.flip = null; return; }
  const scan = LS.scanMessage(text);
  const rights = LS.rightsFor(scan, text);
  const late = LS.callTimes(text).filter(t => t.outside);
  state.flip = { text, scan, rights, late };
  const hits = scan.hits.slice().sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat));
  const cards = hits.filter(h => FACTS[h.cat]).map(h => {
    const f = factFor(h.cat);
    const laws = (RULE_FOR[h.cat] || []).map(id => LS.RIGHTS[id].short);
    if ((h.cat === 'urgency' || h.cat === 'contacts') && rights.some(r => r.id === 'bns308')) laws.push(LS.RIGHTS.bns308.short);
    return card(f.who, ICON[h.cat], quote(text, h.phrases[0]), f.head, f.body, [...new Set(laws)]);
  });
  late.forEach(t => { const f = factFor('time'); cards.push(card(f.who, 'i-clock', `<mark>${esc(t.raw)}</mark>`, f.head, f.body, ['RBI calling hours'])); });
  const n = cards.length;
  box.innerHTML = `
    <div class="verdict rise"><span class="pill ${scan.level}">${esc(scan.levelLabel)}</span>
      <div class="meter" aria-label="Threat score ${scan.score} out of 100"><span class="small muted">Calm</span><span class="track"><i style="left:${Math.max(4, Math.min(96, scan.score))}%"></i></span><span class="small muted">Severe</span></div>
      ${n ? `<span class="hint">${ico('i-flip')}${tr('flipped')(n)}</span><button class="btn primary sm listen-btn" type="button" id="listen-facts">${ico('i-sound')}${tr('listen')}</button>` : ''}</div>
    ${understoodHtml(text)}
    ${n ? `<div class="cards">${cards.join('')}</div>` : `<div class="none rise"><b>No threat words found.</b> <span class="muted">If it still frightened you, seal it anyway. The word list can miss new wording${state.sample ? ', so try the AI reading below' : ''}.</span></div>`}
    ${scan.needsSupport ? `<div class="support rise"><span>You don’t have to pay to make this stop.</span><span class="n"><b>1930</b>cybercrime</span><span class="n"><b>14416</b>Tele-MANAS</span>${hits.some(h => h.cat === 'violence') ? '<span class="n"><b>112</b>danger</span>' : ''}</div>` : ''}
    ${oneTapHtml()}
    <div class="case rise" id="case"></div>
    ${state.sample ? `<div class="ai" id="ai-box"><button class="link-btn" type="button" id="ai-btn">Not sure? Ask AI to read it, in any language</button></div>` : ''}`;
  $$('#result .fcard').forEach((c, i) => {
    c.addEventListener('click', () => c.classList.toggle('flipped'));
    setTimeout(() => c.classList.add('flipped'), 650 + i * 350);
  });
  renderCase();
  const ai = $('#ai-btn'); if (ai) ai.addEventListener('click', () => askAI(text));
  const lf = $('#listen-facts'); if (lf) lf.addEventListener('click', speakFacts);
  wireOneTap();
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
  const cl = matchCluster(ids);
  const hasIds = ids.upi.length + ids.phones.length > 0;
  const reported = state.myReports.some(r => r.text === f.text);
  const steps = [
    { on: !!saved, icon: 'i-lock', t: saved ? 'Sealed' : 'Seal it', d: saved ? `Item #${state.chain.indexOf(saved) + 1} · <code>${saved.hash.slice(0, 8)}</code>` : 'Tamper-proof evidence',
      act: saved ? `<button class="btn ghost sm" type="button" data-open="dlg-vault">View all</button>` : `<button class="btn primary sm" type="button" id="seal">Seal</button>` },
    { on: f.rights.length > 0, icon: 'i-scale', t: `${f.rights.length} law${f.rights.length === 1 ? '' : 's'}`, d: f.rights.length ? f.rights.map(r => esc(r.short)).join(', ') : 'None matched', act: '' },
    { on: !!cl, icon: 'i-link', t: cl ? cl.id : 'Operator', d: cl ? `${cl.reporters} people · ${cl.apps.length} app names` : hasIds ? 'No match yet' : 'No UPI ID or number',
      act: hasIds ? (reported ? '<span class="small muted">Shared</span>' : `<button class="btn ghost sm" type="button" id="report">Share IDs</button>`) : '' },
    { on: !!state.shieldSent, icon: 'i-users', t: 'Warn contacts', d: 'Before they do', act: `<button class="btn ghost sm" type="button" data-open="dlg-shield">${state.shieldSent ? 'Sent' : 'Write it'}</button>` },
    { on: false, icon: 'i-doc', t: 'Complaint', d: 'For legal aid or 1930', act: `<button class="btn ghost sm" type="button" data-open="dlg-packet">Build</button>` }
  ];
  const on = steps.filter(s => s.on).length;
  const last = steps.reduce((m, s, i) => s.on ? i : m, -1);
  el.innerHTML = `<div class="case-head"><h3>${tr('caseH')}</h3><span class="score num">${on} / 5</span></div>
    <ol class="steps"><span class="fill" style="width:${last > 0 ? last * 20 : 0}%"></span>${steps.map(s => `<li class="${s.on ? 'on' : ''}"><span class="node">${ico(s.on ? 'i-check' : s.icon)}</span><div><div class="t">${s.t}</div><div class="d">${s.d}</div></div><div class="act">${s.act}</div></li>`).join('')}</ol>
    ${hasIds && !reported ? `<p class="consent">Sharing adds only the UPI IDs, numbers and wording to the operator map${state.live.canWrite ? ' for everyone with this link' : ' on this device'}. Never your name or contacts.</p>` : ''}`;
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

if ($('#check-form')) {
/* ---------------- Before you borrow ---------------- */
LS.RED_FLAG_QUESTIONS.forEach(q => $('#c-questions').insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" value="${q.id}"><span>${esc(q.q)}</span></label>`));
function runCheck(e) {
  const g = id => +$(id).value;
  // keep the sliders consistent: received ≤ promised, repay ≥ received
  if (g('#c-received') > g('#c-promised')) { if (e && e.target.id === 'c-promised') $('#c-received').value = g('#c-promised'); else $('#c-promised').value = g('#c-received'); }
  if (g('#c-repay') < g('#c-received')) $('#c-repay').value = g('#c-received');
  $('#o-promised').textContent = '₹' + LS.fmt(g('#c-promised'));
  $('#o-received').textContent = '₹' + LS.fmt(g('#c-received'));
  $('#o-repay').textContent = '₹' + LS.fmt(g('#c-repay'));
  $('#o-days').textContent = g('#c-days') + ' days';
  const input = { promised: g('#c-promised'), received: g('#c-received'), repay: g('#c-repay'), days: g('#c-days'), answers: $$('#c-questions input:checked').map(i => i.value) };
  const r = LS.truthCheck(input), out = $('#check-out');
  if (r.error) { out.innerHTML = `<p>${esc(r.error)}</p>`; state.truth = null; return; }
  state.truth = { ...input, apr: r.apr, app: '' };
  const apr = Math.round(r.apr), scale = Math.max(apr, 50);
  const bars = [['This app', apr, 'them'], ['Credit card', 42, ''], ['SHG / MFI loan', 26, '']];
  out.innerHTML = `<span class="eyebrow">Real yearly cost</span>
    <div class="apr ${r.verdict}">${LS.fmt(apr)}%</div>
    <p class="apr-sub">₹${LS.fmt(r.totalCost)} extra on ₹${LS.fmt(input.received)}. That’s ₹${LS.fmt(Math.round(r.perDay))} every day.</p>
    <div class="compare">${bars.map(([l, x, c]) => `<div class="bar ${c}"><span>${l}</span><span class="track"><i style="width:${Math.max(2, Math.min(100, x / scale * 100))}%"></i></span><span class="v">${LS.fmt(x)}%</span></div>`).join('')}</div>
    ${r.flags.length ? `<ul class="flag-list">${r.flags.slice(0, 3).map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
    <p class="safer">${r.verdict === 'ok' ? 'No major warning signs. Still ask for the Key Fact Statement.' : 'Safer: ask your self-help group or a microfinance institution, or check the lender in RBI’s Digital Lending Apps directory.'}</p>`;
}
['#c-promised', '#c-received', '#c-repay', '#c-days'].forEach(id => $(id).addEventListener('input', runCheck));
$('#c-questions').addEventListener('change', runCheck);
$('#check-form').addEventListener('submit', e => { e.preventDefault(); runCheck(); });
runCheck();

}
/* ---------------- system loop ---------------- */
const STAGES = [
  { n: 'Prevent', icon: 'i-calc', app: false, who: 'SHGs, microfinance groups, student volunteers', p: 'Remove the reason people borrow from scam apps.', items: ['Real-cost camps at SHG meetings and colleges', 'Fair small loans through SHGs and microfinance groups', 'WhatsApp lender check for basic phones'] },
  { n: 'Detect', icon: 'i-search', app: true, who: 'This app + victims’ own reports', p: 'Find the operator behind the app names.', items: ['Links reports by UPI ID, number and wording', 'Public only after 3 different people report it', 'Operator files sent to app stores and payment apps'] },
  { n: 'Protect', icon: 'i-shield', app: true, who: 'This app + cyber-safety NGO counsellors', p: 'Answer each threat with the facts, in the moment.', items: ['Flips every threat into the fact and the law', 'Contact warning in English, Hindi and Tamil', 'NGO counsellor callback for severe cases'] },
  { n: 'Respond', icon: 'i-scale', app: false, who: 'Law-college legal-aid clinics, pro-bono lawyers', p: 'Turn sealed evidence into a filed case.', items: ['Clinics help victims file their complaint', 'Victims of one operator file together', 'Hash list proves the evidence was not edited'] },
  { n: 'Reform', icon: 'i-chart', app: false, who: 'Students, media, researchers', p: 'Make the numbers public so platforms respond.', items: ['Public dashboard of operators and response times', 'Twice-yearly public report', 'Hotspots decide the next Prevent camps'] }
];
const loop = $('#loop');
STAGES.forEach((s, i) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / 5, x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a);
  loop.insertAdjacentHTML('beforeend', `<button type="button" class="stage ${s.app ? 'app' : ''}" style="left:${x}%;top:${y}%" data-i="${i}" aria-pressed="false">${ico(s.icon)}<span>${s.n}</span></button>`);
});
function showStage(i) {
  const s = STAGES[i];
  $$('.stage').forEach((b, j) => b.setAttribute('aria-pressed', i === j));
  $('#stage-panel').innerHTML = `<span class="eyebrow">Stage ${i + 1} of 5</span><h3 style="margin-top:.6rem">${s.n}</h3>
    <span class="who ${s.app ? 'app' : 'ppl'}">${ico(s.app ? 'i-shield' : 'i-users')}${esc(s.who)}</span>
    <p class="big">${esc(s.p)}</p><ul>${s.items.map(t => `<li>${ico('i-check')}<span>${esc(t)}</span></li>`).join('')}</ul>`;
}
loop.addEventListener('click', e => { const b = e.target.closest('.stage'); if (b) showStage(+b.dataset.i); });
showStage(2);

/* hero demo: flip the three bubbles in turn */
(function () {
  const cs = $$('[data-demo]'); if (!cs.length) return;
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) { cs.forEach(c => c.classList.add('flipped')); return; }
  let k = 0;
  setInterval(() => { const i = k % (cs.length + 1); if (i === cs.length) cs.forEach(c => c.classList.remove('flipped')); else cs[i].classList.add('flipped'); k++; }, 1600);
})();

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
  startInbox(user);
  db.collection('reports').onSnapshot(snap => { state.live.reports = liveToReports(snap.docs); if (state.mode === 'live') renderGraph(); }, () => { state.live.on = false; });
}

/* validation line */
(function () {
  let tp = 0, fp = 0, fn = 0;
  LSDATA.TEST_SET.forEach(([y, m]) => { const p = LS.scanMessage(m).score >= 40 ? 1 : 0; if (p && y) tp++; else if (p) fp++; else if (y) fn++; });
  $('#val-line').textContent = `Scanner on 50 test messages: ${Math.round(tp / (tp + fn) * 100)}% recall, ${Math.round(tp / (tp + fp) * 100)}% precision.`;
})();

/* boot */
renderGraph();
$('#msg').value = EXAMPLES[0];
flip(EXAMPLES[0]);
applyLang(state.lang);
startLive();
})();
