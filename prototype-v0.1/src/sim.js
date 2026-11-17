/* คลื่นมรกต — แกนจำลอง ต้นแบบ v0.1
   - ไม่มี DOM: ทดสอบได้ใน Node (test/test_sim.js)
   - ทุกค่าเป็น "ค่าสาธิต" สำหรับออกแบบเกม ไม่ใช่ข้อมูลอาวุธหรือหลักนิยมจริง
   - สถานการณ์สมมติ ชื่อหน่วยและนามเรียกขานสมมติทั้งหมด */
(function (root) {
'use strict';

/* ---------- ค่าคงที่ (ค่าสาธิต) ---------- */
const T0 = 18000, TEND = 28800, SUNRISE = 22320, BINGO0 = 26400;
const LCU_SPD = 5, HELO_SPD = 60, JET_SPD = 200, INF_SPD = 2, CAV_SPD = 6;
const TOF = 40, PREP = 45, GATE_R = 2300;

/* ---------- เครื่องมือพื้นฐาน ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const pad3 = n => String(Math.round(((n % 360) + 360) % 360) % 360).padStart(3, '0');
const fmt = n => Math.round(n).toLocaleString('en-US');
function rnd(G) { let a = G.rs | 0; a = a + 0x6D2B79F5 | 0; G.rs = a; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function gauss(G) { const u = rnd(G) || 1e-9, v = rnd(G); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function bearing(ax, ay, bx, by) { return (Math.atan2(bx - ax, by - ay) * 180 / Math.PI + 360) % 360; }
function angDiff(a, b) { let d = ((a - b) % 360 + 360) % 360; if (d > 180) d -= 360; return d; }
const dxy = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function gridStr(x, y) { const e = clamp(Math.round(x / 10), 0, 1999), n = clamp(Math.round(y / 10), 0, 1999); return 'EM ' + String(e).padStart(4, '0') + ' ' + String(n).padStart(4, '0'); }
function parseGrid(s) { const m = /(\d{4})\D+(\d{4})/.exec(s || ''); return m ? { x: +m[1] * 10, y: +m[2] * 10 } : null; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = clamp(t, 0, 1); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); }
function hhmm(t) { t = Math.max(0, Math.floor(t)); return pad2(Math.floor(t / 3600) % 24) + ':' + pad2(Math.floor(t % 3600 / 60)); }
function hhmmss(t) { t = Math.max(0, Math.floor(t)); return hhmm(t) + ':' + pad2(t % 60); }
function moveAlong(e, dt, speed) {
  let rem = speed * dt;
  while (rem > 0 && e.route && e.route.length) {
    const tx = e.route[0][0], ty = e.route[0][1]; const d = Math.hypot(e.x - tx, e.y - ty);
    if (d <= rem) { e.x = tx; e.y = ty; rem -= d; e.route.shift(); }
    else { e.hdg = bearing(e.x, e.y, tx, ty); e.x += (tx - e.x) / d * rem; e.y += (ty - e.y) / d * rem; rem = 0; }
  }
  return !e.route || e.route.length === 0;
}
function tide(t) { const h = t / 3600; return 1.2 + 0.9 * Math.sin(2 * Math.PI * (h - 3.5) / 12.4); }
let TW = null;
function tideWindow() { if (TW) return TW; let a = null, b = null; for (let t = T0; t <= 32400; t += 15) { const ok = tide(t) >= 2; if (ok && a == null) a = t; if (!ok && a != null && b == null) b = t; } return (TW = [a, b]); }
function light(t) { return clamp(0.65 + 0.35 * (t - (SUNRISE - 2400)) / 2400, 0.65, 1); }

/* ---------- ภูมิประเทศสมมติ (พื้นที่ 20×20 กม. จุดกำเนิดมุมล่างซ้าย หน่วยเมตร) ---------- */
const WORLD = {
  size: 20000,
  mainland: [[0,0],[4200,0],[4400,2000],[4100,4200],[4600,6000],[4300,8000],[4700,9400],[4500,11000],[4200,12800],[4600,14600],[4300,16500],[4500,18500],[4200,20000],[0,20000]],
  island: [[11000,6500],[12600,6200],[14500,6400],[16100,6900],[16900,7900],[17300,9300],[17000,10800],[17200,12100],[16500,13300],[15400,14200],[14000,14700],[12700,14800],[11600,14500],[10900,13900],[10600,13000],[10700,12000],[10300,11000],[10350,10200],[10250,9700],[10350,9200],[10500,8200],[10700,7300]],
  hills: [{ x: 11300, y: 11000, r: [260, 500, 740], nm: 'เนิน 120' }, { x: 14400, y: 11300, r: [300, 600, 900, 1200], nm: 'เนิน 214' }, { x: 15900, y: 9000, r: [250, 520], nm: '' }, { x: 3000, y: 15500, r: [400, 800], nm: '' }],
  roads: [
    [[10380,9600],[11200,9800],[12300,9500],[13250,9150],[13900,7900]],
    [[11200,9800],[11450,10500],[11500,11600],[11900,12500],[12250,12900],[11800,13400],[11050,13600]],
    [[11200,9800],[12300,10600],[12450,11250],[13400,11350],[14350,11350]],
    [[12300,9500],[12700,8500],[13900,7900]],
    [[11800,13400],[13000,13800],[14600,12600],[14400,11300]],
    [[11450,10500],[11300,11000]],
    [[1500,9000],[2600,9600],[2200,11800],[2600,14000]]
  ],
  bty: { x: 2600, y: 9600 }, hq: { x: 2200, y: 11800 },
  beach: { x: 10380, y: 9600 }, beachW: { x: 10250, y: 9580 }, lod: { x: 9500, y: 9400 }, shoal: { x: 9920, y: 9530 },
  h120: { x: 11300, y: 11000 }, h214: { x: 14400, y: 11300 }, town: { x: 11800, y: 13400 }, townR: 500,
  pier: { x: 11050, y: 13600 }, pierW: { x: 10700, y: 13650 }, pierHold: { x: 9800, y: 13500 },
  ep: { x: 12250, y: 12900 }, jb: { x: 12300, y: 9500 }, rb: { x: 13250, y: 9150 }, af: { x: 13900, y: 7900 },
  runway: [[13000, 7400], [15200, 7900]],
  ip: { x: 5500, y: 16000, nm: 'IP ทองหลาง' }, gate: { x: 7000, y: 10000, nm: 'ประตู ก' }, gate2: { x: 9800, y: 12700 },
  box: { x0: 5400, x1: 9200, y0: 5600, y1: 8300 }, home: { x: 6800, y: 6900 },
  nfa: [
    { id: 'hosp', nm: 'โรงพยาบาล', x: 12100, y: 13750, r: 250 },
    { id: 'temple', nm: 'วัด', x: 12700, y: 12350, r: 200 },
    { id: 'ep', nm: 'จุดอพยพ (โรงเรียน)', x: 12250, y: 12900, r: 350 }
  ]
};

const RT = {
  coy: [[11200,9800],[11450,10500],[11500,11600],[11900,12500],[12120,12720]],
  p12: [[11200,9800],[11450,10500],[11500,11600],[11550,12600],[11300,13300],[11080,13600]],
  p2: [[11200,9800],[12300,10600],[12450,11250]],
  p2b: [[13400,11350],[14350,11350]],
  p3: [[11200,9800],[11450,10500],[11500,11600],[11650,12700],[11850,13230]],
  cav: [[11200,9800],[12300,9500]],
  cav2: [[13250,9150],[13900,7900]],
  cavD: [[12700,8500],[13900,7900]]
};

/* ---------- ตำแหน่ง (ORBAT) ---------- */
const LV = { 'สูง': 'ระดับสูง', 'กลาง': 'ระดับกลาง', 'ปฏิบัติ': 'ระดับผู้ปฏิบัติ' };
const SEATS = [
  { id: 'jtf', cs: 'มรกต 6', nm: 'ผู้บัญชาการกองกำลังร่วม', lv: 'สูง', svc: 'ร่วม', unit: 'hq',
    d: 'ตัดสินใจระดับยุทธการ: เวลา H การอนุมัติ CAS การรับมือพายุและข่าวปลอม ถ่วงดุลภารกิจทางทหารกับการคุ้มครองพลเรือน',
    dec: ['กำหนดเวลา H และ Go/No-go', 'อนุมัติการสนับสนุนทางอากาศ (CAS)', 'รับมือพายุ', 'รับมือคลิปปลอม'],
    q: { q: 'ปัจจัยใดสำคัญที่สุดในการกำหนดเวลา H ของการยกพลขึ้นบกในสถานการณ์นี้?', a: ['ระดับน้ำที่หาดต้องถึงเกณฑ์', 'ความสะดวกของกองบัญชาการ', 'ให้ตรงกับเวลาอาหารเช้า'], c: 0, x: 'เรือยกพลต้องการระดับน้ำขั้นต่ำ ถ้าไม่ถึงจะค้างสันดอนและตกเป็นเป้า' } },
  { id: 'fscc', cs: 'อัคนี', nm: 'นายทหารประสานการยิงสนับสนุน (FSCC)', lv: 'กลาง', svc: 'ร่วม', unit: 'hq',
    d: 'อนุมัติทุกภารกิจยิง ตรวจเขตห้ามยิง ฝ่ายเดียวกัน และห้วงอากาศ ประสานปืนใหญ่กับ CAS และเฮลิคอปเตอร์',
    dec: ['แผนยิงเตรียม', 'มาตรการประสานห้วงอากาศ', 'อนุมัติ/ระงับ/ปฏิเสธภารกิจยิง', 'ประสาน CAS กับปืนใหญ่'],
    q: { q: 'ก่อนอนุมัติภารกิจยิง FSCC ต้องตรวจอะไรบ้าง?', a: ['เขตห้ามยิง ตำแหน่งฝ่ายเดียวกัน และอากาศยานที่อาจข้ามแนวยิง', 'ความแม่นของพิกัดเพียงอย่างเดียว', 'จำนวนกระสุนคงเหลือเท่านั้น'], c: 0, x: 'FSCC เป็นจุดรวมการตรวจความปลอดภัยของการยิงทั้งระบบ' } },
  { id: 'coy', cs: 'พยัคฆ์ 6', nm: 'ผู้บังคับกองร้อยทหารราบ', lv: 'กลาง', svc: 'ทบ.', unit: 'coy',
    d: 'นำกองร้อยขึ้นบก เปิดจุดอพยพพลเรือน รักษาท่าเรือ และรับมือเหตุในเมืองใกล้โรงพยาบาล',
    dec: ['เปิดจุดอพยพ', 'ถูกยิงใกล้โรงพยาบาล', 'รายงานตำแหน่งตามรอบ'],
    q: { q: 'เหตุผลหลักที่ต้องรายงานตำแหน่งหน่วยตามรอบคืออะไร?', a: ['ให้ภาพสถานการณ์ร่วม (COP) ถูกต้อง ป้องกันการยิงฝ่ายเดียวกัน', 'ให้ผู้บังคับบัญชารู้ว่ายังตื่นอยู่', 'ไม่จำเป็นถ้ามี GPS'], c: 0, x: 'หน่วยอื่นเห็นท่านเฉพาะตำแหน่งที่รายงานล่าสุด ถ้าไม่รายงาน ภาพจะล้าสมัย' } },
  { id: 'fdc', cs: 'สายฟ้า', nm: 'ศูนย์อำนวยการยิง ปืนใหญ่สนาม', lv: 'กลาง', svc: 'ทบ.', unit: 'bty',
    d: 'รับคำขอยิงจากผู้ตรวจการณ์ ทวนกลับ ตรวจไขว้พิกัดกับทิศ/ระยะ แล้วส่ง FSCC อนุมัติ',
    dec: ['รับ/สอบถาม/ปฏิเสธคำขอยิง'],
    q: { q: 'ทำไมต้องทวนกลับ (read-back) พิกัดในคำขอยิง?', a: ['ยืนยันว่าข้อมูลตรงกันและจับข้อผิดพลาดได้ก่อนยิง', 'ให้ข่ายวิทยุไม่ว่าง', 'เป็นธรรมเนียม ไม่มีผลต่อความปลอดภัย'], c: 0, x: 'การทวนกลับและตรวจไขว้เป็นด่านแรกที่จับพิกัดผิดได้' } },
  { id: 'co', cs: 'วารี', nm: 'ผู้บังคับการเรือยกพลขึ้นบก', lv: 'กลาง', svc: 'ทร.', unit: 'wr',
    d: 'บังคับบัญชาเรือวารี เรือยกพล 2 ลำ และเฮลิคอปเตอร์ รับมือเรือไม่ทราบฝ่ายตามกฎการใช้กำลัง',
    dec: ['เรือประมงไม่ทราบฝ่าย', 'ช่วยเหลือผู้บาดเจ็บ', 'ส่งเรือยกพลไปอพยพที่ท่าเรือ'],
    q: { q: 'เรือไม่ทราบฝ่ายเข้าใกล้แต่ไม่แสดงเจตนาเป็นปรปักษ์ ผบ.เรือควรเริ่มจากอะไร?', a: ['ติดต่อ แจ้งเตือน เปลี่ยนเข็ม และพิสูจน์ทราบตามลำดับขั้น', 'ใช้อาวุธทำลายทันที', 'เพิกเฉย'], c: 0, x: 'กฎการใช้กำลังเน้นการเพิ่มระดับตามลำดับและการพิสูจน์ทราบ' } },
  { id: 'sql', cs: 'พยัคฆ์ 1-1', nm: 'ผู้บังคับหมู่ทหารราบ (ชุดรักษาจุดอพยพ)', lv: 'ปฏิบัติ', svc: 'ทบ.', unit: 'p11',
    d: 'ขึ้นเฮลิคอปเตอร์ไปเปิดจุดอพยพที่โรงเรียน คัดกรองพลเรือน และรายงานตำแหน่งตามรอบ',
    dec: ['เหตุที่จุดคัดกรอง (เร่งด่วน)', 'รายงานตำแหน่ง'],
    q: { q: 'เมื่อบุคคลที่จุดคัดกรองไม่ทำตามคำสั่ง สิ่งแรกที่ควรทำคืออะไร?', a: ['สื่อสารให้ชัดผ่านล่าม รักษาระยะ และประเมินเจตนา', 'ใช้กำลังทันที', 'ละทิ้งจุดคัดกรอง'], c: 0, x: 'ยังไม่มีการกระทำหรือเจตนาเป็นปรปักษ์ชัดเจน จึงเริ่มจากการสื่อสารและรักษาระยะ' } },
  { id: 'cav', cs: 'อาชา 6', nm: 'ผู้บังคับหมวดทหารม้า (รถรบ)', lv: 'ปฏิบัติ', svc: 'ทบ.', unit: 'cav',
    d: 'นำรถรบจากหาดไปยึดสนามบิน ผ่านทางแยก ข ที่มีด่านข้าศึกและรถพลเรือน',
    dec: ['ด่านสกัดถนนที่มีพลเรือน (เร่งด่วน)', 'ขอ CAS / อ้อม / โจมตี'],
    q: { q: 'พบด่านข้าศึกมีรถพลเรือนจอดใกล้ ควรทำอย่างไรก่อน?', a: ['หยุด รายงาน และทำให้พลเรือนออกจากพื้นที่ก่อนใช้กำลัง', 'ยิงทันทีก่อนข้าศึกรู้ตัว', 'ขับผ่านด่านด้วยความเร็วสูง'], c: 0, x: 'หลักความได้สัดส่วนและการระวังป้องกันพลเรือนมาก่อน' } },
  { id: 'fo', cs: 'ตาเหยี่ยว', nm: 'ผู้ตรวจการณ์หน้า ปืนใหญ่', lv: 'ปฏิบัติ', svc: 'ทบ.', unit: 'fo',
    d: 'ซ่อนตัวบนเนิน 120 ตั้งแต่ก่อนรุ่ง ค้นหาเป้าหมาย ส่งคำขอยิง และรายงานผล',
    dec: ['ส่งคำขอยิง', 'ยืนยันพิกัด', 'รายงานผลการยิง', 'ข่ายยิงขัดข้อง'],
    q: { q: 'ทิศและระยะจากผู้ตรวจการณ์ถึงเป้าหมายช่วยศูนย์อำนวยการยิงอย่างไร?', a: ['ใช้ตรวจไขว้กับพิกัด ถ้าไม่สอดคล้องแปลว่าอาจมีพิกัดผิด', 'ไม่มีประโยชน์ถ้าส่งพิกัดแล้ว', 'ใช้คำนวณเวลากระสุนตกเท่านั้น'], c: 0, x: 'ข้อมูลสองชุดที่เป็นอิสระต่อกันช่วยจับความผิดพลาด' } },
  { id: 'ood', cs: 'วารี (สะพานเดินเรือ)', nm: 'นายทหารเวรควบคุมเรือ', lv: 'ปฏิบัติ', svc: 'ทร.', unit: 'wr',
    d: 'คุมเข็มและความเร็วเรือ ให้ดาดฟ้าบินอยู่ในเกณฑ์ และไม่ออกนอกพื้นที่ปฏิบัติการ',
    dec: ['ปรับเข็มเพื่อปฏิบัติการบิน', 'เรือใกล้ขอบพื้นที่'],
    q: { q: 'ในต้นแบบนี้ เงื่อนไขลงจอดเฮลิคอปเตอร์บนเรือคืออะไร?', a: ['ลมสัมพัทธ์ไม่เกิน ±30° จากหัวเรือ ไม่เกิน 35 นอต และโคลงไม่เกิน 4.5°', 'เรือต้องหยุดนิ่งเสมอ', 'เรือต้องหันข้างให้ลม'], c: 0, x: 'ค่าสาธิต — ค่าจริงขึ้นกับแบบเรือและอากาศยาน' } },
  { id: 'fdo', cs: 'วารี (ดาดฟ้าบิน)', nm: 'นายทหารควบคุมดาดฟ้าบิน', lv: 'ปฏิบัติ', svc: 'ทร.', unit: 'wr',
    d: 'ให้สัญญาณไฟเขียว/แดงแก่เฮลิคอปเตอร์ ตามลม การโคลงของเรือ และความพร้อมดาดฟ้า',
    dec: ['ไฟเขียว/ไฟแดง ทุกครั้งที่เฮลิคอปเตอร์กลับ'],
    q: { q: 'เมื่อเงื่อนไขดาดฟ้าเกินเกณฑ์ ควรทำอย่างไร?', a: ['ให้ไฟแดง ให้อากาศยานวนรอ และขอสะพานเดินเรือปรับเข็ม', 'ให้ไฟเขียวเพราะนักบินมีประสบการณ์', 'ปิดไฟดาดฟ้าทั้งหมด'], c: 0, x: 'เกณฑ์ความปลอดภัยไม่ขึ้นกับแรงกดดันของภารกิจ' } },
  { id: 'helo', cs: 'เวหา 2', nm: 'นักบินเฮลิคอปเตอร์ประจำเรือ', lv: 'ปฏิบัติ', svc: 'ทร.', unit: 'h2',
    d: 'ส่งชุดรักษาจุดอพยพ แล้วบินรับพลเรือนเที่ยวละ 20 คน ลงจอดบนเรือที่โคลงด้วยตนเอง',
    dec: ['ลงจอดบนเรือ (มินิเกม)', 'จุดอพยพถูกคุกคาม', 'ไฟเตือนขณะบิน'],
    q: { q: 'ข้อใดถูกต้องเรื่องการข้ามแนวยิงปืนใหญ่?', a: ['ใช้ช่องทาง/ประตูที่กำหนด หรือยืนยันว่าไม่มีกระสุนกำลังเดินทาง', 'ข้ามได้ตลอดถ้าบินต่ำ', 'ไม่ต้องสนใจ เป็นหน้าที่ปืนใหญ่'], c: 0, x: 'อากาศยานกับการยิงต้องแยกกันด้วยเวลา พื้นที่ หรือความสูงที่ประสานแล้ว' } },
  { id: 'lead', cs: 'อินทรี 1', nm: 'นักบินหัวหน้าหมู่บินโจมตี', lv: 'ปฏิบัติ', svc: 'ทอ.', unit: 'jet',
    d: 'รับบรีฟจาก JTAC ทวนกลับ ยืนยันเป้าหมาย และโจมตีเมื่อได้รับอนุญาตเท่านั้น',
    dec: ['ทวนกลับบรีฟ', 'ยืนยันเป้าหมาย (tally)', 'เชื้อเพลิงถึงเกณฑ์', 'อากาศต่ำกว่าเกณฑ์'],
    q: { q: 'ก่อนโจมตี นักบินต้องได้รับอะไรจาก JTAC?', a: ['การอนุญาตหลังยืนยันเป้าหมายและทวนข้อมูลถูกต้อง', 'เพียงพิกัดก็พอ', 'คำอนุญาตจากหัวหน้าหมู่บินเท่านั้น'], c: 0, x: 'JTAC เป็นผู้เห็นสถานการณ์ภาคพื้นและเป็นผู้อนุญาตสุดท้าย' } },
  { id: 'jtac', cs: 'ชี้ทาง', nm: 'ผู้ควบคุมการโจมตีทางอากาศภาคพื้น (JTAC)', lv: 'ปฏิบัติ', svc: 'ทอ.', unit: 'jtac',
    d: 'อยู่กับรถรบ ส่งบรีฟ ตรวจคำทวนกลับ และอนุญาตหรือยกเลิกการโจมตีโดยดูพลเรือนและฝ่ายเดียวกัน',
    dec: ['ส่งบรีฟ', 'ตรวจคำทวนกลับ', 'อนุญาต/ยกเลิกการโจมตี'],
    q: { q: 'หากนักบินทวนกลับพิกัดผิด JTAC ควรทำอย่างไร?', a: ['แก้ไขทันทีและให้ทวนกลับใหม่ก่อนอนุญาต', 'ปล่อยไปเพราะใกล้เคียง', 'ยกเลิกภารกิจทั้งหมดเสมอ'], c: 0, x: 'ห้ามอนุญาตจนกว่าข้อมูลตรงกันทั้งสองฝ่าย' } }
];
const AI_SEATS = [
  { id: 'j3', cs: 'มรกต 3', nm: 'ฝ่ายยุทธการ กกล.ร่วม', lv: 'กลาง', svc: 'ร่วม' },
  { id: 'lno', cs: 'สะพาน', nm: 'นายทหารติดต่อพลเรือน/ท้องถิ่น', lv: 'กลาง', svc: 'ร่วม' },
  { id: 'sf', cs: 'เงา', nm: 'ชุดลาดตระเวนพิเศษ (ส่ง FO ขึ้นเนิน)', lv: 'ปฏิบัติ', svc: 'ร่วม' },
  { id: 'jflcc', cs: 'ภูผา 6', nm: 'ผบ.กำลังรบทางบก', lv: 'สูง', svc: 'ทบ.' },
  { id: 'gun', cs: 'สายฟ้า 1', nm: 'พลประจำปืน', lv: 'ปฏิบัติ', svc: 'ทบ.' },
  { id: 'crew', cs: 'อาชา 1', nm: 'พลประจำรถ', lv: 'ปฏิบัติ', svc: 'ทบ.' },
  { id: 'jfmcc', cs: 'สมุทร 6', nm: 'ผบ.กำลังรบทางเรือ', lv: 'สูง', svc: 'ทร.' },
  { id: 'cic', cs: 'นาคา', nm: 'เรือฟริเกต (ศูนย์ยุทธการ + เวหา 1)', lv: 'กลาง', svc: 'ทร.' },
  { id: 'jfacc', cs: 'นภา 6', nm: 'ผบ.กำลังรบทางอากาศ', lv: 'สูง', svc: 'ทอ.' },
  { id: 'wing', cs: 'อินทรี 2', nm: 'นักบินหมายเลข 2', lv: 'ปฏิบัติ', svc: 'ทอ.' }
];
const ORBAT = [
  { g: 'jtf', nm: 'กองบัญชาการกองกำลังร่วม (มรกต)', seats: ['jtf', 'j3', 'fscc', 'lno', 'sf'] },
  { g: 'land', nm: 'กำลังรบทางบก — ทบ.', seats: ['jflcc', 'coy', 'sql', 'cav', 'crew', 'fdc', 'gun', 'fo'] },
  { g: 'sea', nm: 'กำลังรบทางเรือ — ทร.', seats: ['jfmcc', 'co', 'ood', 'fdo', 'helo', 'cic'] },
  { g: 'air', nm: 'กำลังรบทางอากาศ — ทอ.', seats: ['jfacc', 'lead', 'wing', 'jtac'] }
];
function seatUnit(s) { const x = SEATS.find(q => q.id === s); return x ? x.unit : null; }
function seatCS(s) { const x = SEATS.find(q => q.id === s); return x ? x.cs : 'ผู้สังเกตการณ์'; }

/* ---------- สร้างเกม ---------- */
function U(id, o) { return Object.assign({ id, x: 0, y: 0, hdg: 90, spd: 0, route: [], str: 100, st: 'idle', emb: null, side: 'F', live: false, rep: null, repEvery: 600, nextRep: 0, skipRep: 0 }, o); }
function Hs(id, o) { return Object.assign({ id, str: 100, act: true, known: false, kx: 0, ky: 0, seen: 0, sup: 0, by: null, route: [] }, o); }

function newGame(opt) {
  opt = opt || {};
  const seed = (opt.seed >>> 0) || 20261117;
  const G = {
    v: 1, seed, rs: seed, t: T0, seat: opt.seat || null, H: null, prep: null, acm: null,
    wx: { wdir: 60, wkt: 14, sdir: 70, ss: 3, vis: 1, storm: 0, stormT: null, stormEndT: null },
    u: {}, h: {}, c: {}, missions: [], pend: [], decs: [], log: [], snaps: [], sched: [], fx: [],
    civ: { town: 600, ep: 0, evac: 0, harmF: 0, harmE: 0, trust: 60, rb: 6, rbClearAt: null, epOpen: false, screen: true, acc: 0, nextHarm: 0 },
    cas: { st: 'none', att: 0, t: {}, acm: null, wrongXY: null, imp: null },
    m: { frat: 0, near: 0, air: 0, civHarm: 0, roe: 0, nfa: 0, cff: 0, denied: 0, cf: 0, cfOk: 0, loss: 0, deckRisk: 0, aground: 0, boxOut: 0, incidents: 0, reports: 0, screenLapse: 0, secLapse: 0, heloDmg: 0, caughtFDC: 0, caughtBDA: 0, caughtRB: 0, fuelRisk: 0 },
    obj: {}, inj: { gridErr: false, rbErr: false }, flags: {}, ops: { suspend: false, mode: null },
    relayDown: false, artyHold: false, casHold: false, cfUntil: 0, trustQ: [], bingo: BINGO0,
    seq: 0, mseq: 1000, over: false, lastSnap: -1e9, nextDet: T0, nextFo: T0 + 30, mg: null
  };
  const u = G.u;
  u.hq = U('hq', { cs: 'มรกต 6', k: 'hq', x: 2200, y: 11800, live: true });
  u.bty = U('bty', { cs: 'สายฟ้า', k: 'arty', x: 2600, y: 9600, live: true });
  u.fo = U('fo', { cs: 'ตาเหยี่ยว', k: 'fo', x: 11300, y: 11000, st: 'op' });
  u.coy = U('coy', { cs: 'พยัคฆ์ 6', k: 'inf', hqu: true, emb: 'lcu1', rt: 'coy' });
  u.p11 = U('p11', { cs: 'พยัคฆ์ 1-1', k: 'inf', emb: 'h2' });
  u.p12 = U('p12', { cs: 'พยัคฆ์ 1-2', k: 'inf', emb: 'lcu1', rt: 'p12' });
  u.p2 = U('p2', { cs: 'พยัคฆ์ 2', k: 'inf', emb: 'lcu1', rt: 'p2', skipRep: 0.5 });
  u.p3 = U('p3', { cs: 'พยัคฆ์ 3', k: 'inf', emb: 'lcu1', rt: 'p3' });
  u.cav = U('cav', { cs: 'อาชา 6', k: 'cav', emb: 'lcu2', rt: 'cav' });
  u.jtac = U('jtac', { cs: 'ชี้ทาง', k: 'jtac', emb: 'lcu2', follow: 'cav' });
  u.wr = U('wr', { cs: 'วารี', k: 'ship', x: 6800, y: 6900, hdg: 150, spd: 1.5, cmdH: 60, cmdS: 1.5, live: true });
  u.nk = U('nk', { cs: 'นาคา', k: 'ship', x: 5800, y: 12400, hdg: 60, spd: 1, cmdH: 60, cmdS: 1, live: true, frig: true });
  u.h1 = U('h1', { cs: 'เวหา 1', k: 'helo', base: 'nk', live: true, st: 'deck' });
  u.h2 = U('h2', { cs: 'เวหา 2', k: 'helo', base: 'wr', live: true, st: 'deck', pax: 0, trip: 0 });
  u.lcu1 = U('lcu1', { cs: 'วารี 1', k: 'lcu', emb: 'wr', live: true, st: 'emb', pax: 0, off: 0 });
  u.lcu2 = U('lcu2', { cs: 'วารี 2', k: 'lcu', emb: 'wr', live: true, st: 'emb', pax: 0, off: 130 });
  u.jet = U('jet', { cs: 'อินทรี 1-2', k: 'jet', live: true, st: 'base', x: -800, y: 15600 });
  u.fo.rep = { x: u.fo.x, y: u.fo.y, t: T0 }; u.fo.nextRep = T0 + 600;
  for (const k of ['lcu1', 'lcu2', 'h1', 'h2']) { const c = u[k].base ? u[u[k].base] : u.wr; u[k].x = c.x; u[k].y = c.y; }
  for (const k of ['coy', 'p12', 'p2', 'p3', 'cav', 'jtac', 'p11']) { u[k].x = u.wr.x; u[k].y = u.wr.y; }
  const h = G.h;
  h.R1 = Hs('R1', { nm: 'ปืนกลชายหาด', k: 'mg', x: 10900, y: 9950, thr: 1500 });
  h.R2 = Hs('R2', { nm: 'ปืนครกและที่ตรวจการณ์ เนิน 214', k: 'mortar', x: 14350, y: 11350, thr: 3000, camo: 0.75 });
  h.R3 = Hs('R3', { nm: 'กลุ่มติดอาวุธในเมือง', k: 'grp', x: 11950, y: 13350, thr: 800, act: false, str: 60 });
  h.R4 = Hs('R4', { nm: 'ด่านสกัดถนน', k: 'rb', x: 13250, y: 9150, thr: 900, str: 80 });
  h.R5 = Hs('R5', { nm: 'กลุ่มกำลังเสริมข้าศึก', k: 'grp', x: 15450, y: 11250, thr: 1500, act: false, camo: 0.85 });
  G.prepErr = { x: gauss(G) * 70, y: gauss(G) * 70 };
  const at = (hh, mm) => hh * 3600 + mm * 60;
  sched(G, at(6, 5), 'fishing'); sched(G, at(6, 15), 'gridErrArm'); sched(G, at(6, 30), 'r5');
  sched(G, at(6, 38), 'relayDown'); sched(G, at(6, 50), 'relayUp'); sched(G, at(6, 50), 'storm');
  sched(G, at(7, 0), 'clip'); sched(G, at(7, 10), 'town'); sched(G, at(7, 15), 'r5move'); sched(G, at(7, 30), 'stormEnd');
  sched(G, at(5, 58), 'jets'); sched(G, BINGO0, 'bingo'); sched(G, at(5, 20), 'h1go');
  log(G, 'sys', 'เริ่มการฝึก "คลื่นมรกต (ฉบับย่อ)" — สถานการณ์สมมติ ค่าทั้งหมดเป็นค่าสาธิต', 1, null);
  log(G, 'intel', 'ข่าวกรอง: คาดว่ามีปืนกลที่หาดเขียว ที่ตรวจการณ์/ปืนครกบนเนิน 214 และด่านบนถนนสู่สนามบิน พลเรือนในเมืองราว 600 คนต้องการอพยพ', 1, 'ข่ายบังคับบัญชา');
  log(G, 'land', 'ตาเหยี่ยว: ถึงที่ตรวจการณ์เนิน 120 แล้ว (ส่งโดยชุดลาดตระเวน เงา เมื่อคืน)', 0, 'ข่ายยิง');
  pushDec(G, 'jtf_hhour'); pushDec(G, 'fscc_prep'); pushDec(G, 'fscc_acm');
  snap(G);
  return G;
}

/* ---------- ตัวช่วย ---------- */
const isGround = u => u.k === 'inf' || u.k === 'cav' || u.k === 'jtac' || u.k === 'fo';
function airborne(u) {
  if (u.k === 'helo') return ['out', 'ephold', 'back', 'hold', 'divert', 'patrol', 'ret', 'h1out'].includes(u.st);
  if (u.k === 'jet') return ['in', 'orbit', 'run', 'egress', 'rtb'].includes(u.st);
  return false;
}
function netOf(u) { if (!u) return null; if (u.k === 'fo' || u.k === 'arty') return 'ข่ายยิง'; if (u.k === 'ship' || u.k === 'lcu') return 'ข่ายเรือ'; if (u.k === 'helo' || u.k === 'jet') return 'ข่ายอากาศ'; return 'ข่ายบังคับบัญชา'; }
function log(G, c, x, s, n) { G.log.push({ t: Math.floor(G.t), c, x, s: s || 0, n: n || null }); }
function sched(G, t, ev, data, h) { G.sched.push({ t, ev, data: data || null, h: !!h }); }
function trust(G, d) { G.civ.trust = clamp(G.civ.trust + d, 5, 100); }
function mis(G, id) { return G.missions.find(m => m.id === id); }
function hasPending(G, type) { return G.pend.some(d => d.type === type); }
function dropPending(G, types, mid) { G.pend = G.pend.filter(d => !(types.includes(d.type) && (!mid || d.data.mid === mid))); }
function cop(G, u) {
  if (u.live || seatUnit(G.seat) === u.id) return { x: u.x, y: u.y, age: 0 };
  if (!u.rep) return null;
  return { x: u.rep.x, y: u.rep.y, age: G.t - u.rep.t };
}
function nearestNFA(x, y) { let b = null; for (const z of WORLD.nfa) { const d = dxy(x, y, z.x, z.y) - z.r; if (!b || d < b.d) b = { z, d }; } return b; }
function nearestFriendly(G, x, y, useCop) {
  let b = null;
  for (const u of Object.values(G.u)) {
    if (!isGround(u) || u.emb || u.str <= 0) continue;
    const p = useCop ? cop(G, u) : { x: u.x, y: u.y, age: 0 }; if (!p) continue;
    const d = dxy(x, y, p.x, p.y); if (!b || d < b.d) b = { u, d, age: p.age };
  }
  return b;
}
function threatAt(G, p) { return Object.values(G.h).some(h => h.act && h.str > 30 && G.t >= h.sup && dist(h, p) <= h.thr); }
function civNear(G, x, y) {
  if (G.civ.town > 0 && dxy(x, y, WORLD.town.x, WORLD.town.y) < 800) return true;
  if (G.civ.ep > 0 && dxy(x, y, WORLD.ep.x, WORLD.ep.y) < 500) return true;
  if (G.civ.rb > 0 && dxy(x, y, WORLD.rb.x, WORLD.rb.y) < 300) return true;
  return false;
}
function relWindFor(G, hdg, spdMs) {
  const ta = (G.wx.wdir + 180) * Math.PI / 180; let ax = G.wx.wkt * Math.sin(ta), ay = G.wx.wkt * Math.cos(ta);
  const sa = hdg * Math.PI / 180, vs = spdMs * 1.944; ax -= vs * Math.sin(sa); ay -= vs * Math.cos(sa);
  const kt = Math.hypot(ax, ay); const from = ((Math.atan2(ax, ay) * 180 / Math.PI) + 540) % 360;
  return { kt, ang: angDiff(from, hdg) };
}
function rollFor(G, hdg) { const base = 7 + 3 * (G.wx.ss - 3); return 1 + base * Math.abs(Math.sin(angDiff(G.wx.sdir, hdg) * Math.PI / 180)); }
function deckFor(G, hdg, spd) { const w = relWindFor(G, hdg, spd), roll = rollFor(G, hdg); return { ok: Math.abs(w.ang) <= 30 && w.kt <= 35 && roll <= 4.5, ang: w.ang, kt: w.kt, roll }; }
function deck(G) { const s = G.u.wr; return deckFor(G, s.hdg, s.spd); }
function deckNeeded(G) {
  const h = G.u.h2, s = G.u.wr;
  if (['hold', 'land', 'lmg'].includes(h.st)) return true;
  if (h.st === 'back' && dist(h, s) < 5000) return true;
  if (h.st === 'deck' && h.want && !G.ops.suspend) return true;
  return false;
}
function corridorOf(p) { const b = WORLD.bty; const L = dxy(b.x, b.y, p.x, p.y) || 1; return [b.x, b.y, p.x + (p.x - b.x) / L * 1000, p.y + (p.y - b.y) / L * 1000]; }
function futurePath(G, u, secs, step) {
  const out = [];
  if (u.k === 'jet' && u.st === 'orbit') { for (let s = 0; s <= secs; s += step) { const th = (u.th || 0) + JET_SPD / 2500 * s; out.push([s, WORLD.ip.x + 2500 * Math.cos(th), WORLD.ip.y + 2500 * Math.sin(th)]); } return out; }
  const moving = ['out', 'back', 'run', 'egress', 'in', 'rtb', 'divert', 'ret', 'h1out'].includes(u.st);
  if (!moving || !u.route || !u.route.length) { for (let s = 0; s <= secs; s += step) out.push([s, u.x, u.y]); return out; }
  const tmp = { x: u.x, y: u.y, route: u.route.map(p => p.slice()) }; const sp = u.k === 'jet' ? JET_SPD : HELO_SPD;
  for (let s = 0; s <= secs; s += step) { out.push([s, tmp.x, tmp.y]); moveAlong(tmp, step, sp); }
  return out;
}
function predictAir(G, p, tShot) {
  const c = corridorOf(p); const t0 = Math.max(0, tShot - G.t), t1 = t0 + TOF + 10; const res = [];
  for (const u of Object.values(G.u)) {
    if (!airborne(u)) continue;
    if (u.k === 'helo' && G.acm !== 'direct') continue;
    for (const q of futurePath(G, u, t1, 5)) { if (q[0] < t0) continue; if (segDist(q[1], q[2], c[0], c[1], c[2], c[3]) <= 300) { res.push({ cs: u.cs, dt: q[0] }); break; } }
  }
  return res;
}
function inFlight(G) { return G.missions.some(m => m.st === 'flight'); }
function heloNearGate(G) { return Object.values(G.u).some(u => u.k === 'helo' && airborne(u) && dist(u, WORLD.gate) < GATE_R); }
function canShoot(G) {
  if (G.t < G.cfUntil || G.artyHold || G.casHold) return false;
  if (G.acm === 'gate' && heloNearGate(G)) return false;
  return true;
}
function corruptGrid(G, x, y) {
  const s = gridStr(x, y).replace(/\D/g, ''); let best = null;
  for (const i of [1, 2, 5, 6]) for (let dg = 0; dg <= 9; dg++) {
    if (dg === +s[i]) continue;
    const t = s.slice(0, i) + dg + s.slice(i + 1); const px = +t.slice(0, 4) * 10, py = +t.slice(4) * 10;
    if (px > 19990 || py > 19990 || dxy(px, py, x, y) < 400) continue;
    let dm = 1e9; for (const u of Object.values(G.u)) { if (!isGround(u) || u.emb || u.k === 'fo') continue; dm = Math.min(dm, dxy(px, py, u.x, u.y)); }
    if (!best || dm < best.d) best = { x: px, y: py, d: dm, s: 'EM ' + t.slice(0, 4) + ' ' + t.slice(4) };
  }
  return best;
}

/* ---------- ภารกิจยิง ---------- */
function newMission(G, o) { const m = Object.assign({ id: 'AB' + (++G.mseq), st: 'cff', t: { req: G.t }, rep: 0, err: false, caught: null, obs: 'fo' }, o); G.missions.push(m); return m; }
function requestFire(G, tgtId, by, o) {
  o = o || {};
  const h = G.h[tgtId]; if (!h || h.str <= 0) return null;
  if (!h.known) { h.known = true; h.kx = h.x; h.ky = h.y; }
  const ob = G.u[o.obs || 'fo'];
  const kx = h.kx, ky = h.ky; const g0 = gridStr(kx, ky); let grid = g0, err = false;
  if (G.inj.gridErr) { const c = corruptGrid(G, kx, ky); if (c) { grid = c.s; err = true; } G.inj.gridErr = false; }
  const m = newMission(G, { tgt: tgtId, desc: h.nm, grid, grid0: g0, err, obs: ob.id, dir: Math.round(bearing(ob.x, ob.y, kx, ky)), rng: Math.round(dxy(ob.x, ob.y, kx, ky) / 10) * 10, by });
  h.lastReq = G.t; G.m.cff++;
  log(G, 'fires', `${ob.cs} → สายฟ้า: "ภารกิจยิง พิกัด ${m.grid} ทิศ ${pad3(m.dir)}° ระยะ ${fmt(m.rng)} ม. — ${m.desc}"`, 1, 'ข่ายยิง');
  if (G.relayDown && ob.id === 'fo') { m.st = 'lost'; log(G, 'c2', 'ตาเหยี่ยว: ไม่ได้รับการตอบรับจากสายฟ้า — ข่ายยิงเงียบ', 2, 'ข่ายยิง'); pushDec(G, 'fo_lost', { mid: m.id }); return m; }
  m.t.arr = G.t + 15;
  return m;
}
function missionStep(G) {
  for (const m of G.missions) {
    switch (m.st) {
      case 'cff': if (G.t >= m.t.arr) { m.st = 'fdc'; m.t.fdc = G.t; pushDec(G, 'fdc_rx', { mid: m.id }); } break;
      case 'wait': if (!G.relayDown) { m.st = 'cff'; m.t.arr = G.t + 15; } break;
      case 'hold':
        if (G.t >= (m.t.chk || 0)) { m.t.chk = G.t + 10; const p = parseGrid(m.grid); if (!predictAir(G, p, G.t + PREP).length && !G.artyHold && !G.casHold) { m.st = 'ready'; m.t.ready = G.t; log(G, 'fires', `อัคนี: ห้วงอากาศปลอดภัย ปล่อยภารกิจ ${m.id}`, 0, 'ข่ายประสาน'); } }
        break;
      case 'ready':
        if (G.t >= m.t.ready + PREP && canShoot(G)) { m.st = 'flight'; m.t.shot = G.t; m.t.splash = G.t + TOF; log(G, 'fires', `สายฟ้า: "ยิงแล้ว" ภารกิจ ${m.id} — กระสุนเดินทาง ${TOF} วินาที`, 0, 'ข่ายยิง'); }
        break;
      case 'flight': if (G.t >= m.t.splash) splash(G, m); break;
    }
  }
}
function splash(G, m) {
  const p = parseGrid(m.grid); const ix = p.x + gauss(G) * 35, iy = p.y + gauss(G) * 35;
  m.imp = { x: ix, y: iy }; m.st = 'bda';
  G.fx.push({ k: 'splash', x: ix, y: iy, t: G.t }); if (G.fx.length > 40) G.fx.shift();
  log(G, 'fires', `สายฟ้า: "กระสุนตก" ภารกิจ ${m.id}`, 0, 'ข่ายยิง');
  for (const h of Object.values(G.h)) { if (h.str <= 0 || !h.act) continue; const d = dxy(ix, iy, h.x, h.y); if (d < 300) { h.str = Math.max(0, h.str - (50 * (1 - d / 300) + (d < 120 ? 10 : 0))); h.sup = G.t + 180; } }
  for (const u of Object.values(G.u)) {
    if (!isGround(u) || u.emb) continue; const d = dxy(ix, iy, u.x, u.y);
    if (d <= 250) { hurt(G, u, 30); G.m.frat++; log(G, 'fires', `ยิงฝ่ายเดียวกัน! กระสุนภารกิจ ${m.id} ตกห่าง ${u.cs} เพียง ${fmt(d)} ม.`, 3, 'ข่ายยิง'); }
    else if (d <= 600) { G.m.near++; log(G, 'fires', `อันตราย: กระสุนภารกิจ ${m.id} ตกห่าง ${u.cs} ${fmt(d)} ม.`, 2, 'ข่ายยิง'); }
  }
  for (const z of WORLD.nfa) if (dxy(ix, iy, z.x, z.y) <= z.r) { G.m.nfa++; log(G, 'fires', `กระสุนตกในเขตห้ามยิง: ${z.nm}`, 3, 'ข่ายยิง'); }
  civHit(G, ix, iy, 300, 'กระสุนปืนใหญ่');
  if (!m.prep) pushDec(G, 'fo_bda', { mid: m.id }); else m.st = 'done';
}
function civHit(G, x, y, r, src) {
  let n = 0;
  if (G.civ.town > 0 && dxy(x, y, WORLD.town.x, WORLD.town.y) < WORLD.townR + r) n += 5 + Math.floor(rnd(G) * 8);
  if (G.civ.ep > 0 && dxy(x, y, WORLD.ep.x, WORLD.ep.y) < r + 150) n += 3 + Math.floor(rnd(G) * 6);
  if (G.civ.rb > 0 && dxy(x, y, WORLD.rb.x, WORLD.rb.y) < r) { n += G.civ.rb; G.civ.rb = 0; }
  if (n) { G.civ.harmF += n; G.m.civHarm += n; trust(G, -15); log(G, 'civ', `พลเรือนบาดเจ็บ ${n} คน จาก${src}ของฝ่ายเรา`, 3, null); }
}
function hurt(G, u, a, h) {
  u.str = Math.max(0, u.str - a); G.m.loss += a;
  if (u.k === 'lcu') for (const v of Object.values(G.u)) if (v.emb === u.id) { v.str = Math.max(0, v.str - a); G.m.loss += a; }
  if (h) { const key = 'hit' + h.id; if (!G.flags[key] || G.t - G.flags[key] > 300) { G.flags[key] = G.t; log(G, 'land', `${u.cs}: ถูกยิงจาก${h.nm}`, 1, netOf(u)); } }
}
function hazardNow(G) {
  const r = [];
  for (const m of G.missions) {
    if (!['cff', 'fdc', 'query', 'fscc', 'hold', 'ready', 'flight', 'wait', 'lost'].includes(m.st)) continue;
    const p = parseGrid(m.grid);
    if (m.err) r.push(`ภารกิจ ${m.id} ใช้พิกัดคลาดเคลื่อน`);
    const f = nearestFriendly(G, p.x, p.y, false); if (f && f.d < 600) r.push(`ภารกิจ ${m.id} ห่าง ${f.u.cs} ${fmt(f.d)} ม.`);
    const nf = nearestNFA(p.x, p.y); if (nf.d < 200) r.push(`ภารกิจ ${m.id} ใกล้เขตห้ามยิง ${nf.z.nm}`);
    if (civNear(G, p.x, p.y)) r.push(`ภารกิจ ${m.id} ใกล้พลเรือน`);
    const c = corridorOf(p); for (const u of Object.values(G.u)) if (airborne(u) && segDist(u.x, u.y, c[0], c[1], c[2], c[3]) < 600) r.push(`${u.cs} อยู่ใกล้แนวยิง`);
  }
  if (['tally', 'clr', 'hot'].includes(G.cas.st)) { if (G.civ.rb > 0) r.push('มีพลเรือนที่เป้าหมาย CAS'); if (G.cas.wrongXY) r.push('CAS ใช้พิกัดคลาดเคลื่อน'); }
  return [...new Set(r)];
}
function checkFire(G, seat) {
  const hz = hazardNow(G); G.cfUntil = G.t + 90; G.m.cf++; if (hz.length) G.m.cfOk++;
  for (const m of G.missions) if (['ready', 'hold', 'fscc'].includes(m.st)) { m.st = 'fdc'; m.recheck = true; dropPending(G, ['fscc_fire'], m.id); pushDec(G, 'fdc_rx', { mid: m.id }); }
  if (['tally', 'clr', 'hot'].includes(G.cas.st)) { G.cas.st = 'reatk'; G.cas.t.re = G.t + 180; dropPending(G, ['cas_tally', 'jtac_clear']); }
  log(G, 'fires', `${seatCS(seat)}: "ระงับการยิง! ระงับการยิง!"${hz.length ? ' — ' + hz.join(' · ') : ''}`, 2, 'ข่ายยิง');
  G.decs.push({ id: 'S' + (++G.seq), type: 'speakup', seat: seat || 'obs', t0: G.t, t1: G.t, title: 'ทักท้วง / ระงับการยิง', choice: 'กดระงับการยิง', k: 'cf', by: 'player', g: hz.length ? 'good' : 'ok',
    why: hz.length ? 'สมเหตุสมผล: ' + hz.join(' · ') : 'ไม่พบเหตุอันตราย ณ ขณะนั้น การยิงล่าช้า 90 วินาที (การกล้าทักท้วงยังเป็นสิ่งที่ดี)', info: '' });
}

/* ---------- ระบบการตัดสินใจ ---------- */
const DEC = {};
function O(k, l, g, why) { return { k, l, g, why: why || '' }; }
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pushDec(G, type, data, key) {
  const D = DEC[type]; if (!D) return null;
  data = data || {};
  key = key || type + (data.mid || '');
  if (G.pend.some(p => p.key === key)) return null;
  const seat = typeof D.seat === 'function' ? D.seat(G, data) : D.seat;
  if (!seat) return null;
  const d = { id: 'D' + (++G.seq), key, type, seat, t0: G.t, data, urgent: !!D.urgent };
  D.build(G, d);
  if (!d.opts || !d.opts.length) return null;
  d.dl = G.t + (D.urgent ? 15 : (D.dl || 150));
  d.aiAt = G.t + (D.aiDelay != null ? D.aiDelay : 20);
  if (d.aiK == null) d.aiK = d.opts[0].k; if (d.defK == null) d.defK = d.aiK;
  G.pend.push(d);
  if (G.seat === seat) log(G, 'task', `รอการตัดสินใจ: ${d.title}`, D.urgent ? 2 : 1, null);
  return d;
}
function resolve(G, d, k, by) {
  const i = G.pend.indexOf(d); if (i < 0) return false; G.pend.splice(i, 1);
  const o = d.opts.find(x => x.k === k) || d.opts.find(x => x.k === d.defK) || d.opts[0];
  const rec = { id: d.id, type: d.type, seat: d.seat, t0: d.t0, t1: G.t, title: d.title, body: d.body, info: d.info, choice: o.l, k: o.k, g: o.g, why: o.why, by, opts: d.opts.map(x => ({ l: x.l, g: x.g })) };
  if (by === 'timeout') { rec.g = o.g === 'good' ? 'ok' : o.g; rec.why = 'ไม่ได้ตัดสินใจภายในเวลา ระบบใช้ค่าเริ่มต้น — ' + o.why; }
  G.decs.push(rec);
  DEC[d.type].res(G, d, o.k, by);
  return true;
}
function decisionStep(G) {
  for (const d of G.pend.slice()) {
    if (G.seat && d.seat === G.seat) { if (G.t >= d.dl) resolve(G, d, d.defK, 'timeout'); }
    else if (G.t >= d.aiAt) resolve(G, d, d.aiK, 'ai');
  }
}
const nfaTxt = nf => nf.d < 0 ? `${nf.z.nm} (อยู่ในเขต)` : `${nf.z.nm} ${fmt(nf.d)} ม.`;

/* --- มรกต 6 (ผบ.กกล.ร่วม) --- */
DEC.jtf_hhour = { seat: 'jtf', dl: 240, aiDelay: 20, build(G, d) {
  const w = tideWindow(); const at = (h, m) => String(h * 3600 + m * 60);
  d.title = 'กำหนดเวลา H — ยกพลขึ้นบกที่หาดเขียว';
  d.body = 'เรือยกพล วารี 1 และ วารี 2 พร้อมปล่อยจากเรือวารี เลือกเวลาที่เรือถึงหาด (เวลา H)';
  d.info = `ระดับน้ำต้องไม่ต่ำกว่า 2.0 ม. (ช่วงประมาณ ${hhmm(w[0])}–${hhmm(w[1])}) · ดวงอาทิตย์ขึ้น 06:12 · พยากรณ์ฝนพายุราว 06:50 นานประมาณ 40 นาที · พลเรือนราว 600 คนต้องอพยพก่อน 08:00`;
  d.opts = [
    O(at(5, 30), '05:30 — มืดสนิท', 'poor', `ระดับน้ำ ณ H เพียง ${tide(5.5 * 3600).toFixed(1)} ม. ต่ำกว่าเกณฑ์ เรือยกพลจะค้างสันดอน`),
    O(at(5, 45), '05:45 — ใช้ความมืดกำบัง', 'good', 'อยู่ในช่วงน้ำ ความมืดลดการตรวจการณ์ของข้าศึก และเหลือเวลาอพยพมาก'),
    O(at(6, 0), '06:00 — แสงเริ่มขึ้น', 'good', 'อยู่ในช่วงน้ำ ผู้ตรวจการณ์เห็นเป้าหมายชัดขึ้น สมดุลระหว่างการกำบังกับการยิงสนับสนุน'),
    O(at(6, 15), '06:15 — สว่างเต็มที่', 'ok', 'อยู่ในช่วงน้ำ แต่ข้าศึกเห็นเรือยกพลชัด และเหลือเวลาก่อนพายุน้อย'),
    O(at(6, 30), '06:30 — ใกล้ช่วงพายุ', 'poor', 'การขึ้นบกและเที่ยวบินอพยพจะชนช่วงพายุ เวลาอพยพไม่พอ')
  ];
  d.aiK = at(6, 0); d.defK = at(6, 0);
}, res(G, d, k) { G.H = +k; planH(G); log(G, 'c2', `มรกต 6: กำหนดเวลา H = ${hhmm(G.H)}`, 1, 'ข่ายบังคับบัญชา'); } };

DEC.jtf_go = { seat: 'jtf', dl: 150, aiDelay: 20, build(G, d) {
  const H = G.H, ok = tide(H) >= 2, ok15 = tide(H + 900) >= 2, r1 = G.h.R1;
  d.title = 'Go / No-go — ยืนยันการยกพลขึ้นบก';
  d.body = `อีก ${Math.round((H - G.t) / 60)} นาทีถึงเวลา H (${hhmm(H)}) เรือยกพลกำลังจะออกจากเรือวารี`;
  d.info = `ระดับน้ำ ณ H ≈ ${tide(H).toFixed(2)} ม. (เกณฑ์ ≥ 2.0) · H+15 ≈ ${tide(H + 900).toFixed(2)} ม. · ปืนกลชายหาด: ${r1.known ? 'ตรวจพบแล้ว' : 'ยังไม่ยืนยัน'} · แผนยิงเตรียม: ${G.prep === 'tight' ? 'ต่อเนื่องถึง H' : G.prep === 'early' ? 'จบก่อน H−20' : G.prep === 'none' ? 'ไม่ยิง' : '—'} · ทะเลระดับ ${Math.round(G.wx.ss)}`;
  d.opts = [
    O('go', 'Go — ดำเนินการตามแผน', ok ? 'good' : 'poor', ok ? 'เงื่อนไขครบตามแผน' : 'ระดับน้ำ ณ H ยังต่ำกว่าเกณฑ์'),
    O('d15', 'เลื่อนเวลา H ออกไป 15 นาที', ok ? 'ok' : (ok15 ? 'good' : 'ok'), ok ? 'เงื่อนไขครบแล้ว การเลื่อนทำให้เสียเวลา' : 'แก้ปัญหาระดับน้ำได้ทัน'),
    O('d30', 'เลื่อนเวลา H ออกไป 30 นาที', 'poor', 'เสียเวลามากและเข้าใกล้ช่วงพายุ')
  ];
  d.aiK = ok ? 'go' : 'd15'; d.defK = 'go';
}, res(G, d, k) {
  if (k === 'go') { log(G, 'c2', 'มรกต 6: "Go" ยกพลขึ้นบกตามแผน', 1, 'ข่ายบังคับบัญชา'); return; }
  G.H += k === 'd15' ? 900 : 1800; G.flags.goDone = true; planH(G);
  log(G, 'c2', `มรกต 6: เลื่อนเวลา H เป็น ${hhmm(G.H)}`, 2, 'ข่ายบังคับบัญชา');
} };

DEC.jtf_cas = { seat: 'jtf', dl: 150, aiDelay: 20, build(G, d) {
  const civ = G.civ.rb > 0;
  d.title = 'อนุมัติการสนับสนุนทางอากาศโดยใกล้ชิด (CAS)';
  d.body = 'ชี้ทาง (JTAC) ขอ CAS ทำลายด่านสกัดถนน เพื่อเปิดเส้นทางสู่สนามบิน';
  d.info = `พลเรือนที่ด่าน: ${civ ? 'ยังมีรถพลเรือน กำลังประกาศให้ออก' : 'ไม่มีรายงาน'} · อินทรี 1-2 อยู่เหนือพื้นที่ (เหลือเวลาราว ${Math.max(0, Math.round((G.bingo - G.t) / 60))} นาที) · ปืนใหญ่ยิงได้แต่เป็นการยิงพื้นที่`;
  d.opts = [
    O('cas', 'อนุมัติ CAS ภายใต้การควบคุมของ JTAC', 'good', 'อาวุธแม่นยำ มีผู้ควบคุมเห็นเป้าหมายและพลเรือนโดยตรง'),
    O('arty', 'ให้ใช้ปืนใหญ่แทน', civ ? 'poor' : 'ok', civ ? 'เป็นการยิงพื้นที่ใกล้พลเรือน' : 'ใช้ได้ แต่แม่นยำน้อยกว่าและต้องประสานห้วงอากาศ'),
    O('deny', 'ไม่อนุมัติ — ให้ อาชา อ้อมผ่าน DT1', 'ok', 'เลี่ยงความเสี่ยงแต่ช้าลง และด่านยังคุกคามถนน')
  ];
  d.aiK = 'cas';
}, res(G, d, k) {
  if (k === 'cas') { G.cas.st = 'fscc'; log(G, 'air', 'มรกต 6: อนุมัติ CAS — อินทรี 1-2 อยู่ใต้การควบคุมของ ชี้ทาง', 1, 'ข่ายบังคับบัญชา'); pushDec(G, 'fscc_cas'); }
  else if (k === 'arty') { G.cas.st = 'none'; log(G, 'c2', 'มรกต 6: ให้ใช้ปืนใหญ่ยิงด่าน', 1, 'ข่ายบังคับบัญชา'); requestFire(G, 'R4', 'ai', { obs: 'jtac' }); }
  else { G.cas.st = 'none'; cavDetour(G); }
} };

DEC.jtf_clip = { seat: 'jtf', dl: 180, aiDelay: 30, build(G, d) {
  d.title = 'คลิปปลอมในสื่อสังคมออนไลน์';
  d.body = 'มีคลิปตัดต่ออ้างว่าทหารทำร้ายพลเรือนที่จุดอพยพ แชร์ต่อในกลุ่มชาวบ้าน — คนมาจุดอพยพลดลง';
  d.info = `ความเชื่อมั่นพลเรือนลดลงเหลือ ${Math.round(G.civ.trust)}% · มีภาพจริงจากจุดอพยพ และนายทหารติดต่อรู้จักผู้นำชุมชน`;
  d.opts = [
    O('explain', 'ชี้แจงทันทีผ่านผู้นำชุมชน พร้อมภาพจริงจากจุดอพยพ', 'good', 'ตอบเร็ว ผ่านคนที่ชุมชนไว้ใจ มีหลักฐาน'),
    O('release', 'ออกแถลงการณ์ทางการภายหลัง', 'ok', 'ถูกต้องแต่ช้า ข่าวลือแพร่ไปก่อน'),
    O('ignore', 'ไม่ตอบโต้ มุ่งภารกิจต่อ', 'poor', 'ความเชื่อมั่นไม่ฟื้น การอพยพช้าลง'),
    O('ban', 'ห้ามพลเรือนใช้โทรศัพท์ที่จุดอพยพ', 'poor', 'ทำให้ดูเหมือนมีอะไรปิดบัง ความเชื่อมั่นลดลงอีก')
  ];
  d.aiK = 'explain';
}, res(G, d, k) {
  if (k === 'explain') G.trustQ.push({ t: G.t + 600, d: 15, x: 'ผู้นำชุมชนยืนยันว่าคลิปเป็นของปลอม' });
  else if (k === 'release') G.trustQ.push({ t: G.t + 1800, d: 8, x: 'แถลงการณ์ทางการเผยแพร่แล้ว' });
  else if (k === 'ban') trust(G, -10);
  log(G, 'civ', `มรกต 6: ${d.opts.find(o => o.k === k).l}`, 1, 'ข่ายประสาน');
} };

DEC.jtf_storm = { seat: 'jtf', dl: 150, aiDelay: 20, build(G, d) {
  d.title = 'พายุเข้าเร็วตามพยากรณ์';
  d.body = 'ลมแรงขึ้นราว 30 นอต ทะเลระดับ 5 ฝนหนัก ทัศนวิสัยลดลง คาดว่านานประมาณ 40 นาที';
  d.info = `เฮลิคอปเตอร์: ${heloTxt(G)} · เรือยกพล: ${G.u.lcu1.st}/${G.u.lcu2.st} · พลเรือนรอที่จุดอพยพ ${G.civ.ep} คน`;
  d.opts = [
    O('suspend', 'ระงับเที่ยวบินและการเดินเรือยกพลชั่วคราวจนพ้นพายุ', 'good', 'ลดความเสี่ยงอุบัติเหตุในสภาพนอกเกณฑ์'),
    O('judg', 'ให้ผู้ปฏิบัติตัดสินใจตามเกณฑ์ความปลอดภัยของตน', 'ok', 'ยืดหยุ่น แต่โยนภาระและแรงกดดันไปที่ผู้ปฏิบัติ'),
    O('push', 'เร่งอพยพเต็มที่ต่อไป', 'poor', 'สร้างแรงกดดันให้ปฏิบัตินอกเกณฑ์ความปลอดภัย')
  ];
  d.aiK = 'suspend';
}, res(G, d, k) {
  G.ops.mode = k; G.ops.suspend = (k === 'suspend');
  log(G, 'c2', `มรกต 6: ${d.opts.find(o => o.k === k).l}`, 1, 'ข่ายบังคับบัญชา');
  if (k === 'suspend') { const h = G.u.h2; if (h.st === 'out' || h.st === 'ephold') { h.st = 'back'; h.route = heloBack(G); } }
} };

/* --- อัคนี (FSCC) --- */
DEC.fscc_prep = { seat: 'fscc', dl: 240, aiDelay: 20, build(G, d) {
  d.title = 'แผนการยิงเตรียมก่อนยกพลขึ้นบก';
  d.body = 'เลือกช่วงเวลายิงกดดันปืนกลชายหาด (R1) ด้วยปืนใหญ่จากแผ่นดินใหญ่';
  d.info = 'ผลการกดดันคงอยู่ราว 3 นาทีหลังกระสุนตกแต่ละชุด (ค่าสาธิต) · เวลา H ยังกำหนดได้ระหว่าง 05:30–06:30 · ความมืดช่วยกำบังการเข้าหาด';
  const dark = G.H != null && G.H < 21000;
  d.opts = [
    O('tight', 'ยิงกดดันต่อเนื่องช่วง H−6 ถึง H', 'good', 'ข้าศึกถูกกดดันขณะเรือยกพลเข้าหาด'),
    O('early', 'ยิงเตรียมช่วง H−30 ถึง H−20 แล้วหยุด', 'poor', 'ผลการกดดันหมดก่อนเรือยกพลถึงหาด ข้าศึกฟื้นตัวทัน'),
    O('none', 'ไม่ยิงเตรียม (รักษาความลับ)', dark ? 'ok' : 'poor', dark ? 'การจู่โจมในความมืดเป็นทางเลือกได้ แต่เสี่ยงต่อเรือยกพล' : 'เรือยกพลเข้าหาดโดยไม่มีการกดดัน')
  ];
  d.aiK = 'tight';
}, res(G, d, k) { G.prep = k; planH(G); log(G, 'fires', `อัคนี: แผนยิงเตรียม — ${d.opts.find(o => o.k === k).l}`, 0, 'ข่ายประสาน'); } };

DEC.fscc_acm = { seat: 'fscc', dl: 240, aiDelay: 22, build(G, d) {
  d.title = 'มาตรการประสานห้วงอากาศ (เฮลิคอปเตอร์ × แนวยิงปืนใหญ่)';
  d.body = 'เฮลิคอปเตอร์จากเรือต้องบินข้ามแนวยิงปืนใหญ่ที่ยิงจากแผ่นดินใหญ่ไปยังเกาะ';
  d.info = 'ประตู ก อยู่เหนือทะเลใกล้เรือ · เส้นทางผ่านประตูยาวกว่าบินตรงราว 30% · ขณะเฮลิคอปเตอร์อยู่ใกล้ประตู ปืนใหญ่ต้องหยุดยิงชั่วขณะ';
  d.opts = [
    O('gate', 'ช่องทางบิน + ประตูข้ามแนวยิง (ควบคุมตามขั้นตอน)', 'good', 'ทุกฝ่ายรู้กติกาเดียวกัน ไม่ต้องพึ่งการตรวจทุกครั้ง'),
    O('direct', 'บินตรง + FSCC ตรวจห้วงอากาศทุกภารกิจ', 'ok', 'เร็วกว่า แต่ความปลอดภัยขึ้นกับการตรวจทุกครั้ง พลาดครั้งเดียวอันตราย'),
    O('free', 'บินตรง ไม่กำหนดมาตรการ', 'poor', 'FSCC ไม่รู้เส้นทางเฮลิคอปเตอร์ เสี่ยงต่อการบินผ่านแนวยิง')
  ];
  d.aiK = 'gate';
}, res(G, d, k) { G.acm = k; log(G, 'air', `อัคนี: มาตรการห้วงอากาศ — ${d.opts.find(o => o.k === k).l}`, 0, 'ข่ายประสาน'); } };

DEC.fscc_fire = { seat: 'fscc', dl: 150, aiDelay: 20, build(G, d) {
  const m = mis(G, d.data.mid); const p = parseGrid(m.grid);
  const nf = nearestNFA(p.x, p.y), fr = nearestFriendly(G, p.x, p.y, true), civ = civNear(G, p.x, p.y);
  const air = predictAir(G, p, G.t + PREP);
  const hz = nf.d < 200 || (fr && fr.d < 600) || civ, ac = air.length > 0;
  const airTxt = ac ? air.map(a => `${a.cs} จะผ่านแนวยิงในอีก ~${Math.round(a.dt)} วินาที`).join(', ')
    : G.acm === 'gate' ? 'เฮลิคอปเตอร์ใช้ประตู ก (ควบคุมตามขั้นตอน)' : G.acm === 'free' ? 'ไม่มีมาตรการ — ไม่ทราบเส้นทางเฮลิคอปเตอร์' : 'ไม่พบอากาศยานขวางแนวยิง';
  d.title = `อนุมัติภารกิจยิง ${m.id}`;
  d.body = `${m.desc} · พิกัด ${m.grid}${m.rep ? ' (ยิงซ้ำ)' : ''}${m.obs !== 'fo' ? ' · ผู้ขอ: ' + G.u[m.obs].cs : ''}`;
  d.info = `เขตห้ามยิงใกล้สุด: ${nfaTxt(nf)} · ฝ่ายเดียวกันใกล้สุดบนภาพสถานการณ์: ${fr ? fr.u.cs + ' ' + fmt(fr.d) + ' ม.' : '—'}${civ ? ' · มีรายงานพลเรือนใกล้เป้าหมาย' : ''} · ห้วงอากาศ: ${airTxt}${!['none', 'done'].includes(G.cas.st) ? ' · CAS กำลังดำเนินการ' : ''}`;
  d.opts = [
    O('ok', 'อนุมัติการยิง', hz || ac ? 'poor' : 'good', hz ? 'มีอันตรายต่อเขตห้ามยิง/ฝ่ายเดียวกัน/พลเรือนตามข้อมูลที่มี' : ac ? 'อากาศยานจะผ่านแนวยิงระหว่างกระสุนเดินทาง' : 'ตรวจครบ ปลอดภัยตามข้อมูลที่มี'),
    O('hold', 'ระงับไว้จนห้วงอากาศปลอดภัย', ac ? 'good' : 'ok', ac ? 'แยกอากาศยานกับการยิงด้วยเวลา' : 'ไม่มีอากาศยานขวาง ทำให้การยิงล่าช้า'),
    O('deny', 'ไม่อนุมัติ', hz ? 'good' : 'poor', hz ? 'ป้องกันอันตรายต่อเขตห้ามยิง/ฝ่ายเดียวกัน/พลเรือน' : 'ไม่มีเหตุตามข้อมูลที่มี หน่วยในพื้นที่เสียการสนับสนุน')
  ];
  d.aiK = hz ? 'deny' : ac ? 'hold' : 'ok'; d.defK = 'hold';
}, res(G, d, k) {
  const m = mis(G, d.data.mid); if (!m || m.st !== 'fscc') return;
  if (k === 'ok') { m.st = 'ready'; m.t.ready = G.t; log(G, 'fires', `อัคนี: อนุมัติภารกิจ ${m.id}`, 0, 'ข่ายประสาน'); }
  else if (k === 'hold') { m.st = 'hold'; m.t.chk = G.t + 10; log(G, 'fires', `อัคนี: ระงับภารกิจ ${m.id} ชั่วคราว — รอห้วงอากาศปลอดภัย`, 0, 'ข่ายประสาน'); }
  else { m.st = 'denied'; G.m.denied++; log(G, 'fires', `อัคนี: ไม่อนุมัติภารกิจ ${m.id}`, 1, 'ข่ายประสาน'); }
} };

DEC.fscc_cas = { seat: 'fscc', dl: 120, aiDelay: 15, build(G, d) {
  const act = G.missions.filter(m => ['ready', 'hold', 'flight', 'fscc'].includes(m.st)).length;
  d.title = 'ประสาน CAS กับการยิงปืนใหญ่';
  d.body = 'อินทรี 1-2 จะบินจาก IP ทองหลาง ข้ามแนวยิงปืนใหญ่ไปยังด่านสกัดถนน';
  d.info = `ภารกิจปืนใหญ่ที่กำลังดำเนินการ: ${act} · เส้นทางบินเข้าตัดแนวยิงไปเนิน 214 บริเวณเหนือเนิน 120 · เส้นทางเลี่ยงทางตะวันออกเพิ่มเวลาบินราว 1–2 นาที`;
  d.opts = [
    O('hold', 'ระงับการยิงปืนใหญ่ระหว่าง CAS (ราว 3 นาที)', 'good', 'แยกด้วยเวลา ปลอดภัยและเข้าใจง่ายที่สุด'),
    O('alt', 'ให้บินเข้าด้วยเส้นทางเลี่ยงแนวยิงทางตะวันออก', 'ok', 'แยกด้วยพื้นที่ ใช้ได้แต่เพิ่มเวลาและเชื้อเพลิง'),
    O('cont', 'ยิงต่อ — ให้นักบินระวังเอง', 'poor', 'ไม่มีการแยกอากาศยานกับการยิงที่ยืนยันได้')
  ];
  d.aiK = 'hold';
}, res(G, d, k) { G.cas.acm = k; G.cas.st = 'brief'; log(G, 'air', `อัคนี: ประสาน CAS — ${d.opts.find(o => o.k === k).l}`, 0, 'ข่ายประสาน'); pushDec(G, 'jtac_brief'); } };

/* --- สายฟ้า (FDC) --- */
DEC.fdc_rx = { seat: 'fdc', dl: 150, aiDelay: 20, build(G, d) {
  const m = mis(G, d.data.mid); const p = parseGrid(m.grid); const ob = G.u[m.obs];
  const cdir = bearing(ob.x, ob.y, p.x, p.y), crng = dxy(ob.x, ob.y, p.x, p.y);
  const mism = Math.abs(angDiff(cdir, m.dir)) > 10 || Math.abs(crng - m.rng) > Math.max(250, 0.15 * m.rng);
  const nf = nearestNFA(p.x, p.y), fr = nearestFriendly(G, p.x, p.y, true);
  const hz = nf.d < 200 || (fr && fr.d < 600);
  d.title = `รับคำขอยิง ${m.id}${m.recheck ? ' (ตรวจซ้ำหลังระงับการยิง)' : ''}`;
  d.body = `${ob.cs}: "ภารกิจยิง พิกัด ${m.grid} ทิศ ${pad3(m.dir)}° ระยะ ${fmt(m.rng)} ม. — ${m.desc}"`;
  d.info = `ตรวจไขว้จากพิกัด: ทิศ ${pad3(cdir)}° ระยะ ${fmt(crng)} ม. → ${mism ? 'ไม่สอดคล้องกับที่ผู้ตรวจการณ์แจ้ง' : 'สอดคล้อง'} · เขตห้ามยิงใกล้สุด: ${nfaTxt(nf)} · ฝ่ายเดียวกันใกล้สุดบนภาพสถานการณ์: ${fr ? `${fr.u.cs} ${fmt(fr.d)} ม. (รายงานเมื่อ ${Math.round(fr.age / 60)} นาทีก่อน)` : '—'}`;
  d.opts = [
    O('fwd', 'ทวนกลับ แล้วส่งให้ อัคนี (FSCC) อนุมัติ', mism || hz ? 'poor' : 'good', mism ? 'พิกัดไม่สอดคล้องกับทิศ/ระยะ ควรสอบถามก่อน' : hz ? 'เป้าหมายใกล้เขตห้ามยิง/ฝ่ายเดียวกันตามภาพสถานการณ์' : 'ข้อมูลสอดคล้อง ปลอดภัยตามข้อมูลที่มี'),
    O('query', 'สอบถามกลับ: "ขอยืนยันพิกัด"', mism ? 'good' : 'ok', mism ? 'จับความไม่สอดคล้องได้ก่อนยิง' : 'ข้อมูลสอดคล้องอยู่แล้ว ทำให้ล่าช้าเล็กน้อย'),
    O('deny', 'ปฏิเสธภารกิจ — ไม่ปลอดภัย', hz ? 'good' : 'poor', hz ? 'เป้าหมายใกล้เขตห้ามยิง/ฝ่ายเดียวกัน' : 'ไม่พบเหตุอันตรายตามข้อมูลที่มี')
  ];
  d.aiK = hz ? 'deny' : (mism && rnd(G) < 0.85) ? 'query' : 'fwd'; d.defK = 'fwd';
}, res(G, d, k) {
  const m = mis(G, d.data.mid); if (!m || m.st !== 'fdc') return;
  if (k === 'fwd') { m.st = 'fscc'; m.t.fscc = G.t; log(G, 'fires', `สายฟ้า → ${G.u[m.obs].cs}: "ทวนกลับ ${m.grid} — รับทราบ" ส่ง อัคนี ตรวจสอบ`, 0, 'ข่ายยิง'); pushDec(G, 'fscc_fire', { mid: m.id }); }
  else if (k === 'query') { m.st = 'query'; log(G, 'fires', `สายฟ้า → ${G.u[m.obs].cs}: "ขอยืนยันพิกัด ${m.grid}"`, 1, 'ข่ายยิง'); pushDec(G, 'fo_query', { mid: m.id }); }
  else { m.st = 'denied'; G.m.denied++; log(G, 'fires', `สายฟ้า: ปฏิเสธภารกิจ ${m.id} — ไม่ปลอดภัย`, 1, 'ข่ายยิง'); }
} };

/* --- ตาเหยี่ยว (FO) --- */
DEC.fo_query = { seat: G => G.u.fo ? 'fo' : null, dl: 120, aiDelay: 15, build(G, d) {
  const m = mis(G, d.data.mid); const ob = G.u[m.obs];
  d.title = 'สายฟ้าขอยืนยันพิกัด';
  d.body = `สายฟ้า: "ขอยืนยันพิกัด ${m.grid} — ไม่สอดคล้องกับทิศ/ระยะที่แจ้ง"`;
  d.info = `จากการตรวจการณ์ของ ${ob.cs}: "${m.desc}" อยู่ที่ ${m.grid0} (ทิศ ${pad3(m.dir)}° ระยะ ${fmt(m.rng)} ม.)`;
  if (m.err) d.opts = [O('fix', `แก้ไข: "พิกัดที่ถูกต้อง ${m.grid0}"`, 'good', 'ตรวจพบและแก้พิกัดที่คลาดเคลื่อนก่อนยิง'), O('conf', `ยืนยันพิกัดเดิม "${m.grid}"`, 'poor', 'พิกัดที่ส่งไปไม่ตรงกับการตรวจการณ์ของตนเอง')];
  else d.opts = [O('conf', `ยืนยัน "${m.grid}"`, 'good', 'พิกัดตรงกับการตรวจการณ์'), O('cancel', 'ยกเลิกภารกิจ', 'ok', 'ปลอดภัยแต่เสียโอกาสยิง')];
  d.aiK = m.err ? 'fix' : 'conf'; d.defK = 'conf';
}, res(G, d, k) {
  const m = mis(G, d.data.mid); if (!m || m.st !== 'query') return;
  if (k === 'cancel') { m.st = 'cancelled'; return; }
  if (k === 'fix') { m.grid = m.grid0; m.err = false; m.caught = 'fdc'; G.m.caughtFDC++; log(G, 'fires', `${G.u[m.obs].cs}: "แก้ไข พิกัด ${m.grid}"`, 1, 'ข่ายยิง'); }
  else log(G, 'fires', `${G.u[m.obs].cs}: "ยืนยัน ${m.grid}"`, 0, 'ข่ายยิง');
  m.st = 'fscc'; m.t.fscc = G.t; pushDec(G, 'fscc_fire', { mid: m.id });
} };

DEC.fo_bda = { seat: 'fo', dl: 120, aiDelay: 20, build(G, d) {
  const m = mis(G, d.data.mid); const h = G.h[m.tgt]; const di = dxy(m.imp.x, m.imp.y, h.x, h.y);
  d.title = `ผลการยิงภารกิจ ${m.id}`;
  if (di > 600) {
    d.body = `ไม่เห็นกระสุนตกบริเวณ${h.nm}`;
    d.info = `กระสุนตกห่างเป้าหมายประมาณ ${fmt(di)} ม. ทางทิศ ${pad3(bearing(h.x, h.y, m.imp.x, m.imp.y))}° — อาจมีพิกัดผิดพลาด`;
    d.opts = [O('cf', 'แจ้ง "ระงับการยิง" และให้ตรวจสอบพิกัด', 'good', 'หยุดความเสียหายต่อเนื่องและหาสาเหตุ'), O('rpt', 'ยิงซ้ำ (เท่าเดิม)', 'poor', 'ยิงซ้ำด้วยพิกัดเดิมที่ผิด'), O('eom', 'ยุติภารกิจ', 'ok', 'หยุดยิงแต่ไม่ได้แจ้งให้หาสาเหตุ')];
    d.aiK = 'cf'; d.defK = 'eom';
  } else {
    const alive = h.str > 30;
    d.body = `${h.nm}: ${alive ? 'ยังมีการเคลื่อนไหว' : 'หยุดการเคลื่อนไหว ถูกกดดันแล้ว'}`;
    d.info = `กระสุนตกห่างเป้าหมายประมาณ ${fmt(di)} ม. · ประเมินกำลังเป้าหมายคงเหลือราว ${Math.round(h.str / 10) * 10}%`;
    d.opts = [O('rpt', 'ยิงซ้ำ (เท่าเดิม)', alive ? 'good' : 'poor', alive ? 'เป้าหมายยังมีกำลัง' : 'เป้าหมายถูกกดดันแล้ว สิ้นเปลืองและเพิ่มความเสี่ยง'), O('eom', 'ยุติภารกิจ รายงานผล', alive ? 'ok' : 'good', alive ? 'เป้าหมายยังคุกคามอยู่' : 'บรรลุผลแล้ว')];
    d.aiK = alive ? 'rpt' : 'eom'; d.defK = 'eom';
  }
}, res(G, d, k) {
  const m = mis(G, d.data.mid); if (!m) return; m.st = 'done';
  if (k === 'rpt') {
    if (G.h[m.tgt].str <= 0) return;
    const n = newMission(G, { tgt: m.tgt, desc: m.desc, grid: m.grid, grid0: m.grid0, err: m.err, obs: m.obs, dir: m.dir, rng: m.rng, rep: m.rep + 1, by: m.by });
    n.st = 'fscc'; n.t.fscc = G.t; log(G, 'fires', `${G.u[m.obs].cs}: "ยิงซ้ำ"`, 0, 'ข่ายยิง'); pushDec(G, 'fscc_fire', { mid: n.id });
  } else if (k === 'cf') {
    m.caught = 'bda'; G.m.caughtBDA++; G.cfUntil = G.t + 60; G.h[m.tgt].lastReq = G.t - 200;
    log(G, 'fires', `${G.u[m.obs].cs}: "ระงับการยิง! กระสุนไม่ตกที่เป้าหมาย — ตรวจสอบพิกัด"`, 2, 'ข่ายยิง');
  } else log(G, 'fires', `${G.u[m.obs].cs}: "ยุติภารกิจ ${m.id}"`, 0, 'ข่ายยิง');
} };

DEC.fo_lost = { seat: 'fo', dl: 120, aiDelay: 20, build(G, d) {
  const m = mis(G, d.data.mid);
  d.title = 'ข่ายยิงขัดข้อง';
  d.body = `ส่งคำขอยิง ${m.id} ถึงสายฟ้าไม่ได้ (สถานีทวนสัญญาณขัดข้อง)`;
  d.info = 'ทางเลือก: ข่ายสำรองผ่านเรือวารี (ทร.) หรือข่ายบังคับบัญชาผ่าน พยัคฆ์ 6 · คาดว่าข่ายหลักกลับมาภายในราว 10 นาที';
  d.opts = [O('ship', 'ส่งผ่านเรือวารี (ข่ายสำรองร่วมเหล่า)', 'good', 'ใช้ช่องทางสำรองที่วางแผนไว้ ล่าช้าราว 1 นาที'), O('coy', 'ส่งผ่าน พยัคฆ์ 6 ทางข่ายบังคับบัญชา', 'ok', 'ได้ผลแต่ล่าช้าและเพิ่มขั้นตอนทวนข้อความ'), O('wait', 'รอจนข่ายหลักกลับมา', 'poor', 'หน่วยในพื้นที่ขาดการสนับสนุนนาน')];
  d.aiK = 'ship'; d.defK = 'wait';
}, res(G, d, k) {
  const m = mis(G, d.data.mid); if (!m || m.st !== 'lost') return;
  if (k === 'ship') { m.st = 'cff'; m.t.arr = G.t + 60; m.relay = 'วารี'; log(G, 'c2', `วารี: ทวนข้อความคำขอยิง ${m.id} ถึงสายฟ้า`, 0, 'ข่ายเรือ'); }
  else if (k === 'coy') { m.st = 'cff'; m.t.arr = G.t + 120; m.relay = 'พยัคฆ์ 6'; log(G, 'c2', `พยัคฆ์ 6: ทวนข้อความคำขอยิง ${m.id}`, 0, 'ข่ายบังคับบัญชา'); }
  else m.st = 'wait';
} };

DEC.fo_target = { seat: G => G.seat === 'fo' ? 'fo' : null, dl: 150, aiDelay: 20, build(G, d) {
  const h = G.h[d.data.tgt], fo = G.u.fo; if (!h || !h.known || h.str <= 0) { d.opts = []; return; }
  const civ = civNear(G, h.kx, h.ky), nf = nearestNFA(h.kx, h.ky), fr = nearestFriendly(G, h.kx, h.ky, true);
  const planned = h.id === 'R1' && G.prep && G.prep !== 'none' && G.H != null && G.t < G.H;
  const hz = civ || nf.d < 200 || (fr && fr.d < 600);
  d.title = `ตรวจพบเป้าหมาย: ${h.nm}`;
  d.body = `${h.nm} บริเวณ ${gridStr(h.kx, h.ky)} — ทิศ ${pad3(bearing(fo.x, fo.y, h.kx, h.ky))}° ระยะ ${fmt(dxy(fo.x, fo.y, h.kx, h.ky))} ม. จากที่ตรวจการณ์`;
  d.info = `${civ ? 'มีพลเรือนใกล้เป้าหมาย' : 'ไม่พบพลเรือนใกล้เป้าหมาย'} · เขตห้ามยิงใกล้สุด: ${nfaTxt(nf)} · ฝ่ายเดียวกันใกล้สุด: ${fr ? fr.u.cs + ' ' + fmt(fr.d) + ' ม.' : '—'}${planned ? ' · แผนยิงเตรียมครอบคลุมเป้าหมายนี้แล้ว' : ''}`;
  d.opts = [
    O('cff', 'ส่งคำขอยิงทันที', hz || planned ? 'poor' : 'good', hz ? 'เป้าหมายใกล้พลเรือน/เขตห้ามยิง/ฝ่ายเดียวกัน' : planned ? 'ซ้ำซ้อนกับแผนยิงเตรียม และเปิดเผยแผนก่อนเวลา' : 'เป้าหมายคุกคามหน่วยฝ่ายเรา ควรยิงโดยเร็ว'),
    O('watch', 'เฝ้าตรวจต่อ ยังไม่ขอยิง', hz || planned ? 'good' : 'ok', hz ? 'รอให้เงื่อนไขปลอดภัยหรือใช้วิธีอื่น' : planned ? 'ปล่อยให้แผนยิงเตรียมทำงาน' : 'ปล่อยให้เป้าหมายคุกคามต่อไป')
  ];
  d.aiK = hz || planned ? 'watch' : 'cff'; d.defK = d.aiK;
}, res(G, d, k) { const h = G.h[d.data.tgt]; if (k === 'cff') act(G, 'cff', { tgt: d.data.tgt }); else if (h) log(G, 'intel', `ตาเหยี่ยว: เฝ้าตรวจ${h.nm}ต่อไป`, 0, 'ข่ายยิง'); } };

/* --- พยัคฆ์ 6 / พยัคฆ์ 1-1 / อาชา 6 --- */
DEC.coy_ep = { seat: 'coy', dl: 180, aiDelay: 25, build(G, d) {
  const thr = threatAt(G, WORLD.ep);
  d.title = 'เปิดจุดอพยพพลเรือน (EP) ที่โรงเรียน';
  d.body = 'พยัคฆ์ 1-1 ถึงโรงเรียนแล้ว พร้อมเปิดจุดอพยพ';
  d.info = `พลเรือนในเมืองราว ${G.civ.town} คน · ความเชื่อมั่น ${Math.round(G.civ.trust)}% · ${thr ? 'จุดอพยพยังอยู่ในระยะคุกคามของข้าศึก' : 'ไม่พบภัยคุกคามต่อจุดอพยพ'} · เฮลิคอปเตอร์รับได้เที่ยวละ 20 คน`;
  d.opts = [
    O('screen', 'เปิดพร้อมจุดคัดกรอง (รักษาระยะ มีล่าม แยกผู้ป่วย)', 'good', 'สมดุลระหว่างความปลอดภัยกับการอพยพ'),
    O('fast', 'เปิดทันทีโดยไม่คัดกรอง', 'poor', 'เร็วขึ้นแต่เสี่ยงต่อการแฝงตัวและความสับสน'),
    O('wait', 'รอจนภัยคุกคามถูกกดดันก่อน', thr ? 'ok' : 'poor', thr ? 'ปลอดภัยขึ้นแต่เสียเวลาอพยพ' : 'ไม่มีภัยคุกคามแล้ว การรอทำให้เสียเวลา')
  ];
  d.aiK = 'screen';
}, res(G, d, k) {
  if (k === 'wait') { G.flags.epWait = G.t; log(G, 'civ', 'พยัคฆ์ 6: ชะลอการเปิดจุดอพยพ', 1, 'ข่ายบังคับบัญชา'); return; }
  G.civ.epOpen = true; G.civ.screen = (k === 'screen'); G.obj.ep = G.t; if (k === 'screen') trust(G, 5);
  sched(G, G.t + 1500, 'epV');
  log(G, 'civ', `พยัคฆ์ 6: เปิดจุดอพยพที่โรงเรียน${k === 'screen' ? ' พร้อมจุดคัดกรอง' : ''}`, 1, 'ข่ายบังคับบัญชา');
} };

DEC.coy_town = { seat: 'coy', urgent: true, aiDelay: 8, build(G, d) {
  d.title = 'ถูกยิงจากอาคารใกล้โรงพยาบาล';
  d.body = 'พยัคฆ์ 3: "ถูกยิงจากอาคารห่างโรงพยาบาลราว 400 ม. มีพลเรือนอยู่ในละแวก"';
  d.info = 'โรงพยาบาลเป็นเขตห้ามยิง · พลเรือนเดินผ่านถนนสายนี้ไปจุดอพยพ · พยัคฆ์ 3 มีที่กำบัง';
  d.opts = [
    O('maneuver', 'ตรึงและกำบัง เตือนพลเรือน แล้วโอบทางปีกด้วยอาวุธประจำกายอย่างจำกัด', 'good', 'ใช้กำลังได้สัดส่วน หลีกเลี่ยงอันตรายต่อพลเรือนและเขตห้ามยิง'),
    O('arty', 'ขอยิงปืนใหญ่ใส่อาคาร', 'poor', 'ใกล้เขตห้ามยิงและพลเรือน ไม่ได้สัดส่วน'),
    O('withdraw', 'ถอนตัวออกจากเมือง', 'ok', 'ปลอดภัยต่อกำลังพล แต่จุดอพยพและพลเรือนเสียการคุ้มกัน')
  ];
  d.aiK = 'maneuver'; d.defK = 'withdraw';
}, res(G, d, k) {
  if (k === 'maneuver') { G.flags.r3atk = true; log(G, 'land', 'พยัคฆ์ 6: พยัคฆ์ 3 ตรึงและโอบทางปีก เตือนพลเรือนให้หลบ', 1, 'ข่ายบังคับบัญชา'); }
  else if (k === 'arty') { log(G, 'land', 'พยัคฆ์ 6: ขอยิงปืนใหญ่ใส่อาคารใกล้โรงพยาบาล', 1, 'ข่ายบังคับบัญชา'); requestFire(G, 'R3', 'ai', { obs: 'p3' }); G.flags.r3fallback = G.t + 240; }
  else { const p = G.u.p3; p.route = [[11500, 12500]]; p.st = 'move'; G.flags.r3wd = true; log(G, 'land', 'พยัคฆ์ 6: พยัคฆ์ 3 ถอนตัวออกจากเมือง', 1, 'ข่ายบังคับบัญชา'); }
} };

DEC.sql_roe_ep = { seat: 'sql', urgent: true, aiDelay: 6, build(G, d) {
  d.title = 'จุดคัดกรอง: บุคคลไม่หยุดตามคำสั่ง';
  d.body = 'ชายคนหนึ่งเดินเข้าหาเจ้าหน้าที่ มือล้วงในเสื้อ ไม่หยุดเมื่อถูกสั่ง ระยะราว 15 ม.';
  d.info = 'ไม่เห็นอาวุธ · มีพลเรือนต่อแถวอยู่ด้านหลัง · ล่ามอยู่ห่างไป 10 ม.';
  d.opts = [
    O('talk', 'สั่งหยุดซ้ำผ่านล่าม ถอยรักษาระยะ กันพลเรือนออก', 'good', 'ใช้ขั้นการใช้กำลังตามลำดับ ยังไม่มีการกระทำหรือเจตนาเป็นปรปักษ์ที่ชัดเจน'),
    O('shoot', 'ใช้อาวุธทันที', 'poor', 'ยังไม่มีการกระทำหรือเจตนาเป็นปรปักษ์ที่ชัดเจน'),
    O('pass', 'ปล่อยผ่านไปก่อน', 'poor', 'ละเลยการคัดกรอง เสี่ยงต่อพลเรือนคนอื่นและเจ้าหน้าที่')
  ];
  d.aiK = 'talk'; d.defK = 'pass';
}, res(G, d, k) {
  if (k === 'talk') { trust(G, 3); log(G, 'roe', 'พยัคฆ์ 1-1: ชายคนนั้นหยุดและหยิบโทรศัพท์มือถือออกมา — เขาไม่ได้ยินคำสั่งเพราะหูตึง', 1, 'ข่ายบังคับบัญชา'); }
  else if (k === 'shoot') { G.civ.harmF += 1; G.m.civHarm += 1; G.m.roe++; trust(G, -20); log(G, 'roe', 'สิ่งที่อยู่ในมือคือโทรศัพท์มือถือ — พลเรือนบาดเจ็บ 1 คน', 3, 'ข่ายบังคับบัญชา'); }
  else { G.m.screenLapse++; log(G, 'roe', 'ปล่อยผ่านโดยไม่คัดกรอง — ภายหลังพบว่าเป็นโทรศัพท์ แต่จุดคัดกรองเสียระเบียบ', 2, 'ข่ายบังคับบัญชา'); }
} };

DEC.cav_roadblock = { seat: 'cav', urgent: true, aiDelay: 8, build(G, d) {
  d.title = 'พบด่านสกัดถนน — มีรถพลเรือน';
  d.body = 'อาชา 6: "พบด่านข้าศึกถัดจากทางแยก ข ระยะราว 1 กม. มีรถพลเรือน 2 คันจอดใกล้ด่าน"';
  d.info = 'ด่านปิดเส้นทางหลักสู่สนามบิน · มีเส้นทางสำรอง DT1 (ทางดิน ช้ากว่า) · ชี้ทาง (JTAC) อยู่กับหน่วย · อินทรี 1-2 อยู่เหนือพื้นที่';
  d.opts = [
    O('halt', 'หยุด รักษาระยะ รายงาน — ประกาศให้พลเรือนออกก่อน แล้วขอ CAS', 'good', 'คุ้มครองพลเรือนและใช้การสนับสนุนที่แม่นยำ'),
    O('fire', 'ยิงด่านด้วยอาวุธประจำรถทันที', 'poor', 'พลเรือนยังอยู่ในพื้นที่'),
    O('detour', 'อ้อมผ่านเส้นทาง DT1', 'ok', 'เลี่ยงการปะทะแต่ช้ากว่า และด่านยังคุกคามถนน')
  ];
  d.aiK = 'halt'; d.defK = 'halt';
}, res(G, d, k) {
  const c = G.u.cav;
  if (k === 'halt') { G.civ.rbClearAt = G.t + 360; c.st = 'halt'; log(G, 'land', 'อาชา 6: หยุดรักษาระยะ ประกาศเครื่องขยายเสียงให้รถพลเรือนออกจากด่าน', 1, 'ข่ายบังคับบัญชา'); if (G.cas.st === 'none') { G.cas.st = 'req'; log(G, 'air', 'ชี้ทาง: ขอ CAS ทำลายด่านสกัดถนน', 1, 'ข่ายอากาศ'); pushDec(G, 'jtf_cas'); } }
  else if (k === 'fire') { cavFire(G); }
  else cavDetour(G);
} };

DEC.cav_rbatk = { seat: 'cav', dl: 120, aiDelay: 20, build(G, d) {
  const civ = G.civ.rb > 0;
  d.title = 'ด่านสกัดถนนยังอยู่';
  d.body = `CAS ${G.cas.st === 'done' ? 'สิ้นสุดแล้ว' : 'ไม่พร้อม'} — ด่านยังปิดเส้นทางสู่สนามบิน`;
  d.info = civ ? 'ยังมีรถพลเรือนใกล้ด่าน' : 'พลเรือนออกจากพื้นที่แล้ว · ด่านอยู่ห่างราว 1 กม.';
  d.opts = [
    O('atk', 'เข้าตีด่านด้วยรถรบ', civ ? 'poor' : 'good', civ ? 'พลเรือนยังอยู่' : 'พลเรือนออกแล้ว ใช้กำลังได้สัดส่วน'),
    O('detour', 'อ้อมผ่าน DT1', 'ok', 'เลี่ยงการปะทะแต่ช้ากว่า'),
    O('wait', 'รอต่อไป', 'poor', 'เสียเวลาในการยึดสนามบิน')
  ];
  d.aiK = civ ? 'detour' : 'atk';
}, res(G, d, k) { if (k === 'atk') cavFire(G); else if (k === 'detour') cavDetour(G); else G.flags.rbAsk = G.t + 600; } };

DEC.rep_due = { seat: G => (['coy', 'sql', 'cav', 'fo', 'jtac'].includes(G.seat) ? G.seat : null), dl: 120, aiDelay: 9e9, build(G, d) {
  const u = G.u[seatUnit(d.seat)]; if (!u || u.emb) { d.opts = []; return; }
  const pin = pinned(G, u);
  d.title = 'ถึงรอบรายงานตำแหน่ง';
  d.body = `${u.cs}: ตำแหน่งปัจจุบัน ${gridStr(u.x, u.y)} — หน่วยอื่นเห็นท่านตามที่รายงานล่าสุดเท่านั้น`;
  d.info = `รายงานล่าสุด ${u.rep ? Math.round((G.t - u.rep.t) / 60) + ' นาทีก่อน' : 'ยังไม่เคย'}${pin ? ' · กำลังปะทะ' : ''}`;
  d.opts = [O('now', 'รายงานตำแหน่งทันที', 'good', 'ภาพสถานการณ์ร่วมถูกต้อง ลดความเสี่ยงยิงฝ่ายเดียวกัน'), O('later', 'ไว้ก่อน', pin ? 'ok' : 'poor', pin ? 'กำลังปะทะ แต่ควรรายงานโดยเร็ว' : 'หน่วยอื่นเห็นตำแหน่งที่ล้าสมัย')];
  d.aiK = 'now'; d.defK = 'later';
}, res(G, d, k) { if (k === 'now') reportPos(G, G.u[seatUnit(d.seat)]); } };

/* --- วารี (ผบ.เรือ / OOD / FDO) --- */
DEC.co_contact = { seat: 'co', urgent: true, aiDelay: 8, build(G, d) {
  const b = G.c.boat;
  d.title = 'เรือไม่ทราบฝ่ายเข้าใกล้';
  d.body = `เรือประมงขนาดเล็กแล่นตรงเข้าหาวารี ระยะ ${fmt(dist(b, G.u.wr))} ม. ไม่ตอบวิทยุ`;
  d.info = 'เวหา 1 รายงาน: เห็นคนบนเรือโบกผ้า ไม่เห็นอาวุธ · ความเร็วต่ำ · ใกล้เส้นทางเรือยกพล';
  d.opts = [
    O('assist', 'ลดความเร็ว เปลี่ยนเข็มหลบ ส่งเรือเล็กพร้อมแพทย์ตรวจสอบ (เตรียมป้องกันตนเองตามขั้น)', 'good', 'พิสูจน์ทราบตามลำดับขั้น เปิดทางช่วยเหลือ'),
    O('warn', 'ยิงเตือนทันที', 'ok', 'เป็นขั้นหนึ่งของการเพิ่มระดับ แต่เร็วเกินไปเมื่อไม่มีสัญญาณเป็นปรปักษ์'),
    O('fire', 'ยิงหยุดเรือ', 'poor', 'ไม่มีการกระทำหรือเจตนาเป็นปรปักษ์ — ไม่เป็นไปตามกฎการใช้กำลัง')
  ];
  d.aiK = 'assist'; d.defK = 'assist';
}, res(G, d, k) {
  const b = G.c.boat; if (!b) return; b.st = 'stopped';
  if (k === 'assist') { b.idAt = G.t + 120; sched(G, G.t + 240, 'boatFollow'); log(G, 'sea', 'วารี: ส่งเรือเล็กพร้อมแพทย์ไปพิสูจน์ทราบเรือประมง', 1, 'ข่ายเรือ'); }
  else if (k === 'warn') { b.idAt = G.t + 180; sched(G, G.t + 360, 'boatFollow'); trust(G, -5); log(G, 'sea', 'วารี: ยิงเตือน — เรือประมงหยุด คนบนเรือตกใจ', 2, 'ข่ายเรือ'); }
  else { b.idAt = G.t + 60; b.st = 'disabled'; G.civ.harmF += 2; G.m.civHarm += 2; G.m.roe++; trust(G, -25); log(G, 'sea', 'วารี: ยิงหยุดเรือ — พบว่าเป็นชาวประมง วิทยุเสีย มีผู้บาดเจ็บ', 3, 'ข่ายเรือ'); }
} };

DEC.co_followup = { seat: 'co', dl: 150, aiDelay: 20, build(G, d) {
  d.title = 'ชาวประมงบาดเจ็บ';
  d.body = 'ทีมพิสูจน์ทราบรายงาน: เรือประมงวิทยุเสีย ชาวประมง 1 คนบาดเจ็บสาหัสจากอุบัติเหตุบนเรือ ขอความช่วยเหลือ';
  d.info = 'ห้องพยาบาลวารีว่าง · ญาติของชาวประมงอยู่ในเมืองที่กำลังอพยพ';
  d.opts = [O('treat', 'รับขึ้นวารี รักษาในห้องพยาบาลเรือ', 'good', 'ช่วยชีวิตและสร้างความเชื่อมั่นกับชุมชน'), O('transfer', 'ส่งต่อให้เรือนาคา', 'ok', 'ช่วยเหลือได้แต่ล่าช้า'), O('refuse', 'ปฏิเสธ — ไม่ใช่ภารกิจ', 'poor', 'ละเลยหน้าที่ช่วยเหลือผู้ประสบภัยทางทะเล')];
  d.aiK = 'treat';
}, res(G, d, k) {
  const b = G.c.boat; if (b) { b.st = 'leave'; b.side = 'N'; }
  if (k === 'treat') { trust(G, 8); log(G, 'civ', 'วารี: รับชาวประมงบาดเจ็บขึ้นเรือ — ข่าวการช่วยเหลือแพร่ไปในชุมชน', 1, 'ข่ายเรือ'); }
  else if (k === 'transfer') { trust(G, 4); log(G, 'civ', 'วารี: ส่งชาวประมงบาดเจ็บให้นาคา', 0, 'ข่ายเรือ'); }
  else { trust(G, -10); log(G, 'civ', 'วารี: ปฏิเสธการช่วยเหลือชาวประมง', 2, 'ข่ายเรือ'); }
} };

DEC.co_fastboat = { seat: 'co', urgent: true, aiDelay: 8, build(G, d) {
  d.title = 'เรือเร็วพุ่งเข้าหา';
  d.body = 'เรือเร็วไม่ทราบฝ่าย ความเร็วกว่า 30 นอต มุ่งตรงเข้าหาวารี ไม่ตอบวิทยุ ไม่ตอบสัญญาณไฟ';
  d.info = `ระยะ ${fmt(dist(G.c.fast, G.u.wr))} ม. · ไม่เห็นอาวุธชัดเจน · เวลาถึงเรือราว 4 นาที`;
  d.opts = [
    O('eof', 'เตือนทุกช่องทาง เปลี่ยนเข็มหลบ เตรียมป้องกันตนเองตามขั้น ROE', 'good', 'เพิ่มระดับตามลำดับ พร้อมป้องกันตนเอง'),
    O('fire', 'เปิดฉากยิงทันที', 'poor', 'ข้ามขั้นการเตือนโดยยังไม่ยืนยันเจตนา'),
    O('ignore', 'เฝ้าดูต่อไป', 'poor', 'ปล่อยให้ภัยที่อาจเกิดเข้าใกล้โดยไม่ตอบสนอง')
  ];
  d.aiK = 'eof'; d.defK = 'ignore';
}, res(G, d, k) {
  const f = G.c.fast; if (!f) return;
  if (k === 'eof') { f.turnAt = 1500; log(G, 'sea', 'วารี: เตือนทุกช่องทาง เปลี่ยนเข็ม เตรียมป้องกันตนเอง', 1, 'ข่ายเรือ'); }
  else if (k === 'fire') { f.st = 'disabled'; f.side = 'N'; G.m.roe++; G.civ.harmF += 2; G.m.civHarm += 2; trust(G, -10); log(G, 'sea', 'วารี: เปิดฉากยิง — ภายหลังพบว่าเป็นเรือลักลอบขนสินค้า ไม่มีอาวุธ', 3, 'ข่ายเรือ'); }
  else { f.turnAt = 250; }
} };

DEC.co_lcu = { seat: 'co', dl: 180, aiDelay: 25, build(G, d) {
  d.title = d.data.late ? 'ท่าเรือปลอดภัยแล้ว — ส่งเรือยกพลรับพลเรือน?' : 'เรือยกพลว่างแล้ว — เตรียมอพยพทางท่าเรือ';
  d.body = d.data.late ? 'พยัคฆ์ 1-2 รายงานท่าเรือปลอดภัย พร้อมรับพลเรือน' : 'วารี 1 และ วารี 2 ส่งกำลังขึ้นหาดเสร็จ พยัคฆ์ 1-2 กำลังไปรักษาท่าเรือ';
  d.info = `เรือยกพลรับได้ลำละ 100 คน · ระยะจุดคอยถึงท่าเรือราว 1 กม. · ทะเลระดับ ${Math.round(G.wx.ss)} · พยากรณ์พายุราว 06:50`;
  const opts = [O('both', 'ส่งทั้ง 2 ลำไปรอใกล้ท่าเรือ', 'good', 'พร้อมรับพลเรือนทันทีที่ท่าเรือปลอดภัย'), O('one', 'ส่ง 1 ลำ สำรองไว้ 1 ลำ', 'ok', 'มีกำลังสำรอง แต่รับพลเรือนได้น้อยลง')];
  if (!d.data.late) opts.push(O('none', 'ยังไม่ส่ง รอท่าเรือปลอดภัยก่อน', 'ok', 'รอบคอบแต่เสียเวลาเดินทาง'));
  d.opts = opts; d.aiK = 'both';
}, res(G, d, k) {
  const L = [G.u.lcu1, G.u.lcu2];
  if (k === 'none') { G.flags.lcuNone = true; log(G, 'sea', 'วารี: เรือยกพลรอที่เรือแม่', 0, 'ข่ายเรือ'); return; }
  const go = k === 'both' ? L : [L[0]];
  for (const l of go) l.order = 'stage';
  log(G, 'sea', `วารี: ส่ง${k === 'both' ? 'วารี 1 และ วารี 2' : 'วารี 1'} ไปจุดคอยใกล้ท่าเรือ`, 1, 'ข่ายเรือ');
} };

DEC.ood_turn = { seat: G => G.seat === 'ood' ? 'ood' : null, dl: 120, aiDelay: 10, build(G, d) {
  const dk = deck(G), wd = Math.round(G.wx.wdir / 10) * 10, slow = clamp((33 - G.wx.wkt) / 1.944, 0.5, 3);
  d.title = 'เตรียมดาดฟ้าบิน — ปรับเข็มเรือ';
  d.body = `เวหา 2 ${G.u.h2.st === 'deck' ? 'พร้อมขึ้นบิน' : 'กำลังกลับมาลงจอด'} แต่ดาดฟ้ายังไม่อยู่ในเกณฑ์`;
  d.info = `ปัจจุบัน: ลมสัมพัทธ์ ${Math.round(dk.ang)}° ${Math.round(dk.kt)} นอต · โคลง ${dk.roll.toFixed(1)}° (เกณฑ์: ลม ±30° ไม่เกิน 35 นอต · โคลงไม่เกิน 4.5°) · ลมจริงจาก ${pad3(G.wx.wdir)}° ${Math.round(G.wx.wkt)} นอต · คลื่นจาก ${pad3(G.wx.sdir)}°`;
  const cand = [[wd, slow], [wd, 6], [wd + 40, 3]];
  d.opts = cand.map(([h, s]) => { const p = deckFor(G, h, s); return O(`h${(h + 360) % 360}_${s.toFixed(1)}`, `เข็ม ${pad3(h)} ความเร็ว ${Math.round(s * 1.944)} นอต`, p.ok ? 'good' : 'poor', `คาดการณ์: ลมสัมพัทธ์ ${Math.round(p.ang)}° ${Math.round(p.kt)} นอต โคลง ${p.roll.toFixed(1)}°`); });
  d.opts.push(O('keep', 'คงเข็มเดิม', 'poor', 'ดาดฟ้ายังนอกเกณฑ์'));
  d.aiK = d.opts[0].k; d.defK = d.aiK;
}, res(G, d, k) { if (k === 'keep') return; const m = /h(\d+)_([\d.]+)/.exec(k); const s = G.u.wr; s.cmdH = +m[1]; s.cmdS = +m[2]; log(G, 'sea', `วารี: เปลี่ยนเข็ม ${pad3(s.cmdH)} ความเร็ว ${Math.round(s.cmdS * 1.944)} นอต เพื่อปฏิบัติการบิน`, 0, 'ข่ายเรือ'); } };

DEC.ood_box = { seat: G => G.seat === 'ood' ? 'ood' : null, dl: 120, aiDelay: 10, build(G, d) {
  const s = G.u.wr, busy = deckNeeded(G);
  d.title = 'เรือใกล้ขอบพื้นที่ปฏิบัติการ';
  d.body = 'วารีกำลังจะออกนอกพื้นที่ปฏิบัติการเรือที่ประสานไว้';
  d.info = `ตำแหน่ง ${gridStr(s.x, s.y)} เข็ม ${pad3(s.hdg)} · เฮลิคอปเตอร์: ${heloTxt(G)}`;
  d.opts = [
    O('back', 'กลับเข้าพื้นที่ทันที', busy ? 'ok' : 'good', busy ? 'ดาดฟ้าจะออกนอกเกณฑ์ขณะเฮลิคอปเตอร์ต้องใช้' : 'อยู่ในพื้นที่ที่ประสานไว้'),
    O('after', 'กลับเข้าพื้นที่หลังเฮลิคอปเตอร์ลงจอด', busy ? 'good' : 'ok', busy ? 'ถ่วงดุลการบินกับขอบพื้นที่' : 'ไม่มีการบินที่ต้องรอ'),
    O('cont', 'แล่นต่อ', 'poor', 'ออกนอกพื้นที่ที่ประสานไว้')
  ];
  d.aiK = busy ? 'after' : 'back'; d.defK = d.aiK;
}, res(G, d, k) { const s = G.u.wr; if (k === 'back') { s.cmdH = Math.round(bearing(s.x, s.y, WORLD.home.x, WORLD.home.y)); s.cmdS = 6; } else if (k === 'after') G.flags.boxAfter = true; G.flags.boxAsk = G.t + 300; } };

DEC.fdo_deck = { seat: G => G.seat === 'fdo' ? 'fdo' : null, dl: 60, aiDelay: 8, build(G, d) {
  const dk = deck(G), h = G.u.h2;
  d.title = 'สัญญาณลงจอด — เวหา 2';
  d.body = `เวหา 2 วนรอท้ายเรือ ขอลงจอด${h.pax ? ` (ผู้โดยสาร ${h.pax} คน)` : ''}`;
  d.info = `ลมสัมพัทธ์ ${Math.round(dk.ang)}° ${Math.round(dk.kt)} นอต · โคลง ${dk.roll.toFixed(1)}° · เกณฑ์: ลม ±30° ไม่เกิน 35 นอต โคลงไม่เกิน 4.5° → ${dk.ok ? 'อยู่ในเกณฑ์' : 'นอกเกณฑ์'}`;
  d.opts = [O('green', 'ไฟเขียว — อนุญาตลงจอด', dk.ok ? 'good' : 'poor', dk.ok ? 'อยู่ในเกณฑ์' : 'นอกเกณฑ์ — เสี่ยงอุบัติเหตุบนดาดฟ้า'), O('red', 'ไฟแดง — วนรอ และขอสะพานเดินเรือปรับเข็ม', dk.ok ? 'ok' : 'good', dk.ok ? 'อยู่ในเกณฑ์แล้ว ทำให้ล่าช้า' : 'ป้องกันการลงจอดนอกเกณฑ์')];
  d.aiK = dk.ok ? 'green' : 'red'; d.defK = d.aiK;
}, res(G, d, k) {
  const h = G.u.h2; if (h.st !== 'hold') return;
  if (k === 'green') { h.forced = !deck(G).ok; if (h.forced) G.m.deckRisk++; startLanding(G, h); }
  else { h.redAt = G.t; log(G, 'sea', 'วารี (ดาดฟ้าบิน): ไฟแดง — เวหา 2 วนรอ', 0, 'ข่ายเรือ'); }
} };

/* --- เวหา 2 (นักบินเฮลิคอปเตอร์) --- */
DEC.helo_ep = { seat: 'helo', dl: 60, aiDelay: 8, build(G, d) {
  const th = Object.values(G.h).filter(h => h.act && h.str > 30 && G.t >= h.sup && dist(h, WORLD.ep) <= h.thr).map(h => h.known ? h.nm : 'ข้าศึกไม่ทราบตำแหน่ง');
  d.title = 'จุดอพยพอยู่ใต้การคุกคาม';
  d.body = `เวหา 2 ใกล้จุดอพยพ — มีรายงานการยิงจาก${th.join(', ')}`;
  d.info = `ผู้โดยสารบนเครื่อง ${G.u.h2.pax} คน · พลเรือนรอที่จุดอพยพ ${G.civ.ep} คน · การยิงสนับสนุนกำลังดำเนินการ ${G.missions.filter(m => ['fscc', 'hold', 'ready', 'flight'].includes(m.st)).length} ภารกิจ`;
  d.opts = [O('hold', 'วนรอนอกระยะ ขอให้กดดันภัยคุกคาม (สูงสุด 5 นาที)', 'good', 'รอให้การยิงสนับสนุน/ภาคพื้นจัดการก่อน'), O('land', 'ลงจอดตามแผน', 'poor', 'ลงจอดในพื้นที่ที่ยังถูกคุกคาม'), O('rtb', 'ยกเลิกเที่ยวบิน กลับเรือ', 'ok', 'ปลอดภัยแต่เสียเวลา')];
  d.aiK = 'hold';
}, res(G, d, k) {
  const h = G.u.h2; if (h.st !== 'ephold') return;
  if (k === 'land') { h.st = 'out'; h.epOk = true; log(G, 'air', 'เวหา 2: ลงจอดที่จุดอพยพทั้งที่ยังถูกคุกคาม', 2, 'ข่ายอากาศ'); }
  else if (k === 'rtb') { h.st = 'back'; h.route = heloBack(G); log(G, 'air', 'เวหา 2: ยกเลิกเที่ยวบิน กลับเรือ', 1, 'ข่ายอากาศ'); }
  else { h.ephT = G.t; log(G, 'air', 'เวหา 2: วนรอนอกระยะ ขอให้กดดันภัยคุกคามที่จุดอพยพ', 1, 'ข่ายอากาศ'); if (G.h.R2.known && G.h.R2.str > 30 && G.seat !== 'fo') requestFire(G, 'R2', 'ai'); }
} };

DEC.helo_fault = { seat: 'helo', dl: 45, aiDelay: 6, build(G, d) {
  const h = G.u.h2; const near = [G.u.wr, G.u.nk].sort((a, b) => dist(a, h) - dist(b, h))[0];
  d.data.near = near.id;
  d.title = 'ไฟเตือนระบบเกียร์';
  d.body = 'ไฟเตือนเศษโลหะในระบบเกียร์ (chip) สว่างระหว่างบิน';
  d.info = `ตำแหน่ง ${gridStr(h.x, h.y)} · เรือใกล้สุด: ${near.cs} ${fmt(dist(near, h))} ม. · ผู้โดยสาร ${h.pax} คน`;
  d.opts = [O('ship', `ลงจอดที่ ${near.cs} โดยเร็ว (แจ้งฉุกเฉิน)`, 'good', 'ปฏิบัติตามขั้นตอนฉุกเฉิน ลงจอดที่ปลอดภัยใกล้สุด'), O('cont', 'บินต่อให้จบเที่ยว', 'poor', 'เสี่ยงระบบขัดข้องรุนแรงระหว่างบินเหนือทะเล'), O('field', 'ลงจอดที่โล่งบนเกาะทันที', 'ok', 'ปลอดภัยต่ออากาศยาน แต่พื้นที่อาจไม่ปลอดภัย')];
  d.aiK = 'ship';
}, res(G, d, k) {
  const h = G.u.h2; if (!airborne(h)) return;
  if (k === 'ship') { const s = G.u[d.data.near]; h.st = 'divert'; h.divTo = s.id; h.route = [[s.x, s.y]]; log(G, 'air', `เวหา 2: ฉุกเฉิน! ลงจอดที่ ${s.cs}`, 2, 'ข่ายอากาศ'); }
  else if (k === 'cont') { h.faultCont = true; G.m.incidents++; log(G, 'air', 'เวหา 2: บินต่อทั้งที่ไฟเตือนสว่าง', 2, 'ข่ายอากาศ'); }
  else { h.st = 'field'; h.until = G.t + 1200; if (h.x < 10400) { h.x = WORLD.beach.x; h.y = WORLD.beach.y; } log(G, 'air', 'เวหา 2: ลงจอดฉุกเฉินที่โล่งบนเกาะ', 2, 'ข่ายอากาศ'); }
} };

/* --- อินทรี 1 / ชี้ทาง (CAS) --- */
DEC.jtac_brief = { seat: 'jtac', dl: 120, aiDelay: 20, build(G, d) {
  const civ = G.civ.rb > 0, h = G.h.R4;
  G.cas.grid = gridStr(h.known ? h.kx : h.x, h.known ? h.ky : h.y);
  d.title = 'ส่งบรีฟให้ อินทรี 1';
  d.body = 'บรีฟการโจมตี (ฉบับย่อ): จุด IP · ทิศทางเข้า · ลักษณะเป้า · พิกัด · ฝ่ายเดียวกันใกล้สุด · ทิศทางออก';
  d.info = `เป้าหมาย: ด่านสกัดถนน ${G.cas.grid} · ฝ่ายเดียวกันใกล้สุด: อาชา 6 ทางทิศตะวันตก ราว 1 กม. · ${civ ? 'ยังมีรถพลเรือนใกล้ด่าน' : 'ไม่พบพลเรือนแล้ว'}`;
  d.opts = [O('full', 'ส่งบรีฟครบ รวมฝ่ายเดียวกันและ "อาจมีพลเรือนใกล้เป้าหมาย"', 'good', 'นักบินได้ภาพครบ ลดความเสี่ยงโจมตีผิด'), O('min', 'ส่งเฉพาะพิกัดและลักษณะเป้า (เร็วกว่า)', 'poor', 'ขาดข้อมูลฝ่ายเดียวกันและพลเรือน')];
  d.aiK = 'full'; d.defK = 'min';
}, res(G, d, k) {
  G.cas.brief = k; G.cas.st = 'rb';
  G.cas.aiErr = G.inj.rbErr || rnd(G) < 0.25; G.inj.rbErr = false;
  log(G, 'air', `ชี้ทาง → อินทรี 1: บรีฟ — ด่านสกัดถนน ${G.cas.grid}${k === 'full' ? ' · ฝ่ายเดียวกันตะวันตก 1 กม. · อาจมีพลเรือนใกล้เป้า' : ''} · ออกทิศเหนือ`, 0, 'ข่ายอากาศ');
  pushDec(G, 'cas_rb');
} };

DEC.cas_rb = { seat: 'lead', dl: 90, aiDelay: 15, build(G, d) {
  const g = G.cas.grid, p = parseGrid(g); const w = corruptGrid(G, p.x, p.y) || { s: g, x: p.x, y: p.y };
  d.data.w = w;
  d.title = 'ทวนกลับบรีฟ (read-back)';
  d.body = `ชี้ทาง: "เป้าหมาย ด่านสกัดถนน พิกัด ${g} · ฝ่ายเดียวกันทางตะวันตก 1 กม. · ทิศทางออก ทิศเหนือ"`;
  d.info = 'ต้องทวนกลับพิกัด ตำแหน่งฝ่ายเดียวกัน และทิศทางออกให้ตรงกับที่ได้รับ';
  d.opts = shuffle(G, [
    O('ok', `"${g} · ฝ่ายเดียวกันตะวันตก 1 กม. · ออกทิศเหนือ"`, 'good', 'ทวนกลับครบถ้วนถูกต้อง'),
    O('w1', `"${w.s} · ฝ่ายเดียวกันตะวันตก 1 กม. · ออกทิศเหนือ"`, 'poor', 'พิกัดผิดหนึ่งหลัก'),
    O('w2', `"${g} · ฝ่ายเดียวกันตะวันออก 1 กม. · ออกทิศเหนือ"`, 'poor', 'ทิศของฝ่ายเดียวกันผิด')
  ]);
  d.aiK = G.cas.aiErr ? 'w1' : 'ok'; d.defK = 'ok';
}, res(G, d, k) {
  const o = d.opts.find(x => x.k === k); G.cas.rbText = o.l.replace(/"/g, ''); G.cas.rbErr = k !== 'ok';
  G.cas.wrongXY = k === 'w1' ? { x: d.data.w.x, y: d.data.w.y } : null; G.cas.st = 'rbc';
  log(G, 'air', `อินทรี 1: ทวนกลับ ${o.l}`, 0, 'ข่ายอากาศ'); pushDec(G, 'jtac_rbc');
} };

DEC.jtac_rbc = { seat: 'jtac', dl: 90, aiDelay: 12, build(G, d) {
  const err = G.cas.rbErr;
  d.title = 'ตรวจคำทวนกลับของนักบิน';
  d.body = `อินทรี 1: "${G.cas.rbText}"`;
  d.info = `บรีฟที่ส่งไป: พิกัด ${G.cas.grid} · ฝ่ายเดียวกันทางตะวันตก 1 กม. · ทิศทางออก ทิศเหนือ`;
  d.opts = [O('ok', '"ทวนกลับถูกต้อง" — ดำเนินการต่อ', err ? 'poor' : 'good', err ? 'คำทวนกลับคลาดเคลื่อนจากบรีฟ' : 'คำทวนกลับตรงกับบรีฟ'), O('fix', '"แก้ไข" — ส่งข้อมูลที่ถูกต้องให้ทวนใหม่', err ? 'good' : 'ok', err ? 'จับความคลาดเคลื่อนได้ก่อนโจมตี' : 'ไม่มีข้อผิดพลาด ทำให้ล่าช้าเล็กน้อย')];
  d.aiK = err ? (rnd(G) < 0.9 ? 'fix' : 'ok') : 'ok'; d.defK = 'ok';
}, res(G, d, k) {
  if (k === 'fix') { if (G.cas.rbErr) G.m.caughtRB++; G.cas.rbErr = false; G.cas.wrongXY = null; G.cas.t.run = G.t + 25; log(G, 'air', 'ชี้ทาง: "แก้ไข" — อินทรี 1 ทวนกลับใหม่ถูกต้อง', 1, 'ข่ายอากาศ'); }
  else { G.cas.t.run = G.t + 5; log(G, 'air', 'ชี้ทาง: "ทวนกลับถูกต้อง"', 0, 'ข่ายอากาศ'); }
  G.cas.st = 'prerun';
} };

DEC.cas_tally = { seat: 'lead', urgent: true, aiDelay: 5, build(G, d) {
  const civ = G.civ.rb > 0, wrong = !!G.cas.wrongXY;
  d.title = 'ยืนยันเป้าหมาย (tally)';
  if (wrong) {
    d.body = 'ระยะ 9 กม. — ที่พิกัดตามคำทวนกลับ เห็นยานพาหนะทหาร 2 คันจอดใต้ต้นไม้ ไม่เห็นแนวกระสอบทราย';
    d.info = `${G.cas.brief === 'full' ? 'บรีฟระบุฝ่ายเดียวกันทางตะวันตก 1 กม.' : 'บรีฟไม่ได้ระบุฝ่ายเดียวกัน'} · ภาพไม่ตรงกับ "ด่านสกัดถนน"`;
    d.opts = [O('unsure', 'แจ้ง "ไม่แน่ใจเป้าหมาย — ภาพไม่ตรงบรีฟ" ขอยืนยัน', 'good', 'ภาพไม่ตรงกับเป้าหมายที่บรีฟ'), O('tally', 'แจ้ง "เห็นเป้าหมาย"', 'poor', 'ยืนยันเป้าหมายทั้งที่ภาพไม่ตรงบรีฟ')];
    d.aiK = 'unsure';
  } else {
    d.body = `ระยะ 9 กม. — เห็นรถกระบะติดอาวุธและแนวกระสอบทราย${civ ? ' · มีรถเก๋งพลเรือน 2 คันจอดใกล้ด่าน' : ''}`;
    d.info = `${G.cas.brief === 'full' ? 'บรีฟระบุ: อาจมีพลเรือนใกล้เป้าหมาย' : 'บรีฟไม่ได้กล่าวถึงพลเรือน'}${G.wx.storm > 0.4 ? ' · เมฆต่ำ ทัศนวิสัยลดลง' : ''}`;
    d.opts = civ
      ? [O('tallyciv', 'แจ้ง "เห็นเป้าหมาย — มีรถพลเรือน 2 คันใกล้ด่าน"', 'good', 'รายงานสิ่งที่เห็นครบถ้วน'), O('tally', 'แจ้ง "เห็นเป้าหมาย"', 'poor', 'ไม่รายงานพลเรือนที่เห็น'), O('unsure', 'แจ้ง "ไม่แน่ใจเป้าหมาย"', 'ok', 'ระมัดระวังแต่ไม่ชัดเจน')]
      : [O('tally', 'แจ้ง "เห็นเป้าหมาย — ไม่พบพลเรือน"', 'good', 'ยืนยันเป้าหมายตรงกับบรีฟ'), O('unsure', 'แจ้ง "ไม่แน่ใจเป้าหมาย"', 'ok', 'ปลอดภัยแต่ล่าช้า')];
    d.aiK = civ ? 'tallyciv' : 'tally';
  }
  d.defK = 'unsure';
}, res(G, d, k) {
  const c = G.cas; if (c.st !== 'tally') return;
  c.tally = k; c.tallyText = d.opts.find(o => o.k === k).l.replace(/^แจ้ง /, '').replace(/"/g, '');
  log(G, 'air', `อินทรี 1: ${c.tallyText}`, 0, 'ข่ายอากาศ');
  if (k === 'unsure' && c.wrongXY) { c.wrongXY = null; c.rbErr = false; G.m.caughtRB++; c.st = 'reatk'; c.t.re = G.t + 120; log(G, 'air', 'ชี้ทาง: "ยกเลิก — พิกัดที่ถูกคือ ' + c.grid + '" นำทางใหม่', 1, 'ข่ายอากาศ'); return; }
  if (k === 'unsure') { c.st = 'reatk'; c.t.re = G.t + 150; return; }
  c.st = 'clr'; pushDec(G, 'jtac_clear');
} };

DEC.jtac_clear = { seat: 'jtac', urgent: true, aiDelay: 5, build(G, d) {
  const civ = G.civ.rb > 0, wrong = !!G.cas.wrongXY;
  d.title = 'อนุญาตการโจมตี?';
  d.body = `อินทรี 1: "${G.cas.tallyText}"`;
  d.info = `การตรวจการณ์ของท่าน: ${civ ? 'ยังมีรถพลเรือนจอดอยู่ใกล้ด่าน' : 'พลเรือนออกจากพื้นที่แล้ว'} · ${wrong ? 'ภาพที่นักบินบรรยายไม่ตรงกับด่าน · ' : ''}อาชา 6 ห่างด่านราว 1 กม. · ${G.cas.acm === 'cont' ? 'ปืนใหญ่ยังยิงอยู่' : 'ปืนใหญ่ระงับ/แยกเส้นทางแล้ว'}`;
  const bad = civ || wrong;
  d.opts = [O('hot', '"อนุญาตโจมตี (cleared hot)"', bad ? 'poor' : 'good', bad ? (wrong ? 'นักบินอาจกำลังมองเป้าผิด' : 'พลเรือนยังอยู่ใกล้เป้าหมาย') : 'เป้าหมายถูกต้อง พลเรือนออกแล้ว'), O('abort', '"ยกเลิก (abort)" — วนรอ', bad ? 'good' : 'ok', bad ? 'รอให้เงื่อนไขปลอดภัยก่อน' : 'ไม่จำเป็น ทำให้ล่าช้า'), O('cancel', 'ยกเลิกภารกิจ CAS', 'ok', 'ปลอดภัยแต่ด่านยังอยู่')];
  d.aiK = bad ? 'abort' : 'hot'; d.defK = 'abort';
}, res(G, d, k) {
  const c = G.cas; if (c.st !== 'clr') return;
  if (k === 'hot') { c.st = 'hot'; log(G, 'air', 'ชี้ทาง: "อินทรี 1 อนุญาตโจมตี"', 1, 'ข่ายอากาศ'); }
  else if (k === 'abort') { c.st = 'reatk'; c.t.re = G.t + 180; if (c.wrongXY) { c.wrongXY = null; G.m.caughtRB++; } log(G, 'air', 'ชี้ทาง: "ยกเลิก ยกเลิก — วนรอ"', 1, 'ข่ายอากาศ'); }
  else { c.st = 'done'; log(G, 'air', 'ชี้ทาง: ยกเลิกภารกิจ CAS', 1, 'ข่ายอากาศ'); }
} };

DEC.cas_bingo = { seat: 'lead', dl: 60, aiDelay: 10, build(G, d) {
  d.title = 'เชื้อเพลิงถึงเกณฑ์กลับฐาน (bingo)';
  d.body = 'อินทรี 1-2 เชื้อเพลิงเหลือพอสำหรับกลับฐานพร้อมสำรองตามเกณฑ์';
  d.info = `สถานะ CAS: ${casTxt(G)}`;
  d.opts = [O('rtb', 'กลับฐาน (RTB) แจ้ง ชี้ทาง', 'good', 'รักษาเกณฑ์ความปลอดภัย'), O('stay', 'อยู่ต่ออีก 5 นาที', 'poor', 'ลดเชื้อเพลิงสำรองต่ำกว่าเกณฑ์')];
  d.aiK = 'rtb';
}, res(G, d, k) {
  const j = G.u.jet;
  if (k === 'rtb') { j.st = 'rtb'; j.route = [[-800, 15600]]; if (!['done', 'none'].includes(G.cas.st)) G.cas.st = 'done'; dropPending(G, ['cas_tally', 'jtac_clear']); log(G, 'air', 'อินทรี 1-2: ถึงเกณฑ์เชื้อเพลิง กลับฐาน', 1, 'ข่ายอากาศ'); }
  else { G.bingo = G.t + 300; G.m.fuelRisk++; sched(G, G.bingo, 'bingo'); log(G, 'air', 'อินทรี 1-2: อยู่ต่ออีก 5 นาทีต่ำกว่าเกณฑ์สำรอง', 2, 'ข่ายอากาศ'); }
} };

DEC.cas_storm = { seat: 'lead', dl: 60, aiDelay: 10, build(G, d) {
  d.title = 'อากาศต่ำกว่าเกณฑ์การโจมตี';
  d.body = 'เมฆต่ำและฝนหนักเข้าปกคลุมพื้นที่เป้าหมาย มองเห็นพื้นดินเป็นช่วง ๆ';
  d.info = `สถานะ CAS: ${casTxt(G)} · พายุคาดว่านานราว 40 นาที เกินเวลาเหนือพื้นที่ที่เหลือ`;
  d.opts = [O('abort', 'ยุติการปฏิบัติ แจ้ง ชี้ทาง แล้วกลับฐาน', 'good', 'ไม่โจมตีเมื่อยืนยันเป้าหมายไม่ได้'), O('press', 'ลดเพดานบินเพื่อโจมตีต่อ', 'poor', 'เสี่ยงต่อการโจมตีผิดและต่ออากาศยาน')];
  d.aiK = 'abort';
}, res(G, d, k) {
  if (k === 'abort') { G.u.jet.st = 'rtb'; G.u.jet.route = [[-800, 15600]]; if (G.cas.st !== 'none') G.cas.st = 'done'; dropPending(G, ['cas_tally', 'jtac_clear']); log(G, 'air', 'อินทรี 1-2: อากาศต่ำกว่าเกณฑ์ ยุติและกลับฐาน', 1, 'ข่ายอากาศ'); }
  else { G.cas.press = true; G.m.incidents++; log(G, 'air', 'อินทรี 1-2: ลดเพดานบินเพื่อโจมตีต่อในสภาพอากาศต่ำกว่าเกณฑ์', 2, 'ข่ายอากาศ'); }
} };

function heloTxt(G) { const h = G.u.h2; return ({ deck: 'อยู่บนดาดฟ้า', down: 'งดบิน/ซ่อม', out: 'กำลังบินไปจุดอพยพ', ephold: 'วนรอใกล้จุดอพยพ', ep: 'อยู่ที่จุดอพยพ', back: 'กำลังกลับเรือ', hold: 'วนรอลงจอด', land: 'กำลังลงจอด', lmg: 'กำลังลงจอด', turn: 'ส่งผู้โดยสาร', divert: 'ลงจอดฉุกเฉิน', field: 'จอดฉุกเฉินบนเกาะ' })[h.st] || h.st; }
function casTxt(G) { return ({ none: 'ยังไม่มีคำขอ', req: 'รออนุมัติ', fscc: 'รอประสาน FSCC', brief: 'กำลังบรีฟ', rb: 'กำลังทวนกลับ', rbc: 'ตรวจคำทวนกลับ', prerun: 'เตรียมบินเข้า', run: 'กำลังบินเข้า', tally: 'ยืนยันเป้าหมาย', clr: 'รออนุญาต', hot: 'ได้รับอนุญาตโจมตี', reatk: 'วนรอโจมตีใหม่', done: 'สิ้นสุด' })[G.cas.st] || G.cas.st; }

/* ---------- การกระทำของทหารม้า ---------- */
function cavFire(G) {
  const c = G.u.cav, h = G.h.R4;
  if (G.civ.rb > 0) { const n = G.civ.rb; G.civ.harmF += n; G.m.civHarm += n; G.m.roe++; trust(G, -20); G.civ.rb = 0; log(G, 'roe', `อาชา 6: ยิงด่านขณะมีรถพลเรือน — พลเรือนบาดเจ็บ ${n} คน`, 3, 'ข่ายบังคับบัญชา'); }
  G.flags.rbAtk = true; h.str = Math.max(0, h.str - 50); h.sup = G.t + 240;
  c.route = RT.cav2.map(p => p.slice()); c.st = 'move'; G.flags.cavGo = true;
  log(G, 'land', 'อาชา 6: เข้าตีด่านสกัดถนน', 1, 'ข่ายบังคับบัญชา');
}
function cavDetour(G) { const c = G.u.cav; c.route = RT.cavD.map(p => p.slice()); c.st = 'move'; c.spdMul = 0.5; G.flags.detour = true; G.flags.cavGo = true; log(G, 'land', 'อาชา 6: อ้อมผ่านเส้นทาง DT1 ไปสนามบิน', 1, 'ข่ายบังคับบัญชา'); }

/* ---------- แผนตามเวลา H ---------- */
function planH(G) {
  if (G.H == null) return;
  G.sched = G.sched.filter(e => !e.h);
  const H = G.H, l1 = G.u.lcu1;
  if (!G.flags.goDone && H - 1200 > G.t) sched(G, H - 1200, 'goNoGo', null, true);
  if (l1.st === 'emb') sched(G, Math.max(G.t + 1, H - 1320), 'lcuLaunch', null, true);
  if (!G.u.h2.inserted) sched(G, Math.max(G.t + 1, H - 600), 'deckPrep', null, true);
  const prep = G.prep === 'tight' ? [-360, -180, -30] : G.prep === 'early' ? [-1800, -1560, -1320] : [];
  for (const s of prep) { const at = H + s - TOF - PREP; if (at > G.t) sched(G, at, 'prepFire', null, true); }
}
const EV = {
  goNoGo(G) { pushDec(G, 'jtf_go'); },
  lcuLaunch(G) {
    for (const l of [G.u.lcu1, G.u.lcu2]) { if (l.st !== 'emb') continue; l.st = 'lod'; l.emb = null; l.route = [[WORLD.lod.x - l.off * 0.5, WORLD.lod.y + l.off]]; }
    log(G, 'sea', 'วารี: ปล่อยเรือยกพล วารี 1 และ วารี 2 มุ่งหน้าเส้นออกตี', 1, 'ข่ายเรือ');
  },
  deckPrep(G) { const h = G.u.h2; if (!h.inserted) { h.want = 'insert'; h.launchAt = G.H - 180; } },
  prepFire(G) {
    const h = G.h.R1; if (h.str <= 0) return;
    const p = h.known ? { x: h.kx, y: h.ky } : { x: h.x + G.prepErr.x, y: h.y + G.prepErr.y };
    const g = gridStr(p.x, p.y);
    const m = newMission(G, { tgt: 'R1', desc: 'ยิงเตรียม: ' + h.nm, grid: g, grid0: g, prep: true, obs: 'fo', dir: 0, rng: 0 });
    m.st = 'ready'; m.t.ready = G.t; log(G, 'fires', `สายฟ้า: ยิงเตรียมตามแผน ${m.id} → ${g}`, 0, 'ข่ายยิง');
  },
  jets(G) { const j = G.u.jet; j.st = 'in'; j.x = -800; j.y = 15600; j.route = [[WORLD.ip.x + 2500, WORLD.ip.y]]; log(G, 'air', 'อินทรี 1-2: เข้าสู่พื้นที่ พร้อมปฏิบัติ CAS ที่ IP ทองหลาง', 1, 'ข่ายอากาศ'); },
  bingo(G) { if (G.t >= G.bingo - 1 && ['in', 'orbit', 'run', 'egress'].includes(G.u.jet.st)) pushDec(G, 'cas_bingo'); },
  h1go(G) { const h = G.u.h1; if (h.st !== 'deck') return; h.st = 'h1out'; h.route = G.acm === 'gate' ? [[WORLD.gate.x, WORLD.gate.y], [8800, 6300]] : [[8800, 6300]]; log(G, 'air', 'เวหา 1: ขึ้นบินลาดตระเวนผิวน้ำด้านใต้', 0, 'ข่ายอากาศ'); },
  fishing(G) { if (G.c.boat) return; G.c.boat = { id: 'boat', nm: 'เรือประมง', side: 'U', x: 9800, y: 5300, hdg: 300, spd: 3, st: 'approach', route: [] }; log(G, 'sea', 'นาคา: เรดาร์พบเรือขนาดเล็กไม่ทราบฝ่าย ทางใต้ของวารี', 1, 'ข่ายเรือ'); },
  fast(G) { if (G.c.fast && G.c.fast.st !== 'gone') return; G.c.fast = { id: 'fast', nm: 'เรือเร็วไม่ทราบฝ่าย', side: 'U', x: 11800, y: 5200, hdg: 300, spd: 15, st: 'approach', route: [] }; log(G, 'sea', 'นาคา: เรดาร์พบเรือเร็วไม่ทราบฝ่าย ความเร็วสูง ทางตะวันออกเฉียงใต้', 2, 'ข่ายเรือ'); },
  boatFollow(G) { if (G.c.boat && G.c.boat.st !== 'gone') pushDec(G, 'co_followup'); },
  relayDown(G) { if (G.relayDown) return; G.relayDown = true; sched(G, G.t + 720, 'relayUp'); log(G, 'c2', 'สถานีทวนสัญญาณข่ายยิงบนเนิน 120 ขัดข้อง', 2, null); },
  relayUp(G) { if (!G.relayDown) return; G.relayDown = false; log(G, 'c2', 'ข่ายยิงกลับมาใช้งานได้', 1, 'ข่ายยิง'); },
  storm(G) {
    if (G.wx.stormT != null) return; G.wx.stormT = G.t; sched(G, G.t + 2400, 'stormEnd');
    log(G, 'sys', 'พายุฝนเข้าพื้นที่ ลมแรงขึ้น ทะเลมีคลื่นจัด', 2, null); pushDec(G, 'jtf_storm');
    if (['in', 'orbit', 'run', 'egress'].includes(G.u.jet.st)) pushDec(G, 'cas_storm');
  },
  stormEnd(G) { if (G.wx.stormT == null || G.wx.stormEndT != null) return; G.wx.stormEndT = G.t; G.ops.suspend = false; G.ops.mode = null; log(G, 'sys', 'พายุผ่านไป สภาพทะเลเริ่มดีขึ้น — กลับมาปฏิบัติการปกติ', 1, null); },
  clip(G) { if (G.flags.clip) return; G.flags.clip = 1; trust(G, -25); log(G, 'civ', 'คลิปปลอมแพร่ในกลุ่มชาวบ้าน — พลเรือนลังเลที่จะมาจุดอพยพ', 2, null); pushDec(G, 'jtf_clip'); },
  gridErrArm(G) { G.inj.gridErr = true; },
  r5(G) { G.h.R5.act = true; },
  r5move(G) { const h = G.h.R5; if (h.str > 30) { h.route = [[14800, 9000], [14200, 8200]]; } },
  town(G) {
    const p = G.u.p3, h = G.h.R3; if (h.act || h.str <= 0) return;
    if (p.emb || p.st !== 'hold' || dist(p, h) > 400) { if (G.t < 27600) sched(G, G.t + 120, 'town'); return; }
    h.act = true; h.known = true; h.kx = h.x + 40; h.ky = h.y - 30; h.seen = G.t; h.by = 'พยัคฆ์ 3';
    log(G, 'land', 'พยัคฆ์ 3: ถูกยิงจากอาคารใกล้โรงพยาบาล!', 2, 'ข่ายบังคับบัญชา'); pushDec(G, 'coy_town');
  },
  epV(G) { const p = G.u.p11; if (G.civ.epOpen && !p.emb && dist(p, WORLD.ep) < 300) pushDec(G, 'sql_roe_ep'); },
  heloFault(G) { const h = G.u.h2; if (airborne(h) && h.st !== 'divert') pushDec(G, 'helo_fault'); else G.inj.heloFault = true; }
};
function runSched(G) {
  if (!G.sched.length) return;
  G.sched.sort((a, b) => a.t - b.t);
  while (G.sched.length && G.sched[0].t <= G.t) { const e = G.sched.shift(); if (EV[e.ev]) EV[e.ev](G, e.data); }
}

/* ---------- ระบบย่อยรายวินาที ---------- */
function weatherStep(G) {
  const w = G.wx; let s = 0;
  if (w.stormT != null) { s = clamp((G.t - w.stormT) / 300, 0, 1); if (w.stormEndT != null) s = Math.min(s, clamp(1 - (G.t - w.stormEndT) / 300, 0, 1)); }
  w.storm = s; w.wdir = 60 + 20 * s; w.wkt = 14 + 18 * s; w.ss = 3 + 2 * s; w.sdir = 70 + 10 * s; w.vis = 1 - 0.45 * s;
}
function shipStep(G, s, dt) {
  const dh = angDiff(s.cmdH, s.hdg); s.hdg = (s.hdg + clamp(dh, -2 * dt, 2 * dt) + 360) % 360;
  s.spd += clamp(s.cmdS - s.spd, -0.05 * dt, 0.05 * dt);
  s.x += Math.sin(s.hdg * Math.PI / 180) * s.spd * dt; s.y += Math.cos(s.hdg * Math.PI / 180) * s.spd * dt;
}
function oodAI(G) {
  const s = G.u.wr, b = WORLD.box;
  if (G.seat === 'ood') {
    if (deckNeeded(G) && !deck(G).ok && !hasPending(G, 'ood_turn') && G.t >= (G.flags.turnAsk || 0)) { G.flags.turnAsk = G.t + 200; pushDec(G, 'ood_turn'); }
    if ((s.x > b.x1 - 400 || s.y > b.y1 - 400 || s.x < b.x0 + 300 || s.y < b.y0 + 300) && !hasPending(G, 'ood_box') && G.t >= (G.flags.boxAsk || 0)) { G.flags.boxAsk = G.t + 300; pushDec(G, 'ood_box'); }
    if (G.flags.boxAfter && !deckNeeded(G)) { G.flags.boxAfter = false; s.cmdH = Math.round(bearing(s.x, s.y, WORLD.home.x, WORLD.home.y)); s.cmdS = 6; }
    return;
  }
  if (deckNeeded(G)) { s.cmdH = Math.round(G.wx.wdir); s.cmdS = clamp((33 - G.wx.wkt) / 1.944, 0.5, 3); return; }
  if (s.x > b.x1 - 700 || s.y > b.y1 - 700 || s.x < b.x0 + 400 || s.y < b.y0 + 400) { s.cmdH = Math.round(bearing(s.x, s.y, WORLD.home.x, WORLD.home.y)); s.cmdS = 6; return; }
  if (s.cmdS === 6 && dxy(s.x, s.y, WORLD.home.x, WORLD.home.y) > 600) return;
  s.cmdH = Math.round(G.wx.wdir); s.cmdS = 1.5;
}
function heloOut(G) { const ep = WORLD.ep; return G.acm === 'gate' ? [[WORLD.gate.x, WORLD.gate.y], [WORLD.gate2.x, WORLD.gate2.y], [ep.x, ep.y]] : [[ep.x, ep.y]]; }
function heloBack(G) { const s = G.u.wr; return G.acm === 'gate' ? [[WORLD.gate2.x, WORLD.gate2.y], [WORLD.gate.x, WORLD.gate.y], [s.x, s.y]] : [[s.x, s.y]]; }
function gateBlock(G, h) {
  if (G.acm !== 'gate') return false;
  const usesGate = h.route && h.route.some(p => p[0] === WORLD.gate.x && p[1] === WORLD.gate.y);
  const near = dist(h, WORLD.gate) < GATE_R + 150;
  if (!(usesGate && near) && !(dist(h, WORLD.gate) < GATE_R)) return false;
  if (dist(h, WORLD.gate) < GATE_R - 100) return false;
  if (inFlight(G)) { if (!h.gateMsg) { h.gateMsg = 1; log(G, 'air', `${h.cs}: ถึงประตู ก — รอกระสุนตกก่อนข้ามแนวยิง`, 0, 'ข่ายอากาศ'); } return true; }
  h.gateMsg = 0; return false;
}
function stormRisk(G, h, dt) {
  if (G.wx.storm > 0.5 && airborne(h) && rnd(G) < 0.0008 * dt) { G.m.incidents++; log(G, 'air', `${h.cs}: เข้าเมฆโดยไม่ตั้งใจในพายุ ต้องกู้ท่าทาง — เหตุการณ์เกือบเกิดอุบัติเหตุ`, 3, 'ข่ายอากาศ'); }
}
function startLanding(G, h) {
  if (G.seat === 'helo') { h.st = 'lmg'; G.mg = { u: h.id, amp: Math.max(1, deck(G).roll), ss: G.wx.ss, forced: !!h.forced, t0: G.t, n: (G.mg && G.mg.n) || 0 }; }
  else { h.st = 'land'; h.until = G.t + 45; }
}
function aiLanding(G, h) { if (!h.forced) return rnd(G) < 0.99 ? 'ok' : 'hard'; const r = rnd(G); return r < 0.75 ? 'ok' : r < 0.95 ? 'hard' : 'damage'; }
function landOutcome(G, h, res) {
  G.mg = null; const forced = h.forced; h.forced = false;
  if (res === 'waveoff') { h.st = 'hold'; h.t0 = G.t; h.redAt = G.t; log(G, 'air', 'เวหา 2: ยกเลิกการลงจอด (wave-off) วนกลับมาใหม่', 1, 'ข่ายอากาศ'); return; }
  h.st = 'turn'; h.until = G.t + 60; h.after = res;
  if (res === 'hard') { G.m.incidents++; log(G, 'air', 'เวหา 2: ลงจอดแข็ง — ต้องตรวจสภาพ 10 นาที', 2, 'ข่ายอากาศ'); }
  else if (res === 'damage') { G.m.heloDmg++; log(G, 'air', 'เวหา 2: ลงจอดรุนแรง อากาศยานเสียหาย — งดบิน 30 นาที', 3, 'ข่ายอากาศ'); }
  else log(G, 'air', `เวหา 2: ลงจอดบนวารีเรียบร้อย${forced ? ' (นอกเกณฑ์)' : ''}`, 0, 'ข่ายอากาศ');
}
function heloStep(G, h, dt) {
  if (h.id === 'h1') return h1Step(G, h, dt);
  const ship = G.u.wr; stormRisk(G, h, dt);
  if (G.inj.heloFault && airborne(h) && h.st !== 'divert') { G.inj.heloFault = false; pushDec(G, 'helo_fault'); }
  switch (h.st) {
    case 'deck': case 'down': {
      h.x = ship.x; h.y = ship.y; h.hdg = ship.hdg;
      if (h.st === 'down') { if (G.t >= h.until) { h.st = 'deck'; log(G, 'air', 'เวหา 2: ตรวจสภาพเสร็จ พร้อมบิน', 0, 'ข่ายอากาศ'); } break; }
      if (G.t < (h.readyAt || 0)) break;
      if (!h.inserted) { if (G.H == null || G.t < (h.launchAt || 9e9)) break; h.want = 'insert'; }
      else if (G.civ.epOpen && (G.civ.ep >= 10 || (G.civ.ep > 0 && G.civ.town <= 0)) && G.t < TEND - 480) h.want = 'evac';
      else { h.want = null; break; }
      if (G.ops.suspend) break;
      const dk = deck(G);
      if (!dk.ok && !(G.ops.mode === 'push' && G.wx.storm > 0.2)) { if (!h.waitMsg) { h.waitMsg = 1; log(G, 'sea', 'เวหา 2: รอเงื่อนไขดาดฟ้าเพื่อขึ้นบิน', 0, 'ข่ายเรือ'); } break; }
      if (!dk.ok) G.m.deckRisk++;
      h.waitMsg = 0; h.carry = h.want === 'insert' ? 'p11' : null; h.st = 'out'; h.route = heloOut(G); h.epChecked = false; h.epOk = false; h.trip++;
      log(G, 'air', `เวหา 2: ขึ้นบิน${h.carry ? ' นำ พยัคฆ์ 1-1 ไปเปิดจุดอพยพ' : ' เที่ยวอพยพที่ ' + (h.trip - 1)}`, 0, 'ข่ายอากาศ');
      break; }
    case 'out': {
      if (gateBlock(G, h)) break;
      if (G.ops.suspend && !h.carry) { h.st = 'back'; h.route = heloBack(G); break; }
      if (!h.epChecked && dist(h, WORLD.ep) < 2500) { h.epChecked = true; if (threatAt(G, WORLD.ep) && !h.epOk) { h.st = 'ephold'; h.ephT = G.t; pushDec(G, 'helo_ep'); break; } }
      if (moveAlong(h, dt, HELO_SPD)) { h.st = 'ep'; h.t0 = G.t; h.hitChk = false; h.acc = 0; }
      break; }
    case 'ephold': {
      h.oth = (h.oth || 0) + dt * 0.02; h.x += Math.cos(h.oth) * 20 * dt / 10; h.y += Math.sin(h.oth) * 20 * dt / 10;
      if (hasPending(G, 'helo_ep')) break;
      if (!threatAt(G, WORLD.ep)) { h.st = 'out'; h.epOk = true; log(G, 'air', 'เวหา 2: ภัยคุกคามถูกกดดันแล้ว เข้าลงจอดจุดอพยพ', 0, 'ข่ายอากาศ'); }
      else if (G.t - h.ephT > 300) { h.st = 'back'; h.route = heloBack(G); log(G, 'air', 'เวหา 2: รอนานเกิน ยกเลิกเที่ยวบิน กลับเรือ', 1, 'ข่ายอากาศ'); }
      break; }
    case 'ep': {
      h.x = WORLD.ep.x; h.y = WORLD.ep.y;
      if (!h.hitChk && threatAt(G, WORLD.ep)) { h.hitChk = true; if (rnd(G) < 0.2) { G.m.heloDmg++; h.dmg = true; log(G, 'air', 'เวหา 2: ถูกยิงขณะจอดที่จุดอพยพ — เสียหายเล็กน้อย', 3, 'ข่ายอากาศ'); } }
      if (h.carry === 'p11') {
        if (G.t - h.t0 >= 60) { const p = G.u.p11; p.emb = null; p.x = WORLD.ep.x - 40; p.y = WORLD.ep.y - 60; p.st = 'hold'; p.rep = { x: p.x, y: p.y, t: G.t }; p.nextRep = G.t + 600; p.nextDue = G.t + 900; h.carry = null; h.inserted = true; G.obj.epTeam = G.t; log(G, 'land', 'พยัคฆ์ 1-1: ถึงโรงเรียนแล้ว เตรียมเปิดจุดอพยพ', 1, 'ข่ายบังคับบัญชา'); pushDec(G, 'coy_ep'); h.st = 'back'; h.route = heloBack(G); }
      } else {
        h.acc += 20 / 90 * dt; const n = Math.min(Math.floor(h.acc), 20 - h.pax, G.civ.ep); if (n > 0) { h.pax += n; G.civ.ep -= n; h.acc -= n; }
        const w = G.t - h.t0;
        if (h.pax >= 20 || (w >= 180 && h.pax > 0 && G.civ.ep === 0) || w >= 300 || G.ops.suspend) { h.st = 'back'; h.route = heloBack(G); log(G, 'air', `เวหา 2: ออกจากจุดอพยพ พร้อมพลเรือน ${h.pax} คน`, 0, 'ข่ายอากาศ'); }
      }
      break; }
    case 'back': {
      if (gateBlock(G, h)) break;
      if (h.route.length) { const L = h.route[h.route.length - 1]; L[0] = ship.x; L[1] = ship.y; } else h.route = [[ship.x, ship.y]];
      if (moveAlong(h, dt, HELO_SPD) || dist(h, ship) < 400) { h.st = 'hold'; h.t0 = G.t; h.route = []; h.redAt = 0; log(G, 'air', 'เวหา 2: ถึงท้ายเรือวารี ขอลงจอด', 0, 'ข่ายอากาศ'); }
      break; }
    case 'hold': {
      const a = ship.hdg * Math.PI / 180; h.x = ship.x - 350 * Math.sin(a); h.y = ship.y - 350 * Math.cos(a);
      if (G.seat === 'fdo') { if (!hasPending(G, 'fdo_deck') && G.t >= (h.redAt || 0) + 40) pushDec(G, 'fdo_deck'); }
      else if (G.t >= (h.redAt || 0) + 20) {
        const dk = deck(G);
        if (dk.ok) { h.forced = false; startLanding(G, h); }
        else if (G.ops.mode === 'push' && G.t - h.t0 > 120) { h.forced = true; G.m.deckRisk++; startLanding(G, h); }
        else if (G.t - h.t0 > 1200) { h.forced = true; G.m.deckRisk++; log(G, 'air', 'เวหา 2: เชื้อเพลิงต่ำ ต้องลงจอดนอกเกณฑ์', 2, 'ข่ายอากาศ'); startLanding(G, h); }
        else h.redAt = G.t;
      }
      break; }
    case 'land': h.x = ship.x; h.y = ship.y; if (G.t >= h.until) landOutcome(G, h, aiLanding(G, h)); break;
    case 'lmg': h.x = ship.x; h.y = ship.y; if (G.seat !== 'helo') landOutcome(G, h, aiLanding(G, h)); break;
    case 'turn': {
      h.x = ship.x; h.y = ship.y;
      if (G.t >= h.until) {
        if (h.pax) { G.civ.evac += h.pax; log(G, 'civ', `วารี: รับพลเรือน ${h.pax} คนจากเวหา 2 (รวม ${G.civ.evac})`, 0, 'ข่ายเรือ'); h.pax = 0; }
        const extra = h.after === 'hard' ? 600 : h.after === 'damage' ? 1800 : (h.dmg || h.faultCont) ? 900 : 0; h.after = null; h.dmg = false; h.faultCont = false;
        if (extra) { h.st = 'down'; h.until = G.t + extra; } else { h.st = 'deck'; h.readyAt = G.t + 60; }
      }
      break; }
    case 'divert': {
      const s = G.u[h.divTo]; h.route = [[s.x, s.y]];
      if (moveAlong(h, dt, HELO_SPD * 0.8)) { if (h.pax) { G.civ.evac += h.pax; h.pax = 0; } log(G, 'air', `เวหา 2: ลงจอดฉุกเฉินที่ ${s.cs} เรียบร้อย — งดบินตรวจสภาพ 15 นาที`, 1, 'ข่ายอากาศ'); h.st = 'down'; h.until = G.t + 900; if (h.divTo === 'nk') h.until += 300; }
      break; }
    case 'field': if (G.t >= h.until) { h.st = 'back'; h.route = heloBack(G); if (h.pax) h.route = heloBack(G); } break;
  }
}
function h1Step(G, h, dt) {
  const ship = G.u.nk; stormRisk(G, h, dt);
  if (h.st === 'deck') { h.x = ship.x; h.y = ship.y; return; }
  if (h.st === 'h1out') { if (gateBlock(G, h)) return; if (moveAlong(h, dt, 50)) { h.st = 'patrol'; h.th = 0; } return; }
  if (h.st === 'patrol') {
    h.th += 45 / 2200 * dt; h.route = [[8800 + 2200 * Math.cos(h.th), 6300 + 2200 * Math.sin(h.th)]]; moveAlong(h, dt, 45);
    if (G.t >= 25200 || G.ops.suspend || G.wx.storm > 0.6) { h.st = 'ret'; h.route = G.acm === 'gate' ? [[WORLD.gate.x, WORLD.gate.y], [ship.x, ship.y]] : [[ship.x, ship.y]]; log(G, 'air', 'เวหา 1: กลับเรือนาคา', 0, 'ข่ายอากาศ'); }
    return;
  }
  if (h.st === 'ret') { if (gateBlock(G, h)) return; const L = h.route[h.route.length - 1]; if (L) { L[0] = ship.x; L[1] = ship.y; } if (moveAlong(h, dt, 50)) { h.st = 'deck'; } }
}
function lcuStep(G, l, dt) {
  const ship = G.u.wr; const sp = LCU_SPD * (1 - 0.4 * G.wx.storm);
  const hold = G.ops.suspend || (G.ops.mode === 'judg' && G.wx.storm > 0.6);
  if (G.ops.mode === 'push' && G.wx.storm > 0.5 && ['stage', 'pier', 'evac', 'ret'].includes(l.st) && rnd(G) < 0.0005 * dt) { G.m.incidents++; log(G, 'sea', `${l.cs}: คลื่นจัด มีผู้บาดเจ็บบนเรือ`, 3, 'ข่ายเรือ'); }
  switch (l.st) {
    case 'emb': l.x = ship.x; l.y = ship.y; l.hdg = ship.hdg; if (l.order === 'stage' && !hold) { l.order = null; l.st = 'stage'; l.emb = null; l.route = [[WORLD.pierHold.x, WORLD.pierHold.y - l.off]]; } break;
    case 'lod': if (moveAlong(l, dt, sp)) l.st = 'wait'; break;
    case 'wait': if (G.H != null && G.t >= G.H - (dxy(l.x, l.y, WORLD.beachW.x, WORLD.beachW.y) / sp) - 10) { l.st = 'run'; l.route = [[WORLD.shoal.x, WORLD.shoal.y + l.off * 0.6], [WORLD.beachW.x, WORLD.beachW.y + l.off]]; } break;
    case 'run':
      if (l.route.length === 1 && tide(G.t) < 2 && !l.agr) { l.st = 'aground'; l.agr = 1; G.m.aground++; log(G, 'sea', `${l.cs}: ค้างสันดอน! ระดับน้ำ ${tide(G.t).toFixed(2)} ม. ต่ำกว่าเกณฑ์`, 3, 'ข่ายเรือ'); break; }
      if (moveAlong(l, dt, sp)) { l.st = 'beach'; l.t0 = G.t; if (!G.obj.landed) G.obj.landed = G.t; log(G, 'sea', `${l.cs}: ถึงหาดเขียว — ลดทางลาด`, 1, 'ข่ายเรือ'); }
      break;
    case 'aground': if (tide(G.t) >= 2) { l.st = 'run'; log(G, 'sea', `${l.cs}: น้ำขึ้นถึงเกณฑ์ เดินหน้าเข้าหาด`, 1, 'ข่ายเรือ'); } break;
    case 'beach':
      if (G.t - l.t0 >= 240) {
        disembark(G, l.id, WORLD.beach); l.st = 'ret'; l.route = [[ship.x, ship.y]];
        if (!G.flags.coLcu && G.u.lcu1.st !== 'beach' && G.u.lcu2.st !== 'beach' && G.u.lcu1.st !== 'run' && G.u.lcu2.st !== 'run') { G.flags.coLcu = 1; pushDec(G, 'co_lcu'); }
      }
      break;
    case 'ret': if (l.order === 'stage' && !hold) { l.order = null; l.st = 'stage'; l.route = [[WORLD.pierHold.x, WORLD.pierHold.y - l.off]]; break; } l.route = [[ship.x, ship.y]]; if (moveAlong(l, dt, sp) || dist(l, ship) < 80) { l.st = 'emb'; l.emb = 'wr'; } break;
    case 'stage': if (hold) break; if (moveAlong(l, dt, sp)) l.st = 'phold'; break;
    case 'phold': if (G.obj.pier && !hold) { l.st = 'pier'; l.route = [[WORLD.pierW.x - l.off * 0.4, WORLD.pierW.y + l.off * 0.3]]; } break;
    case 'pier': if (moveAlong(l, dt, sp)) { l.st = 'load'; l.t0 = G.t; l.acc = 0; log(G, 'sea', `${l.cs}: เทียบท่าเรือ เริ่มรับพลเรือน`, 1, 'ข่ายเรือ'); } break;
    case 'load': {
      l.acc += 20 / 60 * dt; let n = Math.floor(l.acc);
      if (n > 0) { l.acc -= n; const a = Math.min(n, G.civ.ep, 100 - l.pax); G.civ.ep -= a; l.pax += a; n -= a; const b = Math.min(n, G.civ.town, 100 - l.pax); G.civ.town -= b; l.pax += b; }
      const w = G.t - l.t0;
      if (!hold && (l.pax >= 100 || (w > 600 && l.pax >= 20) || (G.civ.ep + G.civ.town === 0 && l.pax > 0) || (G.t > TEND - 1500 && l.pax > 0))) { l.st = 'evac'; l.route = [[ship.x, ship.y]]; log(G, 'sea', `${l.cs}: ออกจากท่าพร้อมพลเรือน ${l.pax} คน`, 0, 'ข่ายเรือ'); }
      break; }
    case 'evac': if (hold && G.wx.storm > 0.8) break; l.route = [[ship.x, ship.y]]; if (moveAlong(l, dt, sp) || dist(l, ship) < 80) { l.st = 'unload'; l.t0 = G.t; } break;
    case 'unload': l.x = ship.x; l.y = ship.y; if (G.t - l.t0 >= 180) { G.civ.evac += l.pax; log(G, 'civ', `วารี: รับพลเรือน ${l.pax} คนจาก${l.cs} (รวม ${G.civ.evac})`, 1, 'ข่ายเรือ'); l.pax = 0; if (G.t < TEND - 1800 && (G.civ.ep + G.civ.town) > 0) { l.st = 'stage'; l.route = [[WORLD.pierHold.x, WORLD.pierHold.y - l.off]]; } else { l.st = 'emb'; l.emb = 'wr'; } } break;
  }
}
function jetStep(G, j, dt) {
  const c = G.cas, ip = WORLD.ip;
  switch (j.st) {
    case 'in': if (moveAlong(j, dt, JET_SPD)) { j.st = 'orbit'; j.th = 0; } break;
    case 'orbit':
      j.th = (j.th || 0) + JET_SPD / 2500 * dt; j.x = ip.x + 2500 * Math.cos(j.th); j.y = ip.y + 2500 * Math.sin(j.th); j.hdg = (90 - j.th * 180 / Math.PI - 90 + 720) % 360;
      if (c.st === 'run') { j.st = 'run'; const aim = c.wrongXY || G.h.R4; j.route = c.acm === 'alt' ? [[17500, 15000], [16500, 7500], [aim.x, aim.y]] : [[aim.x, aim.y]]; c.tallyAsked = false; log(G, 'air', 'อินทรี 1: ออกจาก IP บินเข้าโจมตี', 0, 'ข่ายอากาศ'); }
      break;
    case 'run': {
      const aim = c.wrongXY || G.h.R4; if (j.route.length) { const L = j.route[j.route.length - 1]; L[0] = aim.x; L[1] = aim.y; }
      moveAlong(j, dt, JET_SPD); const d = dist(j, aim);
      if (d < 9000 && j.route.length <= 1 && !c.tallyAsked && c.st === 'run') { c.tallyAsked = true; c.st = 'tally'; pushDec(G, 'cas_tally'); }
      if (d < 1500) {
        if (c.st === 'hot') casRelease(G);
        else if (!['done', 'reatk'].includes(c.st)) { c.st = 'reatk'; c.t.re = G.t + 180; log(G, 'air', 'อินทรี 1: ไม่ได้รับอนุญาตโจมตี — ผ่านเป้าหมาย วนกลับ', 1, 'ข่ายอากาศ'); }
        dropPending(G, ['cas_tally', 'jtac_clear']);
        j.st = 'egress'; j.route = [[14000, 14500], [ip.x + 2500, ip.y]];
      }
      break; }
    case 'egress': if (moveAlong(j, dt, JET_SPD)) { j.st = 'orbit'; j.th = 0; } break;
    case 'rtb': if (moveAlong(j, dt, JET_SPD)) { j.st = 'gone'; } break;
  }
}
function casRelease(G) {
  const c = G.cas; c.att++;
  const p = c.wrongXY || { x: G.h.R4.x, y: G.h.R4.y }; const e = (c.press || G.wx.storm > 0.5) ? 150 : 15;
  c.imp = { x: p.x + gauss(G) * e, y: p.y + gauss(G) * e }; c.impT = G.t + 8; c.st = 'impact';
  log(G, 'air', 'อินทรี 1: "ปล่อยอาวุธ"', 1, 'ข่ายอากาศ');
}
function casImpact(G) {
  const c = G.cas, x = c.imp.x, y = c.imp.y; c.imp = null; const h = G.h.R4;
  G.fx.push({ k: 'cas', x, y, t: G.t });
  const d = dxy(x, y, h.x, h.y); if (d < 150) { h.str = Math.max(0, h.str - 85); h.sup = G.t + 600; }
  for (const u of Object.values(G.u)) { if (!isGround(u) || u.emb) continue; const du = dxy(x, y, u.x, u.y); if (du <= 200) { hurt(G, u, 35); G.m.frat++; log(G, 'air', `ยิงฝ่ายเดียวกัน! อาวุธ CAS ตกห่าง ${u.cs} ${fmt(du)} ม.`, 3, 'ข่ายอากาศ'); } else if (du <= 500) { G.m.near++; log(G, 'air', `อันตราย: อาวุธ CAS ตกห่าง ${u.cs} ${fmt(du)} ม.`, 2, 'ข่ายอากาศ'); } }
  if (G.civ.rb > 0 && dxy(x, y, WORLD.rb.x, WORLD.rb.y) < 250) { const n = G.civ.rb; G.civ.rb = 0; G.civ.harmF += n; G.m.civHarm += n; G.m.roe++; trust(G, -20); log(G, 'civ', `พลเรือนบาดเจ็บ ${n} คนจากการโจมตีด่าน`, 3, null); }
  log(G, 'air', `ชี้ทาง: ${d < 150 ? 'ผลการโจมตี — ด่านถูกทำลาย' : 'อาวุธตกห่างเป้าหมาย ' + fmt(d) + ' ม.'}`, 1, 'ข่ายอากาศ');
  c.st = h.str <= 30 ? 'done' : (c.att < 3 ? 'reatk' : 'done'); c.t.re = G.t + 180;
}
function casStep(G) {
  const c = G.cas;
  const cold = c.acm !== 'hold' || !inFlight(G);
  if (c.st === 'prerun' && G.t >= c.t.run && G.u.jet.st === 'orbit' && cold) { c.st = 'run'; }
  if (c.st === 'reatk' && G.t >= c.t.re && G.u.jet.st === 'orbit') { if (c.att >= 3 || G.t >= G.bingo || G.h.R4.str <= 30) c.st = 'done'; else if (cold) c.st = 'run'; }
  if (c.imp && G.t >= c.impT) casImpact(G);
  const j = G.u.jet;
  G.casHold = c.acm === 'hold' && (['prerun', 'run', 'tally', 'clr', 'hot', 'impact'].includes(c.st) || (c.st === 'reatk' && G.t >= c.t.re - 60) || j.st === 'run' || (j.st === 'egress' && j.route.length > 1));
}
function disembark(G, carrier, at) {
  const names = [];
  for (const u of Object.values(G.u)) if (u.emb === carrier && isGround(u)) {
    u.emb = null; u.x = at.x + (rnd(G) - 0.5) * 140; u.y = at.y + (rnd(G) - 0.5) * 140;
    u.rep = { x: u.x, y: u.y, t: G.t }; u.nextRep = G.t + u.repEvery + rnd(G) * 120; u.nextDue = G.t + 900;
    if (u.rt && RT[u.rt]) { u.route = RT[u.rt].map(p => p.slice()); u.st = 'move'; } else u.st = 'hold';
    names.push(u.cs);
  }
  if (names.length) log(G, 'land', `${G.u[carrier].cs}: ส่ง ${names.join(', ')} ขึ้นฝั่งหาดเขียวแล้ว`, 1, 'ข่ายบังคับบัญชา');
}
function pinned(G, u) { return Object.values(G.h).some(h => h.act && h.str > 30 && G.t >= h.sup && dist(h, u) < 0.5 * h.thr); }
function groundStep(G, u, dt) {
  if (u.emb || u.str <= 0) { if (u.emb) { const c = G.u[u.emb]; u.x = c.x; u.y = c.y; } return; }
  if (u.follow) { const f = G.u[u.follow]; if (!f.emb) { u.x = f.x - 60; u.y = f.y - 40; u.hdg = f.hdg; } return; }
  if (u.st !== 'move' || !u.route.length) return;
  let sp = (u.k === 'cav' ? CAV_SPD : INF_SPD) * (u.spdMul || 1) * (1 - 0.3 * G.wx.storm);
  if (pinned(G, u)) sp *= 0.3;
  if (moveAlong(u, dt, sp)) { u.st = 'hold'; onArrive(G, u); }
}
function onArrive(G, u) {
  if (u.id === 'p12') { G.flags.pierAt = G.t; log(G, 'land', 'พยัคฆ์ 1-2: ถึงท่าเรือ เริ่มตรวจค้นและรักษาความปลอดภัย', 0, 'ข่ายบังคับบัญชา'); }
  if (u.id === 'p3') log(G, 'land', 'พยัคฆ์ 3: ถึงขอบเมืองด้านใต้ วางกำลังรักษาความปลอดภัย', 0, 'ข่ายบังคับบัญชา');
  if (u.id === 'p2' && G.flags.p2b) { if (dist(u, G.h.R2) < 250) { G.obj.h214 = G.t; log(G, 'land', 'พยัคฆ์ 2: ยึดเนิน 214 ได้แล้ว', 1, 'ข่ายบังคับบัญชา'); } }
  if (u.id === 'cav' && dist(u, WORLD.af) < 200) { G.obj.af = G.t; log(G, 'land', 'อาชา 6: ยึดสนามบินได้แล้ว', 1, 'ข่ายบังคับบัญชา'); }
}
function cavStep(G) {
  const c = G.u.cav, h = G.h.R4; if (c.emb) return;
  if (c.st === 'move' && !G.flags.rbSeen && h.str > 30 && dist(c, h) < 1100) {
    G.flags.rbSeen = 1; c.st = 'halt'; if (!h.known) { h.known = true; h.kx = h.x + 30; h.ky = h.y - 20; h.by = 'อาชา 6'; h.seen = G.t; }
    log(G, 'land', 'อาชา 6: พบด่านสกัดถนน มีรถพลเรือนจอดอยู่', 2, 'ข่ายบังคับบัญชา'); pushDec(G, 'cav_roadblock');
  }
  if (c.st === 'halt' && h.str <= 30 && !G.flags.cavGo) { G.flags.cavGo = true; c.route = RT.cav2.map(p => p.slice()); c.st = 'move'; log(G, 'land', 'อาชา 6: ด่านถูกทำลาย เคลื่อนที่ต่อไปสนามบิน', 1, 'ข่ายบังคับบัญชา'); }
  if (c.st === 'halt' && h.str > 30 && !G.flags.cavGo && G.cas.st === 'done' && !hasPending(G, 'cav_rbatk') && G.t >= (G.flags.rbAsk || 0)) { G.flags.rbAsk = G.t + 900; pushDec(G, 'cav_rbatk'); }
  if (c.st === 'halt' && G.cas.st === 'none' && G.flags.rbSeen && !G.flags.cavGo && !hasPending(G, 'cav_roadblock') && !hasPending(G, 'jtf_cas') && !G.flags.rbAsk0) { G.flags.rbAsk0 = 1; G.flags.rbAsk = G.t + 600; }
  if (G.civ.rbClearAt && G.t >= G.civ.rbClearAt && G.civ.rb > 0) { G.civ.rb = 0; log(G, 'civ', 'ชี้ทาง: รถพลเรือนออกจากบริเวณด่านแล้ว', 1, 'ข่ายอากาศ'); }
}
function hostileStep(G, dt) {
  const L = light(G.t);
  for (const h of Object.values(G.h)) {
    if (!h.act || h.str <= 0) continue;
    if (h.route && h.route.length) moveAlong(h, dt, 1.5);
    if (h.str <= 30 || G.t < h.sup) continue;
    for (const u of Object.values(G.u)) {
      if (u.str <= 0) continue;
      const tgt = (isGround(u) && !u.emb && u.k !== 'fo') || (u.k === 'lcu' && ['run', 'aground', 'beach'].includes(u.st));
      if (!tgt) continue;
      if (h.id === 'R4' && u.st === 'halt') continue;
      const d = dist(u, h); if (d > h.thr) continue;
      hurt(G, u, 0.03 * (h.str / 100) * (1 - d / h.thr) * (0.6 + 0.4 * L) * dt * (h.k === 'mortar' ? 0.5 : 1), h);
    }
  }
}
function assaultStep(G, dt) {
  for (const u of Object.values(G.u)) {
    if (!isGround(u) || u.emb || u.str <= 0 || u.k === 'fo' || u.k === 'jtac') continue;
    for (const h of Object.values(G.h)) {
      if (!h.act || h.str <= 0) continue;
      if (h.id === 'R4' && !G.flags.rbAtk) continue;
      if (h.id === 'R3' && !G.flags.r3atk) continue;
      if (dist(u, h) > 500) continue;
      h.str = Math.max(0, h.str - 0.08 * (h.id === 'R3' ? 2 : 1) * (u.str / 100) * dt);
      if (h.str <= 0 && !h.dead) { h.dead = true; log(G, 'land', `${u.cs}: ${h.nm} ถูกทำลาย/ยึดได้`, 1, netOf(u)); }
    }
  }
}
const OBS = { fo: 5000, inf: 1200, cav: 1500, jtac: 2500, helo: 3500, jet: 6000 };
function detectStep(G) {
  const v = light(G.t) * G.wx.vis;
  for (const h of Object.values(G.h)) {
    if (!h.act || h.str <= 0) continue;
    for (const u of Object.values(G.u)) {
      if (u.emb || u.str <= 0) continue; const base = OBS[u.k]; if (!base) continue;
      if ((u.k === 'helo' || u.k === 'jet') && !airborne(u)) continue;
      const R = base * v * (h.camo || 1), d = dist(u, h); if (d > R) continue;
      if (rnd(G) < 0.25 * (1 - d / R)) {
        const e = 30 + 0.02 * d; h.kx = h.x + gauss(G) * e; h.ky = h.y + gauss(G) * e; h.seen = G.t;
        if (!h.known) { h.known = true; h.by = u.cs; log(G, 'intel', `${u.cs}: พบ${h.nm} บริเวณ ${gridStr(h.kx, h.ky)}`, 1, netOf(u)); }
        break;
      }
    }
  }
}
function foAI(G) {
  if (G.t < G.nextFo) return; G.nextFo = G.t + 20;
  if (G.seat === 'fo') {
    for (const h of Object.values(G.h)) {
      if (!h.act || !h.known || h.str <= 30 || h.id === 'R3' || (h.id === 'R1' && G.H != null && G.t > G.H - 600)) continue;
      if (G.missions.some(m => m.tgt === h.id && !['done', 'denied', 'cancelled'].includes(m.st))) continue;
      if (G.t < (h.foAsk || 0) || hasPending(G, 'fo_target')) continue;
      h.foAsk = G.t + (h.id === 'R4' ? 1200 : 420); pushDec(G, 'fo_target', { tgt: h.id }, 'fo_target' + h.id); break;
    }
    return;
  }
  for (const id of ['R2', 'R5', 'R1']) {
    const h = G.h[id]; if (!h.act || !h.known || h.str <= 30) continue;
    if (id === 'R1' && (G.H == null || G.t > G.H - 900 || G.prep !== 'none' && G.prep != null)) continue;
    if (G.missions.some(m => m.tgt === id && !['done', 'denied', 'cancelled'].includes(m.st))) continue;
    if (h.lastReq && G.t - h.lastReq < 240) continue;
    requestFire(G, id, 'ai'); break;
  }
}
function civStep(G, dt) {
  const c = G.civ;
  if (G.flags.epWait && !c.epOpen && (!threatAt(G, WORLD.ep) || G.t - G.flags.epWait > 900)) { G.flags.epWait = 0; pushDec(G, 'coy_ep', null, 'coy_ep2'); }
  if (c.epOpen && c.town > 0) {
    let rate = (8 / 60) * (c.trust / 100);
    if (threatAt(G, WORLD.ep)) rate *= 0.4;
    if (G.h.R3.act && G.h.R3.str > 30) rate *= 0.5;
    rate *= 1 - 0.3 * G.wx.storm; if (!c.screen) rate *= 1.2;
    c.acc += rate * dt; const n = Math.floor(c.acc); if (n > 0) { const k = Math.min(n, c.town); c.town -= k; c.ep += k; c.acc -= n; }
  }
  if (c.ep > 0 && threatAt(G, WORLD.ep) && G.t >= c.nextHarm) { c.nextHarm = G.t + 600; if (rnd(G) < 0.5) { c.harmE += 1; log(G, 'civ', 'ข้าศึกยิงใกล้จุดอพยพ — พลเรือนบาดเจ็บ 1 คน', 2, null); } }
  for (const q of G.trustQ) if (!q.done && G.t >= q.t) { q.done = true; trust(G, q.d); log(G, 'civ', q.x + ' — ความเชื่อมั่นเพิ่มขึ้น', 1, null); }
  if (G.seat !== 'jtf' && c.trust < 50 && G.t >= (G.flags.commAt || 0) && G.H != null && G.t > G.H) { G.flags.commAt = G.t + 1200; trust(G, 6); log(G, 'civ', 'มรกต 6: สื่อสารกับผู้นำชุมชนผ่านนายทหารติดต่อ', 0, 'ข่ายประสาน'); }
  if (G.flags.r3fallback && G.t >= G.flags.r3fallback && G.h.R3.str > 30 && !G.flags.r3atk) { G.flags.r3fallback = 0; G.flags.r3atk = true; log(G, 'land', 'พยัคฆ์ 6: เปลี่ยนเป็นการดำเนินกลยุทธ์ภาคพื้นในเมือง', 1, 'ข่ายบังคับบัญชา'); }
}
function contactStep(G, dt) {
  const ship = G.u.wr;
  for (const c of Object.values(G.c)) {
    if (c.st === 'gone') continue;
    if (c.idAt && G.t >= c.idAt) { c.idAt = null; c.side = 'N'; log(G, 'sea', `พิสูจน์ทราบแล้ว: ${c.id === 'boat' ? 'เรือประมงพลเรือน' : 'เรือพลเรือน'}`, 1, 'ข่ายเรือ'); }
    if (c.st === 'approach') {
      c.route = [[ship.x, ship.y]]; const d = dist(c, ship);
      if (c.id === 'boat') { if (d < 3000 && !c.asked) { c.asked = 1; pushDec(G, 'co_contact'); } if (d < 1500) { c.st = 'stopped'; break; } }
      if (c.id === 'fast') {
        if (d < 4000 && !c.asked) { c.asked = 1; pushDec(G, 'co_fastboat'); }
        if (c.turnAt && d < c.turnAt) { c.st = 'leave'; if (c.turnAt < 1000) { G.m.secLapse++; log(G, 'sea', 'เรือไม่ทราบฝ่ายผ่านใกล้วารีในระยะ 250 ม. โดยไม่ถูกตอบสนอง', 2, 'ข่ายเรือ'); } else log(G, 'sea', 'เรือเร็วหันหัวออกเมื่อเห็นการตอบสนอง', 1, 'ข่ายเรือ'); break; }
        if (d < 200) { c.st = 'leave'; break; }
      }
      moveAlong(c, dt, c.spd);
    } else if (c.st === 'leave') { c.route = [[c.x + 3000, -600]]; moveAlong(c, dt, c.spd); if (c.y < -400) c.st = 'gone'; }
  }
}
function reportPos(G, u) {
  if (!u || u.emb) return false; u.rep = { x: u.x, y: u.y, t: G.t }; u.nextDue = G.t + 900; G.m.reports++;
  dropPending(G, ['rep_due']); log(G, 'c2', `${u.cs}: รายงานตำแหน่ง ${gridStr(u.x, u.y)}`, 0, netOf(u)); return true;
}
function reportStep(G) {
  const mine = seatUnit(G.seat);
  for (const u of Object.values(G.u)) {
    if (!isGround(u) || u.emb || u.str <= 0) continue;
    if (u.id === mine) { if (u.k !== 'fo' && G.t >= (u.nextDue || 9e9) && !hasPending(G, 'rep_due')) { u.nextDue = G.t + 900; pushDec(G, 'rep_due'); } continue; }
    if (G.t >= u.nextRep) { u.nextRep = G.t + u.repEvery + rnd(G) * 120; if (rnd(G) < (u.skipRep || 0)) continue; u.rep = { x: u.x, y: u.y, t: G.t }; }
  }
}
function objStep(G) {
  const o = G.obj, h = G.h;
  if (!o.beach && G.obj.landed && h.R1.str <= 30) { o.beach = G.t; log(G, 'land', 'หาดเขียวปลอดภัย', 1, 'ข่ายบังคับบัญชา'); }
  if (!o.pier && G.flags.pierAt && G.t - G.flags.pierAt >= 300) { o.pier = G.t; log(G, 'land', 'พยัคฆ์ 1-2: ท่าเรือปลอดภัย พร้อมรับเรือยกพล', 1, 'ข่ายบังคับบัญชา'); if (G.flags.lcuNone) pushDec(G, 'co_lcu', { late: true }, 'co_lcu_late'); }
  if (!o.rb && h.R4.str <= 30) { o.rb = G.t; }
  if (!o.r2 && h.R2.str <= 30) { o.r2 = G.t; log(G, 'intel', 'เนิน 214: ปืนครกและที่ตรวจการณ์ถูกกดดัน', 1, 'ข่ายยิง'); }
  if (o.r2 && !G.flags.p2b && G.u.p2.st === 'hold' && !G.u.p2.emb && dist(G.u.p2, { x: 12450, y: 11250 }) < 150) { G.flags.p2b = true; const p = G.u.p2; p.route = RT.p2b.map(q => q.slice()); p.st = 'move'; log(G, 'land', 'พยัคฆ์ 2: เคลื่อนที่เข้ายึดเนิน 214', 0, 'ข่ายบังคับบัญชา'); }
  if (!o.r5 && h.R5.act && h.R5.str <= 30) { o.r5 = G.t; log(G, 'intel', 'กลุ่มกำลังเสริมข้าศึกถูกกดดัน', 1, 'ข่ายยิง'); }
  const s = G.u.wr, b = WORLD.box; if (s.x < b.x0 || s.x > b.x1 || s.y < b.y0 || s.y > b.y1) G.m.boxOut += 1;
}
const r10 = v => Math.round(v / 10);
function snap(G) {
  G.lastSnap = G.t;
  if (!G.snapU) { G.snapU = Object.keys(G.u); G.snapH = Object.keys(G.h); }
  const u = []; for (const id of G.snapU) { const x = G.u[id]; u.push(r10(x.x), r10(x.y), x.rep ? r10(x.rep.x) : -1, x.rep ? r10(x.rep.y) : -1, Math.round(x.str), x.emb ? 1 : 0, Math.round((x.hdg || 0) / 5)); }
  const h = []; for (const id of G.snapH) { const x = G.h[id]; h.push(r10(x.x), r10(x.y), x.known ? r10(x.kx) : -1, x.known ? r10(x.ky) : -1, Math.round(x.str), x.act ? 1 : 0); }
  const c = []; for (const x of Object.values(G.c)) if (x.st !== 'gone') c.push([x.id, r10(x.x), r10(x.y), x.side]);
  const f = G.missions.filter(m => m.st === 'flight').map(m => { const p = parseGrid(m.grid); return [r10(p.x), r10(p.y)]; });
  G.snaps.push({ t: G.t, u, h, c, f, civ: [G.civ.town, G.civ.ep, G.civ.evac, G.civ.harmF + G.civ.harmE] });
}
function snapUnits(G, s) { const out = []; G.snapU.forEach((id, i) => { const a = s.u.slice(i * 7, i * 7 + 7); out.push({ id, x: a[0] * 10, y: a[1] * 10, rx: a[2] < 0 ? null : a[2] * 10, ry: a[3] < 0 ? null : a[3] * 10, str: a[4], emb: !!a[5], hdg: a[6] * 5 }); }); return out; }
function snapHostiles(G, s) { const out = []; G.snapH.forEach((id, i) => { const a = s.h.slice(i * 6, i * 6 + 6); out.push({ id, x: a[0] * 10, y: a[1] * 10, kx: a[2] < 0 ? null : a[2] * 10, ky: a[3] < 0 ? null : a[3] * 10, str: a[4], act: !!a[5] }); }); return out; }

/* ---------- ลูปหลัก ---------- */
function tick(G, dt) {
  G.t += dt;
  weatherStep(G); runSched(G);
  for (const s of [G.u.wr, G.u.nk]) shipStep(G, s, dt);
  oodAI(G);
  if (G.t % 120 < dt) { const nk = G.u.nk; nk.cmdH = dxy(nk.x, nk.y, 5800, 12400) > 900 ? Math.round(bearing(nk.x, nk.y, 5800, 12400)) : Math.round(G.wx.wdir); nk.cmdS = 1; }
  lcuStep(G, G.u.lcu1, dt); lcuStep(G, G.u.lcu2, dt);
  heloStep(G, G.u.h1, dt); heloStep(G, G.u.h2, dt); jetStep(G, G.u.jet, dt);
  for (const u of Object.values(G.u)) if (isGround(u)) groundStep(G, u, dt);
  cavStep(G); casStep(G); missionStep(G);
  for (const m of G.missions) if (m.st === 'flight') {
    const c = corridorOf(parseGrid(m.grid));
    for (const u of Object.values(G.u)) if (airborne(u) && segDist(u.x, u.y, c[0], c[1], c[2], c[3]) <= 300) { const key = 'air' + m.id + u.id; if (!G.flags[key]) { G.flags[key] = 1; G.m.air++; log(G, 'air', `อันตราย! ${u.cs} บินผ่านแนวยิงขณะกระสุนภารกิจ ${m.id} กำลังเดินทาง`, 3, 'ข่ายอากาศ'); } }
  }
  hostileStep(G, dt); assaultStep(G, dt);
  if (G.t >= G.nextDet) { G.nextDet = G.t + 10; detectStep(G); }
  foAI(G); civStep(G, dt); contactStep(G, dt); reportStep(G); objStep(G); decisionStep(G);
  if (G.t - G.lastSnap >= 30) snap(G);
  if (G.t >= TEND && !G.over) { G.over = true; G.pend = []; snap(G); log(G, 'sys', `จบการฝึก 08:00 — พลเรือนถึงที่ปลอดภัย ${G.civ.evac} คน รออยู่ที่จุดอพยพ ${G.civ.ep} คน`, 2, null); }
}
function step(G, dt) {
  let rem = dt;
  while (rem > 1e-6 && !G.over) { const h = Math.min(1, rem); if (G.mg && G.seat === 'helo') return; tick(G, h); rem -= h; }
}

/* ---------- API สำหรับหน้าจอ ---------- */
function decide(G, id, k) { const d = G.pend.find(x => x.id === id); if (!d) return false; return resolve(G, d, k, 'player'); }
function setSeat(G, seat) {
  G.seat = seat || null;
  for (const d of G.pend) if (d.seat === G.seat) d.dl = Math.max(d.dl, G.t + 60);
  const u = G.u[seatUnit(seat)]; if (u && isGround(u) && !u.emb) u.nextDue = G.t + 600;
  log(G, 'sys', `ผู้เล่นรับตำแหน่ง: ${seat ? seatCS(seat) : 'ผู้สังเกตการณ์'}`, 0, null);
}
function act(G, type, a) {
  a = a || {};
  switch (type) {
    case 'cff': { const h = G.h[a.tgt]; if (!h || !h.known || h.str <= 0) return false; if (G.missions.some(m => m.tgt === a.tgt && ['cff', 'fdc', 'query', 'fscc', 'hold', 'ready', 'flight', 'lost', 'wait'].includes(m.st))) return false; return !!requestFire(G, a.tgt, 'player'); }
    case 'report': return reportPos(G, G.u[seatUnit(G.seat)]);
    case 'checkfire': checkFire(G, G.seat); return true;
    case 'helm': { const s = G.u.wr; s.cmdH = ((Math.round(a.h) % 360) + 360) % 360; s.cmdS = clamp(+a.s, 0, 8); log(G, 'sea', `วารี: สั่งเข็ม ${pad3(s.cmdH)} ความเร็ว ${Math.round(s.cmdS * 1.944)} นอต`, 0, 'ข่ายเรือ'); return true; }
    case 'comm': if (G.t < (G.flags.commAt || 0)) return false; G.flags.commAt = G.t + 1200; trust(G, 6); log(G, 'civ', 'มรกต 6: สื่อสารกับผู้นำชุมชนผ่านนายทหารติดต่อ — ความเชื่อมั่นเพิ่มขึ้น', 1, 'ข่ายประสาน'); return true;
    case 'artyhold': G.artyHold = !G.artyHold; log(G, 'fires', `อัคนี: ${G.artyHold ? 'ระงับการยิงปืนใหญ่ทั้งหมดชั่วคราว' : 'ยกเลิกการระงับการยิงปืนใหญ่'}`, 1, 'ข่ายประสาน'); return true;
    case 'cav': {
      const c = G.u.cav; if (c.st !== 'halt' || G.flags.cavGo) return false;
      if (a.k === 'cas') { if (G.cas.st !== 'none') return false; G.cas.st = 'req'; log(G, 'air', 'ชี้ทาง: ขอ CAS ทำลายด่านสกัดถนน', 1, 'ข่ายอากาศ'); pushDec(G, 'jtf_cas'); return true; }
      if (a.k === 'detour') { cavDetour(G); return true; }
      if (a.k === 'atk') { cavFire(G); return true; }
      return false;
    }
  }
  return false;
}
function inject(G, type) {
  switch (type) {
    case 'gridErr': G.inj.gridErr = true; break;
    case 'relay': EV.relayDown(G); break;
    case 'clip': G.flags.clip = 0; EV.clip(G); break;
    case 'fishing': if (!G.c.boat) EV.fishing(G); break;
    case 'fast': EV.fast(G); break;
    case 'storm': EV.storm(G); break;
    case 'heloFault': EV.heloFault(G); break;
    case 'rbErr': G.inj.rbErr = true; break;
    case 'town': G.sched = G.sched.filter(e => e.ev !== 'town'); sched(G, G.t, 'town'); break;
    default: return false;
  }
  log(G, 'inject', `ผู้ฝึก: ใส่สถานการณ์ "${INJ[type] || type}"`, 1, null);
  return true;
}
const INJ = { gridErr: 'พิกัดผิดในคำขอยิงครั้งถัดไป', relay: 'สถานีทวนสัญญาณข่ายยิงขัดข้อง', clip: 'คลิปปลอมในสื่อสังคม', fishing: 'เรือประมงไม่ทราบฝ่าย', fast: 'เรือเร็วพุ่งเข้าหา', storm: 'พายุเข้าทันที', heloFault: 'ไฟเตือนเฮลิคอปเตอร์', rbErr: 'นักบินทวนกลับผิด', town: 'ถูกยิงในเมืองใกล้โรงพยาบาล' };
function mgResult(G, res) { const h = G.u.h2; if (h.st !== 'lmg') return false; landOutcome(G, h, res); return true; }
function mgAuto(G) { const h = G.u.h2; if (h.st !== 'lmg') return false; landOutcome(G, h, aiLanding(G, h)); return true; }
function finish(G) { if (G.over) return; G.over = true; G.pend = []; snap(G); log(G, 'sys', `ยุติการฝึกเมื่อ ${hhmm(G.t)} — พลเรือนถึงที่ปลอดภัย ${G.civ.evac} คน รออยู่ที่จุดอพยพ ${G.civ.ep} คน`, 2, null); }
function stormAt(G, t) { const w = G.wx; if (w.stormT == null) return 0; let s = clamp((t - w.stormT) / 300, 0, 1); if (w.stormEndT != null) s = Math.min(s, clamp(1 - (t - w.stormEndT) / 300, 0, 1)); return s; }
function phase(G) {
  const t = G.t, H = G.H;
  if (G.over) return 'จบการฝึก';
  if (G.wx.storm > 0.3) return 'พายุ';
  if (H == null || t < H - 1320) return 'วางแผน';
  if (t < H) return 'เคลื่อนสู่หาด';
  if (t < H + 900) return 'ยกพลขึ้นบก';
  if (t >= TEND - 900) return 'ปิดการอพยพ';
  return 'ขยายผล/อพยพ';
}
function hrel(G, t) { if (G.H == null) return 'H?'; const d = Math.round(((t == null ? G.t : t) - G.H) / 60); return d === 0 ? 'H' : 'H' + (d > 0 ? '+' : '−') + Math.abs(d); }
function activeFires(G) {
  const out = [];
  for (const m of G.missions) {
    const recent = m.t.splash && G.t - m.t.splash < 25;
    if (['fscc', 'hold', 'ready', 'flight'].includes(m.st) || recent) { const p = parseGrid(m.grid); out.push({ id: m.id, st: m.st, x: p.x, y: p.y, shot: m.t.shot || null, splash: m.t.splash || null, err: m.err, prep: !!m.prep, tgt: m.tgt, imp: m.imp }); }
  }
  return out;
}
function summary(G) {
  const c = G.civ, m = G.m;
  const shots = G.missions.filter(x => x.t.shot && !x.prep && x.rep === 0).map(x => x.t.shot - x.t.req);
  const mine = G.decs.filter(d => d.by !== 'ai');
  const cnt = g => mine.filter(d => d.g === g).length;
  return { safe: c.evac + c.ep, evac: c.evac, ep: c.ep, town: c.town, harmF: c.harmF, harmE: c.harmE, trust: Math.round(c.trust),
    frat: m.frat, near: m.near, air: m.air, roe: m.roe, nfa: m.nfa, cffAvg: shots.length ? shots.reduce((a, b) => a + b, 0) / shots.length : null, missions: G.missions.filter(x => x.t.shot).length,
    cf: m.cf, cfOk: m.cfOk, loss: Math.round(m.loss), deckRisk: m.deckRisk, aground: m.aground, incidents: m.incidents, heloDmg: m.heloDmg, boxOut: Math.round(m.boxOut / 60),
    caught: m.caughtFDC + m.caughtBDA + m.caughtRB, obj: Object.assign({}, G.obj), dec: { good: cnt('good'), ok: cnt('ok'), poor: cnt('poor'), n: mine.length } };
}

const SIM = {
  T0, TEND, SUNRISE, WORLD, RT, SEATS, AI_SEATS, ORBAT, LV, INJ, DEC,
  newGame, step, decide, act, inject, mgResult, mgAuto, finish, stormAt, setSeat, reportPos, snapUnits, snapHostiles,
  deck, deckFor, cop, airborne, isGround, seatUnit, seatCS, phase, hrel, summary, activeFires, threatAt, casTxt, heloTxt,
  util: { hhmm, hhmmss, gridStr, parseGrid, bearing, angDiff, tide, tideWindow, light, clamp, fmt, pad3, dxy, segDist }
};
if (typeof module !== 'undefined' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(typeof window !== 'undefined' ? window : globalThis);
