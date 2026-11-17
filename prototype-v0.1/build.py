"""รวมไฟล์ใน src/ เป็นหน้าเดียว dist/index.html"""
import pathlib, re
root = pathlib.Path(__file__).parent
src = root / 'src'
def read(n): return (src / n).read_text(encoding='utf-8')
def js(n):
    t = read(n)
    assert '</script' not in t.lower(), n
    return t
html = read('shell.html')
for marker, content in [('/*CSS*/', read('style.css')), ('/*SIM*/', js('sim.js')), ('/*RENDER*/', js('render.js')), ('/*UI*/', js('ui.js'))]:
    assert html.count(marker) == 1, marker
    html = html.replace(marker, content)
assert html.startswith('<!DOCTYPE html>')
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'index.html').write_text(html, encoding='utf-8')
print('dist/index.html', round(len(html.encode('utf-8')) / 1024), 'KB')
