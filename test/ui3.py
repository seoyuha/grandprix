import subprocess, time, sys
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots2/'; errs=[]
env=dict(__import__('os').environ, UNITS=sys.argv[1] if len(sys.argv)>1 else '10', RS='40', END='5')
mk=subprocess.Popen(['node','test/mkclass.js'],stdout=subprocess.PIPE,text=True,env=env)
code=mk.stdout.readline().strip(); print('code',code)
with sync_playwright() as p:
    b=p.chromium.launch(); studs=[]
    for i,(name,car,vp) in enumerate([('하늘','red',(1280,800)),('바다','blue',(820,1180)),('구름','yellow',(390,844)),('별님','green',(1180,820))]):
        c=b.new_context(viewport={'width':vp[0],'height':vp[1]}); S=c.new_page(); S.on('pageerror',lambda e,n=name:errs.append(n+': '+str(e)))
        S.on('console', lambda m,n=name: errs.append(n+' console: '+m.text) if m.type=='error' else None)
        S.goto(U+'/?code='+code); S.wait_for_timeout(900)
        if i in (0,2): S.screenshot(path=D+f'01_join_{i}.png')
        S.fill('#jn',name); S.click(f'.jcar[data-c={car}]')
        S.click('#go'); S.wait_for_timeout(700)
        if i==0: S.screenshot(path=D+'02_lobby.png')
        if i==1: S.screenshot(path=D+'02b_lobby_tablet_portrait.png')
        studs.append(S)
    studs[2].screenshot(path=D+'02c_lobby_phone.png',full_page=True)
    S0=studs[0]; S0.wait_for_timeout(3500); S0.screenshot(path=D+'03_room_cd.png')
    S0.wait_for_timeout(2600); S0.screenshot(path=D+'04_game_plan.png')
    studs[1].screenshot(path=D+'04b_game_tablet.png'); studs[2].screenshot(path=D+'04c_game_phone.png',full_page=True)
    for rnd in range(5):
        for k,S in enumerate(studs):
            try:
                S.wait_for_selector('#ready',timeout=20000)
                g=min(4,1+rnd) if k%2==0 else min(2,1+rnd)
                btn=S.locator(f'.gearBtn[data-g="{g}"]')
                if btn.is_enabled(): btn.click()
                n=int(S.locator('.gearBtn.on').get_attribute('data-g'))
                cards=S.locator('#hand .card')
                for j in range(n): cards.nth(j).click()
                if rnd==1 and k==0: S.click('#bst'); S.screenshot(path=D+'05_cards_selected.png')
                S.click('#ready'); S.wait_for_selector('.ans',timeout=6000); S.wait_for_timeout(300)
                if k==0 and rnd in (0,2): S.screenshot(path=D+f'06_mission_{rnd}.png')
                if k==2 and rnd==1: S.screenshot(path=D+'06c_mission_phone.png')
                S.locator('.ans').nth(0 if k!=1 else 1).click(); S.wait_for_timeout(250)
                if k==0 and rnd==0: S.screenshot(path=D+'07_answer.png')
                if k==1 and rnd==0: S.screenshot(path=D+'07b_answer_wrong.png')
            except Exception as e: print('rnd',rnd,k,str(e)[:100])
        S0.wait_for_timeout(2600); S0.screenshot(path=D+f'08_move_{rnd}.png')
    S0.wait_for_timeout(9000)
    S0.screenshot(path=D+'09_result.png'); studs[2].screenshot(path=D+'09c_result_phone.png',full_page=True)
    S0.click('#toLobby'); S0.wait_for_timeout(1200); S0.screenshot(path=D+'10_back_lobby.png')
    S0.click('[data-help]'); S0.wait_for_timeout(500); S0.screenshot(path=D+'11_help.png')
    print('errors',errs[:20]); b.close()
mk.kill()
