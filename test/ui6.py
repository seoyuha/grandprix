import subprocess, os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots2/'; errs=[]
env=dict(os.environ, UNITS='11', RS='40', END='4')
mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env)
code=mk.stdout.readline().strip()
with sync_playwright() as p:
    b=p.chromium.launch(); studs=[]
    for i,(name,car,vp) in enumerate([('하늘','pink',(1280,800)),('바다','sky',(390,844)),('구름','orange',(1180,820))]):
        S=b.new_context(viewport={'width':vp[0],'height':vp[1]}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
        S.goto(U+'/?code='+code); S.wait_for_timeout(600); S.fill('#jn',name); S.click(f'.jcar[data-c={car}]'); S.click('#go'); S.wait_for_timeout(400); studs.append(S)
    S0=studs[0]; S0.wait_for_timeout(9000)
    S0.click('[data-help]'); S0.wait_for_timeout(500); S0.screenshot(path=D+'20_help.png'); S0.click('#hx')
    for rnd in range(4):
        for k,S in enumerate(studs):
            try:
                S.wait_for_selector('#ready',timeout=15000)
                g=4 if k==0 else 2
                for gg in range(g,0,-1):
                    btn=S.locator(f'.gearBtn[data-g="{gg}"]')
                    if btn.is_enabled(): btn.click(); break
                n=int(S.locator('.gearBtn.on').get_attribute('data-g')); cards=S.locator('#hand .card')
                for j in range(n): cards.nth(j).click()
                if k==0 and rnd>0: S.click('#bst')
                S.click('#ready'); S.wait_for_selector('.ans',timeout=6000); S.locator('.ans').nth(0).click()
            except Exception as e: print('r',rnd,k,str(e)[:80])
        for t in range(6):
            S0.wait_for_timeout(700); S0.screenshot(path=D+f'21_move_{rnd}_{t}.png')
    S0.wait_for_timeout(1500); S0.screenshot(path=D+'22_result.png'); studs[1].screenshot(path=D+'22b_result_phone.png',full_page=True)
    print('errors',errs); b.close()
mk.kill()
