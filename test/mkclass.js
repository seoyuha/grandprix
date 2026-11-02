// 시험용: 수업을 만들고 방 코드를 출력, 교사 연결을 유지
const { io } = require('socket.io-client');
const t = io(process.env.URL || 'http://localhost:3998');
t.emit('teacher:create', { pw: process.env.TEACHER_PW }, r => {
  t.emit('teacher:settings', { units: (process.env.UNITS || '10').split(',').map(Number), roundSec: +(process.env.RS || 40) }, () => { console.log(r.code); });
});
t.on('tstate', s => { if (process.env.END && s.rooms.some(r => r.game && r.game.round >= +process.env.END)) { t.emit('teacher:endAll', {}, () => {}); } });
