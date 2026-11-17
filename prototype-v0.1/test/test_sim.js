// ทดสอบแกนจำลองใน Node: node test/test_sim.js [verbose]
const SIM = require('../src/sim.js');
const verbose = process.argv.includes('verbose');
const { hhmm } = SIM.util;
let fails = 0;
function check(cond, msg) { if (!cond) { fails++; console.log('  ✗', msg); } }
function civTotal(G) { return G.civ.town + G.civ.ep + G.civ.evac + G.u.h2.pax + G.u.lcu1.pax + G.u.lcu2.pax; }

function run(label, opt, policy) {
  const G = SIM.newGame(opt);
  let steps = 0, maxPend = 0;
  try {
    while (!G.over && steps < 20000) {
      if (policy) policy(G);
      SIM.step(G, 1); steps++;
      maxPend = Math.max(maxPend, G.pend.length);
      if (steps % 600 === 0) check(civTotal(G) === 600, `${label}: พลเรือนไม่ครบ 600 ที่ ${hhmm(G.t)} (${civTotal(G)})`);
    }
  } catch (e) { fails++; console.log(`  ✗ ${label}: exception at ${hhmm(G.t)}`, e.stack.split('\n').slice(0, 4).join('\n')); return G; }
  check(G.over, `${label}: ไม่จบเกม (t=${hhmm(G.t)})`);
  check(civTotal(G) === 600, `${label}: พลเรือนรวม ${civTotal(G)} ≠ 600`);
  const s = SIM.summary(G);
  const types = {}; for (const d of G.decs) types[d.type] = (types[d.type] || 0) + 1;
  console.log(`${label.padEnd(26)} H=${G.H ? hhmm(G.H) : '—'} safe=${s.safe} evac=${s.evac} ep=${s.ep} town=${s.town} harmF=${s.harmF} harmE=${s.harmE} trust=${s.trust} frat=${s.frat} near=${s.near} air=${s.air} roe=${s.roe} msn=${s.missions} cff=${s.cffAvg ? Math.round(s.cffAvg) : '-'}s aground=${s.aground} inc=${s.incidents} box=${s.boxOut}m obj=${Object.keys(s.obj).join(',')} dec=${G.decs.length} mine=${s.dec.n}(${s.dec.good}/${s.dec.ok}/${s.dec.poor}) maxPend=${maxPend}`);
  if (verbose) console.log('   types:', JSON.stringify(types));
  return G;
}

console.log('— AI ทั้งหมด (ผู้สังเกตการณ์) หลาย seed —');
const g1 = run('observer seed 1', { seed: 1 });
for (const s of [2, 3, 4, 5, 20261117]) run('observer seed ' + s, { seed: s });

if (verbose) {
  console.log('\n— ไทม์ไลน์ seed 1 (sev≥1) —');
  for (const e of g1.log) if (e.s >= 1) console.log(hhmm(e.t), e.s, e.c, e.x);
}

console.log('\n— ผู้เล่นทุกตำแหน่ง ไม่ตอบเลย (หมดเวลา) —');
for (const seat of SIM.SEATS.map(s => s.id)) run('timeout ' + seat, { seed: 7, seat }, G => { if (G.mg) SIM.mgResult(G, 'ok'); });

