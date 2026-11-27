"""Headless check of File > Import from photo / WinCAM import + export (needs Playwright + Chromium).
Serve the repo first, e.g. python3 -m http.server 8812 (base_url default http://localhost:8812/index.html).
A FANUC-like program screen (dark background, green text, line numbers, status rows) is drawn on a canvas,
saved as PNG and fed to the photo dialog; OCR runs with the vendored Tesseract.js."""
import sys, os, base64, tempfile
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8812/index.html'
shots = os.environ.get('SHOTS', '')
here = os.path.dirname(os.path.abspath(__file__))
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def file_menu(pg):
    pg.evaluate("document.querySelector('#open').closest('details').open=true")

PAGES = [
    ['O0003 N00000', '%', 'O0003(BLOKI)', 'T3M6', 'G54', 'G90G0Y100', 'G43Z200H3', 'M1'],
    ['O0003 N00000', 'G43Z200H3', 'M1', 'G0X-430Y-15', 'S800M3', 'G1X430F1100', 'M30'],
]
DRAW = """(lines)=>{const c=document.createElement('canvas');c.width=1100;c.height=560;const g=c.getContext('2d');
 g.fillStyle='#050805';g.fillRect(0,0,c.width,c.height);g.font='bold 30px monospace';g.fillStyle='#4cff5c';
 g.fillText('PROGRAM        '+lines[0],30,46);g.fillRect(30,60,1040,2);
 lines.slice(1).forEach((l,i)=>{g.fillText(String(i+1).padStart(4,'0')+'  '+l+' ;',30,110+i*46);});
 g.fillText('EDIT **** *** ***    12:04:31',30,520);return c.toDataURL('image/png');}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1300, 'height': 900}, accept_downloads=True)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base); pg.wait_for_timeout(800)
    check(pg.locator('#photoimport').count() == 1 and pg.locator('#wincamimport').count() == 1 and pg.locator('#wincamexport').count() == 1, 'File menu has the import/export items')
    check(pg.evaluate("typeof Tesseract") == 'undefined', 'Tesseract is not loaded on page load (lazy)')
    tmp = tempfile.mkdtemp()
    files = []
    for i, lines in enumerate(PAGES):
        url = pg.evaluate(DRAW, lines)
        path = os.path.join(tmp, f'page{i+1}.png'); open(path, 'wb').write(base64.b64decode(url.split(',', 1)[1])); files.append(path)
    pg.evaluate("setSimMode('mill')"); pg.wait_for_timeout(300)
    pg.evaluate("$('source').value='%\\nO0003(BLOKI)\\n%';$('source').dispatchEvent(new Event('input'))")
    file_menu(pg); pg.click('#photoimport')
    # pick in reverse order, then reorder with the ↑ button
    pg.set_input_files('#photofiles', [files[1], files[0]])
    check(pg.locator('#photolist li').count() == 2, 'two pages listed')
    pg.locator('#photolist li').nth(1).locator('button[title="Move up"]').click()
    check('page1.png' in pg.locator('#photolist li').nth(0).inner_text(), 'pages reorder')
    pg.click('#photoocr')
    pg.wait_for_function("/Done:|failed/.test(document.getElementById('photostatus').textContent)", timeout=120000)
    status = pg.inner_text('#photostatus'); prev = pg.input_value('#photopreview')
    print('status:', status); print(prev)
    check('Done' in status, 'OCR finished')
    lines = prev.split('\n')
    for want in ['T3M6', 'G90G0Y100', 'G43Z200H3', 'G0X-430Y-15', 'G1X430F1100', 'M30']:
        check(want in lines, f'preview has {want}')
    check(lines.count('G43Z200H3') == 1 and lines.count('M1') == 1, 'overlapping lines between pages removed once')
    check(not any('PROGRAM' in l or 'EDIT' in l or '12:04' in l for l in lines), 'screen clutter stripped')
    if shots: pg.screenshot(path=os.path.join(shots, 'photo-dialog.png'))
    pg.click('#photoappend')
    src = pg.input_value('#source')
    check(src.startswith('%\nO0003(BLOKI)\n') and src.rstrip().endswith('%') and 'G1X430F1100' in src, 'appended before the closing %')
    # WinCAM import → tool list note → export byte-identical
    fx = os.path.join(here, 'fixtures', 'wincam-sample.cnc')
    pg.set_input_files('#wincamfile', fx); pg.wait_for_timeout(800)
    note = pg.inner_text('#importnote') if pg.locator('#importnote').count() else ''
    print('note:', note)
    check('T2' in note and 'H2 D2' in note and 'line 73' in note and 'defaults' in note, 'tool note lists T/H/D/first call and default geometry')
    pg.evaluate("$('tooldialog').showModal()")
    check('in program: H3 · first line 5' in pg.inner_text('#tools'), 'tool table shows program usage')
    if shots: pg.screenshot(path=os.path.join(shots, 'wincam-tools.png'))
    pg.evaluate("$('tooldialog').close()")
    with pg.expect_download() as dl:
        file_menu(pg); pg.click('#wincamexport')
    d = dl.value
    check(d.suggested_filename == 'O0003.cnc', 'export file name from O number')
    check(open(d.path(), 'rb').read() == open(fx, 'rb').read(), 'export is byte-identical to the imported WinCAM file')
    # lathe: Txxyy + names from comments
    pg.evaluate("setSimMode('lathe')"); pg.wait_for_timeout(300)
    lp = os.path.join(tmp, 'lathe.cnc'); open(lp, 'wb').write(b'%\r\nO0100(HOLKKI)\r\nN10 G28 U0 W0\r\nN20 T0101 (CNMG 120408)\r\nG96 S200 M3\r\nN30 T0303(VNMG R0.4)\r\nM30\r\n%\r\n')
    pg.set_input_files('#wincamfile', lp); pg.wait_for_timeout(800)
    names = pg.evaluate("[MachineState.lathe.tools.find(t=>t.id===1).name,MachineState.lathe.tools.find(t=>t.id===3).name]")
    check(names == ['CNMG 120408', 'VNMG R0.4'], 'lathe tool names from comments')
    check(not errs, 'no page errors ' + '; '.join(errs))
    b.close()
print('FAILED: %d' % len(fails) if fails else 'ALL PASS')
sys.exit(1 if fails else 0)
