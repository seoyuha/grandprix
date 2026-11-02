const { io } = require('socket.io-client');
const URL = 'http://localhost:3999'; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = io(URL); let T = null; t.on('tstate', s => T = s);
  const { code } = await new Promise(r => t.emit('teacher:create', { pw: process.env.TEACHER_PW }, r));
  await new Promise(r => t.emit('teacher:settings', { roundSec: 40 }, r));
  const mk = (name) => { const s = io(URL); const b = { s, st: null }; s.on('state', x => b.st = x); s.emit('student:join', { code, name }, () => {}); return b; };
  const four = ['가', '나', '다', '라'].map(mk);
  await sleep(2500);
  const r0 = T.rooms[0]; console.log('방', T.rooms.length, r0 && r0.status, r0 && r0.game && r0.game.players.length);
  const late = mk('늦게');
  await sleep(2500);
  const r1 = T.rooms.find(r => r.playerIds.includes(T.students.find(s => s.name === '늦게').id));
  console.log('늦게 온 학생 방:', r1 ? r1.name : '없음', '인원', r1 && r1.game.players.length, '라운드', r1 && r1.game.round, '대기실', T.lobby.length);
  console.log('늦게 학생 화면:', late.st && late.st.stage, late.st && late.st.game && late.st.game.me && late.st.game.me.late);
  // 틀린 문제 기록: 한 명 계획+오답
  const b = four[0]; const g = b.st.game;
  await new Promise(r => b.s.emit('student:plan', { gear: 1, cards: [0], boost: false }, r));
  await sleep(300);
  const q = b.st.game.me.q; const wrong = (q.answer + 1) % 4;
  await new Promise(r => b.s.emit('student:answer', { choice: wrong }, r));
  // 모두 연결 끊기 → 라운드가 멈춰 있어야 함
  const rid = r1.id; const before = T.rooms.find(r => r.id === rid).game.round;
  [...four, late].forEach(x => x.s.disconnect());
  await sleep(3000);
  const rr = T.rooms.find(r => r.id === rid);
  console.log('모두 끊김: 라운드', before, '→', rr.game.round, rr.game.phase);
  // 다시 연결하고 교사가 종료 → 틀린 문제 확인
  const back = mk('가'); await sleep(800);
  await new Promise(r => t.emit('teacher:endAll', {}, r)); await sleep(500);
  console.log('결과 화면 틀린 문제:', JSON.stringify(back.st.game && back.st.game.me && back.st.game.me.wrongs).slice(0, 160));
  process.exit(0);
})();
