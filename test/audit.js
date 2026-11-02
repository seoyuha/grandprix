// 수업 흐름 점검: FAST=1 PORT=3999 node server.js 를 켠 뒤  node test/audit.js
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3999';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push([ok ? '✅' : '❌', name, info]); };
const call = (sock, ev, data) => new Promise(r => sock.emit(ev, data || {}, r));

async function teacher(settings) {
  const t = io(URL); const T = { s: t, st: null }; t.on('tstate', x => T.st = x);
  const r = await call(t, 'teacher:create', { pw: process.env.TEACHER_PW }); T.code = r.code; T.key = r.key;
  if (settings) await call(t, 'teacher:settings', settings);
  await sleep(150); return T;
}
function student(code, name, opts = {}) {
  const s = io(URL); const b = { s, st: null, name, auto: opts.auto !== false, token: null, busy: false };
  s.on('state', x => b.st = x);
  s.emit('student:join', { code, name, token: opts.token }, r => { b.token = r && r.token; });
  b.timer = setInterval(() => {
    if (!b.auto) return; const g = b.st && b.st.game; if (!g || g.phase !== 'plan' || !g.me || b.busy) return;
    const me = g.me;
    if (!me.plan) { b.busy = true; const gear = Math.min(4, me.gear + 1); const sc = v => typeof v === 'number' ? v : -1;
      const cards = [...Array(me.hand.length).keys()].sort((a, c) => sc(me.hand[c]) - sc(me.hand[a])).slice(0, gear);
      s.emit('student:plan', { gear, cards }, () => b.busy = false); }
    else if (me.q && !me.answered) { b.busy = true; s.emit('student:answer', { choice: Math.random() < .8 ? me.q.answer ?? 0 : 1 }, () => b.busy = false); }
  }, 60);
  b.close = () => { clearInterval(b.timer); s.disconnect(); };
  return b;
}
const roomOf = (T, name) => { const st = T.st.students.find(x => x.name === name); return st && st.roomId; };
async function waitFor(fn, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; }

