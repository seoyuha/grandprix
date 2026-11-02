import subprocess, os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots4/'
env=dict(os.environ, UNITS='10', RS='60', END='99')
mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env); code=mk.stdout.readline().strip()
with sync_playwright() as p:
    b=p.chromium.launch(); studs=[]
    for name in ['하늘','바다','구름']:
        S=b.new_context(viewport={'width':1280,'height':800}).new_page(); S.goto(U+'/?code='+code); S.wait_for_timeout(300); S.fill('#jn',name); S.click('#go'); studs.append(S)
    S0=studs[0]
    S0.wait_for_selector('img.cdImg[src*="cd_5"]',timeout=20000); S0.wait_for_timeout(200); S0.screenshot(path=D+'02_cd5.png')
    S0.wait_for_selector('img.cdImg[src*="cd_4"]',timeout=5000); S0.wait_for_timeout(200); S0.screenshot(path=D+'03_cd4.png')
    print('ok'); b.close()
mk.kill()
