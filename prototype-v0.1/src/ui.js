/* คลื่นมรกต — ส่วนติดต่อผู้ใช้ (หน้าจอ แผง การตัดสินใจ มินิเกม AAR) */
(function () {
'use strict';
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = SIM.util, W = SIM.WORLD;
const SVC = { 'ทบ.': 'army', 'ทร.': 'navy', 'ทอ.': 'air', 'ร่วม': 'joint' };
const GR = { good: 'ดี', ok: 'พอใช้', poor: 'ควรทบทวน' };
const NETS = ['ข่ายบังคับบัญชา', 'ข่ายยิง', 'ข่ายประสาน', 'ข่ายเรือ', 'ข่ายอากาศ'];
const SEATNETS = { jtf: NETS, fscc: ['ข่ายยิง', 'ข่ายประสาน', 'ข่ายอากาศ'], fdc: ['ข่ายยิง', 'ข่ายประสาน'], fo: ['ข่ายยิง'], coy: ['ข่ายบังคับบัญชา'], sql: ['ข่ายบังคับบัญชา'], cav: ['ข่ายบังคับบัญชา', 'ข่ายอากาศ'], co: ['ข่ายเรือ', 'ข่ายอากาศ'], ood: ['ข่ายเรือ'], fdo: ['ข่ายเรือ', 'ข่ายอากาศ'], helo: ['ข่ายอากาศ'], lead: ['ข่ายอากาศ'], jtac: ['ข่ายอากาศ', 'ข่ายบังคับบัญชา'] };
const STD_SEED = 20261117;
const SPEEDS = [0, 1, 5, 10, 20, 40];
const seatInfo = id => SIM.SEATS.find(s => s.id === id) || SIM.AI_SEATS.find(s => s.id === id);
const KIND = { inf: 'ทหารราบ', cav: 'ทหารม้า (รถรบ)', jtac: 'ผู้ควบคุมการโจมตีทางอากาศ', fo: 'ผู้ตรวจการณ์หน้า', hq: 'กองบัญชาการ กกล.ร่วม + FSCC', arty: 'ปืนใหญ่สนาม + FDC', ship: 'เรือ', lcu: 'เรือยกพล', helo: 'เฮลิคอปเตอร์', jet: 'เครื่องบินโจมตี 2 เครื่อง' };
const UST = { move: 'เคลื่อนที่', hold: 'วางกำลัง', halt: 'หยุดรอ', op: 'ซ่อนพราง ตรวจการณ์', idle: 'พร้อม', emb: 'อยู่ในอู่เรือ', lod: 'ไปเส้นออกตี', wait: 'รอที่เส้นออกตี', run: 'วิ่งเข้าหาด', aground: 'ค้างสันดอน', beach: 'ลดทางลาดที่หาด', ret: 'กลับเรือแม่', stage: 'ไปจุดคอยท่าเรือ', phold: 'รอที่จุดคอย', pier: 'เข้าเทียบท่า', load: 'รับพลเรือน', evac: 'นำพลเรือนกลับ', unload: 'ส่งพลเรือนขึ้นเรือ', in: 'เข้าพื้นที่', orbit: 'บินวนที่ IP', egress: 'ออกจากเป้า', rtb: 'กลับฐาน', base: 'ที่ฐานบิน', gone: 'กลับฐานแล้ว' };
const MST = { cff: 'ส่งคำขอ', lost: 'ข่ายขัดข้อง', wait: 'รอข่าย', fdc: 'ที่ FDC', query: 'สอบถามพิกัด', fscc: 'รอ FSCC', hold: 'ระงับ (ห้วงอากาศ)', ready: 'เตรียมยิง', flight: 'กระสุนเดินทาง', bda: 'รอรายงานผล', done: 'จบ', denied: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' };
const OBJ = [['landed', 'เรือยกพลถึงหาดเขียว'], ['beach', 'หาดเขียวปลอดภัย'], ['epTeam', 'ชุดรักษาจุดอพยพถึงโรงเรียน'], ['ep', 'เปิดจุดอพยพ'], ['r2', 'กดดันเนิน 214'], ['rb', 'เปิดด่านสกัดถนน'], ['af', 'ยึดสนามบิน'], ['pier', 'ท่าเรือปลอดภัย'], ['h214', 'ยึดเนิน 214'], ['r5', 'กดดันกำลังเสริมข้าศึก']];
const EVCAT = { all: 'ทั้งหมด', fires: 'ยิงสนับสนุน', air: 'อากาศ', sea: 'ทะเล', land: 'ภาคพื้น', civ: 'พลเรือน', roe: 'ROE', intel: 'ข่าวกรอง', c2: 'สื่อสาร', inject: 'ผู้ฝึก' };
const AARQ = ['สิ่งที่ตั้งใจให้เกิดขึ้นคืออะไร (แผนและเจตนา)', 'สิ่งที่เกิดขึ้นจริงคืออะไร', 'ทำไมจึงแตกต่าง หรือทำไมจึงสำเร็จ', 'ครั้งหน้าจะคงอะไรไว้ และปรับปรุงอะไร'];
const ASSUME = [
  { g: 'ทบ.', t: 'ห่วงโซ่ขอยิง', v: 'ผู้ตรวจการณ์ → ศูนย์อำนวยการยิง (ทวนกลับ + ตรวจไขว้ทิศ/ระยะกับพิกัด) → FSCC อนุมัติ → ยิง → ผู้ตรวจการณ์รายงานผล' },
  { g: 'ทบ.', t: 'เวลาเตรียมยิงหลังอนุมัติ', v: '45 วินาที (ค่าสาธิต)' },
  { g: 'ทบ.', t: 'เวลากระสุนเดินทาง', v: '40 วินาทีทุกระยะ (ค่าสาธิต ไม่ใช่ข้อมูลอาวุธ)' },
  { g: 'ทบ.', t: 'ผลการยิงต่อเป้าหมาย', v: 'ลดกำลังสูงสุดราว 60% ต่อชุด และกดดันเป้าหมาย 3 นาที (ค่าเกม)' },
  { g: 'ทบ.', t: 'ระยะอันตรายต่อฝ่ายเดียวกัน', v: '≤250 ม. นับเป็นยิงฝ่ายเดียวกัน · ≤600 ม. นับเป็นเฉียด · FDC/FSCC ปฏิเสธเมื่อภาพสถานการณ์แสดงฝ่ายเดียวกันใกล้กว่า 600 ม. (ค่าเกม)' },
  { g: 'ทบ.', t: 'รอบรายงานตำแหน่ง', v: 'ทุกราว 10–15 นาที บางหน่วยรายงานไม่สม่ำเสมอ ทำให้ภาพสถานการณ์ล้าหลัง' },
  { g: 'ทบ.', t: 'ความเร็วเคลื่อนที่', v: 'ทหารราบ 2 ม./วินาที บนถนน · รถรบ 6 ม./วินาที · ลดลงเมื่อถูกยิงกดหรือพายุ (ค่าสาธิต)' },
  { g: 'ทบ.', t: 'ด่านที่มีพลเรือน', v: 'หยุด ประกาศ และให้พลเรือนออกจากพื้นที่ภายในราว 6 นาที ก่อนใช้กำลัง' },
  { g: 'ทร.', t: 'ระดับน้ำสำหรับเรือยกพล', v: 'ต้อง ≥2.0 ม. แบบจำลองน้ำขึ้นลงรอบ 12.4 ชม. ได้ช่วงประมาณ 05:40–07:32' },
  { g: 'ทร.', t: 'เกณฑ์ดาดฟ้าบิน', v: 'ลมสัมพัทธ์ไม่เกิน ±30° จากหัวเรือ และไม่เกิน 35 นอต · โคลงไม่เกิน 4.5° (ค่าสาธิต ขึ้นกับแบบเรือ/อากาศยาน)' },
  { g: 'ทร.', t: 'แบบจำลองการโคลง', v: 'โคลง = 1° + ฐาน × |sin(มุมคลื่นสัมพัทธ์)| ฐาน 7° ที่ทะเลระดับ 3 และ 13° ที่ระดับ 5' },
  { g: 'ทร.', t: 'ขีดความสามารถขนส่ง', v: 'เรือยกพล 5 ม./วินาที รับ 100 คน · เฮลิคอปเตอร์ 60 ม./วินาที รับ 20 คนต่อเที่ยว' },
  { g: 'ทร.', t: 'การรับมือเรือไม่ทราบฝ่าย', v: 'ติดต่อ → เตือน → เปลี่ยนเข็ม → พิสูจน์ทราบ → ป้องกันตนเองตามขั้น' },
  { g: 'ทอ.', t: 'บรีฟ CAS ฉบับย่อ', v: 'IP · ทิศทางเข้า · ลักษณะเป้า · พิกัด · ฝ่ายเดียวกันใกล้สุด · ทิศทางออก แล้วนักบินทวนกลับ' },
  { g: 'ทอ.', t: 'ขั้นตอนอนุญาตโจมตี', v: 'นักบินยืนยันเป้าหมาย (tally) → JTAC อนุญาต (cleared hot) หรือยกเลิก (abort)' },
  { g: 'ทอ.', t: 'เวลาเหนือพื้นที่', v: 'อยู่ได้ถึง 07:20 แล้วต้องกลับฐาน (ค่าสาธิต)' },
  { g: 'ร่วม', t: 'เขตอันตรายแนวยิงต่ออากาศยาน', v: '±300 ม. ตลอดแนวยิง และเลยเป้า 1 กม. ระหว่างกระสุนเดินทาง (ค่าเกม — ต้องตรวจกับหลักนิยมจริง)' },
  { g: 'ร่วม', t: 'มาตรการประตูข้ามแนวยิง', v: 'อากาศยานข้ามแนวยิงที่ประตู ก เท่านั้น ปืนใหญ่หยุดยิงขณะอากาศยานอยู่ในรัศมี 2.3 กม. ของประตู' },
  { g: 'ร่วม', t: 'ข่ายวิทยุ', v: 'ข่ายบังคับบัญชา · ข่ายยิง · ข่ายประสาน · ข่ายเรือ · ข่ายอากาศ · ข่ายสำรองผ่านเรือ' },
  { g: 'ร่วม', t: 'ความเชื่อมั่นของพลเรือน', v: 'คลิปปลอม −25 · ชี้แจงผ่านผู้นำชุมชนฟื้น +15 ใน 10 นาที · พลเรือนบาดเจ็บจากฝ่ายเรา −15 ต่อเหตุการณ์' },
  { g: 'ร่วม', t: 'การประเมินการตัดสินใจ', v: 'ประเมินจาก "ข้อมูลที่มีในขณะนั้น" ไม่ใช่ผลลัพธ์ · หมดเวลา = ใช้ค่าเริ่มต้นและได้ไม่เกิน "พอใช้"' }
];
const HELP = `<h3>วิธีเล่น</h3><ol>
<li>เลือกตำแหน่งในผังการจัดกำลัง ตอบแบบทดสอบสั้นเพื่อรับ "ใบอนุญาตบทบาท" แล้วเข้าประจำตำแหน่ง ตำแหน่งที่เหลือ AI ทำแทน</li>
<li>เวลาในเกม 05:00–08:00 ปรับความเร็วที่แถบบน เมื่อมีเรื่องรอตัดสินใจ เวลาจะชะลอเอง เรื่องเร่งด่วน (⚡) เดินแบบเวลาจริง 15 วินาที</li>
<li>แผนที่คือ "ภาพสถานการณ์ร่วม" หน่วยภาคพื้นปรากฏตามตำแหน่งที่รายงานล่าสุด ⌛ แปลว่าภาพล้าสมัย จึงต้องรายงานตำแหน่งของตนตามรอบ</li>
<li>ทุกตำแหน่งกด "⚠ ระงับการยิง" ได้เมื่อเห็นอันตราย AAR จะบอกว่าการทักท้วงนั้นสมเหตุสมผลหรือไม่</li>
<li>แท็บ "ควบคุม" มีเครื่องมือเฉพาะตำแหน่ง เช่น ขอยิง (ผู้ตรวจการณ์หน้า) คุมเข็มเรือ (นายทหารเวร) หรือซ้อมลงจอด (นักบินเฮลิคอปเตอร์)</li>
<li>จบแล้วดู AAR: เล่นซ้ำบนแผนที่ สลับ "ภาพที่เห็น" กับ "ความจริง" และดูคะแนนการตัดสินใจที่ประเมินจากข้อมูลขณะนั้น</li>
</ol><p class="fine">ต้นแบบนี้เล่นคนเดียวกับ AI ฉบับเต็มออกแบบให้ผู้เล่นหลายคนนั่งคนละตำแหน่งในเครือข่ายเดียวกัน และเชื่อมเครื่องฝึกจริงผ่าน DIS/HLA</p>`;

let S, scene = null, dpr = 1, panelT = 0, liveT = 0, MG = null;
function defaults() { return { screen: 'intro', G: null, scale: 10, autoSlow: true, instructor: false, truth: false, seedMode: 'std', lobbySel: 'jtf', licensed: {}, quiz: {}, tab: 'task', net: 'all', sel: null, sheet: null, minimized: {}, seenLog: 0, endShown: false, cam: null, lastPanel: '', aar: { i: -1, mode: 'cop', filter: 'all', mine: true, play: false, ans: ['', '', '', ''] } }; }
let REVIEW = {};
function loadReview() { try { REVIEW = JSON.parse(localStorage.getItem('emerald-review-v1') || '{}') || {}; } catch (e) { REVIEW = {}; } }
function saveReview() { try { localStorage.setItem('emerald-review-v1', JSON.stringify(REVIEW)); } catch (e) { /* ใช้ได้เฉพาะในหน่วยความจำ */ } }

/* ---------- หน้าจอ ---------- */
function show(id) {
  S.screen = id;
  for (const el of $$('.scr')) el.classList.toggle('on', el.id === 'scr-' + id);
  if (id !== 'game') { hideSheet(); $('#drawer').hidden = true; }
  if (id === 'lobby') renderLobby();
  if (id === 'game') { buildTop(); resizeMap(); renderPanel(true); }
  if (id === 'aar') renderAAR();
  if (id === 'assume') renderAssume();
  try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
}

/* ---------- ล็อบบี้ ---------- */
function seatCard(id) {
  const s = seatInfo(id); const play = SIM.SEATS.some(x => x.id === id);
  const tags = `<span class="tags"><span class="chip svc ${SVC[s.svc]}">${s.svc}</span><span class="chip">${SIM.LV[s.lv]}</span>${play ? '' : '<span class="chip">AI</span>'}</span>`;
  if (!play) return `<div class="seat ai" aria-disabled="true">${tags}<span class="cs">${esc(s.cs)}</span><span class="nm">${esc(s.nm)}</span></div>`;
  return `<button class="seat ${S.lobbySel === id ? 'on' : ''}" data-act="pick" data-seat="${id}" aria-pressed="${S.lobbySel === id}">${tags}<span class="cs">${esc(s.cs)}</span><span class="nm">${esc(s.nm)}</span>${S.licensed[id] ? '<span class="lic">✓ มีใบอนุญาตบทบาท</span>' : ''}</button>`;
}
function renderLobby() {
  $('#orbat').innerHTML = SIM.ORBAT.map(g => `<div class="og"><h3>${esc(g.nm)}</h3><div class="og-list">${g.seats.map(seatCard).join('')}</div></div>`).join('') +
    `<div class="og"><h3>ไม่รับตำแหน่ง</h3><div class="og-list"><button class="seat ${S.lobbySel === 'obs' ? 'on' : ''}" data-act="pick" data-seat="obs"><span class="cs">ผู้สังเกตการณ์</span><span class="nm">AI เล่นทุกตำแหน่ง ดูภาพรวมและใช้แผงผู้ฝึกได้</span></button></div></div>`;
  const opts = `<div class="opts-row">
    <label class="check"><input type="checkbox" data-chk="autoSlow" ${S.autoSlow ? 'checked' : ''}><span>ชะลอเวลาอัตโนมัติเมื่อมีเรื่องรอตัดสินใจ (เร่งด่วน ×1 · ปกติไม่เกิน ×2)</span></label>
    <label class="check"><input type="checkbox" data-chk="instructor" ${S.instructor ? 'checked' : ''}><span>เปิดแผงผู้ฝึก (white cell): ใส่สถานการณ์และดูความจริงบนแผนที่</span></label>
    <label class="check"><input type="checkbox" data-chk="random" ${S.seedMode === 'random' ? 'checked' : ''}><span>สุ่มรายละเอียดสถานการณ์ (ไม่เลือก = ชุดมาตรฐาน ใช้เทียบผลระหว่างผู้เล่น)</span></label></div>`;
  const id = S.lobbySel, box = $('#seatinfo');
  if (id === 'obs') {
    box.innerHTML = `<div class="si"><h2 class="si-cs">ผู้สังเกตการณ์</h2><p class="si-nm">AI เล่นทุกตำแหน่ง</p><p class="si-d">ดูทั้งระบบทำงานแบบเร่งเวลา เปลี่ยนไปนั่งตำแหน่งใดก็ได้ระหว่างเล่นจากเมนู "ตำแหน่ง" ด้านบน เหมาะสำหรับสาธิตให้ผู้บังคับบัญชาหรือเพื่อนเหล่าอื่นดูภาพรวมก่อน</p>${opts}<div class="start-row"><button class="btn primary big" data-act="start" data-seat="obs">เริ่มสังเกตการณ์ →</button></div></div>`;
    return;
  }
  const s = seatInfo(id), q = s.q, st = S.quiz[id];
  const quiz = `<div class="quiz"><div class="q">${esc(q.q)}</div><div class="opts">${q.a.map((a, i) => `<button class="qopt ${st && st.pick === i ? (i === q.c ? 'right' : 'wrong') : ''}" data-act="quiz" data-i="${i}">${esc(a)}</button>`).join('')}</div>${st ? `<p class="x">${st.pick === q.c ? '✓ ถูกต้อง — ' : 'ยังไม่ถูก ลองใหม่ — '}${esc(q.x)}</p>` : ''}</div>`;
  box.innerHTML = `<div class="si"><span class="chip svc ${SVC[s.svc]}">${s.svc}</span> <span class="chip">${SIM.LV[s.lv]}</span><h2 class="si-cs" style="margin-top:8px">${esc(s.cs)}</h2><p class="si-nm">${esc(s.nm)}</p><p class="si-d">${esc(s.d)}</p>
    <h4>การตัดสินใจที่จะเจอ</h4><ul>${s.dec.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h4>ใบอนุญาตบทบาท (ไมโครเลิร์นนิง 1 ข้อ)</h4>${quiz}${opts}
    <div class="start-row"><button class="btn primary big" data-act="start" data-seat="${id}" ${S.licensed[id] ? '' : 'disabled'}>เข้าประจำตำแหน่ง →</button>${S.licensed[id] ? '' : '<button class="btn" data-act="skipquiz">ข้ามแบบทดสอบ (โหมดสาธิต)</button>'}</div></div>`;
}

/* ---------- เริ่มเกม ---------- */
function startGame(seat) {
  const seed = S.seedMode === 'random' ? ((Math.random() * 1e9) >>> 0) || 1 : STD_SEED;
  S.G = SIM.newGame({ seed, seat: seat === 'obs' ? null : seat });
  Object.assign(S, { seenLog: S.G.log.length, sheet: null, minimized: {}, sel: null, endShown: false, tab: 'task', truth: false, cam: null, lastPanel: '', aar: { i: -1, mode: 'cop', filter: 'all', mine: true, play: false, ans: ['', '', '', ''] } });
  show('game');
  const me = S.G.seat ? seatInfo(S.G.seat) : null;
  toast(me ? `ท่านคือ ${me.cs} · ${me.nm}` : 'ผู้สังเกตการณ์ — AI เล่นทุกตำแหน่ง', 2);
  toast('เคล็ดลับ: เร่งเวลา ×20–×40 ได้ เมื่อมีเรื่องรอตัดสินใจ ระบบจะชะลอเวลาเอง', 1);
}

/* ---------- แถบบน ---------- */
function myPending() { const G = S.G; return G && G.seat ? G.pend.filter(d => d.seat === G.seat) : []; }
function effScale() {
  if (S.scale === 0) return 0;
  const mine = myPending();
  if (mine.some(d => d.urgent)) return 1;
  if (mine.length && S.autoSlow) return Math.min(S.scale, 2);
  return S.scale;
}
function buildTop() {
  const G = S.G;
  $('#speed').innerHTML = SPEEDS.map(v => `<button data-act="speed" data-v="${v}" aria-pressed="${S.scale === v}" class="${S.scale === v ? 'on' : ''}" aria-label="${v === 0 ? 'หยุดเวลา' : 'ความเร็ว ' + v + ' เท่า'}">${v === 0 ? '⏸' : '×' + v}</button>`).join('') + '<span class="slow" id="slowNote"></span>';
  $('#seatSel').innerHTML = '<option value="">ผู้สังเกตการณ์ (AI ทั้งหมด)</option>' + SIM.ORBAT.map(g => `<optgroup label="${esc(g.nm)}">${g.seats.filter(id => SIM.SEATS.some(s => s.id === id)).map(id => `<option value="${id}">${esc(seatInfo(id).cs)} — ${esc(seatInfo(id).nm)}</option>`).join('')}</optgroup>`).join('');
  $('#seatSel').value = G.seat || '';
  $('#btnWC').hidden = !(S.instructor || !G.seat);
  $('#cfbtn').hidden = !G.seat;
}
function syncTop() {
  const G = S.G;
  $('#clk').textContent = U.hhmmss(G.t);
  $('#hrel').textContent = SIM.hrel(G);
  $('#phase').textContent = SIM.phase(G);
  const eff = effScale(), note = $('#slowNote');
  const txt = S.scale === 0 ? 'หยุดอยู่' : eff !== S.scale ? `ชะลอเป็น ×${eff} — มีเรื่องรอตัดสินใจ` : '';
  if (note && note.textContent !== txt) note.textContent = txt;
}
function hudHTML(G) {
  const td = U.tide(G.t), up = U.tide(G.t + 600) > td, w = G.wx, c = G.civ;
  return `<span class="h ${td < 2 && G.H != null && G.t < G.H + 600 ? 'warn' : ''}">น้ำ <b>${td.toFixed(2)}</b> ม. ${up ? '▲' : '▼'}</span><span class="h opt">แสง <b>${Math.round(U.light(G.t) * 100)}%</b></span><span class="h ${w.storm > 0.3 ? 'warn' : ''}">ลม <b>${U.pad3(w.wdir)}°/${Math.round(w.wkt)}</b> นอต · ทะเล <b>${Math.round(w.ss)}</b></span><span class="h">พลเรือน เมือง <b>${c.town}</b> · EP <b>${c.ep}</b> · ถึงเรือ <b>${c.evac}</b></span>${G.relayDown ? '<span class="h warn">ข่ายยิงขัดข้อง</span>' : ''}${S.truth ? '<span class="h warn">ผู้ฝึก: แสดงความจริง</span>' : ''}`;
}

/* ---------- แผนที่ ---------- */
function resizeMap() {
  const wrap = $('#mapwrap'), cv = $('#map'); if (!wrap || S.screen !== 'game') return;
  const r = wrap.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  if (!S.cam) { S.cam = { w: r.width, h: r.height, cx: 0, cy: 0, s: 1 }; R.fit(S.cam); } else { S.cam.w = r.width; S.cam.h = r.height; }
}
function buildScene(G, truth) {
  const units = [], hostiles = [], contacts = [], routes = [];
  const mine = SIM.seatUnit(G.seat);
  for (const u of Object.values(G.u)) {
    if (u.emb) continue;
    if (u.k === 'jet' && (u.st === 'base' || u.st === 'gone')) continue;
    if (u.k === 'helo' && ['deck', 'down', 'turn', 'land', 'lmg'].includes(u.st)) continue;
    let p = SIM.cop(G, u);
    if (!p) { if (!truth) continue; p = { x: u.x, y: u.y, age: 0 }; }
    const o = { id: u.id, k: u.k, cs: u.cs, x: p.x, y: p.y, hdg: u.hdg, age: p.age, mine: u.id === mine, sel: S.sel === 'u:' + u.id, hqu: u.hqu, pax: u.pax || 0, t: G.t };
    if (truth && Math.hypot(p.x - u.x, p.y - u.y) > 60) o.ghost = { x: u.x, y: u.y };
    units.push(o);
    if ((u.k === 'helo' && SIM.airborne(u) || u.k === 'lcu' && u.st !== 'emb') && u.route && u.route.length) routes.push({ pts: [[u.x, u.y]].concat(u.route), color: u.k === 'helo' ? 'rgba(154,209,245,.55)' : 'rgba(90,169,255,.35)' });
  }
  for (const h of Object.values(G.h)) {
    if (!h.known && !(truth && h.act)) continue;
    const o = { id: h.id, k: h.k, nm: h.nm, str: h.str, label: h.nm, x: null, y: null };
    if (h.known) { o.x = h.kx; o.y = h.ky; }
    if (truth && h.act && h.str > 0) { o.ghost = true; o.tx = h.x; o.ty = h.y; }
    hostiles.push(o);
  }
  for (const c of Object.values(G.c)) if (c.st !== 'gone') contacts.push({ id: c.id, side: c.side, x: c.x, y: c.y, nm: c.nm });
  let cas = null; const j = G.u.jet; if (j.st === 'run' && j.route.length) { const L = j.route[j.route.length - 1]; cas = { x0: j.x, y0: j.y, x1: L[0], y1: L[1] }; }
  return { t: G.t, light: U.light(G.t), storm: G.wx.storm, acm: G.acm, truth, units, hostiles, contacts, routes, fires: SIM.activeFires(G), fx: G.fx, cas, civ: { town: G.civ.town, ep: G.civ.ep, epOpen: G.civ.epOpen, rb: G.civ.rb, rbSeen: !!G.flags.rbSeen || truth } };
}
function drawGame() {
  const cv = $('#map'); if (!S.cam || !cv.width) return;
  scene = buildScene(S.G, S.truth);
  R.draw(cv.getContext('2d'), S.cam, dpr, scene);
}
function zoomAt(px, py, f) { const c = S.cam; const w = R.toWorld(c, px, py); const fit = Math.min(c.w / 16400, c.h / 11600); c.s = Math.max(fit * 0.6, Math.min(0.5, c.s * f)); c.cx = w.x - (px - c.w / 2) / c.s; c.cy = w.y + (py - c.h / 2) / c.s; }
function bindMap() {
  const cv = $('#map'), ptr = new Map(); let drag = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    if (!S.cam) return; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (ptr.size === 1) drag = { x: e.offsetX, y: e.offsetY, cx: S.cam.cx, cy: S.cam.cy, moved: false };
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: S.cam.s }; drag = null; }
  });
  cv.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (pinch && ptr.size === 2) { const [a, b] = [...ptr.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s * d / pinch.d / S.cam.s); }
    else if (drag) { const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (drag.moved) { S.cam.cx = drag.cx - dx / S.cam.s; S.cam.cy = drag.cy + dy / S.cam.s; } }
  });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved && ptr.size === 1) tapAt(e.offsetX, e.offsetY); ptr.delete(e.pointerId); if (ptr.size < 2) pinch = null; if (!ptr.size) drag = null; });
  cv.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); drag = null; pinch = null; });
  cv.addEventListener('wheel', e => { if (!S.cam) return; e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
}
function tapAt(px, py) {
  if (!scene) return; const h = R.hit(S.cam, scene, px, py);
  S.sel = h ? h.kind + ':' + h.o.id : null; renderSel();
}
function renderSel() {
  const el = $('#selcard'), G = S.G; if (!S.sel || !G) { el.hidden = true; return; }
  const [kind, id] = S.sel.split(':'); let html = '';
  if (kind === 'u') {
    const u = G.u[id]; const p = SIM.cop(G, u) || u; const mine = SIM.seatUnit(G.seat) === id;
    const st = u.k === 'helo' ? SIM.heloTxt(G) : (UST[u.st] || u.st);
    html = `<b>${esc(u.cs)}</b><div class="k">${KIND[u.k] || ''}</div><div>สถานะ: ${esc(u.k === 'helo' && u.id === 'h1' ? (SIM.airborne(u) ? 'ลาดตระเวน' : 'บนเรือนาคา') : st)}</div><div>พิกัด: <span class="mono">${U.gridStr(p.x, p.y)}</span></div>` +
      (SIM.isGround(u) && !u.live && !mine ? `<div class="k">รายงานล่าสุด ${u.rep ? Math.round((G.t - u.rep.t) / 60) + ' นาทีก่อน' : '—'}</div>` : '') +
      (SIM.isGround(u) ? `<div>กำลัง: ${Math.round(u.str)}%</div>` : '') + (u.pax ? `<div>ผู้โดยสาร: ${u.pax} คน</div>` : '');
  } else if (kind === 'h') {
    const h = G.h[id]; if (!h) { el.hidden = true; return; }
    html = `<b style="color:#ffb3b5">${esc(h.nm)}</b><div class="k">ข้าศึก${h.known ? ` · ตรวจพบโดย ${esc(h.by || '—')}` : ' (ผู้ฝึกเห็นเท่านั้น)'}</div>` + (h.known ? `<div>พิกัดที่ทราบ: <span class="mono">${U.gridStr(h.kx, h.ky)}</span></div><div>ประเมินกำลัง: ~${Math.round(h.str / 10) * 10}%</div>` : '');
  } else { const c = G.c[id]; if (!c) { el.hidden = true; return; } html = `<b>${c.side === 'U' ? 'เป้าไม่ทราบฝ่าย' : esc(c.nm)}</b><div class="k">ผิวน้ำ · ${c.side === 'U' ? 'รอพิสูจน์ทราบ' : 'พลเรือน'}</div><div>พิกัด: <span class="mono">${U.gridStr(c.x, c.y)}</span></div>`; }
  el.innerHTML = html + '<div style="margin-top:6px"><button class="btn sm ghost" data-act="sel-close">ปิด</button></div>'; el.hidden = false;
}

/* ---------- แผงงาน ---------- */
function renderPanel(force) {
  if (!S.G) return;
  const html = S.tab === 'task' ? taskHTML() : S.tab === 'ctl' ? ctlHTML() : radioHTML();
  if (force || html !== S.lastPanel) { $('#tabbody').innerHTML = html; S.lastPanel = html; liveUpdate(); }
  for (const b of $$('.tabs button')) { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }
  const n = myPending().length; $('#taskBadge').textContent = n ? String(n) : '';
}
function taskHTML() {
  const G = S.G, seat = G.seat, me = seat ? seatInfo(seat) : null, pend = myPending();
  let h = '';
  if (me) {
    h += `<div class="card"><h3>เรื่องรอตัดสินใจ ${pend.length ? `<span class="badge">${pend.length}</span>` : ''}</h3>${pend.length ? pend.map(d => `<button class="task ${d.urgent ? 'urg' : ''}" data-act="open-dec" data-id="${d.id}"><span class="t">${d.urgent ? '⚡ ' : ''}${esc(d.title)}</span><span class="s">เหลือราว ${Math.max(0, Math.ceil((d.dl - G.t) / 60))} นาที (เวลาในเกม) · แตะเพื่อเปิด</span></button>`).join('') : '<p class="sub">ยังไม่มี เรื่องใหม่จะเด้งขึ้นเอง ระหว่างนี้ติดตามแผนที่และข่ายวิทยุ</p>'}</div>`;
    h += `<div class="card"><h3><span class="chip svc ${SVC[me.svc]}">${me.svc}</span>${esc(me.cs)}</h3><p class="sub">${esc(me.nm)} · ${SIM.LV[me.lv]}</p><p style="margin-top:6px;font-size:14px">${esc(me.d)}</p></div>`;
  } else h += '<div class="card"><h3>ผู้สังเกตการณ์</h3><p class="sub">AI เล่นทุกตำแหน่ง เลือกตำแหน่งจากเมนูด้านบนเพื่อรับหน้าที่ได้ทุกเมื่อ</p></div>';
  return h + objHTML(G) + sitHTML(G);
}
function objHTML(G) {
  return `<div class="card"><h3>เป้าหมายภารกิจ</h3><ul class="objs">${OBJ.map(([k, l]) => `<li class="${G.obj[k] ? 'done' : ''}"><span class="tick">${G.obj[k] ? '✓' : '○'}</span><span>${l}</span><span class="tm">${G.obj[k] ? U.hhmm(G.obj[k]) : ''}</span></li>`).join('')}<li class="${G.civ.evac >= 300 ? 'done' : ''}"><span class="tick">${G.civ.evac >= 300 ? '✓' : '○'}</span><span>พลเรือนถึงเรืออย่างน้อย 300 คน</span><span class="tm">${G.civ.evac}/600</span></li></ul></div>`;
}
function sitHTML(G) {
  const c = G.civ, tw = U.tideWindow();
  return `<div class="card"><h3>ภาพรวมสถานการณ์</h3><dl class="kv">
    <dt>เวลา H</dt><dd>${G.H != null ? U.hhmm(G.H) : 'ยังไม่กำหนด'}</dd>
    <dt>น้ำ</dt><dd>ต้องไม่ต่ำกว่า 2.0 ม. ช่วง ${U.hhmm(tw[0])}–${U.hhmm(tw[1])}</dd>
    <dt>พลเรือน</dt><dd>เมือง ${c.town} · จุดอพยพ ${c.ep} · ถึงเรือ ${c.evac}</dd>
    <dt>บาดเจ็บ</dt><dd>${c.harmF} จากฝ่ายเรา · ${c.harmE} จากข้าศึก</dd>
    <dt>ความเชื่อมั่น</dt><dd>${Math.round(c.trust)}%<div class="meter"><i style="width:${Math.round(c.trust)}%"></i></div></dd>
    <dt>CAS</dt><dd>${SIM.casTxt(G)}</dd>
    <dt>เฮลิคอปเตอร์</dt><dd>${SIM.heloTxt(G)}</dd></dl></div>`;
}
function firesCard(G, n) {
  const ms = G.missions.slice(-(n || 6)).reverse();
  return `<div class="card"><h3>ภารกิจยิง</h3>${ms.length ? `<table class="tbl"><tr><th>ภารกิจ</th><th>เป้าหมาย</th><th>สถานะ</th></tr>${ms.map(m => `<tr><td class="mono">${m.id}</td><td>${esc(m.desc)}<div class="sub mono">${m.grid}</div></td><td>${MST[m.st] || m.st}</td></tr>`).join('')}</table>` : '<p class="sub">ยังไม่มีภารกิจยิง</p>'}</div>`;
}
function airCard(G) {
  const a = [G.u.h1, G.u.h2, G.u.jet];
  return `<div class="card"><h3>อากาศยาน</h3><dl class="kv">${a.map(u => `<dt>${esc(u.cs)}</dt><dd>${u.id === 'h2' ? SIM.heloTxt(G) : u.id === 'h1' ? (SIM.airborne(u) ? 'ลาดตระเวนผิวน้ำ' : 'บนเรือนาคา') : (UST[u.st] || u.st)}</dd>`).join('')}</dl><p class="sub" style="margin-top:6px">มาตรการห้วงอากาศ: ${G.acm === 'gate' ? 'ประตู ก (ควบคุมตามขั้นตอน)' : G.acm === 'direct' ? 'บินตรง ตรวจรายภารกิจ' : G.acm === 'free' ? 'ไม่กำหนด' : 'ยังไม่กำหนด'}</p></div>`;
}
function unitCard(G, seat) {
  const me = seatInfo(seat), u = G.u[SIM.seatUnit(seat)];
  let h = `<div class="card"><h3><span class="chip svc ${SVC[me.svc]}">${me.svc}</span>${esc(me.cs)}</h3>`;
  if (u && SIM.isGround(u)) {
    h += u.emb ? `<p class="sub">อยู่บน${esc(G.u[u.emb].cs)} — รอขึ้นฝั่ง</p>` : `<dl class="kv"><dt>พิกัด</dt><dd class="mono" data-live="mygrid"></dd><dt>สถานะ</dt><dd>${UST[u.st] || u.st}</dd><dt>กำลัง</dt><dd>${Math.round(u.str)}%</dd><dt>รายงานล่าสุด</dt><dd data-live="myrep"></dd></dl>${u.k !== 'fo' ? '<div class="row"><button class="btn sm" data-act="report">รายงานตำแหน่ง</button></div>' : ''}`;
  } else h += `<p class="sub">${esc(me.nm)}</p>`;
  return h + '</div>';
}
function ctlHTML() {
  const G = S.G, seat = G.seat;
  if (!seat) return `<div class="card"><h3>ผู้สังเกตการณ์</h3><p class="sub">เลือกตำแหน่งจากเมนูด้านบนเพื่อเข้าควบคุม หรือเปิดแผงผู้ฝึกเพื่อใส่สถานการณ์</p><div class="row"><button class="btn sm" data-act="wc">เปิดแผงผู้ฝึก</button></div></div>` + firesCard(G) + airCard(G);
  let h = unitCard(G, seat);
  const c = G.civ;
  switch (seat) {
    case 'jtf':
      h += `<div class="card"><h3>สั่งการ</h3><p class="sub">ความเชื่อมั่นพลเรือน ${Math.round(c.trust)}% — การสื่อสารผ่านผู้นำชุมชนเพิ่มความเชื่อมั่น (ใช้ได้ทุก 20 นาที)</p><div class="row"><button class="btn sm" data-act="comm">สื่อสารกับผู้นำชุมชน</button></div></div>` + firesCard(G, 4) + airCard(G); break;
    case 'fscc':
      h += `<div class="card"><h3>การยิงสนับสนุน</h3><p class="sub">${G.artyHold ? 'กำลังระงับการยิงปืนใหญ่ทั้งหมด' : 'ปืนใหญ่ยิงได้ตามการอนุมัติ'}${G.casHold ? ' · ระงับอัตโนมัติระหว่าง CAS' : ''}</p><div class="row"><button class="btn sm ${G.artyHold ? 'warn' : ''}" data-act="artyhold">${G.artyHold ? 'ยกเลิกการระงับ' : 'ระงับการยิงปืนใหญ่ทั้งหมด'}</button></div></div>` + firesCard(G, 8) + airCard(G); break;
    case 'fdc': h += firesCard(G, 10); break;
    case 'fo': {
      const fo = G.u.fo, hs = Object.values(G.h).filter(x => x.known && x.act);
      h += `<div class="card"><h3>เป้าหมายที่ตรวจพบ</h3>${G.relayDown ? '<p class="sub g-poor">ข่ายยิงขัดข้อง — คำขอยิงจะถามช่องทางสำรอง</p>' : ''}${hs.length ? `<table class="tbl"><tr><th>เป้าหมาย</th><th>ทิศ/ระยะ</th><th></th></tr>${hs.map(x => { const busy = G.missions.some(m => m.tgt === x.id && ['cff', 'fdc', 'query', 'fscc', 'hold', 'ready', 'flight', 'lost', 'wait'].includes(m.st)); return `<tr><td>${esc(x.nm)}<div class="sub">${x.str <= 30 ? 'ถูกกดดันแล้ว' : 'ประเมินกำลัง ~' + Math.round(x.str / 10) * 10 + '%'}</div></td><td class="mono">${U.pad3(U.bearing(fo.x, fo.y, x.kx, x.ky))}° ${U.fmt(U.dxy(fo.x, fo.y, x.kx, x.ky))} ม.</td><td><button class="btn sm" data-act="cff" data-t="${x.id}" ${busy || x.str <= 0 ? 'disabled' : ''}>${busy ? 'มีภารกิจ' : 'ขอยิง'}</button></td></tr>`; }).join('')}</table>` : '<p class="sub">ยังไม่พบเป้าหมาย ระยะตรวจการณ์ขึ้นกับแสงและอากาศ</p>'}<p class="sub" style="margin-top:6px">ระยะตรวจการณ์ขณะนี้ราว <span data-live="obsr"></span> ม.</p></div>` + firesCard(G, 4); break; }
    case 'coy': case 'sql': {
      const ps = ['coy', 'p11', 'p12', 'p2', 'p3'].map(id => G.u[id]);
      h += `<div class="card"><h3>หน่วยในกองร้อย</h3><table class="tbl"><tr><th>หน่วย</th><th>สถานะ</th><th>รายงาน</th></tr>${ps.map(u => `<tr><td>${esc(u.cs)}</td><td>${u.emb ? 'บน' + esc(G.u[u.emb].cs) : (UST[u.st] || u.st)} · ${Math.round(u.str)}%</td><td>${u.rep ? Math.round((G.t - u.rep.t) / 60) + ' นาทีก่อน' : '—'}</td></tr>`).join('')}</table></div>`;
      h += `<div class="card"><h3>จุดอพยพ (โรงเรียน)</h3><dl class="kv"><dt>สถานะ</dt><dd>${c.epOpen ? 'เปิดแล้ว' + (c.screen ? ' มีจุดคัดกรอง' : ' ไม่มีจุดคัดกรอง') : 'ยังไม่เปิด'}</dd><dt>รอที่จุดอพยพ</dt><dd>${c.ep} คน</dd><dt>เฮลิคอปเตอร์</dt><dd>${SIM.heloTxt(G)}</dd></dl></div>`; break; }
    case 'cav': case 'jtac': {
      const cv = G.u.cav, halted = cv.st === 'halt' && !G.flags.cavGo;
      h += `<div class="card"><h3>ด่านสกัดถนน (ทางแยก ข)</h3><dl class="kv"><dt>อาชา 6</dt><dd>${cv.emb ? 'อยู่บนเรือยกพล' : UST[cv.st] || cv.st}</dd><dt>รถพลเรือนที่ด่าน</dt><dd>${G.flags.rbSeen ? (c.rb > 0 ? 'ยังอยู่' : 'ออกไปแล้ว') : 'ยังไม่พบด่าน'}</dd><dt>CAS</dt><dd>${SIM.casTxt(G)}</dd><dt>ด่าน</dt><dd>${G.h.R4.str <= 30 ? 'ถูกทำลาย' : G.flags.rbSeen ? 'ยังปิดถนน' : '—'}</dd></dl>${halted ? `<div class="row">${G.cas.st === 'none' ? '<button class="btn sm" data-act="cav" data-k="cas">ขอ CAS</button>' : ''}<button class="btn sm" data-act="cav" data-k="detour">อ้อมผ่าน DT1</button><button class="btn sm warn" data-act="cav" data-k="atk">เข้าตีด่าน</button></div>` : ''}</div>`;
      if (seat === 'jtac') h += airCard(G); break; }
    case 'co': {
      const L = [G.u.lcu1, G.u.lcu2], ct = Object.values(G.c).filter(x => x.st !== 'gone');
      h += `<div class="card"><h3>เรือวารีและอากาศยาน</h3><dl class="kv"><dt>เข็ม/ความเร็ว</dt><dd data-live="shiphdg"></dd><dt>ดาดฟ้าบิน</dt><dd data-live="deckok"></dd>${L.map(l => `<dt>${esc(l.cs)}</dt><dd>${UST[l.st] || l.st}${l.pax ? ` · ${l.pax} คน` : ''}</dd>`).join('')}<dt>เวหา 2</dt><dd>${SIM.heloTxt(G)}${G.u.h2.pax ? ` · ${G.u.h2.pax} คน` : ''}</dd></dl></div>`;
      h += `<div class="card"><h3>เป้าผิวน้ำ</h3>${ct.length ? ct.map(x => `<p>${x.side === 'U' ? '<span class="g-ok">ไม่ทราบฝ่าย</span>' : '<span class="g-good">' + esc(x.nm) + '</span>'} · ระยะ ${U.fmt(U.dxy(x.x, x.y, G.u.wr.x, G.u.wr.y))} ม.</p>`).join('') : '<p class="sub">ไม่มี</p>'}</div>`; break; }
    case 'ood': {
      const s = G.u.wr, hd = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], sp = [0, 3, 6, 10, 14];
      h += `<div class="card"><h3>คุมเรือ</h3><dl class="kv"><dt>ปัจจุบัน</dt><dd data-live="shiphdg"></dd><dt>สั่งไว้</dt><dd data-live="shipcmd"></dd><dt>ลมสัมพัทธ์</dt><dd data-live="relwind"></dd><dt>โคลง</dt><dd data-live="roll"></dd><dt>ดาดฟ้าบิน</dt><dd data-live="deckok"></dd><dt>ขอบพื้นที่</dt><dd data-live="box"></dd></dl>
        <p class="sub" style="margin:8px 0 4px">เข็ม (องศา)</p><div class="helm">${hd.map(v => `<button data-act="helm" data-h="${v}" class="${Math.round(s.cmdH) === v ? 'on' : ''}">${U.pad3(v)}</button>`).join('')}</div>
        <p class="sub" style="margin:8px 0 4px">ความเร็ว (นอต)</p><div class="helm">${sp.map(v => `<button data-act="helm" data-s="${(v / 1.944).toFixed(2)}" class="${Math.round(s.cmdS * 1.944) === v ? 'on' : ''}">${v}</button>`).join('')}</div>
        <p class="sub" style="margin-top:8px">เคล็ดลับ: หันหัวเรือเข้าหาลม (ลมจาก <span data-live="wdir"></span>) แล้วลดความเร็วเมื่อลมแรง เพื่อให้ลมสัมพัทธ์ไม่เกิน 35 นอต</p></div>`; break; }
    case 'fdo':
      h += `<div class="card"><h3>ดาดฟ้าบิน</h3><dl class="kv"><dt>ลมสัมพัทธ์</dt><dd data-live="relwind"></dd><dt>โคลง</dt><dd data-live="roll"></dd><dt>สรุป</dt><dd data-live="deckok"></dd><dt>เวหา 2</dt><dd>${SIM.heloTxt(G)}</dd></dl><p class="sub" style="margin-top:6px">เกณฑ์ (ค่าสาธิต): ลมสัมพัทธ์ ±30° ไม่เกิน 35 นอต · โคลงไม่เกิน 4.5° ระบบจะถามไฟเขียว/แดงทุกครั้งที่เฮลิคอปเตอร์กลับ</p></div>`; break;
    case 'helo':
      h += `<div class="card"><h3>เวหา 2</h3><dl class="kv"><dt>สถานะ</dt><dd>${SIM.heloTxt(G)}</dd><dt>เที่ยวบิน</dt><dd>${G.u.h2.trip}</dd><dt>ผู้โดยสาร</dt><dd>${G.u.h2.pax} คน</dd><dt>รอที่จุดอพยพ</dt><dd>${c.ep} คน</dd><dt>ดาดฟ้า</dt><dd data-live="deckok"></dd></dl><div class="row"><button class="btn sm" data-act="practice">ซ้อมลงจอดบนเรือ</button></div><p class="sub" style="margin-top:6px">ทุกครั้งที่ได้ไฟเขียว ท่านต้องลงจอดเองในมินิเกม</p></div>` + airCard(G); break;
    case 'lead':
      h += `<div class="card"><h3>อินทรี 1-2</h3><dl class="kv"><dt>สถานะ</dt><dd>${UST[G.u.jet.st] || G.u.jet.st}</dd><dt>CAS</dt><dd>${SIM.casTxt(G)}</dd><dt>ถึงเกณฑ์กลับฐาน</dt><dd data-live="bingo"></dd></dl></div>` + airCard(G); break;
  }
  return h;
}
const LIVE = {
  mygrid: G => { const u = G.u[SIM.seatUnit(G.seat)]; return u ? U.gridStr(u.x, u.y) : '—'; },
  myrep: G => { const u = G.u[SIM.seatUnit(G.seat)]; return u && u.rep ? Math.round((G.t - u.rep.t) / 60) + ' นาทีก่อน' : 'ยังไม่เคย'; },
  shiphdg: G => `${U.pad3(G.u.wr.hdg)}° · ${Math.round(G.u.wr.spd * 1.944)} นอต`,
  shipcmd: G => `${U.pad3(G.u.wr.cmdH)}° · ${Math.round(G.u.wr.cmdS * 1.944)} นอต`,
  relwind: G => { const d = SIM.deck(G); return `${d.ang >= 0 ? '+' : ''}${Math.round(d.ang)}° · ${Math.round(d.kt)} นอต`; },
  roll: G => SIM.deck(G).roll.toFixed(1) + '°',
  deckok: G => SIM.deck(G).ok ? '✓ อยู่ในเกณฑ์' : '✗ นอกเกณฑ์',
  wdir: G => U.pad3(G.wx.wdir) + '°',
  box: G => { const s = G.u.wr, b = W.box; const d = Math.min(s.x - b.x0, b.x1 - s.x, s.y - b.y0, b.y1 - s.y); return d < 0 ? 'อยู่นอกพื้นที่!' : U.fmt(d) + ' ม.'; },
  bingo: G => { const m = Math.round((G.bingo - G.t) / 60); return m > 0 ? m + ' นาที' : 'ถึงแล้ว'; },
  obsr: G => U.fmt(5000 * U.light(G.t) * G.wx.vis)
};
function liveUpdate() {
  if (!S.G) return;
  for (const el of $$('[data-live]', $('#tabbody'))) { const f = LIVE[el.dataset.live]; if (f) { const v = f(S.G); if (el.textContent !== v) el.textContent = v; if (el.dataset.live === 'deckok') el.className = 'deckok ' + (SIM.deck(S.G).ok ? 'y' : 'n'); } }
}
function radioHTML() {
  const G = S.G;
  const chips = ['all'].concat(NETS).map(n => `<button class="${S.net === n ? 'on' : ''}" data-act="net" data-net="${n}">${n === 'all' ? 'ทั้งหมด' : n}</button>`).join('');
  const items = G.log.filter(e => S.net === 'all' ? (e.n || e.s >= 2) : e.n === S.net).slice(-70).reverse();
  return `<div class="net-chips">${chips}</div><ul class="radio">${items.map(e => `<li class="s${e.s}"><span class="tm">${U.hhmm(e.t)}</span>${esc(e.x)}${e.n ? `<span class="net">· ${e.n}</span>` : ''}</li>`).join('')}</ul>`;
}

