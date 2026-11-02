import subprocess
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots2/'
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1440,'height':900}).new_page(); T.on('dialog',lambda d:d.accept())
    T.goto(U+'/teacher.html'); T.wait_for_timeout(600); T.click('#bCreate'); T.wait_for_timeout(700); code=T.inner_text('#code')
    bots=subprocess.Popen(['node','test/joinbots.js',code,'9'])
    T.wait_for_timeout(15000); T.screenshot(path=D+'t10_dash.png')
    T.click('[data-v=settings]'); T.wait_for_timeout(500); T.screenshot(path=D+'t11_settings.png')
    T.click('[data-v=questions]'); T.wait_for_timeout(900); T.click('#qAddOpen'); T.wait_for_timeout(300); T.screenshot(path=D+'t12_questions.png')
    bots.kill(); b.close()
