import subprocess
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1440,'height':900}).new_page(); T.on('pageerror',lambda e:errs.append(str(e)))
    T.goto(U+'/teacher.html'); T.wait_for_timeout(500); T.click('#bCreate'); T.wait_for_timeout(500); code=T.inner_text('#code')
    S=b.new_context(viewport={'width':1280,'height':800}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
    S.goto(U+'/?code='+code); S.wait_for_timeout(400); S.fill('#jn','하늘'); S.click('#go'); S.wait_for_timeout(4000)
    T.screenshot(path='/tmp/claude-0/shots4/t_wait.png'); S.screenshot(path='/tmp/claude-0/shots4/s_wait.png')
    print('lobby msg:', S.inner_text('.lobbyMsg')); print('chip:', T.inner_text('#lobby')); print('errors',errs); b.close()
