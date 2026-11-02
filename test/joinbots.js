// 시험용: 이미 만든 수업에 가상 학생 n명을 넣어 천천히 플레이
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3998';
const code = process.argv[2], N = +process.argv[3] || 8;
const cars = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'sky'];
const names = ['하늘', '바다', '구름', '별님', '달님', '나래', '가람', '다온', '라온', '보라', '서진', '하린'];
for (let i = 0; i < N; i++) {
  const s = io(URL); const b = { st: null, busy: false };
  s.emit('student:join', { code, name: names[i], car: cars[i % 8] }, () => {});
  s.on('state', st => { b.st = st; });
  setInterval(() => {
    const g = b.st && b.st.game; if (!g || g.phase !== 'plan' || !g.me || b.busy) return;
    const me = g.me;
    if (!me.plan && Math.random() < .25) {
      b.busy = true; let gear = Math.min(4, Math.max(1, me.gear + (me.engine < 2 ? -1 : 1))); gear = Math.min(gear, me.hand.length);
      const sc = v => typeof v === 'number' ? v : v === 'S' ? 2 : -1;
      const cards = [...Array(me.hand.length).keys()].sort((a, c) => sc(me.hand[c]) - sc(me.hand[a])).slice(0, gear);
      s.emit('student:plan', { gear, cards, boost: Math.random() < .3 }, () => { b.busy = false; });
    } else if (me.plan && me.q && !me.answered && Math.random() < .2) {
      b.busy = true; s.emit('student:answer', { choice: Math.floor(Math.random() * 4) }, () => { b.busy = false; });
    }
  }, 500);
}
