// 가상 학생 테스트: node test/bots.js <학생수> <경기 수>
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3999';
const N = +process.argv[2] || 9, GAMES = +process.argv[3] || 6;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const t = io(URL); let tstate = null; t.on('tstate', s => tstate = s);
  const { code } = await new Promise(r => t.emit('teacher:create', { pw: process.env.TEACHER_PW }, r));
  await new Promise(r => t.emit('teacher:settings', { units: [10, 11, 12], roundSec: 20, laps: 2, autoMode: true }, r));
  const bots = []; const history = {}; // 방 구성 기록
  for (let i = 0; i < N; i++) {
    const s = io(URL); const b = { s, name: '학생' + (i + 1), st: null, planning: false };
    s.on('state', st => { b.st = st; act(b); });
    await new Promise(r => s.emit('student:join', { code, name: b.name }, r));
    bots.push(b);
    setInterval(() => b.st && act(b), 150);
  }
  function act(b) {
    const g = b.st.game; if (!g || g.phase !== 'plan' || !g.me) return;
    const me = g.me;
    if (!me.plan && !b.planning) {
      b.planning = true;
      let gear = Math.min(4, Math.max(1, me.gear + (me.engine < 2 ? -1 : 1)));
      gear = Math.min(gear, me.hand.length);
      const sc = v => typeof v === 'number' ? v : v === 'S' ? 2 : -1;
      const cards = [...Array(me.hand.length).keys()].sort((a, c) => sc(me.hand[c]) - sc(me.hand[a])).slice(0, gear);
      b.s.emit('student:plan', { gear, cards, boost: Math.random() < .3 }, res => { b.planning = false; if (!res.ok) console.log('plan fail', res.msg); });
    } else if (me.plan && me.q && !me.answered && !b.answering) {
      b.answering = true;
      const tp = tstate && tstate.rooms.flatMap(r => r.game ? r.game.players : []).find(p => p.name === b.name);
      if (!tp || !tp.q || tp.q.q !== me.q.q) { b.answering = false; return; }
      const right = tp.q.answer;
      b.s.emit('student:answer', { choice: Math.random() < (+process.env.ACC || .8) ? right : (right + 1) % 4 }, () => { b.answering = false; });
    }
  }
  const seenGames = new Set(); const groups = [];
  const start = Date.now();
  while (Date.now() - start < 120000) {
    await sleep(200);
    if (!tstate) continue;
    for (const r of tstate.rooms) if (r.game && !seenGames.has(r.game.no) && r.status === 'playing') { seenGames.add(r.game.no); groups.push(r.playerIds.map(id => tstate.students.find(s => s.id === id).name)); }
    if (tstate.resultsCount >= GAMES) break;
  }
  const res = await new Promise(r => t.emit('teacher:results', {}, r));
  console.log('경기 수', res.results.length, '걸린 시간', ((Date.now() - start) / 1000).toFixed(1) + 's');
  res.results.forEach(g => console.log(`#${g.no} ${g.room} 라운드${g.rounds} ${g.reason}:`, g.players.map(p => `${p.rank}.${p.name}(${p.right}/${p.total},스핀${p.spins})`).join(' ')));
  // 재배정 규칙 확인: 같은 이전 경기 출신이 3명 이상인 방이 있는지
  const lastOf = {}; let violations = 0;
  const byNo = Object.fromEntries(res.results.map(g => [g.no, g]));
  const order = res.results.slice().sort((a, b) => a.no - b.no);
  const prev = {}; let viol = 0; groups.forEach(g => { const cnt = {}; g.forEach(n => { if (prev[n]) cnt[prev[n]] = (cnt[prev[n]] || 0) + 1; }); if (Object.values(cnt).some(v => v >= 3)) viol++; const key = g.join(','); g.forEach(n => prev[n] = key); });
  console.log('전 방 친구 3명 이상 모인 방:', viol);
  console.log('방 구성:', groups.map(g => g.length).join(','));
  console.log('정답률 합', res.students.map(s => s.stats.correct + '/' + s.stats.total).join(' '));
  process.exit(0);
})();