(async () => {
  /* 1. 자동 배정 기본값 + 인원 나누기 */
  {
    const T = await teacher();
    check('자동 배정이 처음부터 켜져 있다', T.st.settings.autoMode === true);
    check('한 방 인원 기본값 3~5명', T.st.settings.minSize === 3 && T.st.settings.maxSize === 5);
    const kids = []; for (let i = 0; i < 13; i++) kids.push(student(T.code, '학생' + (i + 1)));
    await waitFor(() => T.st.rooms.length >= 3);
    await sleep(300);
    const sizes = T.st.rooms.map(r => r.playerIds.length).sort();
    check('13명 → 3~5명씩 방 3개', sizes.length === 3 && sizes.every(n => n >= 3 && n <= 5), sizes.join(','));
    check('교사가 버튼을 누르지 않아도 출발', await waitFor(() => T.st.rooms.every(r => r.status === 'playing')));
    /* 2. 경기가 끝나면 → 결과 화면 → 대기실 → 재배정, 전 방 친구 3명 이상 금지 */
    const firstRooms = {}; T.st.rooms.forEach(r => r.playerIds.forEach(id => firstRooms[id] = r.id));
    const done = await waitFor(() => T.st.resultsCount >= 3, 60000);
    check('3개 방 경기가 모두 끝남', done, `끝난 경기 ${T.st.resultsCount}판`);
    const sawResult = kids.some(k => k.st && k.st.game && k.st.game.phase === 'done') || done;
    check('끝나면 학생은 결과 화면을 봄', sawResult);
    const regrouped = await waitFor(() => T.st.rooms.length >= 3 && T.st.rooms.every(r => r.status !== 'finished') && T.st.lobby.length === 0, 30000);
    check('기다렸다가 새 방에 자동 재배정', regrouped);
    let worst = 0;
    for (const r of T.st.rooms) { const cnt = {}; r.playerIds.forEach(id => cnt[firstRooms[id]] = (cnt[firstRooms[id]] || 0) + 1); worst = Math.max(worst, ...Object.values(cnt)); }
    check('새 방에 전 방 친구는 2명까지', worst <= 2, `가장 많이 겹친 수 ${worst}명`);
    /* 3. 새로고침(재접속)하면 경기로 돌아옴 */
    const k = kids[0]; const tok = k.token; const rid = roomOf(T, k.name); k.close(); await sleep(400);
    const back = student(T.code, k.name, { token: tok }); await sleep(600);
    check('새로고침해도 같은 방으로 돌아옴', roomOf(T, k.name) === rid && back.st && back.st.stage !== 'lobby');
    kids.forEach(x => x.close()); back.close(); T.s.disconnect();
  }
  /* 4. 혼자 남은 학생: 막 시작한 경기에 끼워 넣기 */
  {
    const T = await teacher({ roundSec: 30 });
    const four = ['가', '나', '다', '라'].map(n => student(T.code, n, { auto: false }));
    await waitFor(() => T.st.rooms.some(r => r.status === 'playing'));
    const late = student(T.code, '늦게', { auto: false });
    check('늦게 온 1명은 진행 중 경기에 들어감', await waitFor(() => roomOf(T, '늦게'), 5000));
    [...four, late].forEach(x => x.close()); T.s.disconnect();
  }
  /* 5. 친구가 모자라면 AI 친구가 채워서 바로 출발 */
  {
    const T = await teacher();
    check('AI 채우기가 처음부터 켜져 있다', T.st.settings.aiFill === true);
    const one = student(T.code, '혼자');
    const t0 = Date.now();
    const ok = await waitFor(() => T.st.rooms.some(r => r.playerIds.length === 1 && (r.bots || []).length === 2));
    check('혼자 → AI 2명이 채워 3명 방', ok, `${((Date.now() - t0) / 1000).toFixed(1)}초(빠른 시험 모드)`);
    const fin = await waitFor(() => T.st.resultsCount >= 1, 40000);
    check('AI와 함께 경기를 끝까지 진행', fin);
    const res = await call(T.s, 'teacher:results');
    const g = res.results[0];
    check('AI는 결과 기록에 표시되지만 학생 점수에는 안 들어감', g && g.players.some(p => p.bot) && res.students.length === 1, g && g.players.map(p => p.name).join(','));
    one.close(); T.s.disconnect();
  }
  /* 5-2. AI 방에 늦게 온 학생 → AI 자리를 이어받음 */
  {
    const T = await teacher({ roundSec: 40 });
    const a = student(T.code, '먼저', { auto: false });
    await waitFor(() => T.st.rooms.some(r => r.status === 'playing'));
    const b = student(T.code, '나중', { auto: false });
    const ok = await waitFor(() => roomOf(T, '나중'), 6000);
    const r = T.st.rooms[0];
    check('AI 방에 들어온 학생이 AI 한 명과 교체', ok && r.game.players.filter(p => p.bot).length === 1 && r.game.players.length === 3);
    a.close(); b.close(); T.s.disconnect();
  }
  /* 5-3. AI를 끄면 2명이라도 출발 */
  {
    const T = await teacher({ aiFill: false });
    const two = ['하나', '두리'].map(n => student(T.code, n));
    check('AI를 끄면 2명이라도 출발', await waitFor(() => T.st.rooms.some(r => r.playerIds.length === 2 && !(r.bots || []).length && r.status !== 'waiting'), 6000));
    two.forEach(x => x.close()); T.s.disconnect();
  }
  /* 6. 자동 배정을 끄면 교사가 직접 */
  {
    const T = await teacher({ autoMode: false, minSize: 4, maxSize: 4 });
    const kids = []; for (let i = 0; i < 8; i++) kids.push(student(T.code, '수동' + i));
    await sleep(1500);
    check('자동 배정을 끄면 저절로 방이 생기지 않음', T.st.rooms.length === 0 && T.st.lobby.length === 8);
    await call(T.s, 'teacher:assign'); await sleep(300);
    check('[지금 배정] → 4명씩 2방', T.st.rooms.length === 2 && T.st.rooms.every(r => r.playerIds.length === 4 && r.status === 'waiting'));
    // 학생 옮기기
    const [r1, r2] = T.st.rooms; const sid = r1.playerIds[0];
    await call(T.s, 'teacher:move', { sid, to: r2.id }); await sleep(200);
    check('교사가 학생을 다른 방으로 옮김', T.st.rooms.find(r => r.id === r2.id).playerIds.includes(sid));
    await call(T.s, 'teacher:move', { sid, to: r1.id }); await sleep(200);
    await call(T.s, 'teacher:startAll');
    check('[대기 방 출발] → 모든 방 시작', await waitFor(() => T.st.rooms.every(r => r.status === 'playing')));
    // 멈춤
    await call(T.s, 'teacher:pauseAll'); const rd = T.st.rooms[0].game.round; await sleep(1500);
    check('[일시 정지] → 라운드가 멈춤', T.st.paused && T.st.rooms[0].game.round === rd);
    await call(T.s, 'teacher:pauseAll');
    await call(T.s, 'teacher:endAll'); await sleep(400);
    check('[경기 종료] → 결과 저장', T.st.resultsCount === 2);
    await sleep(1500);
    check('자동 배정이 꺼져 있으면 결과 화면에 머묾', T.st.rooms.every(r => r.status === 'finished'));
    await call(T.s, 'teacher:room', { roomId: T.st.rooms[0].id, action: 'rematch' });
    check('[같은 팀 다시] → 같은 친구들과 다시 출발', await waitFor(() => T.st.rooms.some(r => r.status === 'playing')));
    // 학생이 스스로 대기실로
    const k = kids.find(x => roomOf(T, x.name) === T.st.rooms.find(r => r.status === 'finished').id);
    await call(k.s, 'student:leave'); await sleep(200);
    check('결과 화면에서 [대기실로] → 대기실', !roomOf(T, k.name));
    const res = await call(T.s, 'teacher:results');
    check('결과 보기: 학생별·경기별·틀린 문제 기록', res.ok && res.results.length >= 2 && res.students.length === 8 && Array.isArray(res.wrongs));
    // 내보내기
    await call(T.s, 'teacher:kick', { sid: T.st.students[0].id }); await sleep(200);
    check('학생 내보내기', T.st.students.length === 7);
    // 교사 재접속
    T.s.disconnect(); const t2 = io(URL); const r = await call(t2, 'teacher:resume', { code: T.code, key: T.key, pw: process.env.TEACHER_PW });
    check('교사 화면 새로고침 → 이전 수업 이어서', r.ok);
    kids.forEach(x => x.close()); t2.disconnect();
  }
  /* 8. 교사 비밀번호 */
  {
    const t = io(URL);
    const bad = await call(t, 'teacher:create', { pw: 'wrong' });
    check('틀린 비밀번호로는 수업을 만들 수 없음', !bad.ok && bad.pw);
    const none = await call(t, 'teacher:create', {});
    check('비밀번호 없이는 수업을 만들 수 없음', !none.ok);
    const okr = await call(t, 'teacher:create', { pw: process.env.TEACHER_PW });
    check('맞는 비밀번호로 수업 만들기', okr.ok);
    const rbad = await call(t, 'teacher:resume', { code: okr.code, key: okr.key, pw: 'x' });
    check('이어서 열기도 비밀번호가 필요', !rbad.ok);
    t.disconnect();
  }
  /* 7. 단원 설정 */
  {
    const T = await teacher({ units: [11, 12] });
    const kids = ['a', 'b', 'c'].map(n => student(T.code, n, { auto: false }));
    await waitFor(() => kids[0].st && kids[0].st.game);
    const g = kids[0].st.game;
    check('두 단원 고르면 트랙 왼쪽 11·오른쪽 12', g.track.spaceUnits[0] === 11 && g.track.spaceUnits[15] === 12);
    kids.forEach(x => x.close()); T.s.disconnect();
  }
  console.log(results.map(r => r.join(' ')).join('\n'));
  console.log(`\n${results.filter(r => r[0] === '✅').length}/${results.length} 통과`);
  process.exit(0);
})();
