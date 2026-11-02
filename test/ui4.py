import subprocess
from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots2/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1440,'height':900}).new_page()
    T.on('pageerror',lambda e:errs.append(str(e))); T.on('dialog',lambda d:d.accept())
    T.on('console', lambda m: errs.append('console: '+m.text) if m.type=='error' and 'fonts' not in m.text and 'cdnjs' not in m.text else None)
    T.goto(U+'/teacher.html'); T.wait_for_timeout(800); T.screenshot(path=D+'t01_start.png')
    T.click('#bCreate'); T.wait_for_timeout(800); code=T.inner_text('#code'); print('code',code)
    T.screenshot(path=D+'t02_empty.png')
    T.click('[data-v=settings]'); T.wait_for_timeout(400); T.click('.ucard[data-u="12"]'); T.wait_for_timeout(500); T.screenshot(path=D+'t03_settings.png')
    T.click('[data-v=dash]')
    bots=subprocess.Popen(['node','test/joinbots.js',code,'9'])
    T.wait_for_timeout(9000); T.screenshot(path=D+'t04_dash_play.png')
    T.wait_for_timeout(6000); T.screenshot(path=D+'t04b_dash_play.png',full_page=True)
    T.click('[data-v=monitor]'); T.wait_for_timeout(1500); T.screenshot(path=D+'t05_monitor.png')
    T.wait_for_timeout(5000); T.screenshot(path=D+'t05b_monitor.png')
    T.click('[data-v=questions]'); T.wait_for_timeout(900); T.click('#qAddOpen'); T.wait_for_timeout(300); T.screenshot(path=D+'t06_questions.png')
    T.click('#bEnd'); T.wait_for_timeout(1500)
    T.click('[data-v=results]'); T.wait_for_timeout(900); T.screenshot(path=D+'t07_results.png')
    T.click('[data-v=dash]'); T.wait_for_timeout(800); T.screenshot(path=D+'t08_dash_finished.png')
    T.set_viewport_size({'width':820,'height':1180}); T.wait_for_timeout(500); T.screenshot(path=D+'t09_tablet.png')
    bots.kill(); print('errors',errs[:10]); b.close()