console.log('\n— ผู้เล่นทุกตำแหน่ง ตอบสุ่ม + กดปุ่มควบคุม —');
for (const seat of SIM.SEATS.map(s => s.id)) {
  let r = 99;
  const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  run('random ' + seat, { seed: 11, seat }, G => {
    for (const d of G.pend.slice()) if (d.seat === G.seat && G.t - d.t0 > 3) SIM.decide(G, d.id, d.opts[Math.floor(rand() * d.opts.length)].k);
    if (G.mg) SIM.mgResult(G, ['ok', 'hard', 'waveoff', 'damage'][Math.floor(rand() * 4)]);
    if (rand() < 0.002) SIM.act(G, 'report');
    if (rand() < 0.0008) SIM.act(G, 'checkfire');
    if (seat === 'fo' && rand() < 0.01) for (const h of Object.values(G.h)) if (h.known && h.str > 0) SIM.act(G, 'cff', { tgt: h.id });
    if (seat === 'ood' && rand() < 0.003) SIM.act(G, 'helm', { h: Math.floor(rand() * 360), s: rand() * 6 });
    if (seat === 'jtf' && rand() < 0.002) SIM.act(G, 'comm');
    if (seat === 'fscc' && rand() < 0.001) SIM.act(G, 'artyhold');
    if (seat === 'cav' && rand() < 0.01) SIM.act(G, 'cav', { k: ['cas', 'detour', 'atk'][Math.floor(rand() * 3)] });
  });
}

console.log('\n— ผู้ฝึกใส่สถานการณ์ทุกแบบ —');
run('injects all', { seed: 3 }, G => {
  const at = { 19200: 'fast', 20000: 'heloFault', 21000: 'gridErr', 21600: 'rbErr', 22000: 'relay', 23000: 'heloFault', 24000: 'clip', 24500: 'town', 25000: 'storm', 26000: 'fishing' };
  if (at[G.t]) SIM.inject(G, at[G.t]);
});

console.log('\n— กรณีพิเศษ —');
run('player jtf H=05:30 go', { seed: 5, seat: 'jtf' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'jtf') { if (d.type === 'jtf_hhour') SIM.decide(G, d.id, String(5.5 * 3600)); else if (d.type === 'jtf_go') SIM.decide(G, d.id, 'go'); else SIM.decide(G, d.id, d.aiK); }
});
run('player fscc acm=free', { seed: 5, seat: 'fscc' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'fscc') SIM.decide(G, d.id, d.type === 'fscc_acm' ? 'free' : d.type === 'fscc_fire' ? 'ok' : d.aiK);
});
run('player fscc acm=direct ok', { seed: 6, seat: 'fscc' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'fscc') SIM.decide(G, d.id, d.type === 'fscc_acm' ? 'direct' : d.type === 'fscc_fire' ? 'ok' : d.aiK);
});
run('player fdc always fwd', { seed: 1, seat: 'fdc' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'fdc') SIM.decide(G, d.id, 'fwd');
});
run('player jtac always hot', { seed: 2, seat: 'jtac' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'jtac') SIM.decide(G, d.id, d.type === 'jtac_clear' ? 'hot' : d.type === 'jtac_rbc' ? 'ok' : d.aiK);
});
run('player jtf storm push', { seed: 4, seat: 'jtf' }, G => {
  for (const d of G.pend.slice()) if (d.seat === 'jtf') SIM.decide(G, d.id, d.type === 'jtf_storm' ? 'push' : d.aiK);
});
run('player ood idle (no helm)', { seed: 4, seat: 'ood' }, null);
run('player helo waveoff x2', { seed: 8, seat: 'helo' }, G => { if (G.mg) { G.__n = (G.__n || 0) + 1; SIM.mgResult(G, G.__n % 3 ? 'waveoff' : 'ok'); } });

console.log('\n— บันทึก/โหลดสถานะ (JSON) กลางเกม —');
{
  const G = SIM.newGame({ seed: 9 });
  SIM.step(G, 4000);
  const G2 = JSON.parse(JSON.stringify(G));
  SIM.step(G, 6000); SIM.step(G2, 6000);
  check(G.civ.evac === G2.civ.evac && G.t === G2.t && G.log.length === G2.log.length, 'JSON round-trip ให้ผลไม่ตรงกัน');
  console.log('round-trip ok, size KB =', Math.round(JSON.stringify(G).length / 1024));
}

console.log(fails ? `\n✗ ล้มเหลว ${fails} รายการ` : '\n✓ ผ่านทั้งหมด');
process.exit(fails ? 1 : 0);