/* ---------- แผ่นตัดสินใจ ---------- */
function syncDecisions() {
  const mine = myPending();
  if (S.sheet && !mine.find(d => d.id === S.sheet)) hideSheet();
  if (!S.sheet) { const next = mine.find(d => d.urgent) || mine.find(d => !S.minimized[d.id]); if (next) openSheet(next.id); }
  else { const cur = mine.find(d => d.id === S.sheet), urg = mine.find(d => d.urgent && d.id !== S.sheet); if (urg && cur && !cur.urgent) { S.minimized[cur.id] = true; openSheet(urg.id); } }
  if (S.sheet) { const d = mine.find(x => x.id === S.sheet); if (d) { const total = d.dl - d.t0, left = Math.max(0, d.dl - S.G.t); const bar = $('#shBar'), lt = $('#shLeft'); if (bar) bar.style.width = (100 * left / total).toFixed(1) + '%'; if (lt) lt.textContent = `เหลือ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; } }
}
function openSheet(id) {
  const d = S.G.pend.find(x => x.id === id); if (!d) return;
  S.sheet = id; delete S.minimized[id];
  const me = seatInfo(d.seat), el = $('#sheet');
  el.className = 'sheet' + (d.urgent ? ' urgent' : '');
  el.innerHTML = `<div class="sh-head"><span class="chip svc ${SVC[me.svc]}">${esc(me.cs)}</span><h3 id="shTitle">${d.urgent ? '⚡ ' : ''}${esc(d.title)}</h3>${d.urgent ? '' : '<button class="btn sm ghost" data-act="sh-min">ย่อไว้</button>'}</div>
    <div class="sh-timer"><div class="bar2"><i id="shBar"></i></div><span id="shLeft"></span></div>
    <p class="sh-body">${esc(d.body)}</p>
    <div class="sh-info"><b>ข้อมูลที่มีในขณะนี้</b>${esc(d.info)}</div>
    <div class="sh-opts">${d.opts.map(o => `<button class="sh-opt" data-act="choose" data-k="${esc(o.k)}">${esc(o.l)}</button>`).join('')}</div>
    <p class="fine sh-foot">${d.urgent ? 'เร่งด่วน: เวลาเดินจริง ×1 · ' : ''}หมดเวลาแล้วระบบเลือกค่าเริ่มต้นให้ · AAR ประเมินจากข้อมูลขณะตัดสินใจ ไม่ใช่ผลลัพธ์</p>`;
  el.hidden = false; $('#scrim').hidden = !d.urgent;
  if (d.urgent) { const b = el.querySelector('.sh-opt'); if (b) b.focus({ preventScroll: true }); }
}
function hideSheet() { const el = $('#sheet'); if (el) el.hidden = true; const sc = $('#scrim'); if (sc) sc.hidden = true; if (S) S.sheet = null; }
function choose(k) {
  const id = S.sheet; const d = S.G.pend.find(x => x.id === id); if (!d) { hideSheet(); return; }
  const o = d.opts.find(x => x.k === k); SIM.decide(S.G, id, k); hideSheet();
  toast('ตัดสินใจแล้ว: ' + (o ? o.l : ''), 1); renderPanel(true);
}

/* ---------- แจ้งเตือน ---------- */
function toast(msg, sev) {
  const box = $('#toasts'); if (!box || S.screen !== 'game') return;
  const el = document.createElement('div'); el.className = 'toast s' + (sev || 1); el.textContent = msg;
  box.prepend(el); while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => el.remove(), sev >= 3 ? 7000 : 5000);
}
function syncToasts() {
  const G = S.G, L = G.log, nets = G.seat ? SEATNETS[G.seat] : null; let n = 0;
  for (let i = S.seenLog; i < L.length; i++) { const e = L[i]; if (e.c === 'task' || e.c === 'sys' && e.s < 2) continue; if (e.s >= 2 || (e.s >= 1 && nets && e.n && nets.includes(e.n))) { if (n++ < 2) toast(`${U.hhmm(e.t)} ${e.x}`, e.s); } }
  S.seenLog = L.length;
}

/* ---------- ผู้ฝึก ---------- */
function openDrawer() {
  const el = $('#drawer');
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><h3 style="flex:1">แผงผู้ฝึก (White cell)</h3><button class="btn sm ghost" data-act="wc-close">ปิด</button></div>
    <label class="check"><input type="checkbox" data-chk="truth" ${S.truth ? 'checked' : ''}><span>แสดงความจริงบนแผนที่ (ตำแหน่งจริงของทุกหน่วยและข้าศึก เทียบกับภาพที่ผู้เล่นเห็น)</span></label>
    <div><p class="sub" style="margin-bottom:6px">ใส่สถานการณ์ทันที</p><div class="inj">${Object.entries(SIM.INJ).map(([k, l]) => `<button class="btn sm" data-act="inject" data-k="${k}">${esc(l)}</button>`).join('')}</div></div>
    <div><p class="sub" style="margin-bottom:6px">ข้ามเวลา (เรื่องที่รอตัดสินใจอาจหมดเวลา)</p><div class="row" style="margin:0"><button class="btn sm" data-act="skip" data-s="300">+5 นาที</button><button class="btn sm" data-act="skip" data-s="900">+15 นาที</button></div></div>
    <p class="fine">ตั้งเวลาไว้แล้ว: เรือประมง 06:05 · พิกัดผิดในคำขอยิงหลัง 06:15 · ข่ายยิงขัดข้อง 06:38 · พายุ 06:50 · คลิปปลอม 07:00 · เหตุในเมือง 07:10</p>`;
  el.hidden = false;
}

/* ---------- มินิเกมลงจอด ---------- */
function syncMG() { const G = S.G; if (G.mg && G.seat === 'helo' && !MG && !G.over) openMG(false); }
function openMG(practice) {
  const G = S.G; const amp = practice ? 2.8 : Math.min(14, G.mg.amp * (G.mg.forced ? 1.25 : 1));
  MG = { practice, t: 0, amp, ss: practice ? 3 : G.mg.ss, z: 14, vz: 0, hold: false, done: false, msg: '', res: null };
  $('#mgMode').textContent = practice ? 'โหมดซ้อม' : (G.mg.forced ? 'ดาดฟ้านอกเกณฑ์!' : 'ภารกิจจริง');
  $('#mg').hidden = false; S.mgOpen = true;
  const c = $('#mgc'), r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  $('#mgDown').focus({ preventScroll: true });
}
function deckAt(t) {
  const env = 0.45 + 0.55 * Math.abs(Math.sin(2 * Math.PI * t / 29));
  const k = MG.ss / 3, w = 2 * Math.PI / 6.1;
  return { roll: MG.amp * Math.sin(2 * Math.PI * t / 8.4) * env, heave: 0.45 * k * Math.sin(w * t + 1), hv: 0.45 * k * w * Math.cos(w * t + 1) };
}
function mgEnd(res) {
  if (!MG) return; const practice = MG.practice; $('#mg').hidden = true; S.mgOpen = false; MG = null;
  if (practice) { toast(res === 'ok' ? 'ซ้อมลงจอด: เรียบร้อย' : res === 'waveoff' ? 'ซ้อมลงจอด: ยกเลิก' : 'ซ้อมลงจอด: ' + (res === 'hard' ? 'ลงจอดแข็ง' : 'ลงจอดรุนแรง'), 1); return; }
  if (res === 'auto') SIM.mgAuto(S.G); else SIM.mgResult(S.G, res);
}
function mgFrame(dt) {
  if (!MG) return;
  if (!MG.done) {
    MG.t += dt;
    MG.vz += ((MG.hold ? -2.3 : 0.5) - MG.vz) * Math.min(1, 1.7 * dt);
    MG.z = Math.min(26, MG.z + MG.vz * dt);
    const d = deckAt(MG.t);
    if (MG.z <= d.heave) {
      const vr = Math.abs(MG.vz - d.hv), r = Math.abs(d.roll);
      const res = vr <= 1.2 && r <= 3.5 ? 'ok' : vr <= 2.4 && r <= 6 ? 'hard' : 'damage';
      MG.done = true; MG.res = res; MG.z = d.heave;
      MG.msg = (res === 'ok' ? 'ลงจอดเรียบร้อย' : res === 'hard' ? 'ลงจอดแข็ง' : 'ลงจอดรุนแรง') + ` — อัตราลด ${vr.toFixed(1)} ม./วิ · โคลง ${r.toFixed(1)}°`;
      setTimeout(() => mgEnd(res), 1700);
    } else if (MG.t > 45) { MG.done = true; MG.msg = 'หมดเวลา — ยกเลิกการลงจอด'; setTimeout(() => mgEnd('waveoff'), 1300); }
  }
  drawMG();
}
function drawMG() {
  const c = $('#mgc'); if (!c || !MG) return; const ctx = c.getContext('2d'), w = c.width / dpr, h = c.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const d = deckAt(MG.t), sc = h / 24, cx = w / 2, deckY = h * 0.66 - d.heave * sc;
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#16263a'); g.addColorStop(1, '#0b1826'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0d2b42'; ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.8 + Math.sin(x / 38 + MG.t * 1.3) * 4 * MG.ss / 3);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.translate(cx, deckY); ctx.rotate(d.roll * Math.PI / 180);
  ctx.fillStyle = '#2a3646'; ctx.beginPath(); ctx.moveTo(-8 * sc, 0); ctx.lineTo(8 * sc, 0); ctx.lineTo(6 * sc, 7 * sc); ctx.lineTo(-6 * sc, 7 * sc); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3d4b5c'; ctx.fillRect(-8 * sc, -0.35 * sc, 16 * sc, 0.5 * sc);
  ctx.strokeStyle = '#f2b134'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1.8 * sc, -0.4 * sc); ctx.lineTo(1.8 * sc, -0.4 * sc); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,237,245,.7)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, -0.4 * sc); ctx.lineTo(0, 6 * sc); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  const hy = h * 0.66 - MG.z * sc;
  ctx.save(); ctx.translate(cx, hy);
  ctx.strokeStyle = '#cfe4ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7 * sc, -3.6 * sc); ctx.lineTo(7 * sc, -3.6 * sc); ctx.stroke();
  ctx.fillStyle = '#5aa9ff'; ctx.beginPath(); ctx.ellipse(0, -1.7 * sc, 1.6 * sc, 1.7 * sc, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9ad1f5'; ctx.beginPath(); ctx.moveTo(0, -3.4 * sc); ctx.lineTo(0, -3.6 * sc); ctx.moveTo(-1.2 * sc, -0.1 * sc); ctx.lineTo(-1.6 * sc, 0); ctx.moveTo(1.2 * sc, -0.1 * sc); ctx.lineTo(1.6 * sc, 0); ctx.stroke();
  ctx.restore();
  const r = Math.abs(d.roll), okRoll = r <= 3.5;
  ctx.fillStyle = okRoll ? '#47c78a' : '#ff6b6b'; ctx.beginPath(); ctx.arc(w - 22, 22, 9, 0, Math.PI * 2); ctx.fill();
  ctx.font = "600 12px 'Chakra Petch','IBM Plex Sans Thai',sans-serif"; ctx.fillStyle = '#e6edf5'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(okRoll ? 'ดาดฟ้านิ่ง' : 'ดาดฟ้าโคลง', w - 38, 22);
  if (MG.msg) { ctx.fillStyle = 'rgba(6,10,16,.78)'; ctx.fillRect(0, h / 2 - 22, w, 44); ctx.fillStyle = MG.res === 'ok' ? '#47c78a' : MG.res === 'hard' ? '#f2b134' : MG.res ? '#ff6b6b' : '#e6edf5'; ctx.textAlign = 'center'; ctx.font = "700 15px 'Chakra Petch','IBM Plex Sans Thai',sans-serif"; ctx.fillText(MG.msg, w / 2, h / 2); }
  const vr = MG.vz - d.hv, alt = Math.max(0, MG.z - d.heave);
  const hud = `<div><span>สูงจากดาดฟ้า</span><b>${alt.toFixed(1)} ม.</b></div><div class="${Math.abs(vr) <= 1.2 ? 'y' : 'n'}"><span>อัตราลดสัมพัทธ์</span><b>${vr.toFixed(1)} ม./วิ</b></div><div class="${okRoll ? 'y' : 'n'}"><span>โคลงดาดฟ้า</span><b>${d.roll.toFixed(1)}°</b></div><div><span>เวลาที่เหลือ</span><b>${Math.max(0, 45 - MG.t).toFixed(0)} วิ</b></div>`;
  const hb = $('#mgHud'); if (hb.innerHTML !== hud) hb.innerHTML = hud;
}

