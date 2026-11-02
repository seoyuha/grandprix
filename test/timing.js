const { io } = require('socket.io-client');
const URL = 'http://localhost:3997'; const sleep = ms => new Promise(r => setTimeout(r, ms));
const call = (s, e, d) => new Promise(r => s.emit(e, d || {}, r));
(async () => {
  for (const [label, n] of [['혼자 1명', 1], ['2명', 2], ['3명', 3], ['7명', 7]]) {
    const t = io(URL); let T = null; t.on('tstate', x => T = x); const { code } = await call(t, 'teacher:create', { pw: process.env.TEACHER_PW }); await sleep(200);
    const kids = []; for (let i = 0; i < n; i++) { const s = io(URL); s.emit('student:join', { code, name: 'k' + i }, () => {}); kids.push(s); }
    const t0 = Date.now(); let ta = 0, tp = 0;
    while (Date.now() - t0 < 25000) { await sleep(100); if (!ta && T && T.lobby.length === 0 && T.rooms.length) ta = Date.now() - t0; if (!tp && T && T.rooms.length && T.rooms.every(r => r.status === 'playing')) { tp = Date.now() - t0; break; } }
    console.log(`${label}: 방 배정 ${(ta / 1000).toFixed(1)}초 · 출발 ${(tp / 1000).toFixed(1)}초 · 방 ${T.rooms.map(r => r.playerIds.length + '명' + ((r.bots || []).length ? '+AI' + r.bots.length : '')).join(', ')}`);
    kids.forEach(s => s.disconnect()); t.disconnect();
  }
  process.exit(0);
})();
