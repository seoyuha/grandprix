import subprocess, os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots3/'; errs=[]
env=dict(os.environ, UNITS='10', RS='60', END='3')
mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env)
code=mk.stdout.readline().strip()
with sync_playwright() as p:
    b=p.chromium.launch(); studs=[]
    for i,(name,car,vp) in enumerate([('하늘','red',(1280,800)),('바다','blue',(390,844)),('구름','yellow',(1180,820))]):
        S=b.new_context(viewport={'width':vp[0],'height':vp[1]}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
        S.goto(U+'/?code='+code); S.wait_for_timeout(500); S.fill('#jn',name); S.click(f'.jcar[data-c={car}]'); S.click('#go'); S.wait_for_timeout(300); studs.append(S)
    S0=studs[0]; S0.wait_for_timeout(1500); S0.screenshot(path=D+'01_lobby_sound.png')
    S0.wait_for_selector('#ready',timeout=20000)
    S0.click('.gearBtn[data-g="2"]'); c=S0.locator('#hand .card'); c.nth(0).click(); c.nth(1).click(); S0.wait_for_timeout(300); S0.screenshot(path=D+'02_preview.png')
    S0.click('#ready'); S0.wait_for_selector('.ans'); S0.wait_for_timeout(300); S0.screenshot(path=D+'03_mission_say.png')
    S0.click('#sayQ'); S0.locator('.ans').nth(0).click()
    shot=False
    for loop in range(80):
        for k,S in enumerate(studs):
            try:
                if S.locator('#ready').count() and S.locator('#ready').is_visible():
                    if k==0 and loop<6:
                        S.click('.gearBtn[data-g="2"]') if S.locator('.gearBtn[data-g="2"]').is_enabled() else None
                    n=int(S.locator('.gearBtn.on').get_attribute('data-g')); cs=S.locator('#hand .card')
                    for j in range(n): cs.nth(j).click()
                    if k==0 and loop<3: S0.screenshot(path=D+f'04_preview_{loop}.png')
                    S.click('#ready'); S.wait_for_selector('.ans',timeout=4000); S.locator('.ans').nth((k+loop)%4).click()
            except Exception as e: pass
        if S0.locator('#res').count():
            S0.wait_for_timeout(1200); S0.screenshot(path=D+'05_result_review.png',full_page=False)
            S0.evaluate("document.getElementById('res').scrollTo(0,9999)"); S0.wait_for_timeout(300); S0.screenshot(path=D+'05b_result_review_bottom.png')
            studs[1].screenshot(path=D+'05c_phone.png',full_page=True); shot=True; break
        S0.wait_for_timeout(400)
    print('shot',shot,'errors',errs); b.close()
mk.kill()
