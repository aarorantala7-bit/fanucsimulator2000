"""Headless check of G31 skip in the browser (needs Playwright + Chrome). Serve the repo first, e.g. python3 -m http.server 8812.
Usage: python3 tests/headless_g31.py [base_url] ; SHOTS=dir saves screenshots."""
import json, os, sys
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8812/index.html'; SH=os.environ.get('SHOTS','')
MILL="%\nO0031(G31 EDGE)\nG21G17G40G49G80G90G54\nT2M6\nG0X-20.Y0S3000M3\nG43Z25.H2M8\nG0Z5.\nG1Z-2.F300\nX20.\nG0Z25.\nT12M6\nG0X0Y0\nG43Z25.H12\nG65P9160X-70.Y0Z-5.D1.Q25.T6.R10.F300.\nG0Z25.\nG0X0Y0\nG31Z-20.F200\n#150=#5063\nG0Z25.\nM30\nO9160\nG0X#24Y#25\nG0Z#18\nG31Z#26F[#9*3]\nG31X[#24+#7*#17]F#9\n#27=#5061\n#140=#27+#7*#20/2\n#141=#24\nG0X#24\nG0Z#18\nM99\n%\n"
LATHE="%\nO0032(G31 FACE)\nG21G18G40G99\nT0101\nG97S500M3\nG0X60.Z10.\nG98\nG0X20.Z5.\nG31Z-1.F100\n#142=#5062\nG0Z5.\nG0X60.Z-10.\nG31X30.\n#143=#5061\nG0X60.\nG99\nG0X120.Z50.\nM30\n%\n"
fails=[]
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: fails.append(m)
def shot(pg,name):
    if SH: pg.screenshot(path=os.path.join(SH,name))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROME','/usr/bin/google-chrome'),args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1400,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.goto(URL); pg.wait_for_timeout(900)
    pg.evaluate("setSimMode('mill')"); pg.wait_for_timeout(300)
    # manual stock 100 x 80 x 30, X0 Y0 at the centre, Z0 on top
    pg.evaluate("$('stocksetup').click()"); pg.wait_for_timeout(150)
    pg.select_option('#zeromode','center'); pg.dispatch_event('#zeromode','input')
    for k,v in (('stockx',100),('stocky',80),('stockz',30),('zeroz',0)): pg.fill('#'+k,str(v))
    pg.click('#stockapply'); pg.wait_for_timeout(500)
    pg.evaluate("t=>{$('source').value=t;$('load').click();}",MILL); pg.wait_for_timeout(1200)
    c=pg.evaluate("[140,141,150].map(k=>MachineState.common.get(k))"); st=pg.evaluate("[stock.x0,stock.x1,stock.top]")
    check(st==[-50,50,0],f'mill stock as set ({st})')
    check(c[0]==-50 and c[1]==-70,f'mill edge probe: #140 = edge X-50 from #5061 ({c})')
    check(abs(c[2]+2)<0.02,f'mill Z probe on the slot floor: #5063 = -2 ({c[2]})')
    d=pg.inner_text('#diagnostics'); check('G31 skip: contact at X-53.000' in d,'diagnostics list the contact')
    # step block by block to the G31 X block: the step ends at the contact and the HUD says so
    k=pg.evaluate("samples.findIndex(b=>segs[b.i].skip&&segs[b.i].a.z<0&&segs[b.i].b.x!==segs[b.i].a.x)")
    pg.evaluate(f"$('seek').value={k+1};$('seek').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    hud=pg.inner_text('#hud'); ctr=pg.inner_text('#counter')
    check('X -53.00' in hud and 'G31 SKIP · CONTACT' in hud,f'HUD at the G31 block shows the stop at X-53 and the contact ({hud!r})')
    check(ctr.startswith(f'{k+1} /'),f'block counter at the G31 block ({ctr})')
    shot(pg,'desktop-mill-g31-contact.png')
    pg.evaluate("$('seek').value=$('seek').max;$('seek').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
    h=pg.evaluate("(()=>{const s=stock,i=Math.floor((-48-s.x0)/s.dx),j=Math.floor((0-s.y0)/s.dy);return s.h[j*s.nx+i]})()"); check(h==0,f'probe did not cut the blank edge (h {h})')
    # moved G54: same measured values
    pg.evaluate("$('stocksetup').click()"); pg.wait_for_timeout(150); pg.fill('#g54x','-250'); pg.fill('#g54z','-320'); pg.click('#stockapply'); pg.wait_for_timeout(1200)
    c2=pg.evaluate("[140,141,150].map(k=>MachineState.common.get(k))"); check(c2==c,f'same values with G54 X-250 Z-320 ({c2})')
    # lathe
    pg.evaluate("setSimMode('lathe')"); pg.wait_for_timeout(400)
    pg.evaluate("LatheView.openStock()"); pg.wait_for_timeout(150); pg.select_option('#lst-zero','front'); pg.dispatch_event('#lst-zero','input')
    for k,v in (('lst-od',50),('lst-length',80)): 
        if pg.locator('#'+k).count(): pg.fill('#'+k,str(v))
    pg.click('#lst-apply'); pg.wait_for_timeout(500)
    pg.evaluate("t=>{$('source').value=t;$('load').click();}",LATHE); pg.wait_for_timeout(1200)
    ls=pg.evaluate("({...MachineState.lathe.stock})"); lc=pg.evaluate("[142,143].map(k=>MachineState.common.get(k))"); err=pg.evaluate("LatheView.res.error")
    print('   lathe stock',ls)
    check(not err and abs(lc[0]-ls['face'])<0.004 and abs(lc[1]-ls['od'])<0.005,f'lathe: face Z {lc[0]} vs stock face {ls["face"]}, OD X {lc[1]} vs {ls["od"]}')
    k=pg.evaluate("LatheView.res.segs.findIndex(s=>s.skip)")
    pg.evaluate("()=>{const r=LatheView.res,i=r.segs.findIndex(s=>s.skip);const bl=SimRuntime.makeBlocks(r.segs);const n=bl.findIndex(b=>b.i>=i);$('seek').value=n+1;$('seek').dispatchEvent(new Event('input'))}"); pg.wait_for_timeout(300)
    hud=pg.inner_text('#hud'); check('G31 SKIP · CONTACT' in hud,f'lathe HUD shows the contact ({hud[:120]!r})')
    shot(pg,'desktop-lathe-g31-contact.png')
    check(not errs,f'no page errors {errs[:2]}')
    b.close()
print(json.dumps({'failed':fails}))
sys.exit(1 if fails else 0)
