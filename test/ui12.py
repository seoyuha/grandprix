import subprocess
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots4/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1440,'height':900}).new_page(); T.on('pageerror',lambda e:errs.append('T '+str(e)))
    T.goto(U+'/teacher.html'); T.wait_for_timeout(500); T.click('#bCreate'); T.wait_for_timeout(500); code=T.inner_text('#code')
    S=b.new_context(viewport={'width':1280,'height':800}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
    S.goto(U+'/?code='+code); S.wait_for_timeout(400); S.fill('#jn','하늘'); S.click('#go'); S.wait_for_timeout(2500)
    S.screenshot(path=D+'ai_0_lobby.png')
    S.wait_for_selector('img.cdImg',timeout=15000); S.wait_for_timeout(300); S.screenshot(path=D+'ai_1_room.png')
    S.wait_for_selector('#ready',timeout=15000); S.wait_for_timeout(9000); S.screenshot(path=D+'ai_2_race.png')
    T.screenshot(path=D+'ai_3_teacher.png')
    T.click('[data-v=settings]'); T.wait_for_timeout(500); T.evaluate("document.getElementById('sAi').scrollIntoView()"); T.screenshot(path=D+'ai_4_setting.png')
    print('errors',errs); b.close()