/* ---------- AAR ---------- */
function goAAR() { S.aar.i = -1; show('aar'); }
function stormAt(G, t) { return SIM.stormAt(G, t); }
function snapScene(G, i, mode) {
  const s = G.snaps[i], truth = mode === 'truth', mine = SIM.seatUnit(G.seat);
  const units = [], hostiles = [], contacts = [], all = SIM.snapUnits(G, s), wr = all.find(a => a.id === 'wr'), nk = all.find(a => a.id === 'nk');
  for (const a of all) {
    const u = G.u[a.id]; if (a.emb || a.x < 0) continue;
    if (u.k === 'helo' && (Math.hypot(a.x - wr.x, a.y - wr.y) < 60 || Math.hypot(a.x - nk.x, a.y - nk.y) < 60)) continue;
    let x = a.x, y = a.y, age = 0;
    if (!truth && !u.live && a.id !== mine) { if (a.rx == null) continue; x = a.rx; y = a.ry; }
    units.push({ id: a.id, k: u.k, cs: u.cs, x, y, hdg: a.hdg, age, mine: a.id === mine, hqu: u.hqu, t: s.t });
  }
  for (const a of SIM.snapHostiles(G, s)) {
    const h = G.h[a.id]; if (!a.act && a.kx == null) continue;
    const o = { id: a.id, k: h.k, nm: h.nm, str: a.str, label: h.nm, x: a.kx, y: a.ky };
    if (truth && a.act && a.str > 0) { o.ghost = true; o.tx = a.x; o.ty = a.y; }
    if (o.x != null || o.ghost) hostiles.push(o);
  }
  for (const c of s.c) contacts.push({ id: c[0], x: c[1] * 10, y: c[2] * 10, side: c[3], nm: c[0] === 'boat' ? 'เรือประมง' : 'เรือพลเรือน' });
  const fires = s.f.map(f => ({ x: f[0] * 10, y: f[1] * 10, st: 'flight', shot: s.t - 20, splash: s.t + 20, id: '' }));
  const fx = G.missions.filter(m => m.imp && m.t.splash <= s.t && s.t - m.t.splash < 60).map(m => ({ k: 'splash', x: m.imp.x, y: m.imp.y, t: s.t - Math.min(18, s.t - m.t.splash) }));
  return { t: s.t, light: U.light(s.t), storm: stormAt(G, s.t), acm: G.acm, truth, units, hostiles, contacts, routes: [], fires, fx, cas: null, civ: { town: s.civ[0], ep: s.civ[1], epOpen: !!(G.obj.ep && s.t >= G.obj.ep), rb: 0, rbSeen: false } };
}
let aarCam = null;
function drawAAR() {
  const G = S.G, cv = $('#aarMap'); if (!G || !cv || !G.snaps.length) return;
  const r = cv.getBoundingClientRect(); if (r.width < 10) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const want = Math.round(r.width * dpr); if (cv.width !== want) { cv.width = want; cv.height = Math.round(r.height * dpr); }
  aarCam = { w: r.width, h: r.height, cx: 0, cy: 0, s: 1 }; R.fit(aarCam);
  const i = Math.max(0, Math.min(G.snaps.length - 1, S.aar.i));
  R.draw(cv.getContext('2d'), aarCam, dpr, snapScene(G, i, S.aar.mode));
  const lab = $('#rpTime'); if (lab) lab.textContent = `${U.hhmm(G.snaps[i].t)} (${SIM.hrel(G, G.snaps[i].t)})`;
  const rg = $('#rpRange'); if (rg && +rg.value !== i) rg.value = i;
}
let aarAcc = 0;
function aarFrame(dt) { if (!S.aar.play || !S.G) return; aarAcc += dt; if (aarAcc > 0.12) { aarAcc = 0; S.aar.i++; if (S.aar.i >= S.G.snaps.length - 1) { S.aar.i = S.G.snaps.length - 1; S.aar.play = false; const b = $('#rpPlay'); if (b) b.textContent = '▶ เล่น'; } drawAAR(); } }
function decHTML(d) {
  const me = seatInfo(d.seat) || { cs: 'ผู้สังเกตการณ์' };
  return `<details class="dec"><summary><span class="tm">${U.hhmm(d.t0)}</span><span class="gchip ${d.g}">${GR[d.g]}</span><span class="tt">${esc(d.title)}</span><span class="chip">${esc(me.cs)}</span><span class="chip ghost">${d.by === 'player' ? 'ผู้เล่น' : d.by === 'timeout' ? 'หมดเวลา' : 'AI'}</span></summary>
    <div class="dd">${d.body ? `<div><b>สถานการณ์:</b> ${esc(d.body)}</div>` : ''}${d.info ? `<div><b>ข้อมูลที่มีในขณะนั้น:</b> ${esc(d.info)}</div>` : ''}<div><b>ที่เลือก:</b> ${esc(d.choice)}</div><div><b>เหตุผลของคะแนน:</b> ${esc(d.why)}</div>${d.opts ? `<div><b>ทางเลือกทั้งหมด:</b> ${d.opts.map(o => `${esc(o.l)} <span class="g-${o.g}">(${GR[o.g]})</span>`).join(' · ')}</div>` : ''}</div></details>`;
}
function renderAAR() {
  const G = S.G; if (!G) { show('intro'); return; }
  const s = SIM.summary(G), me = G.seat ? seatInfo(G.seat) : null;
  $('#aarSeat').textContent = (me ? `${me.cs} · ${me.nm}` : 'ผู้สังเกตการณ์') + ` · จบเมื่อ ${U.hhmm(G.t)}`;
  if (S.aar.i < 0 || S.aar.i >= G.snaps.length) S.aar.i = G.snaps.length - 1;
  const M = (v, l, cls) => `<div class="metric ${cls || ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const metrics = [
    M(s.evac, 'พลเรือนถึงเรือ (จาก 600)', s.evac >= 300 ? 'goodm' : ''), M(s.safe, 'ปลอดภัยรวม (ถึงเรือ + อยู่ในจุดอพยพ)'),
    M(s.harmF, 'พลเรือนบาดเจ็บจากฝ่ายเรา', s.harmF ? 'bad' : 'goodm'), M(s.frat, 'ยิงฝ่ายเดียวกัน', s.frat ? 'bad' : 'goodm'),
    M(s.near, 'อาวุธตกเฉียดฝ่ายเดียวกัน', s.near ? 'bad' : ''), M(s.air, 'อากาศยานผ่านแนวยิงขณะยิง', s.air ? 'bad' : 'goodm'),
    M(s.roe + s.nfa, 'ละเมิด ROE / เขตห้ามยิง', (s.roe + s.nfa) ? 'bad' : 'goodm'), M(s.cffAvg ? Math.round(s.cffAvg) + ' วิ' : '—', 'เวลาเฉลี่ย ขอยิง → ยิง'),
    M(`${s.cfOk}/${s.cf}`, 'ทักท้วงที่สมเหตุสมผล'), M(s.caught, 'ความผิดพลาดที่จับได้ก่อนเกิดผล'),
    M(s.incidents + s.deckRisk, 'เหตุความปลอดภัยการบิน/เรือ', (s.incidents + s.deckRisk) ? 'bad' : ''), M(`${s.trust}%`, 'ความเชื่อมั่นพลเรือนตอนจบ')
  ].join('');
  const objs = OBJ.map(([k, l]) => `<li class="${G.obj[k] ? 'done' : ''}"><span class="tick">${G.obj[k] ? '✓' : '○'}</span><span>${l}</span><span class="tm">${G.obj[k] ? U.hhmm(G.obj[k]) : 'ไม่สำเร็จ'}</span></li>`).join('');
  const decs = G.decs.filter(d => S.aar.mine ? d.by !== 'ai' : true);
  const evs = G.log.filter(e => e.c !== 'task' && (S.aar.filter === 'all' ? e.s >= 1 : e.c === S.aar.filter));
  $('#aar').innerHTML = `
    <section class="span2"><h3>ผลลัพธ์</h3><div class="metrics">${metrics}</div><p class="fine" style="margin-top:8px">${me ? `การตัดสินใจของท่าน: ดี ${s.dec.good} · พอใช้ ${s.dec.ok} · ควรทบทวน ${s.dec.poor} (รวม ${s.dec.n})` : 'โหมดผู้สังเกตการณ์: การตัดสินใจทั้งหมดทำโดย AI'} · ผลลัพธ์กับคุณภาพการตัดสินใจแยกกัน การตัดสินใจที่ดีอาจเจอผลร้ายได้ และกลับกัน</p></section>
    <section><h3>เล่นซ้ำ</h3><canvas id="aarMap" aria-label="แผนที่เล่นซ้ำ"></canvas>
      <div class="rp-ctl"><button class="btn sm" id="rpPlay" data-act="aar-play">${S.aar.play ? '⏸ หยุด' : '▶ เล่น'}</button><input type="range" id="rpRange" min="0" max="${G.snaps.length - 1}" value="${S.aar.i}" aria-label="เลื่อนเวลา"><span id="rpTime" class="mono"></span></div>
      <div class="rp-ctl"><span class="seg" role="group" aria-label="มุมมอง"><button class="${S.aar.mode === 'cop' ? 'on' : ''}" data-act="aar-mode" data-m="cop">ภาพที่ผู้เล่นเห็น</button><button class="${S.aar.mode === 'truth' ? 'on' : ''}" data-act="aar-mode" data-m="truth">ความจริง</button></span><span class="fine">เทียบสองมุมมองเพื่อดูว่าภาพสถานการณ์ล้าหลังตรงไหน</span></div></section>
    <section><h3>เป้าหมายภารกิจ</h3><ul class="objs">${objs}<li class="${s.evac >= 300 ? 'done' : ''}"><span class="tick">${s.evac >= 300 ? '✓' : '○'}</span><span>พลเรือนถึงเรืออย่างน้อย 300 คน</span><span class="tm">${s.evac}/600</span></li></ul></section>
    <section class="span2"><h3>การตัดสินใจ</h3><div class="rp-ctl" style="margin:0 0 8px"><span class="seg"><button class="${S.aar.mine ? 'on' : ''}" data-act="aar-mine" data-v="1">${me ? 'ของท่าน' : 'ผู้เล่น'}</button><button class="${S.aar.mine ? '' : 'on'}" data-act="aar-mine" data-v="0">ทั้งหมดรวม AI</button></span><span class="fine">แตะแต่ละรายการเพื่อดู "ข้อมูลที่มีในขณะนั้น" และเหตุผลของคะแนน</span></div>${decs.length ? decs.map(decHTML).join('') : '<p class="fine">ไม่มีรายการ</p>'}</section>
    <section><h3>เหตุการณ์</h3><div class="net-chips" style="margin-bottom:8px">${Object.entries(EVCAT).map(([k, l]) => `<button class="${S.aar.filter === k ? 'on' : ''}" data-act="aar-filter" data-f="${k}">${l}</button>`).join('')}</div><ul class="radio evlist">${evs.map(e => `<li class="s${e.s}"><span class="tm">${U.hhmm(e.t)}</span>${esc(e.x)}</li>`).join('')}</ul></section>
    <section class="q4"><h3>คำถามทบทวน 4 ข้อ</h3>${AARQ.map((q, i) => `<label for="aq${i}">${i + 1}. ${q}</label><textarea id="aq${i}" data-aq="${i}">${esc(S.aar.ans[i])}</textarea>`).join('')}<div class="row"><button class="btn sm primary" data-act="copy-aar">คัดลอกสรุป AAR</button></div></section>`;
  requestAnimationFrame(drawAAR);
}
function aarText() {
  const G = S.G, s = SIM.summary(G), me = G.seat ? seatInfo(G.seat) : null;
  const lines = [`สรุป AAR — คลื่นมรกต (ต้นแบบ v0.1)`, `ตำแหน่ง: ${me ? me.cs + ' · ' + me.nm : 'ผู้สังเกตการณ์'} · จบเมื่อ ${U.hhmm(G.t)}`, '',
    `พลเรือนถึงเรือ ${s.evac}/600 · ปลอดภัยรวม ${s.safe} · บาดเจ็บจากฝ่ายเรา ${s.harmF}`, `ยิงฝ่ายเดียวกัน ${s.frat} · เฉียด ${s.near} · อากาศยานผ่านแนวยิง ${s.air} · ละเมิด ROE/เขตห้ามยิง ${s.roe + s.nfa}`,
    `ทักท้วงสมเหตุสมผล ${s.cfOk}/${s.cf} · จับความผิดพลาดได้ ${s.caught}`, '', 'การตัดสินใจ:'];
  for (const d of G.decs.filter(x => x.by !== 'ai')) lines.push(`- ${U.hhmm(d.t0)} ${d.title}: ${d.choice} [${GR[d.g]}]`);
  lines.push('');
  AARQ.forEach((q, i) => lines.push(`${i + 1}. ${q}`, '   ' + (S.aar.ans[i] || '-')));
  return lines.join('\n');
}

/* ---------- หน้าสมมติฐาน ---------- */
function renderAssume() {
  const rows = ASSUME.map((a, i) => { const r = REVIEW[i] || {}; return `<div class="arow"><span><span class="chip svc ${SVC[a.g]}">${a.g}</span></span><div class="t">${esc(a.t)}</div><div class="v">${esc(a.v)}</div><div class="rv"><select data-rev="${i}" aria-label="ผลการตรวจ: ${esc(a.t)}"><option value="">ยังไม่ตรวจ</option><option value="ok" ${r.s === 'ok' ? 'selected' : ''}>ถูกต้อง</option><option value="fix" ${r.s === 'fix' ? 'selected' : ''}>ต้องแก้</option></select><input data-note="${i}" placeholder="หมายเหตุ / ค่าที่ถูก" value="${esc(r.n || '')}" aria-label="หมายเหตุ: ${esc(a.t)}"></div></div>`; }).join('');
  const done = Object.values(REVIEW).filter(r => r && r.s).length;
  $('#assume').innerHTML = `<p class="intro-note">ส่งหน้านี้ให้เพื่อนจากเหล่าที่เกี่ยวข้องตรวจทีละข้อ เลือก "ถูกต้อง" หรือ "ต้องแก้" พร้อมหมายเหตุ แล้วกด "คัดลอกผลการตรวจ" ส่งกลับมา ผลจะบันทึกไว้ในเบราว์เซอร์ของผู้ตรวจเท่านั้น · ตรวจแล้ว ${done}/${ASSUME.length} ข้อ</p><div class="arow ahead"><span>เหล่า</span><span>หัวข้อ</span><span>ค่าที่ใช้ในต้นแบบ</span><span>ผลการตรวจ</span></div>${rows}`;
}
function reviewText() {
  const lines = ['ผลการตรวจสมมติฐานหลักนิยม — คลื่นมรกต (ต้นแบบ v0.1)', ''];
  ASSUME.forEach((a, i) => { const r = REVIEW[i] || {}; lines.push(`[${a.g}] ${a.t}: ${r.s === 'ok' ? 'ถูกต้อง' : r.s === 'fix' ? 'ต้องแก้' : 'ยังไม่ตรวจ'}${r.n ? ' — ' + r.n : ''}`); });
  return lines.join('\n');
}

/* ---------- กล่องโต้ตอบ / คัดลอก ---------- */
function dialog(html, buttons) {
  $('#dlgBox').innerHTML = html + `<div class="dlg-actions">${buttons.map(b => `<button class="btn ${b[2] || ''}" data-act="${b[1]}">${b[0]}</button>`).join('')}</div>`;
  $('#dlg').hidden = false; S.dialogOpen = true;
  const f = $('#dlgBox .dlg-actions .btn'); if (f) f.focus({ preventScroll: true });
}
function closeDialog() { $('#dlg').hidden = true; S.dialogOpen = false; }
function copyText(txt, btn) {
  const fallback = () => { dialog(`<h3>คัดลอกข้อความ</h3><p class="fine" style="margin-bottom:8px">คัดลอกจากกล่องด้านล่าง</p><textarea readonly>${esc(txt)}</textarea>`, [['ปิด', 'dlg-close', 'primary']]); setTimeout(() => { const t = $('#dlgBox textarea'); if (t) { t.focus(); t.select(); } }, 30); };
  try { navigator.clipboard.writeText(txt).then(() => { if (btn) { const o = btn.textContent; btn.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => { btn.textContent = o; }, 1600); } }, fallback); } catch (e) { fallback(); }
}

/* ---------- การกระทำ ---------- */
const ACT = {
  'go-intro': () => show('intro'), 'go-lobby': () => show('lobby'), 'go-assume': () => show('assume'),
  help: () => dialog(HELP, [['เข้าใจแล้ว', 'dlg-close', 'primary']]), 'dlg-close': () => closeDialog(),
  pick: b => { S.lobbySel = b.dataset.seat; renderLobby(); if (window.innerWidth < 900) $('#seatinfo').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  quiz: b => { const id = S.lobbySel, i = +b.dataset.i, q = seatInfo(id).q; S.quiz[id] = { pick: i }; if (i === q.c) S.licensed[id] = true; renderLobby(); },
  skipquiz: () => { S.licensed[S.lobbySel] = true; renderLobby(); },
  start: b => startGame(b.dataset.seat),
  speed: b => { S.scale = +b.dataset.v; buildTop(); },
  wc: () => openDrawer(), 'wc-close': () => { $('#drawer').hidden = true; },
  inject: b => { SIM.inject(S.G, b.dataset.k); toast('ผู้ฝึก: ' + SIM.INJ[b.dataset.k], 2); },
  skip: b => { SIM.step(S.G, +b.dataset.s); toast('ข้ามเวลาไป ' + (+b.dataset.s / 60) + ' นาที', 1); },
  end: () => dialog(`<h3>จบการฝึกตอนนี้?</h3><p>ระบบจะสรุปผลถึงเวลา ${U.hhmm(S.G.t)} แล้วเปิดหน้าทบทวนหลังการฝึก (AAR)</p>`, [['เล่นต่อ', 'dlg-close', ''], ['ไปที่ AAR', 'end-yes', 'primary']]),
  'end-yes': () => { closeDialog(); SIM.finish(S.G); goAAR(); },
  zin: () => zoomAt(S.cam.w / 2, S.cam.h / 2, 1.4), zout: () => zoomAt(S.cam.w / 2, S.cam.h / 2, 1 / 1.4), zfit: () => R.fit(S.cam),
  zme: () => { const u = S.G.u[SIM.seatUnit(S.G.seat)] || S.G.u.wr; const p = SIM.cop(S.G, u) || u; S.cam.cx = p.x; S.cam.cy = p.y; S.cam.s = Math.max(S.cam.s, 0.06); },
  legend: () => { const l = $('#legend'); l.hidden = !l.hidden; },
  'sel-close': () => { S.sel = null; renderSel(); },
  checkfire: () => { SIM.act(S.G, 'checkfire'); toast('ระงับการยิง! ภารกิจที่ยังไม่ยิงถูกส่งกลับไปตรวจใหม่', 3); renderPanel(true); },
  'open-dec': b => openSheet(b.dataset.id), choose: b => choose(b.dataset.k),
  'sh-min': () => { S.minimized[S.sheet] = true; hideSheet(); renderPanel(true); },
  net: b => { S.net = b.dataset.net; renderPanel(true); },
  report: () => { if (SIM.act(S.G, 'report')) { toast('รายงานตำแหน่งแล้ว', 1); renderPanel(true); } },
  cff: b => { if (SIM.act(S.G, 'cff', { tgt: b.dataset.t })) toast('ส่งคำขอยิงแล้ว', 1); else toast('ส่งไม่ได้ — มีภารกิจค้างอยู่หรือเป้าหมายถูกทำลายแล้ว', 2); renderPanel(true); },
  helm: b => { const s = S.G.u.wr; SIM.act(S.G, 'helm', { h: b.dataset.h != null ? +b.dataset.h : s.cmdH, s: b.dataset.s != null ? +b.dataset.s : s.cmdS }); renderPanel(true); },
  comm: () => { if (SIM.act(S.G, 'comm')) toast('สื่อสารกับผู้นำชุมชนแล้ว', 1); else toast('ยังใช้ไม่ได้ — ต้องเว้นระยะ 20 นาที', 2); },
  artyhold: () => { SIM.act(S.G, 'artyhold'); renderPanel(true); },
  cav: b => { if (!SIM.act(S.G, 'cav', { k: b.dataset.k })) toast('ทำไม่ได้ในสถานะนี้', 2); renderPanel(true); },
  practice: () => openMG(true),
  'mg-wave': () => { if (MG && !MG.done) mgEnd('waveoff'); }, 'mg-auto': () => { if (MG && !MG.done) mgEnd(MG.practice ? 'ok' : 'auto'); },
  'replay-same': () => startGame(S.G && S.G.seat ? S.G.seat : 'obs'),
  'aar-play': b => { S.aar.play = !S.aar.play; if (S.aar.play && S.aar.i >= S.G.snaps.length - 1) S.aar.i = 0; b.textContent = S.aar.play ? '⏸ หยุด' : '▶ เล่น'; },
  'aar-mode': b => { S.aar.mode = b.dataset.m; for (const x of $$('[data-act="aar-mode"]')) x.classList.toggle('on', x === b); drawAAR(); },
  'aar-mine': b => { S.aar.mine = b.dataset.v === '1'; renderAAR(); },
  'aar-filter': b => { S.aar.filter = b.dataset.f; renderAAR(); },
  'copy-aar': b => copyText(aarText(), b), 'copy-review': b => copyText(reviewText(), b)
};
function bindGlobal() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && !b.disabled) { const f = ACT[b.dataset.act]; if (f) f(b, e); return; }
    const t = e.target.closest('[data-tab]'); if (t) { S.tab = t.dataset.tab; renderPanel(true); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.chk) { const k = t.dataset.chk; if (k === 'random') S.seedMode = t.checked ? 'random' : 'std'; else if (k === 'truth') S.truth = t.checked; else S[k] = t.checked; if (k === 'instructor' && S.G) buildTop(); }
    else if (t.id === 'seatSel') { SIM.setSeat(S.G, t.value || null); hideSheet(); S.minimized = {}; S.lastPanel = ''; buildTop(); renderPanel(true); const me = t.value ? seatInfo(t.value) : null; toast(me ? `เปลี่ยนเป็น ${me.cs} · ${me.nm}` : 'ผู้สังเกตการณ์', 2); }
    else if (t.dataset.rev != null) { const i = t.dataset.rev; REVIEW[i] = Object.assign(REVIEW[i] || {}, { s: t.value }); saveReview(); renderAssume(); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.note != null) { const i = t.dataset.note; REVIEW[i] = Object.assign(REVIEW[i] || {}, { n: t.value }); saveReview(); }
    else if (t.dataset.aq != null) S.aar.ans[+t.dataset.aq] = t.value;
    else if (t.id === 'rpRange') { S.aar.i = +t.value; drawAAR(); }
  });
  document.addEventListener('keydown', e => {
    if (MG && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); MG.hold = true; return; }
    if (e.key === 'Escape') { if (!$('#dlg').hidden) closeDialog(); else if (S.mgOpen) { if (MG && !MG.done) mgEnd('waveoff'); } else if (!$('#drawer').hidden) $('#drawer').hidden = true; else if (S.sheet) { const d = S.G && S.G.pend.find(x => x.id === S.sheet); if (d && !d.urgent) { S.minimized[S.sheet] = true; hideSheet(); } } }
  });
  document.addEventListener('keyup', e => { if (MG && (e.code === 'Space' || e.key === ' ')) MG.hold = false; });
  const dn = $('#mgDown');
  const press = v => e => { e.preventDefault(); if (MG) MG.hold = v; dn.classList.toggle('held', v); };
  dn.addEventListener('pointerdown', press(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) dn.addEventListener(ev, press(false));
  bindMap();
  const ro = new ResizeObserver(() => { if (S.screen === 'game') resizeMap(); if (S.screen === 'aar') drawAAR(); });
  ro.observe($('#mapwrap')); ro.observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { S.lastPanel = ''; });
}

/* ---------- ลูปหลัก ---------- */
let last = 0;
function frame(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
  try {
    if (S.screen === 'game' && S.G) {
      const G = S.G;
      if (!G.over && !S.mgOpen && !S.dialogOpen) { const sc = effScale(); if (sc > 0) SIM.step(G, dt * sc); }
      if (G.over && !S.endShown) { S.endShown = true; toast('จบการฝึก — กำลังเปิดหน้าทบทวนหลังการฝึก', 2); setTimeout(() => { if (S.screen === 'game') goAAR(); }, 1500); }
      syncTop(); syncDecisions(); syncToasts(); syncMG();
      panelT += dt; liveT += dt;
      if (panelT > 0.5) { panelT = 0; renderPanel(false); const hud = hudHTML(G), hb = $('#hud'); if (hb.innerHTML !== hud) hb.innerHTML = hud; if (S.sel) renderSel(); }
      if (liveT > 0.25) { liveT = 0; liveUpdate(); }
      drawGame();
    } else if (S.screen === 'aar') aarFrame(dt);
    if (S.mgOpen) mgFrame(dt);
  } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

/* ---------- เริ่มต้น / hot reload ---------- */
function start(data) {
  S = defaults(); dpr = Math.min(2, window.devicePixelRatio || 1);
  if (data && data.S && typeof data.S === 'object') { Object.assign(S, data.S); S.sheet = null; S.mgOpen = false; S.dialogOpen = false; S.lastPanel = ''; }
  loadReview();
  bindGlobal();
  show(S.screen === 'game' && !S.G ? 'intro' : (S.screen || 'intro'));
  try { if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S: Object.assign({}, S, { sheet: null, mgOpen: false, dialogOpen: false }) })); } catch (e) { /* ignore */ }
  requestAnimationFrame(frame);
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
