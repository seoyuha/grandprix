import subprocess, os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots2/'; errs=[]
env=dict(os.environ, UNITS='12', RS='40', END='3')
mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env)
code=mk.stdout.readline().strip()
with sync_playwright() as p:
    b=p.chromium.launch(); studs=[]
    for i,(name,car,vp) in enumerate([('하늘','purple',(1280,800)),('바다','green',(390,844)),('구름','yellow',(1180,820)),('별님','red',(1180,820))]):
        S=b.new_context(viewport={'width':vp[0],'height':vp[1]}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
        S.goto(U+'/?code='+code); S.wait_for_timeout(500); S.fill('#jn',name); S.click(f'.jcar[data-c={car}]'); S.click('#go'); S.wait_for_timeout(300); studs.append(S)
    S0=studs[0]; shot=False
    for loop in range(80):
        for k,S in enumerate(studs):
            try:
                if S.locator('#ready').count() and S.locator('#ready').is_visible():
                    S.locator('#hand .card').nth(0).click(); S.click('#ready'); S.wait_for_selector('.ans',timeout=4000); S.locator('.ans').nth(k%2).click()
            except Exception as e: pass
        if S0.locator('#res').count():
            S0.wait_for_timeout(1200); S0.screenshot(path=D+'30_result.png'); studs[1].screenshot(path=D+'30b_result_phone.png',full_page=True); shot=True; break
        S0.wait_for_timeout(400)
    print('shot',shot,'errors',errs); b.close()
mk.kill()
