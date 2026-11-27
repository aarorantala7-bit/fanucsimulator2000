"""Headless browser check (needs python playwright + Chrome).
Usage: python3 tests/headless_check.py [base_url] [shots_dir]
Serve the repo first, e.g. python3 -m http.server 8812 (base_url default http://localhost:8812/index.html)."""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/index.html'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else 'shots'
os.makedirs(SHOTS, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.goto(URL); pg.wait_for_timeout(1200)
    snap = lambda: pg.evaluate('machineModeSnapshot()')
    s = snap(); check(all(s[k] in ('mill', 'tooldialog', 'stockdialog') for k in ('mode', 'body', 'selector', 'view', 'panel', 'library', 'tools', 'toolDialog', 'stockDialog')) and set(s['demos']) == {'mill'}, 'default mode is Milling everywhere ' + json.dumps(s))
    def run_demo(i, secs=1.5):
        pg.evaluate(f"loadDemo('{i}')"); pg.wait_for_timeout(600)
        diag = pg.evaluate("document.getElementById('diagnostics').textContent")
        check(not any(w in diag.lower() for w in ('error', 'alarm', 'unsupported', 'not found')), f'demo {i} loads cleanly')
        pg.click('#play'); pg.wait_for_timeout(int(secs * 1000)); pg.screenshot(path=f'{SHOTS}/demo_{i}.png')
        pg.evaluate("document.getElementById('reset').click()")
    for d in pg.evaluate("SimDemos.forMachine('mill').map(d=>d.id)"): run_demo(d)
    # Aaro's WinCAM program in mill mode
    wincam = open(os.path.join(HERE, 'fixtures', 'wincam-sample.cnc'), encoding='latin-1').read()
    pg.evaluate("(t)=>{setSimMode('mill');const s=document.getElementById('source');s.value=t;document.getElementById('load').click();}", wincam); pg.wait_for_timeout(800)
    diag = pg.evaluate("document.getElementById('diagnostics').textContent")
    check('M46' in diag and 'error' not in diag.lower(), 'WinCAM sample loads (M46/M50 noted, no error)')
    pg.click('#play'); pg.wait_for_timeout(2500); pg.screenshot(path=f'{SHOTS}/wincam_mill.png'); pg.evaluate("document.getElementById('reset').click()")
    # single dropdown switches all five
    pg.select_option('#machinemode', 'lathe'); pg.wait_for_timeout(700)
    s = snap(); check(all(s[k] in ('lathe', 'lathetooldialog', 'lathestockdialog') for k in ('mode', 'body', 'selector', 'view', 'panel', 'library', 'tools', 'toolDialog', 'stockDialog')) and set(s['demos']) == {'lathe'}, 'Turning switches simulator, panel, tools, stock and library ' + json.dumps(s))
    pg.evaluate("document.getElementById('toolsetup').click()"); pg.wait_for_timeout(300)
    check(pg.evaluate("document.getElementById('lathetooldialog').open && !document.getElementById('tooldialog').open"), 'Setup > Tool library opens the lathe tool table'); pg.screenshot(path=f'{SHOTS}/lathe_tools.png')
    pg.evaluate("document.getElementById('lathetooldialog').close()")
    pg.evaluate("document.getElementById('stocksetup').click()"); pg.wait_for_timeout(200)
    check(pg.evaluate("document.getElementById('lathestockdialog').open"), 'Setup > Stock opens the bar/tube dialog'); pg.evaluate("document.getElementById('lathestockdialog').close()")
    pg.reload(); pg.wait_for_timeout(1200); check(snap()['mode'] == 'lathe', 'machine choice persists across reload')
    for d in pg.evaluate("SimDemos.forMachine('lathe').map(d=>d.id)"): run_demo(d, 2.5)
    # code library in both modes
    lib = lambda: pg.evaluate("(()=>{document.getElementById('codelibrary').click();const t=document.getElementById('codedialog').innerText;const r={machine:document.getElementById('ref-machine').value,codes:CodeLibrary.visible(),text:t};return r})()")
    r = lib(); check(r['machine'] == 'lathe' and 'G71' in r['codes'] and 'G81' not in r['codes'], 'library defaults to Turning and hides mill-only codes')
    pg.fill('#ref-query', 'G76'); pg.wait_for_timeout(200)
    t = pg.evaluate("document.getElementById('ref-details').innerText")
    check('G76 P020060 Q100 R0.05' in t and 'thread' in t.lower(), 'lathe G76 = threading with real example'); pg.screenshot(path=f'{SHOTS}/library_turning.png')
    pg.select_option('#ref-machine', 'mill'); pg.wait_for_timeout(200)
    t = pg.evaluate("document.getElementById('ref-details').innerText")
    check('G76 X50.0 Y30.0 Z-20.0 R2.0 Q0.1 P500 F80' in t and 'boring' in t.lower(), 'mill G76 = fine boring with real example'); pg.screenshot(path=f'{SHOTS}/library_milling.png')
    allText = pg.evaluate("CodeLibraryData.LIB.map(e=>e.ex.join(' ')).join(' ')+document.getElementById('codedialog').innerText")
    check('<value>' not in allText and 'placeholder' not in allText.lower(), 'no <value> placeholders or disclaimers')
    pg.evaluate("document.getElementById('codedialog').close()")
    # CNC panel EDIT keys (lathe panel)
    pg.evaluate("document.getElementById('editor-cnc').click()")
    key = lambda k: pg.evaluate(f"(()=>{{const b=[...document.querySelectorAll('#editor-keypad button')].find(b=>b.getAttribute('aria-label')==={json.dumps(k)});b.click();}})()")
    def keys(s):
        for ch in s: key(ch)
    setsrc = lambda t, at: pg.evaluate(f"(()=>{{const s=document.getElementById('source');s.value={json.dumps(t)};s.focus();s.setSelectionRange({at},{at});}})()")
    src = lambda: pg.evaluate("document.getElementById('source').value")
    buf = lambda: pg.evaluate("document.getElementById('keypad-buffer').value")
    pg.evaluate("CncPanel.setMode('MEM')"); setsrc('G1 X10. Z5.', 3); keys('W3.'); key('INSERT')
    check(src() == 'G1 X10. Z5.', 'INSERT is refused outside EDIT mode'); key('CAN'); key('CAN'); key('CAN')
    pg.evaluate("CncPanel.setMode('EDIT')"); setsrc('G1 X10. Z5.', 3); keys('W3.'); key('INSERT')
    check(src() == 'G1 X10. W3. Z5.', 'INSERT puts the key-in after the word at the cursor -> ' + repr(src()))
    setsrc(src(), 3); keys('X20.'); key('ALTER'); check(src() == 'G1 X20. W3. Z5.', 'ALTER replaces the word at the cursor -> ' + repr(src()))
    setsrc(src(), 8); key('DELETE'); check(src() == 'G1 X20. Z5.', 'DELETE removes the word at the cursor -> ' + repr(src()))
    keys('X12'); key('CAN'); check(buf() == 'X1', 'CAN backspaces the key-in buffer -> ' + repr(buf())); key('CAN'); key('CAN')
    end = len(src()); setsrc(src(), end - 1); keys('F.2'); key('EOB'); key('INSERT')
    check(src().startswith('G1 X20. Z5. F.2;\n'), 'EOB + INSERT ends the block with ";" -> ' + repr(src()))
    # O-number search / directory
    setsrc('O1234 (TEST)\nG0 X50. Z2.\nM30\n', 0); pg.evaluate("[...document.querySelectorAll('.cnc-softkeys button')].find(b=>b.dataset.soft==='SAVE').click()")
    setsrc('O5555\nM30\n', 0); keys('O1234'); key('↓'); pg.wait_for_timeout(300)
    check(src().startswith('O1234'), 'O-number search loads the program from memory')
    for scr, sub, name in (('POS', 'ALL', 'pos'), ('OFS/SET', 'GEOM', 'offset_geom'), ('OFS/SET', 'SHIFT', 'work_shift'), ('SYSTEM', 'PARAM', 'param')):
        pg.evaluate(f"document.querySelector('[data-fkey=\"{scr}\"]').click()"); pg.evaluate(f"document.querySelector('[data-soft=\"{sub}\"]').click()"); pg.wait_for_timeout(150)
        pg.screenshot(path=f'{SHOTS}/panel_lathe_{name}.png')
    t = pg.evaluate("document.querySelector('.cnc-screen').innerText"); check('1420' in t, 'SYSTEM shows the parameter table')
    pg.evaluate("document.querySelector('[data-fkey=\"POS\"]').click()")
    check('X' in pg.evaluate("document.getElementById('cnc-axes').innerText") and 'Y' not in pg.evaluate("document.getElementById('cnc-axes').innerText"), 'lathe panel jogs X/Z only')
    pg.select_option('#machinemode', 'mill'); pg.wait_for_timeout(600)
    check('Y' in pg.evaluate("document.getElementById('cnc-axes').innerText"), 'mill panel jogs X/Y/Z')
    pg.evaluate("document.querySelector('[data-fkey=\"OFS/SET\"]').click()"); pg.evaluate("document.querySelector('[data-soft=\"OFFSET\"]').click()"); pg.wait_for_timeout(150)
    check('H GEOM' in pg.evaluate("document.querySelector('.cnc-screen').innerText"), 'mill offset screen shows H/D geometry and wear'); pg.screenshot(path=f'{SHOTS}/panel_mill_offset.png')
    check(not errs, 'no console errors ' + json.dumps(errs[:5]))
    b.close()
print(json.dumps({'failed': fails}))
sys.exit(1 if fails else 0)
