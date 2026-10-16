/* LoanShield sample data. All app names, UPI IDs and phone numbers are fictional.
   The test set was written by the project team to check the scanner's logic.
   It is not real victim data; field accuracy is measured in the pilot. */
(function (root) {
'use strict';

const TEST_SET = [
  // label 1 = harassment, 0 = not harassment
  [1, 'Pay now or we will send your morphed photos to all your contacts.'],
  [1, 'Last warning. Rs 4500 pending. Your family and boss will know you are a fraud by evening.'],
  [1, 'Legal notice issued. FIR will be filed at cyber cell, arrest warrant tomorrow. Pay within 2 hours.'],
  [1, 'Tum chor ho. Abhi pay karo warna sabko bhej denge tumhari photo.'],
  [1, 'We have your contact list. Every number will get a message that you are a thief.'],
  [1, 'Ghar walon ko bata denge ki tum defaulter ho. Turant paisa bhejo.'],
  [1, 'Your photo will be made viral on WhatsApp groups if payment not done today.'],
  [1, 'Digital arrest initiated by CBI. Transfer the dues to recovery.desk@fakebank to stop it.'],
  [1, 'Pay or we will come to your house. We know where you live.'],
  [1, 'Your colleagues have been informed that you are a cheater. Next is your office HR.'],
  [1, 'Final notice: non-bailable warrant will be issued. Call 9000012345 to settle.'],
  [1, 'Besharam, loan lekar bhaag gaya. Rishtedaar ko call kar rahe hain.'],
  [1, 'Pay double the amount or we leak your photos. Photo leak to everyone you know.'],
  [1, 'Jaan se maar denge agar paisa nahi diya.'],
  [1, 'Your relatives will receive your edited photo tonight.'],
  [1, 'Police complaint registered against you for loan fraud. Pay penalty immediately.'],
  [1, 'Sab ko bata denge office mein. Tumhare boss ka number hai humare paas.'],
  [1, 'You beggar. Pay today or your friends get the screenshots.'],
  [1, 'We will message everyone in your phone that you ran away with our money.'],
  [1, 'Court notice has been sent to your address. Jail ho jayegi.'],
  [1, 'Your nude photos will be sent to your family.'],
  [1, 'Tumhari photo viral kar denge. Last chance.'],
  [1, 'Loser. Cannot repay 3000? Everyone you know will hear about it.'],
  [1, 'We will break your phone and your legs if you ignore this call.'],
  [1, 'Pay to recovery@fakepay now. Gharwalon ko sab pata chalega.'],
  [0, 'Dear customer, your EMI of Rs 2,150 is due on 05-Oct. Pay on time to avoid a late fee.'],
  [0, 'Your OTP for login is 482913. Do not share it with anyone.'],
  [0, 'Beware of fraud calls. Our bank never asks for your PIN or OTP.'],
  [0, 'Reminder: your loan instalment is overdue by 3 days. Overdue charge applies. Pay now via the app.'],
  [0, 'Hi beta, call your relatives in Madurai today, it is Paati’s birthday.'],
  [0, 'Meeting moved to 4pm. Please inform your boss.'],
  [0, 'Your order has been shipped and will arrive tomorrow.'],
  [0, 'Congratulations! You are pre-approved for a credit card. Apply at the branch.'],
  [0, 'Your electricity bill of Rs 1,240 is due. Pay before the 10th to avoid a penalty.'],
  [0, 'Police verification for your passport is scheduled on Monday.'],
  [0, 'Movie tonight? The new thriller has a court scene everyone is talking about.'],
  [0, 'Your KYC is pending. Update it through the official app or visit the branch.'],
  [0, 'Sir, the processing fee for your home loan is 0.5%. Documents attached.'],
  [0, 'Your parcel is held. Pay Rs 25 at http://parcel-help.example to release it.'],
  [0, 'Thanks for repaying your loan. Your account is now closed.'],
  [0, 'Mummy, I reached the hostel. Will call later.'],
  [0, 'Final notice: your gym membership ends today. Renew to keep your slot.'],
  [0, 'Arrest of the gang that ran fake loan apps was reported in today’s paper.'],
  [0, 'Your credit score improved by 12 points this month.'],
  [0, 'Don’t share your photo with unknown apps, beta.'],
  [0, 'Payment received. Rs 3,000 credited to your loan account.'],
  [0, 'Office mein party hai Friday ko, aa jana.'],
  [0, 'We noticed a late payment. You can request a new date in the app at no extra charge.'],
  [0, 'The cyber cell workshop on online safety is at 11am in the auditorium.'],
  [0, 'Your SIP of Rs 1,000 was processed successfully.']
];

/* Community reports feeding the Scam Graph. Days count from the start of the sample period. */
const SCRIPT_A = 'Dear customer your loan of Rs 4500 is overdue. Pay to recovery.desk@fakebank within 2 hours or we will send a message to all your contacts that you are a fraud.';
const SCRIPT_B = 'Final warning from legal team. FIR and arrest warrant ready. Call 9000077140 today or police will visit your office.';
const SAMPLE_REPORTS = [
  { reporter: 'R1', app: 'InstaCash Pro', day: 2,  upi: ['recovery.desk@fakebank'], phones: ['9000011221'], text: SCRIPT_A },
  { reporter: 'R2', app: 'PaisaJet',      day: 9,  upi: [], phones: ['9000011221'], text: 'Dear customer your loan of Rs 3000 is overdue. Pay within 2 hours or we will send a message to all your contacts that you are a fraud.' },
  { reporter: 'R3', app: 'LoanGully',     day: 15, upi: ['collect.lg@fakepay'], phones: [], text: 'Dear customer your loan of Rs 6200 is overdue. Pay to collect.lg@fakepay within 2 hours or we will send a message to all your contacts that you are a fraud.' },
  { reporter: 'R4', app: 'LoanGully',     day: 21, upi: ['collect.lg@fakepay'], phones: ['9000033118'], text: 'Your photos will be morphed and sent to your family.' },
  { reporter: 'R5', app: 'QuickMoney Max', day: 5, upi: [], phones: ['9000077140'], text: SCRIPT_B },
  { reporter: 'R6', app: 'MoneyBolt',     day: 18, upi: ['mb.recover@fakebank'], phones: ['9000077140'], text: 'Pay now. Your boss will get a call.' },
  { reporter: 'R7', app: 'MoneyBolt',     day: 27, upi: ['mb.recover@fakebank'], phones: [], text: 'Final warning from legal team. FIR and arrest warrant ready. Call 9000077141 today or police will visit your office.' },
  { reporter: 'R8', app: 'CashNest',      day: 33, upi: ['cn.dues@fakepay'], phones: ['9000098001'], text: 'Pay the penalty today.' }
];

/* Example a visitor sees pre-filled in the scanner (fictional). */
const EXAMPLE_MESSAGE = 'LoanGully recovery: Rs 6200 overdue. Pay to collect.lg@fakepay within 2 hours or your morphed photo goes to all your contacts. FIR ready. Call 9000033118.';

const API = { TEST_SET, SAMPLE_REPORTS, EXAMPLE_MESSAGE };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.LSDATA = API;
})(typeof window !== 'undefined' ? window : globalThis);
