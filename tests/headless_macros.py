"""Headless check of the Macros menu (needs Playwright + Chrome). Serve the repo first, e.g. python3 -m http.server 8812.
Usage: python3 tests/headless_macros.py [base_url] ; SHOTS=dir saves screenshots."""
import json, os, sys, tempfile
from playwright.sync_api import sync_playwright
SH=os.environ.get('SHOTS',''); URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8812/index.html'; TMP=tempfile.mkdtemp()
MILL="%\nO0001(HOST)\nG21G17G40G49G80G90G54\nT7M6\nG0X0Y0S1800M3\nG43Z25.H7M8\nG0Z25.\nG91G28Z0M5\nG90\nM30\n%\n"
LATHE="%\nO0001(HOST)\nG21G18G40G99\nG50S2000\nT0101\nG96S200M3\nG0X60.Z5.M8\nG0X120.Z50.M9\nG28U0W0M5\nM30\n%\n"
fails=[]
def shot(pg,path):
    if SH: pg.screenshot(path=path)
def check(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: fails.append(m)
RECTS="(()=>['mac-list','mac-desc','mac-setup','mac-params','mac-preview','mac-msg','mac-insert','mac-close'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]}).concat([[ 'dlg',...(()=>{const r=document.getElementById('macrodlg').getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})()]]))()"
def setprog(pg,text,before):
    pg.evaluate("([t,b])=>{const s=$('source');s.value=t;s.dispatchEvent(new Event('input',{bubbles:true}));const i=t.indexOf(b);s.focus();s.setSelectionRange(i,i);}",[text,before])
def openmenu(pg):
    pg.click('summary:has-text("Macros")'); pg.click('#macro-open'); pg.wait_for_timeout(200)
def diag(pg): return pg.evaluate("$('diagnostics').textContent")
def settle(pg): pg.wait_for_timeout(1300)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for W,H,tag in ((1400,900,'desktop'),(412,915,'phone')):
        pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=1 if W>500 else 2); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.goto(URL); pg.wait_for_timeout(1000)
        pg.evaluate("setSimMode('mill')"); pg.wait_for_timeout(300)
        # --- mill, text editor
        setprog(pg,MILL,"G0Z25.\nG91"); pg.evaluate("$('load').click()"); settle(pg); base=pg.evaluate("segs.length")
        openmenu(pg)
        opts=pg.evaluate("[...$('mac-list').options].map(o=>o.value)"); check(opts[:6]==['bolt-circle','rect-pocket','circ-pocket','facing','peck-drill','probe-edge'] and 'lathe-rough' not in opts,f'{tag}: mill list is filtered ({opts})')
        rects={}
        for id in opts:
            pg.select_option('#mac-list',id); pg.wait_for_timeout(60); rects[id]=pg.evaluate(RECTS)
        r0=rects[opts[0]]; stable=all(v==r0 for v in rects.values())
        check(stable,f'{tag} {W}px: dialog layout identical for every mill template'+('' if stable else ' '+str([ (k,[a for a,c in zip(v,r0) if a!=c]) for k,v in rects.items() if v!=r0][:2])))
        sc=pg.evaluate("(()=>{const d=$('macrodlg');return [d.scrollHeight,d.clientHeight]})()"); print('   scroll',sc); check(r0[-1][3]<=W and pg.evaluate("(()=>{const d=$('macrodlg');return d.scrollHeight<=d.clientHeight})()"),f'{tag}: dialog fits the width ({r0[-1]})')
        pg.check('input[name=mac-mode][value=inline]'); pg.wait_for_timeout(60); ri=pg.evaluate(RECTS); check(ri==r0,f'{tag}: switching to inline does not move the layout')
        pg.check('input[name=mac-mode][value=g65]')
        pg.select_option('#mac-list','bolt-circle'); pg.fill('#mac-params input[data-k=D]','80'); pg.fill('#mac-params input[data-k=H]','8')
        if tag=='desktop': shot(pg,f'{SH}/desktop-macro-dialog-mill.png')
        else: shot(pg,f'{SH}/phone-macro-dialog-mill.png')
        pg.click('#mac-insert'); pg.wait_for_timeout(600)
        src=pg.evaluate("$('source').value"); i=src.find('G65P9110'); check(i>0 and src.find('G43Z25.H7M8')<i<src.find('G0Z25.\nG91') and 'D80.' in src[i:i+80] and src.rstrip().endswith('M99\n%') and src.find('O9110')>src.find('M30'),f'{tag}: G65 call at the cursor, O9110 appended before %')
        check(not pg.evaluate("$('macrodlg').open"),f'{tag}: dialog closes after insert')
        settle(pg); n=pg.evaluate("segs.length"); d=diag(pg); check(n>base and 'ALARM' not in d.upper(),f'{tag}: program re-runs with the macro ({base} -> {n} segments; {d[:80]!r})')
        holes=pg.evaluate("segs.filter(s=>s.cycle&&/G8[13]/.test(s.cycle)&&s.b.z<-11).length"); print('   hole feed segs',holes)
        # second insert: inline pocket + clash avoidance
        setprog(pg,pg.evaluate("$('source').value"),"G0Z25.\nG91"); openmenu(pg)
        pg.select_option('#mac-list','bolt-circle'); o=pg.input_value('#mac-o'); check(o=='9111',f'{tag}: next free O number offered ({o})')
        pg.fill('#mac-o','9110'); pg.wait_for_timeout(50); check(pg.is_disabled('#mac-insert') and 'already used' in pg.inner_text('#mac-msg'),f'{tag}: clash with O9110 is refused')
        pg.select_option('#mac-list','rect-pocket'); pg.check('input[name=mac-mode][value=inline]'); pg.wait_for_timeout(50)
        check('#24' in pg.inner_text('#mac-msg'),f'{tag}: inline warns about the locals it sets')
        pg.click('#mac-insert'); settle(pg); d=diag(pg); n2=pg.evaluate("segs.length"); check(n2>n and 'ALARM' not in d.upper(),f'{tag}: inline pocket runs ({n2} segments)')
        # --- work zero / G54 change: same toolpath, stock follows zero
        if tag=='desktop':
            s1=pg.evaluate("JSON.stringify(segs.map(s=>[s.b.x,s.b.y,s.b.z]).slice(-50))")
            pg.evaluate("$('stocksetup').click()"); pg.wait_for_timeout(150); pg.select_option('#zeromode','corner'); pg.dispatch_event('#zeromode','input')
            pg.fill('#g54x','-250'); pg.fill('#g54z','-330'); pg.click('#stockauto'); settle(pg)
            d=diag(pg); s2=pg.evaluate("JSON.stringify(segs.map(s=>[s.b.x,s.b.y,s.b.z]).slice(-50))")
            check('ALARM' not in d.upper() and pg.evaluate("MachineState.mill.work[54].x")==-250,'macros run after changing work zero to corner and G54 X-250 Z-330')
            pg.evaluate("$('seek').value=$('seek').max;$('seek').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(400)
            cut=pg.evaluate("Math.min(...stock.h)"); check(cut<-5,f'stock is cut by the macros with the corner zero (min height {cut})')
            shot(pg,f'{SH}/desktop-mill-macros-run.png')
            pg.evaluate("$('stocksetup').click()"); pg.select_option('#zeromode','center'); pg.dispatch_event('#zeromode','input'); pg.fill('#g54x','-300'); pg.fill('#g54z','-350'); pg.click('#stockauto'); settle(pg)
        # --- my macros: save, export, import
        setprog(pg,MILL,"G0Z25.\nG91"); openmenu(pg); pg.select_option('#mac-list','peck-drill'); pg.fill('#mac-params input[data-k=Z]','-15'); pg.click('#mac-save'); pg.wait_for_timeout(150)
        pg.fill('#me-name','My peck Z15'); 
        if tag=='phone': shot(pg,f'{SH}/phone-my-macro-editor.png')
        pg.click('#me-save'); pg.wait_for_timeout(150); pg.check('input[name=mac-mode][value=g65]')
        stored=pg.evaluate("JSON.parse(localStorage.getItem('fanucsim.macros.user'))"); check(len(stored)==1 and stored[0]['name']=='My peck Z15' and any(q['k']=='Z' and q['def']==-15 for q in stored[0]['params']),f'{tag}: my macro saved to localStorage')
        sel=pg.evaluate("$('mac-list').selectedOptions[0].parentNode.label+'/'+$('mac-list').selectedOptions[0].text"); check(sel=='My macros/My peck Z15',f'{tag}: listed under My macros ({sel})')
        rm=pg.evaluate(RECTS);check(rm==r0,f'{tag}: layout unchanged with a My macros entry selected'+('' if rm==r0 else str([(a,c) for a,c in zip(rm,r0) if a!=c])))
        pg.click('#mac-insert'); settle(pg); src=pg.evaluate("$('source').value"); check('G65P9500' in src and 'O9500' in src and 'ALARM' not in diag(pg).upper(),f'{tag}: own macro inserted as G65 P9500 and runs'+repr([l for l in src.split(chr(10)) if l[:1] in 'OG' and ('65' in l or l[:1]=='O')])+diag(pg)[:150])
        pg.click('summary:has-text("Macros")')
        with pg.expect_download() as dl: pg.click('#macro-export')
        path=dl.value.path(); data=json.load(open(path)); check(data['format']=='fanucsim-macros' and data['macros'][0]['name']=='My peck Z15',f'{tag}: export downloads {dl.value.suggested_filename}')
        data['macros'].append({**data['macros'][0],'id':'user-other','name':'Imported row','machine':'both'}); open(TMP+'/mac-import.json','w').write(json.dumps(data))
        pg.evaluate("localStorage.removeItem('fanucsim.macros.user')")
        pg.click('summary:has-text("Macros")')
        with pg.expect_file_chooser() as fc: pg.click('#macro-import')
        fc.value.set_files(TMP+'/mac-import.json'); pg.wait_for_timeout(400)
        msg=pg.inner_text('#mac-msg'); n=len(pg.evaluate("JSON.parse(localStorage.getItem('fanucsim.macros.user'))")); check('Imported' in msg and n==2,f'{tag}: import merges ({msg!r}, {n} stored)')
        pg.click('#mac-close')
        open(TMP+'/bad.json','w').write('{"x":1}'); pg.click('summary:has-text("Macros")')
        with pg.expect_file_chooser() as fc: pg.click('#macro-import')
        fc.value.set_files(TMP+'/bad.json'); pg.wait_for_timeout(300); check('Import failed' in pg.inner_text('#mac-msg'),f'{tag}: bad file is reported'); pg.click('#mac-close')
        # --- CNC panel
        setprog(pg,MILL,"G0Z25.\nG91"); pg.evaluate("$('editor-cnc').click()"); pg.wait_for_timeout(400)
        pg.evaluate("CncPanel.setMode('MEM')"); openmenu(pg); pg.select_option('#mac-list','facing')
        check(pg.is_disabled('#mac-insert') and 'EDIT' in pg.inner_text('#mac-msg'),f'{tag}: CNC panel outside EDIT refuses ({pg.inner_text("#mac-msg")[:70]!r})')
        pg.click('#mac-close'); pg.evaluate("CncPanel.setMode('EDIT')"); pg.wait_for_timeout(200)
        pg.evaluate("()=>{const s=$('source');const i=s.value.indexOf('G0Z25.\\nG91');s.setSelectionRange(i,i);CncPanel.refresh&&CncPanel.refresh(false)}")
        openmenu(pg); pg.select_option('#mac-list','facing'); pg.check('input[name=mac-mode][value=g65]'); check(not pg.is_disabled('#mac-insert'),f'{tag}: CNC EDIT mode allows insert')
        pg.click('#mac-insert'); settle(pg); src=pg.evaluate("$('source').value"); check('G65P9140' in src and 'O9140' in src and 'ALARM' not in diag(pg).upper(),f'{tag}: inserted from the CNC panel and the program runs'+repr([l for l in src.split(chr(10)) if l[:1] in 'OG' and ('65' in l or l[:1]=='O')])+diag(pg)[:150]+pg.inner_text('#mac-msg'))
        shot(pg,f'{SH}/{tag}-cnc-panel-after-insert.png')
        pg.evaluate("$('editor-normal').click()"); pg.wait_for_timeout(200)
        # --- lathe
        pg.evaluate("setSimMode('lathe')"); pg.wait_for_timeout(400)
        setprog(pg,LATHE,"G0X120.Z50.M9"); pg.evaluate("$('load').click()"); settle(pg)
        openmenu(pg); lo=pg.evaluate("[...$('mac-list').options].map(o=>o.value)"); check(lo==['part-counter','lathe-rough','lathe-groove','lathe-thread','lathe-probe-face'] or set(lo)>={'lathe-rough','lathe-groove','lathe-thread','lathe-probe-face','part-counter'} and 'bolt-circle' not in lo,f'{tag}: lathe list filtered ({lo})')
        lr={}
        for id in lo:
            pg.select_option('#mac-list',id); pg.wait_for_timeout(60); lr[id]=pg.evaluate(RECTS)
        check(all(v==lr[lo[0]] for v in lr.values()),f'{tag}: lathe dialog layout stable')
        pg.select_option('#mac-list','lathe-rough'); pg.check('input[name=mac-mode][value=g65]')
        shot(pg,f'{SH}/{tag}-macro-dialog-lathe.png')
        pg.click('#mac-insert'); settle(pg)
        for id,mode in (('lathe-groove','inline'),('lathe-thread','g65')):
            setprog(pg,pg.evaluate("$('source').value"),"G0X120.Z50.M9"); openmenu(pg); pg.select_option('#mac-list',id); pg.check(f'input[name=mac-mode][value={mode}]'); pg.click('#mac-insert'); settle(pg)
        src=pg.evaluate("$('source').value"); d=diag(pg); ls=pg.evaluate("LatheView.res&&LatheView.res.segs.length"); err=pg.evaluate("LatheView.res&&LatheView.res.error")
        check(all(k in src for k in ('O9210','O9230','G65P9210','G65P9230','(MACRO GROOVING LOOP')) and not err and ls>20,f'{tag}: lathe rough (G65) + groove (inline) + thread (G65) run ({ls} segs, err {err})')
        if tag=='desktop':
            pg.evaluate("LatheView.openStock()"); pg.wait_for_timeout(150); pg.select_option('#lst-zero','front'); pg.dispatch_event('#lst-zero','input'); pg.fill('#lst-g54z','-380'); pg.click('#lst-auto'); settle(pg)
            err=pg.evaluate("LatheView.res&&LatheView.res.error"); check(not err and pg.evaluate("MachineState.lathe.work[54].z")==-380,'lathe macros run with Z0 on stock front and G54 Z-380')
            pg.evaluate("$('seek').value=$('seek').max;$('seek').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(500)
            shot(pg,f'{SH}/desktop-lathe-macros-run.png')
        check(not errs,f'{tag}: no page errors {errs[:2]}')
        pg.close()
    b.close()
print(json.dumps({'failed':fails}))
sys.exit(1 if fails else 0)
