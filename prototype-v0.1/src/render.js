/* คลื่นมรกต — วาดแผนที่ด้วย canvas 2D (ใช้ทั้งเกมสดและการเล่นซ้ำใน AAR) */
(function (root) {
'use strict';
const W = SIM.WORLD;
const C = {
  sea: '#0a1622', land: '#17241c', land2: '#1d2d23', coast: '#3f5b48', contour: 'rgba(160,190,140,0.20)',
  road: 'rgba(170,150,110,0.55)', town: '#2a3442', grid: 'rgba(147,164,184,0.065)', gridLbl: 'rgba(147,164,184,0.55)',
  fr: '#5aa9ff', ho: '#ff5a5f', ne: '#47c78a', un: '#f4d35e', amber: '#f2b134', text: '#e6edf5', muted: '#93a4b8', nfa: '#ff7a7a', sky: '#9ad1f5'
};
let reduced = false;
try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
const FONT = "'Chakra Petch','IBM Plex Sans Thai','Sarabun',system-ui,sans-serif";

function poly(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
const P = { mainland: poly(W.mainland), island: poly(W.island) };
const town = (function () { let a = 11; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; const out = []; for (let i = 0; i < 80; i++) { const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * 470; out.push([W.town.x + Math.cos(ang) * d, W.town.y + Math.sin(ang) * d, 30 + r() * 55, 24 + r() * 45]); } return out; })();

function fit(cam) { cam.s = Math.min(cam.w / 16400, cam.h / 11600); cam.cx = 9700; cam.cy = 10700; }
function sx(cam, x) { return (x - cam.cx) * cam.s + cam.w / 2; }
function sy(cam, y) { return cam.h / 2 - (y - cam.cy) * cam.s; }
function toWorld(cam, px, py) { return { x: (px - cam.w / 2) / cam.s + cam.cx, y: (cam.h / 2 - py) / cam.s + cam.cy }; }
function worldTf(ctx, cam, dpr) { ctx.setTransform(dpr * cam.s, 0, 0, -dpr * cam.s, dpr * (cam.w / 2 - cam.cx * cam.s), dpr * (cam.h / 2 + cam.cy * cam.s)); }
function screenTf(ctx, dpr) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

function label(ctx, txt, x, y, o) {
  o = o || {};
  ctx.font = `${o.w || 600} ${o.size || 11}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'top';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,10,16,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(txt, x, y);
  ctx.fillStyle = o.color || C.text; ctx.fillText(txt, x, y);
}

/* ---------- สัญลักษณ์หน่วย (แบบย่อคล้าย APP-6) ---------- */
function frameLand(ctx, x, y, col, dashed) {
  ctx.setLineDash(dashed ? [3, 3] : []); ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(90,169,255,0.16)';
  ctx.beginPath(); ctx.rect(x - 12, y - 8, 24, 16); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
}
function symFriendly(ctx, u, x, y) {
  const col = C.fr, dashed = u.age > 660;
  switch (u.k) {
    case 'inf': frameLand(ctx, x, y, col, dashed); ctx.beginPath(); ctx.moveTo(x - 12, y - 8); ctx.lineTo(x + 12, y + 8); ctx.moveTo(x + 12, y - 8); ctx.lineTo(x - 12, y + 8); ctx.stroke(); if (u.hqu) { ctx.beginPath(); ctx.moveTo(x - 12, y - 8); ctx.lineTo(x - 12, y + 18); ctx.stroke(); } break;
    case 'cav': frameLand(ctx, x, y, col, dashed); ctx.beginPath(); ctx.moveTo(x - 12, y + 8); ctx.lineTo(x + 12, y - 8); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); ctx.stroke(); break;
    case 'arty': frameLand(ctx, x, y, col, false); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); break;
    case 'hq': frameLand(ctx, x, y, col, false); ctx.beginPath(); ctx.moveTo(x - 12, y - 8); ctx.lineTo(x - 12, y + 18); ctx.stroke(); label(ctx, 'HQ', x, y - 6, { size: 9, color: col }); break;
    case 'fo': case 'jtac': {
      ctx.setLineDash(dashed ? [3, 3] : []); ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(90,169,255,0.18)';
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x - 10, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y + 2, 2.2, 0, Math.PI * 2); ctx.fill();
      if (u.k === 'jtac') label(ctx, 'J', x, y - 24, { size: 9, color: col }); break; }
    case 'ship': hull(ctx, x, y, u.hdg, 15, col, 'rgba(90,169,255,0.22)'); break;
    case 'lcu': hull(ctx, x, y, u.hdg, 8, col, 'rgba(90,169,255,0.3)'); break;
    case 'helo': helo(ctx, x, y, u.hdg, col, u.t); break;
    case 'jet': jet(ctx, x, y, u.hdg, col); break;
  }
}
function hull(ctx, x, y, hdg, L, col, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((hdg || 0) * Math.PI / 180);
  ctx.beginPath(); ctx.moveTo(0, -L); ctx.quadraticCurveTo(L * 0.42, -L * 0.3, L * 0.36, L * 0.85); ctx.lineTo(-L * 0.36, L * 0.85); ctx.quadraticCurveTo(-L * 0.42, -L * 0.3, 0, -L); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
}
function helo(ctx, x, y, hdg, col, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((hdg || 0) * Math.PI / 180);
  ctx.strokeStyle = col; ctx.fillStyle = 'rgba(90,169,255,0.3)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 15); ctx.stroke();
  const a = reduced ? 0.6 : ((t || 0) * 0.5) % Math.PI; ctx.beginPath(); ctx.moveTo(-11 * Math.cos(a), -11 * Math.sin(a)); ctx.lineTo(11 * Math.cos(a), 11 * Math.sin(a)); ctx.moveTo(-11 * Math.sin(a), 11 * Math.cos(a)); ctx.lineTo(11 * Math.sin(a), -11 * Math.cos(a)); ctx.stroke();
  ctx.restore();
}
function jet(ctx, x, y, hdg, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate((hdg || 0) * Math.PI / 180);
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(9, 7); ctx.lineTo(0, 3); ctx.lineTo(-9, 7); ctx.closePath();
  ctx.fillStyle = 'rgba(154,209,245,0.35)'; ctx.fill(); ctx.strokeStyle = C.sky; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
}
function symHostile(ctx, h, x, y, ghost) {
  ctx.save(); ctx.globalAlpha = ghost ? 0.55 : 1; ctx.setLineDash(ghost ? [3, 3] : []);
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 12); ctx.lineTo(x - 12, y); ctx.closePath();
  ctx.fillStyle = h.str <= 30 ? 'rgba(255,90,95,0.06)' : 'rgba(255,90,95,0.22)'; ctx.fill(); ctx.lineWidth = 1.7; ctx.strokeStyle = C.ho; ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = C.ho; ctx.fillStyle = C.ho; ctx.lineWidth = 1.5;
  if (h.k === 'mg') { ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill(); }
  else if (h.k === 'mortar') { ctx.beginPath(); ctx.arc(x, y + 3, 5, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y - 5); ctx.stroke(); }
  else if (h.k === 'rb') { ctx.fillRect(x - 6, y - 1.5, 12, 3); }
  else { ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); }
  if (h.str <= 30) { ctx.strokeStyle = C.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 13, y + 13); ctx.lineTo(x + 13, y - 13); ctx.stroke(); }
  ctx.restore();
}
function symContact(ctx, c, x, y) {
  if (c.side === 'U') { ctx.fillStyle = 'rgba(244,211,94,0.25)'; ctx.strokeStyle = C.un; ctx.lineWidth = 1.6; for (const [dx, dy] of [[0, -6], [6, 0], [0, 6], [-6, 0]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } label(ctx, '?', x, y - 6, { size: 10, color: C.un }); }
  else { ctx.fillStyle = 'rgba(71,199,138,0.22)'; ctx.strokeStyle = C.ne; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(x - 8, y - 8, 16, 16); ctx.fill(); ctx.stroke(); }
}

/* ---------- วาดทั้งฉาก ---------- */
function draw(ctx, cam, dpr, sc) {
  const s = cam.s; screenTf(ctx, dpr);
  ctx.fillStyle = C.sea; ctx.fillRect(0, 0, cam.w, cam.h);
  worldTf(ctx, cam, dpr); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(64,124,156,0.13)'; ctx.lineWidth = 900; ctx.stroke(P.island); ctx.stroke(P.mainland);
  ctx.strokeStyle = 'rgba(74,140,170,0.14)'; ctx.lineWidth = 380; ctx.stroke(P.island); ctx.stroke(P.mainland);
  ctx.fillStyle = C.land; ctx.fill(P.mainland); ctx.fill(P.island);
  ctx.strokeStyle = C.coast; ctx.lineWidth = 1.6 / s; ctx.stroke(P.mainland); ctx.stroke(P.island);
  ctx.strokeStyle = C.contour; ctx.lineWidth = 1 / s;
  for (const hl of W.hills) for (const r of hl.r) { ctx.beginPath(); ctx.ellipse(hl.x, hl.y, r * 1.15, r * 0.85, 0.3, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(120,104,66,0.9)'; ctx.lineWidth = 140; ctx.beginPath(); ctx.moveTo(10360, 9180); ctx.lineTo(10260, 9700); ctx.lineTo(10350, 10180); ctx.stroke();
  ctx.fillStyle = C.town; for (const b of town) ctx.fillRect(b[0], b[1], b[2], b[3]);
  ctx.strokeStyle = '#3c434d'; ctx.lineWidth = 70; ctx.beginPath(); ctx.moveTo(W.runway[0][0], W.runway[0][1]); ctx.lineTo(W.runway[1][0], W.runway[1][1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,237,245,0.5)'; ctx.lineWidth = 1 / s; ctx.setLineDash([60, 60]); ctx.beginPath(); ctx.moveTo(W.runway[0][0], W.runway[0][1]); ctx.lineTo(W.runway[1][0], W.runway[1][1]); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 45; ctx.beginPath(); ctx.moveTo(W.pier.x, W.pier.y); ctx.lineTo(W.pierW.x, W.pierW.y); ctx.stroke();
  ctx.strokeStyle = C.road; ctx.lineWidth = 1.6 / s;
  W.roads.forEach((r, i) => { ctx.setLineDash(i === 3 ? [8 / s, 6 / s] : []); ctx.beginPath(); r.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); });
  ctx.setLineDash([]);
  screenTf(ctx, dpr);

  /* กริด 1 กม. */
  const step = s * 1000 > 34 ? 1000 : 2000;
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let x = 0; x <= 20000; x += step) { const X = sx(cam, x); if (X < 0 || X > cam.w) continue; ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, cam.h); ctx.stroke(); if (x % 2000 === 0) label(ctx, String(x / 1000).padStart(2, '0'), X + 2, 4, { size: 9, color: C.gridLbl, align: 'left', w: 500 }); }
  for (let y = 0; y <= 20000; y += step) { const Y = sy(cam, y); if (Y < 0 || Y > cam.h) continue; ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(cam.w, Y); ctx.stroke(); if (y % 2000 === 0) label(ctx, String(y / 1000).padStart(2, '0'), 4, Y + 2, { size: 9, color: C.gridLbl, align: 'left', w: 500 }); }

  /* ชื่อสถานที่ */
  const place = (t, x, y, o) => label(ctx, t, sx(cam, x), sy(cam, y), Object.assign({ size: 10, color: 'rgba(205,215,225,0.7)', w: 500 }, o || {}));
  place('หาดเขียว', 9900, 9800, { color: '#d9c58f' }); place('เมือง', 11350, 14300); place('สนามบิน', 14200, 7300); place('ท่าเรือ', 10250, 13350);
  place('ทางแยก ข', 12300, 9350); place('เนิน 120', 11300, 11550); place('เนิน 214', 14400, 12150); place('แผ่นดินใหญ่', 2100, 7400, { size: 12 });
  if (s > 0.075) { place('โรงเรียน', 12650, 12820, { size: 9 }); }

  /* เขตห้ามยิง */
  for (const z of W.nfa) { const X = sx(cam, z.x), Y = sy(cam, z.y), r = z.r * s; ctx.setLineDash([4, 3]); ctx.strokeStyle = C.nfa; ctx.lineWidth = 1.4; ctx.fillStyle = 'rgba(255,90,95,0.07)'; ctx.beginPath(); ctx.arc(X, Y, Math.max(r, 5), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); if (s > 0.075) label(ctx, 'ห้ามยิง: ' + z.nm.replace(' (โรงเรียน)', ''), X, Y + Math.max(r, 5) + 2, { size: 9, color: C.nfa, w: 500 }); }
  /* พื้นที่เรือ / ประตู / IP / ปืนใหญ่ */
  const b = W.box; ctx.setLineDash([6, 4]); ctx.strokeStyle = 'rgba(90,169,255,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(sx(cam, b.x0), sy(cam, b.y1), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s); ctx.setLineDash([]);
  label(ctx, 'พื้นที่ปฏิบัติการเรือ', sx(cam, (b.x0 + b.x1) / 2), sy(cam, b.y0) + 3, { size: 9, color: 'rgba(90,169,255,0.75)', w: 500 });
  if (sc.acm === 'gate') { const X = sx(cam, W.gate.x), Y = sy(cam, W.gate.y); ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(242,177,52,0.4)'; ctx.beginPath(); ctx.arc(X, Y, 2300 * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.amber; ctx.fillRect(X - 4, Y - 4, 8, 8); label(ctx, 'ประตู ก', X, Y + 6, { size: 10, color: C.amber }); }
  { const X = sx(cam, W.ip.x), Y = sy(cam, W.ip.y); ctx.strokeStyle = C.sky; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X, Y - 7); ctx.lineTo(X + 7, Y + 6); ctx.lineTo(X - 7, Y + 6); ctx.closePath(); ctx.stroke(); label(ctx, W.ip.nm, X, Y + 8, { size: 10, color: C.sky }); }

  /* แนวยิง */
  const bty = W.bty;
  for (const f of sc.fires) {
    const X0 = sx(cam, bty.x), Y0 = sy(cam, bty.y), X1 = sx(cam, f.x), Y1 = sy(cam, f.y);
    if (f.st === 'flight') {
      const L = Math.hypot(f.x - bty.x, f.y - bty.y) || 1, ex = f.x + (f.x - bty.x) / L * 1000, ey = f.y + (f.y - bty.y) / L * 1000;
      ctx.strokeStyle = 'rgba(242,140,40,0.16)'; ctx.lineWidth = Math.max(4, 600 * s); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(sx(cam, ex), sy(cam, ey)); ctx.stroke(); ctx.lineCap = 'round';
      ctx.strokeStyle = '#f29a34'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke();
      const pr = Math.max(0, Math.min(1, (sc.t - f.shot) / (f.splash - f.shot))); ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.arc(X0 + (X1 - X0) * pr, Y0 + (Y1 - Y0) * pr, 3, 0, Math.PI * 2); ctx.fill();
    } else if (f.st !== 'done' && f.st !== 'bda') {
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(242,177,52,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X1, Y1); ctx.stroke(); ctx.setLineDash([]);
    }
    if (f.st !== 'done' && f.st !== 'bda') { ctx.strokeStyle = f.err && sc.truth ? C.ho : C.amber; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X1, Y1, 7, 0, Math.PI * 2); ctx.moveTo(X1 - 10, Y1); ctx.lineTo(X1 + 10, Y1); ctx.moveTo(X1, Y1 - 10); ctx.lineTo(X1, Y1 + 10); ctx.stroke(); label(ctx, f.id + (f.st === 'hold' ? ' (ระงับ)' : ''), X1, Y1 + 11, { size: 9, color: C.amber }); }
  }
  /* เส้นทางอากาศยาน + CAS */
  for (const r of sc.routes) { ctx.setLineDash([3, 5]); ctx.strokeStyle = r.color; ctx.lineWidth = 1.2; ctx.beginPath(); r.pts.forEach((p, i) => i ? ctx.lineTo(sx(cam, p[0]), sy(cam, p[1])) : ctx.moveTo(sx(cam, p[0]), sy(cam, p[1]))); ctx.stroke(); ctx.setLineDash([]); }
  if (sc.cas) { ctx.setLineDash([8, 4]); ctx.strokeStyle = C.sky; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx(cam, sc.cas.x0), sy(cam, sc.cas.y0)); ctx.lineTo(sx(cam, sc.cas.x1), sy(cam, sc.cas.y1)); ctx.stroke(); ctx.setLineDash([]); }

  /* เอฟเฟกต์กระสุนตก */
  for (const f of sc.fx) {
    const age = sc.t - f.t; if (age < 0 || age > 25) continue; const X = sx(cam, f.x), Y = sy(cam, f.y);
    const k = age / 25; ctx.strokeStyle = f.k === 'cas' ? `rgba(154,209,245,${1 - k})` : `rgba(255,170,60,${1 - k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, 5 + (reduced ? 8 : 26 * k), 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = `rgba(255,120,40,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill();
  }

  /* พลเรือน */
  const civ = sc.civ;
  if (civ) {
    const badge = (t, x, y, col) => { const X = sx(cam, x), Y = sy(cam, y); ctx.font = `700 11px ${FONT}`; const w = ctx.measureText(t).width + 12; ctx.fillStyle = 'rgba(8,24,18,0.85)'; ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X - w / 2, Y - 9, w, 18, 9) : ctx.rect(X - w / 2, Y - 9, w, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, X, Y + 0.5); };
    if (civ.town > 0) badge('พลเรือนในเมือง ' + civ.town, W.town.x + 1150, W.town.y + 950, C.ne);
    if (civ.epOpen) badge('จุดอพยพ ' + civ.ep, W.ep.x + 1150, W.ep.y - 150, C.ne);
    if (civ.rb > 0 && civ.rbSeen) for (const d of [-90, 70]) { const X = sx(cam, W.rb.x + d), Y = sy(cam, W.rb.y - 160); ctx.fillStyle = 'rgba(71,199,138,0.3)'; ctx.strokeStyle = C.ne; ctx.lineWidth = 1.3; ctx.fillRect(X - 5, Y - 4, 10, 8); ctx.strokeRect(X - 5, Y - 4, 10, 8); }
  }

  /* ข้าศึก */
  for (const h of sc.hostiles) {
    if (h.ghost) { const X = sx(cam, h.tx), Y = sy(cam, h.ty); symHostile(ctx, h, X, Y, true); if (h.x != null && Math.hypot(h.tx - h.x, h.ty - h.y) > 40) { ctx.strokeStyle = 'rgba(255,90,95,0.4)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(sx(cam, h.x), sy(cam, h.y)); ctx.stroke(); ctx.setLineDash([]); } }
    if (h.x == null) continue;
    const X = sx(cam, h.x), Y = sy(cam, h.y); symHostile(ctx, h, X, Y, false);
    if (s > 0.022) label(ctx, h.label, X, Y + 14, { size: 10, color: '#ffb3b5' });
  }
  for (const c of sc.contacts) { const X = sx(cam, c.x), Y = sy(cam, c.y); symContact(ctx, c, X, Y); label(ctx, c.side === 'U' ? 'ไม่ทราบฝ่าย' : c.nm, X, Y + 13, { size: 10, color: c.side === 'U' ? C.un : C.ne }); }

  /* ฝ่ายเรา */
  for (const u of sc.units) {
    if (u.ghost) { const X = sx(cam, u.ghost.x), Y = sy(cam, u.ghost.y); ctx.save(); ctx.globalAlpha = 0.45; symFriendly(ctx, Object.assign({}, u, { age: 999 }), X, Y); ctx.restore(); ctx.strokeStyle = 'rgba(90,169,255,0.45)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(sx(cam, u.x), sy(cam, u.y)); ctx.stroke(); ctx.setLineDash([]); }
  }
  for (const u of sc.units) {
    const X = sx(cam, u.x), Y = sy(cam, u.y);
    if (u.sel || u.mine) { ctx.strokeStyle = u.mine ? C.amber : C.text; ctx.lineWidth = 1.5; ctx.setLineDash(u.mine ? [] : [3, 3]); ctx.beginPath(); ctx.arc(X, Y, 19, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    symFriendly(ctx, u, X, Y);
    const tag = u.cs + (u.age > 660 ? ` ⌛${Math.round(u.age / 60)}′` : '') + (u.pax ? ` · ${u.pax} คน` : '');
    if (s > 0.02 || u.mine || u.sel) label(ctx, tag, X, Y + (u.k === 'inf' && u.hqu ? 20 : 13), { size: 10, color: u.mine ? '#ffd27a' : '#cfe4ff' });
  }

  /* กลางคืน/พายุ */
  const night = Math.max(0, (1 - sc.light) * 1.3);
  if (night > 0.01) { ctx.fillStyle = `rgba(3,6,14,${Math.min(0.5, night)})`; ctx.fillRect(0, 0, cam.w, cam.h); }
  if (sc.storm > 0.05) {
    ctx.fillStyle = `rgba(40,52,70,${0.28 * sc.storm})`; ctx.fillRect(0, 0, cam.w, cam.h);
    if (!reduced) { ctx.strokeStyle = `rgba(180,200,220,${0.18 * sc.storm})`; ctx.lineWidth = 1; ctx.beginPath(); const n = Math.floor(90 * sc.storm), o = (sc.t * 37) % 40; for (let i = 0; i < n; i++) { const x = (i * 97.3 + o * 3) % cam.w, y = (i * 53.1 + o * 7) % cam.h; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); } ctx.stroke(); }
  }
  /* มาตราส่วน + ทิศเหนือ */
  const km = s * 1000, bx = 14, by = cam.h - 18; ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + km * 2, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + km * 2, by - 4); ctx.lineTo(bx + km * 2, by + 4); ctx.stroke();
  label(ctx, '2 กม.', bx + km, by - 16, { size: 10, w: 500 });
  label(ctx, 'N', cam.w - 18, 8, { size: 11 }); ctx.fillStyle = C.text; ctx.beginPath(); ctx.moveTo(cam.w - 18, 22); ctx.lineTo(cam.w - 13, 34); ctx.lineTo(cam.w - 23, 34); ctx.closePath(); ctx.fill();
}

function hit(cam, sc, px, py) {
  let best = null, bd = 22;
  const test = (o, x, y, kind) => { const d = Math.hypot(sx(cam, x) - px, sy(cam, y) - py); if (d < bd) { bd = d; best = { kind, o }; } };
  for (const u of sc.units) test(u, u.x, u.y, 'u');
  for (const h of sc.hostiles) if (h.x != null) test(h, h.x, h.y, 'h');
  for (const c of sc.contacts) test(c, c.x, c.y, 'c');
  return best;
}

root.R = { draw, fit, toWorld, sx, sy, hit, C };
})(typeof window !== 'undefined' ? window : globalThis);
