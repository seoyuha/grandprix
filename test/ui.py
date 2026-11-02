import sys, time
from playwright.sync_api import sync_playwright
U = 'http://localhost:3998'; D = '/tmp/claude-0/shots/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    tc = b.new_context(viewport={'width': 1400, 'height': 900}); T = tc.new_page()
    T.on('pageerror', lambda e: errs.append('T: ' + str(e))); T.on('dialog', lambda d: d.accept())
    T.goto(U + '/teacher.html'); T.wait_for_timeout(800)
    T.screenshot(path=D + '01_teacher_start.png')
    T.click('#bCreate'); T.wait_for_timeout(800)
    code = T.inner_text('#code'); print('code', code)
    # 설정: 10단원만, 라운드 30초
    T.click('[data-v=settings]'); T.wait_for_timeout(300)
    T.select_option('#sRound', '30'); T.wait_for_timeout(200)
    T.screenshot(path=D + '02_teacher_settings.png')
    T.click('[data-v=dash]')
    studs = []
    for i, (name, car) in enumerate([('하늘', 'red'), ('바다', 'blue'), ('구름', 'yellow'), ('별님', 'green')]):
        vp = {'width': 1280, 'height': 800} if i == 0 else {'width': 820, 'height': 1180} if i == 1 else {'width': 390, 'height': 844}
        c = b.new_context(viewport=vp); S = c.new_page()
        S.on('pageerror', lambda e, n=name: errs.append(n + ': ' + str(e)))
        S.goto(U + '/?code=' + code); S.wait_for_timeout(500)
        if i == 0: S.screenshot(path=D + '03_student_join.png')
        S.fill('#jn', name); S.click(f'#cp [data-c={car}]'); S.click('#go'); S.wait_for_timeout(500)
        if i == 0: S.screenshot(path=D + '04_student_lobby.png')
        studs.append(S)
    studs[0].wait_for_timeout(5500)
    studs[0].screenshot(path=D + '05_student_room.png')
    T.screenshot(path=D + '06_teacher_dash_countdown.png')
    studs[0].wait_for_timeout(5000)
    S0 = studs[0]
    S0.screenshot(path=D + '07_game_plan.png')
    studs[2].screenshot(path=D + '07b_game_plan_phone.png', full_page=True)
    # 모두: 기어 2, 카드 2장 → 문제 → 답
    for k, S in enumerate(studs):
        S.click('.gear[data-g="2"]'); S.wait_for_timeout(100)
        cards = S.locator('#hand .card'); cards.nth(0).click(); cards.nth(1).click()
        if k == 0: S.screenshot(path=D + '08_game_cards_selected.png')
        S.click('#ready'); S.wait_for_timeout(500)
        if k == 0: S.screenshot(path=D + '09_question.png')
        S.locator('.choice').nth(k % 4).click(); S.wait_for_timeout(400)
        if k == 0: S.screenshot(path=D + '10_answer_result.png')
    S0.wait_for_timeout(2500); S0.screenshot(path=D + '11_moving.png')
    T.screenshot(path=D + '12_teacher_dash_playing.png')
    T.click('[data-v=monitor]'); T.wait_for_timeout(600); T.screenshot(path=D + '13_teacher_monitor.png')
    S0.wait_for_timeout(5000); S0.screenshot(path=D + '14_round2.png')
    # 몇 라운드 더: 3단·4단
    for rnd in range(4):
        for k, S in enumerate(studs):
            try:
                S.wait_for_selector('#ready', timeout=15000)
                g = min(4, 2 + rnd)
                btn = S.locator(f'.gear[data-g="{g}"]')
                if btn.is_enabled(): btn.click()
                else: S.locator('.gear[data-g="3"]').click()
                n = int(S.locator('.gear.on b').inner_text())
                cards = S.locator('#hand .card')
                for j in range(n): cards.nth(j).click()
                S.click('#ready'); S.wait_for_selector('.choice', timeout=5000)
                if rnd == 1 and k == 0: S.screenshot(path=D + f'15_question_lv.png')
                S.locator('.choice').nth(0).click()
            except Exception as e: print('rnd', rnd, k, str(e)[:120])
        S0.wait_for_timeout(1500)
        if rnd == 2: S0.screenshot(path=D + '16_mid_race.png')
    T.click('[data-v=dash]'); T.wait_for_timeout(300)
    T.click('#bEnd'); T.wait_for_timeout(1500)
    S0.wait_for_timeout(4000); S0.screenshot(path=D + '17_result.png')
    T.screenshot(path=D + '18_teacher_finished.png')
    T.click('[data-v=questions]'); T.wait_for_timeout(800); T.screenshot(path=D + '19_teacher_questions.png')
    T.click('[data-v=results]'); T.wait_for_timeout(800); T.screenshot(path=D + '20_teacher_results.png')
    S0.wait_for_timeout(13000); S0.screenshot(path=D + '21_back_to_room.png')
    print('errors', errs)
    b.close()
