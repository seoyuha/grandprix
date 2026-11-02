import subprocess, os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots4/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for units in ['10,11','10,12','11,12']:
        env=dict(os.environ, UNITS=units, RS='60', END='99')
        mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env); code=mk.stdout.readline().strip()
        studs=[]
        for i,(name,car) in enumerate([('하늘','red'),('바다','blue'),('구름','yellow')]):
            S=b.new_context(viewport={'width':1280,'height':800}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
            S.goto(U+'/?code='+code); S.wait_for_timeout(400); S.fill('#jn',name); S.click(f'.jcar[data-c={car}]'); S.click('#go'); S.wait_for_timeout(200); studs.append(S)
        S0=studs[0]
        if units=='10,11':
            S0.wait_for_timeout(700); S0.screenshot(path=D+'01_lobby_title.png')
            S0.wait_for_timeout(1200); S0.screenshot(path=D+'02_cd5.png'); S0.wait_for_timeout(1000); S0.screenshot(path=D+'03_cd4.png')
        S0.wait_for_selector('#ready',timeout=20000); S0.wait_for_timeout(800)
        S0.screenshot(path=D+f'track_{units.replace(",","_")}.png')
        for S in studs: S.close()
        mk.kill()
    T=b.new_context(viewport={'width':1440,'height':900}).new_page(); T.on('dialog',lambda d:d.accept()); T.on('pageerror',lambda e:errs.append('T '+str(e)))
    T.goto(U+'/teacher.html'); T.wait_for_timeout(600); T.screenshot(path=D+'t1_start.png')
    T.click('#bCreate'); T.wait_for_timeout(600); code=T.inner_text('#code')
    T.click('[data-v=settings]'); T.wait_for_timeout(300); T.click('.ucard[data-u="11"]'); T.wait_for_timeout(300)
    bots=subprocess.Popen(['node','test/joinbots.js',code,'4'])
    T.click('[data-v=dash]'); T.wait_for_timeout(9000); T.screenshot(path=D+'t2_dash.png')
    T.click('[data-v=monitor]'); T.wait_for_timeout(1500); T.screenshot(path=D+'t3_monitor.png')
    T.click('[data-v=questions]'); T.wait_for_timeout(800); T.screenshot(path=D+'t4_questions.png')
    bots.kill(); print('errors',errs); b.close()
