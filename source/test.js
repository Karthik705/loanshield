const LS = require('./core.js');
const D = require('./data.js');
const { webcrypto } = require('crypto');
const assert = require('assert');

(async () => {
  // Truth check
  const t = LS.truthCheck({ promised: 5000, received: 3500, repay: 5000, days: 7 });
  console.log('APR', Math.round(t.apr), 'risk', t.risk, t.verdict, t.flags.map(f => f.id));
  assert(Math.abs(t.apr - (1500 / 3500) * (365 / 7) * 100) < 1e-6);
  assert.equal(LS.truthCheck({ promised: 0, received: 1, repay: 1, days: 1 }).error !== undefined, true);
  const fair = LS.truthCheck({ promised: 20000, received: 20000, repay: 21500, days: 180 });
  console.log('fair APR', Math.round(fair.apr), fair.verdict);

  // Scanner on test set
  let tp = 0, fp = 0, tn = 0, fn = 0; const wrong = [];
  D.TEST_SET.forEach(([y, m]) => {
    const r = LS.scanMessage(m); const p = r.score >= 40 ? 1 : 0;
    if (p && y) tp++; else if (p && !y) { fp++; wrong.push(['FP', r.score, m]); } else if (!p && !y) tn++; else { fn++; wrong.push(['FN', r.score, m]); }
  });
  const prec = tp / (tp + fp), rec = tp / (tp + fn);
  console.log({ tp, fp, tn, fn, precision: prec.toFixed(3), recall: rec.toFixed(3), f1: (2 * prec * rec / (prec + rec)).toFixed(3) });
  wrong.forEach(w => console.log(' ', w.join(' | ')));

  // Identifiers
  const ex = LS.scanMessage(D.EXAMPLE_MESSAGE);
  console.log('example', ex.score, ex.level, ex.ids, ex.hits.map(h => h.cat));
  assert.deepEqual(ex.ids.upi, ['collect.lg@fakepay']);
  assert.deepEqual(ex.ids.phones, ['9000033118']);
  assert.deepEqual(LS.extractIdentifiers('mail me at a.b@gmail.com').upi, []);

  // Graph
  const g = LS.buildGraph(D.SAMPLE_REPORTS);
  g.clusters.forEach(c => console.log(c.id, c.apps.join('/'), 'reports', c.reports, 'reporters', c.reporters, c.published ? 'PUBLISHED' : 'held', [...new Set(c.links.map(l => l.why))]));
  console.log('script sim A vs PaisaJet', LS.templateSimilarity(D.SAMPLE_REPORTS[0].text, D.SAMPLE_REPORTS[1].text).toFixed(2),
    'B vs MoneyBolt', LS.templateSimilarity(D.SAMPLE_REPORTS[4].text, D.SAMPLE_REPORTS[6].text).toFixed(2),
    'A vs B', LS.templateSimilarity(D.SAMPLE_REPORTS[0].text, D.SAMPLE_REPORTS[4].text).toFixed(2));
  // adding the visitor's own report should merge into LoanGully's operator
  const g2 = LS.buildGraph(D.SAMPLE_REPORTS.concat([{ reporter: 'YOU', app: 'LoanGully', day: 40, upi: ex.ids.upi, phones: ex.ids.phones, text: D.EXAMPLE_MESSAGE }]));
  console.log('after you report:', g2.clusters.map(c => c.id + ':' + c.apps.join('/') + ':' + c.reporters).join('  '));

  // Hash chain
  let chain = [];
  chain = await LS.appendEntry(chain, { ts: 1, kind: 'message', text: 'a' }, webcrypto.subtle);
  chain = await LS.appendEntry(chain, { ts: 2, kind: 'message', text: 'b' }, webcrypto.subtle);
  chain = await LS.appendEntry(chain, { ts: 3, kind: 'call', text: 'c' }, webcrypto.subtle);
  assert((await LS.verifyChain(chain, webcrypto.subtle)).ok);
  const tampered = chain.map(e => ({ ...e })); tampered[1].text = 'B';
  const v = await LS.verifyChain(tampered, webcrypto.subtle);
  console.log('tamper detected at', v.brokenAt); assert.equal(v.brokenAt, 1);

  // Packet
  const pk = LS.buildPacket({ date: '06 Oct 2026', ids: ex.ids, apps: ['LoanGully'], evidence: chain, chainOk: true, cluster: g2.clusters[0], truth: { promised: 5000, received: 3500, repay: 5000, days: 7, apr: t.apr } });
  console.log(pk.split('\n').slice(0, 30).join('\n'));
  console.log('ALL TESTS PASSED');
})();
;(async () => {
  const LS = require('./core.js'), D = require('./data.js'), assert = require('assert');
  const ex = LS.scanMessage(D.EXAMPLE_MESSAGE);
  const r = LS.rightsFor(ex, D.EXAMPLE_MESSAGE);
  console.log('rights', r.map(x => x.id));
  assert(r.some(x => x.id === 'bns308') && r.some(x => x.id === 'it67'));
  const t = LS.callTimes('10:40 pm call from 900. Next 9 am. Also 22:15 and 6.30 a.m. and 13:00');
  console.log('times', t.map(x => x.raw + (x.outside ? '!' : '')).join(', '));
  assert.deepEqual(t.map(x => x.outside), [true, false, true, true, false]);
  const note = 'Call at 10:40 pm from 9000033118, said they will visit my office';
  console.log('note rights', LS.rightsFor(LS.scanMessage(note), note).map(x => x.id));
  console.log(LS.shieldMessage('ta', 'Karthik'));
  console.log(LS.shieldMessage('hi', ''));
  console.log('NEW TESTS PASSED');
})();
