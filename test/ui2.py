from playwright.sync_api import sync_playwright
U='http://localhost:3998'; D='/tmp/claude-0/shots/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); T=b.new_context(viewport={'width':1400,'height':900}).new_page(); T.on('pageerror',lambda e:errs.append(str(e))); T.on('dialog',lambda d:d.accept())
    T.goto(U+'/teacher.html'); T.wait_for_timeout(600); T.click('#bCreate'); T.wait_for_timeout(600); code=T.inner_text('#code')
    T.click('[data-v=settings]'); T.wait_for_timeout(300)
    T.click('.ucard[data-u="11"]'); T.wait_for_timeout(300); T.click('.ucard[data-u="12"]'); T.wait_for_timeout(400)
    T.screenshot(path=D+'30_settings_mixed.png')
    ss=[]
    for i,n in enumerate(['가람','나래','다온']):
        S=b.new_context(viewport={'width':1280,'height':800}).new_page(); S.on('pageerror',lambda e:errs.append(str(e)))
        S.goto(U+'/?code='+code); S.wait_for_timeout(300); S.fill('#jn',n); S.click('#go'); ss.append(S)
    ss[0].wait_for_timeout(11000); ss[0].screenshot(path=D+'31_mixed_plan.png')
    for k,S in enumerate(ss):
        S.click('.gear[data-g="2"]'); c=S.locator('#hand .card'); c.nth(0).click(); c.nth(1).click(); S.click('#ready'); S.wait_for_selector('.choice')
        if k==0: S.screenshot(path=D+'32_mixed_q.png')
        S.locator('.choice').nth(0).click()
    ss[0].wait_for_timeout(1200); ss[0].screenshot(path=D+'33_mixed_move.png')
    print(errs); b.close()
