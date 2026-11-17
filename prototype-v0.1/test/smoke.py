# Playwright smoke test: one scripted session, collects console/page errors + a few screenshots
import os, sys, time, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
url = (root / 'dist' / 'index.html').as_uri()
shots = root / 'test' / 'shots'
shots.mkdir(exist_ok=True)
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')
errors = []
def hook(page, tag):
    page.on('console', lambda m: errors.append(f'[{tag}] console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
    # ---- desktop: FSCC seat, decisions, AAR
    pg = b.new_page(viewport={'width': 1366, 'height': 860}); hook(pg, 'desk')
    pg.route('**/fonts.googleapis.com/**', lambda r: r.abort()); pg.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    pg.goto(url); pg.wait_for_timeout(400)
    pg.screenshot(path=str(shots / '1_intro.png'))
    pg.click('[data-act="go-lobby"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="pick"][data-seat="fscc"]'); pg.click('[data-act="quiz"][data-i="0"]')
    pg.click('[data-act="start"][data-seat="fscc"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="speed"][data-v="40"]')
    answered = 0; t0 = time.time()
    while time.time() - t0 < 14:
        if pg.is_visible('#sheet') and pg.locator('#sheet .sh-opt').count():
            if answered == 1: pg.screenshot(path=str(shots / '2_sheet.png'))
            pg.locator('#sheet .sh-opt').first.click(); answered += 1
        pg.wait_for_timeout(250)
    clock = pg.inner_text('#clk')
    pg.click('[data-tab="ctl"]'); pg.wait_for_timeout(600)
    pg.screenshot(path=str(shots / '3_game_fscc.png'))
    pg.click('[data-act="end"]'); pg.click('[data-act="end-yes"]'); pg.wait_for_timeout(800)
    pg.screenshot(path=str(shots / '4_aar.png'), full_page=False)
    print('desktop: clock at end', clock, 'answered', answered)
    # ---- mobile: helo seat, practice mini-game, assumptions page
    mp = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); hook(mp, 'mob')
    mp.route('**/fonts.googleapis.com/**', lambda r: r.abort()); mp.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    mp.goto(url); mp.wait_for_timeout(300)
    mp.click('[data-act="go-lobby"]'); mp.click('[data-act="pick"][data-seat="helo"]'); mp.click('[data-act="skipquiz"]')
    mp.click('[data-act="start"][data-seat="helo"]'); mp.wait_for_timeout(300)
    mp.click('[data-act="speed"][data-v="20"]'); mp.wait_for_timeout(3000)
    mp.screenshot(path=str(shots / '5_mobile_game.png'))
    mp.click('[data-tab="ctl"]'); mp.wait_for_timeout(300)
    mp.click('[data-act="practice"]'); mp.wait_for_timeout(300)
    dn = mp.locator('#mgDown'); box = dn.bounding_box()
    mp.mouse.move(box['x'] + 20, box['y'] + 10); mp.mouse.down(); mp.wait_for_timeout(2500)
    mp.screenshot(path=str(shots / '6_mobile_mg.png')); mp.mouse.up(); mp.wait_for_timeout(5000)
    mg_open = mp.is_visible('#mg')
    mp.goto(url); mp.wait_for_timeout(200); mp.click('[data-act="go-assume"]'); mp.wait_for_timeout(200)
    mp.screenshot(path=str(shots / '7_mobile_assume.png'))
    print('mobile: mg still open after landing?', mg_open)
    b.close()
print('ERRORS:' if errors else 'no console errors'); [print(' ', e) for e in errors[:30]]
