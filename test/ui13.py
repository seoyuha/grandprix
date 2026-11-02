import os
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots4/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1280,'height':800}).new_page(); T.on('pageerror',lambda e:errs.append(str(e)))
    T.goto(U+'/teacher.html'); T.wait_for_timeout(600)
    T.click('#bCreate'); T.wait_for_timeout(300); print('빈칸:', T.inner_text('#startErr'))
    T.fill('#tPw','1234'); T.click('#bCreate'); T.wait_for_timeout(500); print('틀림:', T.inner_text('#startErr')); T.screenshot(path=D+'pw_wrong.png')
    T.fill('#tPw',os.environ['TEACHER_PW']); T.click('#bCreate'); T.wait_for_timeout(700); print('맞음 → 관제실 보임:', T.is_visible('#vApp'))
    T.reload(); T.wait_for_timeout(1200); print('새로고침 → 그대로 관제실:', T.is_visible('#vApp'))
    T2=b.new_context(viewport={'width':1280,'height':800}).new_page(); T2.goto(U+'/teacher.html'); T2.wait_for_timeout(800)
    print('다른 기기 → 비밀번호 화면:', T2.is_visible('#vStart'))
    print('errors',errs); b.close()
