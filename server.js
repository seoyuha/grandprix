// 부릉부릉 영어 그랑프리 — 게임 서버
// 히트(Heat)식 자동차 경주 규칙 + 6학년 영어 10·11·12단원 문제
// 실행: npm install → npm start → 학생 http://localhost:3000  교사 http://localhost:3000/teacher.html
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { UNITS, buildQuestions } = require('./questions');

const PORT = process.env.PORT || 3000;
// 교사 관리 비밀번호: 코드에는 알아볼 수 없는 값(해시)만 넣어 두었어요.
// 바꾸고 싶으면 Render의 Environment에 TEACHER_PASSWORD 를 넣으면 그 값이 쓰여요.
const PW_SALT = 'd057941223c441b7d5e80c1f', PW_HASH = 'c16e713ee933471431d0657ac15d0886d387e97319e6ab154de8e6ecb5aee38e';
function checkPw(pw) {
  pw = String(pw || '');
  if (process.env.TEACHER_PASSWORD) return pw === process.env.TEACHER_PASSWORD;
  const a = crypto.scryptSync(pw, PW_SALT, 32), b = Buffer.from(PW_HASH, 'hex');
  return crypto.timingSafeEqual(a, b);
}
const pwFails = {}; // 틀린 횟수 (주소별) — 5번 틀리면 1분 쉬어요
const FAST = process.env.FAST === '1'; // 테스트용: 연출 시간을 짧게
const BASE_Q = buildQuestions();

const app = express();
app.use(express.json({ limit: '2mb' }));
const page = f => [path.join(__dirname, 'public', f), path.join(__dirname, f)].find(x => fs.existsSync(x));
app.get(['/', '/index.html'], (q, res) => { const f = page('index.html'); f ? res.sendFile(f) : res.status(404).send('index.html 파일을 찾을 수 없어요. public 폴더를 확인하세요.'); });
app.get(['/teacher', '/teacher.html'], (q, res) => { const f = page('teacher.html'); f ? res.sendFile(f) : res.status(404).send('teacher.html 파일을 찾을 수 없어요. public 폴더를 확인하세요.'); });
app.use(express.static(path.join(__dirname, 'public')));
// GitHub에 public 폴더 없이 올렸을 때도 화면 파일을 찾을 수 있게 (서버 파일은 내보내지 않아요)
app.get(['/student.js', '/teacher.js', '/common.js', '/style.css', '/teacher.css'], (q, res, next) => { const f = page(q.path.slice(1)); f ? res.sendFile(f) : next(); });
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

/* ===================== 트랙 ===================== */
const TRACK = {
  len: 36,
  // 배경 그림의 커브에 맞춘 코너: 왼쪽 커브 위(1)·아래(33), 오른쪽 커브 가운데(17)
  corners: [{ at: 1, limit: 5 }, { at: 17, limit: 4 }, { at: 33, limit: 3 }],
  sectorLen: 12,
};
const MAX_PER_SPACE = 2;
const CARS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'sky'];

/* ===================== 저장 ===================== */
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
let classes = {};
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const out = {};
      for (const [code, c] of Object.entries(classes)) {
        out[code] = {
          code, teacherKey: c.teacherKey, createdAt: c.createdAt, settings: c.settings, gameSeq: c.gameSeq,
          results: c.results, wrongs: c.wrongs, custom: c.custom, disabled: c.disabled,
          students: Object.fromEntries(Object.entries(c.students).map(([k, s]) => [k, { id: s.id, name: s.name, car: s.car, token: s.token, lastGroup: s.lastGroup, stats: s.stats }])),
        };
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(out));
    } catch (e) { console.error('save failed', e.message); }
  }, 800);
}
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const [code, c] of Object.entries(raw)) {
      classes[code] = Object.assign(blankClass(code, c.teacherKey), c, { rooms: {}, roomSeq: 0, paused: false });
      classes[code].settings = Object.assign(defaultSettings(), c.settings || {});
      for (const s of Object.values(classes[code].students)) { s.online = false; s.roomId = null; s.socketId = null; }
    }
    console.log('불러온 수업:', Object.keys(classes).join(', ') || '없음');
  } catch (e) { /* 처음 실행 */ }
}

/* ===================== 수업 ===================== */
function defaultSettings() {
  return { units: [10], laps: 2, roundSec: 60, timeLimitMin: 15, minSize: 3, maxSize: 5, autoMode: true, aiFill: true };
}
function blankClass(code, key) {
  return {
    code, teacherKey: key, createdAt: Date.now(), settings: defaultSettings(), students: {}, rooms: {}, roomSeq: 0, gameSeq: 0,
    results: [], wrongs: [], custom: [], disabled: [], paused: false, pausedAt: 0, lobbyChangedAt: Date.now(),
  };
}
function newCode() { let c; do { c = String(Math.floor(1000 + Math.random() * 9000)); } while (classes[c]); return c; }
const uid = (n = 8) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const r4 = () => 1 + Math.floor(Math.random() * 4);

function allQuestions(c) { return BASE_Q.concat(c.custom); }
function activeQuestions(c) { const off = new Set(c.disabled); return allQuestions(c).filter(q => !off.has(q.id)); }
// 칸마다 단원: 1단원은 전체, 2단원은 트랙 왼쪽 절반(앞 단원)·오른쪽 절반(뒤 단원), 3단원은 12칸씩
function zoneUnit(units, space) {
  const u = units && units.length ? units : [10];
  const sp = spaceOf(space);
  if (u.length === 2) return sp >= 9 && sp <= 26 ? u[1] : u[0];
  return u[Math.floor(sp / TRACK.sectorLen) % u.length];
}
function unitForSpace(c, space, units) { return zoneUnit(units || c.settings.units, space); }
const spaceOf = pos => ((pos % TRACK.len) + TRACK.len) % TRACK.len;

function pickQuestion(c, p, unit, level) {
  const act = activeQuestions(c);
  let pool = act.filter(q => q.unit === unit && q.level === level);
  if (!pool.length) pool = act.filter(q => q.unit === unit);
  if (!pool.length) pool = act.filter(q => c.settings.units.includes(q.unit));
  if (!pool.length) pool = act.length ? act : BASE_Q;
  let fresh = pool.filter(q => !p.seen.includes(q.id));
  if (!fresh.length) { p.seen = p.seen.filter(id => !pool.some(q => q.id === id)); fresh = pool; }
  const q = fresh[Math.floor(Math.random() * fresh.length)];
  p.seen.push(q.id);
  const order = shuffle([0, 1, 2, 3]);
  return { id: q.id, unit: q.unit, level: q.level, q: q.q, choices: order.map(i => q.choices[i]), answer: order.indexOf(0), exp: q.exp || '' };
}

/* ===================== 모둠 나누기 ===================== */
// 3~5명씩 나누고, 바로 전 경기에 같은 방이었던 친구가 한 방에 3명 이상 모이지 않게 해요.
function groupSizes(n, minS, maxS) {
  if (n < minS) return [];
  const k = Math.ceil(n / maxS);
  const sizes = Array(k).fill(Math.floor(n / k));
  for (let i = 0; i < n % k; i++) sizes[i]++;
  if (sizes.some(s => s < minS)) { // 아주 드문 경우: 남는 사람은 다음 판
    const k2 = Math.floor(n / minS); const s2 = Array(k2).fill(minS); let left = n - k2 * minS;
    for (let i = 0; left > 0 && i < k2; i++) { const add = Math.min(maxS - minS, left); s2[i] += add; left -= add; }
    return s2;
  }
  return sizes;
}
function partition(students, minS, maxS) {
  const sizes = groupSizes(students.length, minS, maxS);
  if (!sizes.length) return [];
  let best = null, bestBad = Infinity;
  for (let t = 0; t < 400; t++) {
    const pool = shuffle(students.slice());
    const groups = []; let i = 0;
    for (const s of sizes) { groups.push(pool.slice(i, i + s)); i += s; }
    let bad = 0;
    for (const g of groups) {
      const cnt = {};
      for (const s of g) if (s.lastGroup) cnt[s.lastGroup] = (cnt[s.lastGroup] || 0) + 1;
      for (const v of Object.values(cnt)) if (v >= 3) bad += v - 2;
    }
    if (bad < bestBad) { best = groups; bestBad = bad; if (!bad) break; }
  }
  return best;
}
function lobbyStudents(c) { return Object.values(c.students).filter(s => s.online && !s.roomId); }
const ROOM_NAMES = ['1번 피트', '2번 피트', '3번 피트', '4번 피트', '5번 피트', '6번 피트', '7번 피트', '8번 피트', '9번 피트', '10번 피트', '11번 피트', '12번 피트'];
const AI_NAMES = ['AI 번개', 'AI 터보', 'AI 로켓', 'AI 부릉이', 'AI 씽씽이'];
// 빈자리를 AI 친구로 채워요 (학생 수 + AI = 최소 인원)
function addBots(c, room, n) {
  room.bots = room.bots || [];
  const usedNames = new Set(room.bots.map(b => b.name));
  for (let i = 0; i < n; i++) {
    const name = AI_NAMES.find(x => !usedNames.has(x)) || 'AI ' + (room.bots.length + 1); usedNames.add(name);
    room.bots.push({ id: 'ai-' + uid(3), name, car: CARS[(room.bots.length * 3 + 5) % CARS.length], bot: true });
  }
}
function createRoom(c, ids, autoStart) {
  const used = new Set(Object.values(c.rooms).map(r => r.name));
  const name = ROOM_NAMES.find(n => !used.has(n)) || `${++c.roomSeq + 12}번 피트`;
  const room = { id: 'r' + uid(4), name, playerIds: [], bots: [], status: 'waiting', startAt: 0, game: null, paused: false, createdAt: now() };
  c.rooms[room.id] = room;
  for (const id of ids) { const s = c.students[id]; if (s) { s.roomId = room.id; room.playerIds.push(id); } }
  if (autoStart) startCountdown(c, room, FAST ? 800 : 5000);
  return room;
}
function badCount(groups) {
  let bad = 0;
  for (const g of groups) { const cnt = {}; for (const s of g) if (s.lastGroup) cnt[s.lastGroup] = (cnt[s.lastGroup] || 0) + 1; for (const v of Object.values(cnt)) if (v >= 3) bad += v - 2; }
  return bad;
}
function assignLobby(c, autoStart, auto) {
  const lobby = lobbyStudents(c);
  let groups = partition(lobby, c.settings.minSize, c.settings.maxSize);
  if (auto && groups.length && badCount(groups)) {
    // 전 방 친구가 3명 이상 모일 수밖에 없으면, 다른 방이 끝나 친구들이 더 올 때까지 기다려요.
    const othersPlaying = Object.values(c.rooms).some(r => r.status === 'playing' || r.status === 'countdown' || r.status === 'finished');
    const waited = now() - c.lobbyChangedAt;
    if (othersPlaying && waited < (FAST ? 1000 : 10000)) return 0;
  }
  for (const g of groups) createRoom(c, g.map(s => s.id), autoStart);
  return groups.length;
}
function startCountdown(c, room, ms) {
  if (room.status === 'playing') return;
  if (room.playerIds.length < 1) return;
  room.status = 'countdown'; room.startAt = now() + ms;
}

/* ===================== 레이스 규칙 ===================== */
function lateJoin(c, room, s) {
  const g = room.game;
  // AI 친구가 있으면 가장 뒤에 있는 AI의 자리를 이어받아요
  const bots = Object.values(g.players).filter(x => x.bot).sort((a, b) => a.pos - b.pos);
  let startPos = null;
  if (bots.length) { const b = bots[0]; startPos = b.pos; delete g.players[b.id]; g.order = g.order.filter(x => x !== b.id); room.bots = (room.bots || []).filter(x => x.id !== b.id); }
  const ps = Object.values(g.players);
  s.roomId = room.id; s.lobbyAt = 0; if (!room.playerIds.includes(s.id)) room.playerIds.push(s.id);
  const p = newPlayer(s, ps.length);
  p.pos = startPos != null ? startPos : ps.length ? Math.min(...ps.map(x => x.pos)) : 0;
  const used = new Set(ps.map(x => x.car));
  p.car = used.has(s.car) ? (CARS.find(x => !used.has(x)) || s.car) : s.car;
  p.late = true;
  g.players[s.id] = p; g.order.push(s.id);
  g.log.push({ round: g.round, late: s.name, moves: [] });
}
function newPlayer(s, i) {
  const deck = shuffle([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 'S', 'S', 'S']);
  const p = { id: s.id, pos: -Math.floor(i / 2), order: i, gear: 1, engine: 6, deck, hand: [], discard: [], plan: null, q: null,
    answered: false, correct: false, choice: -1, finished: false, finishedAt: 0, seen: [], right: 0, total: 0, spins: 0, wrongs: [] };
  draw(p);
  return p;
}
function draw(p) {
  while (p.hand.length < 7) {
    if (!p.deck.length) { if (!p.discard.length) break; p.deck = shuffle(p.discard); p.discard = []; }
    p.hand.push(p.deck.pop());
  }
}
function payHeat(p, n) { let paid = 0; while (paid < n && p.engine > 0) { p.engine--; p.discard.push('H'); paid++; } return paid; }

function startGame(c, room) {
  room.status = 'playing';
  c.gameSeq++;
  room.bots = room.bots || [];
  const ids = shuffle(room.playerIds.concat(room.bots.map(b => b.id)));
  const g = { no: c.gameSeq, units: c.settings.units.slice(), laps: c.settings.laps, round: 0, phase: 'plan', deadline: 0, showUntil: 0,
    players: {}, order: ids, log: [], lastMoves: [], startedAt: now(), endsAt: now() + c.settings.timeLimitMin * 60000, finishOrder: [] };
  // 같은 방에서 색이 겹치면 다른 색으로 (방 화면과 같은 순서로 정해요)
  const usedCars = new Set(), carOf = {};
  const who = id => c.students[id] || room.bots.find(b => b.id === id);
  room.playerIds.concat(room.bots.map(b => b.id)).forEach(id => { const want = who(id).car; carOf[id] = usedCars.has(want) ? CARS.find(x => !usedCars.has(x)) || want : want; usedCars.add(carOf[id]); });
  ids.forEach((id, i) => { const w = who(id); const pl = newPlayer(w, i); pl.car = carOf[id]; if (w.bot) { pl.bot = true; pl.botName = w.name; } g.players[id] = pl; });
  room.game = g;
  newRound(c, room);
}
function newRound(c, room) {
  const g = room.game;
  g.round++; g.phase = 'plan';
  g.deadline = now() + c.settings.roundSec * 1000;
  for (const p of Object.values(g.players)) { p.plan = null; p.q = null; p.answered = false; p.correct = false; p.choice = -1;
    if (p.bot) p.botAt = now() + (FAST ? 100 + Math.random() * 300 : 4000 + Math.random() * 9000); }
}
// AI 친구의 판단: 엔진 열과 다음 코너를 보고 기어·카드를 골라요. 정답률은 약 75%.
function botAct(c, room, p) {
  const g = room.game;
  let gear = p.engine <= 1 ? Math.max(1, p.gear - 1) : Math.min(4, p.gear + (Math.random() < .6 ? 1 : 0));
  const num = v => typeof v === 'number' ? v : v === 'S' ? 2 : -5;
  for (; gear >= 1; gear--) {
    if (Math.abs(gear - p.gear) > 1 && p.engine < 1) continue;
    const idx = p.hand.map((v, i) => ({ v, i })).sort((a, b) => num(b.v) - num(a.v)).slice(0, gear).map(x => x.i);
    if (idx.length < gear) continue;
    const sum = idx.reduce((a, i) => a + Math.max(0, num(p.hand[i])), 0);
    const need = cornersBetween(p.pos, p.pos + sum).reduce((a, cn) => a + Math.max(0, sum - cn.limit), 0);
    if (need < p.engine || gear === 1) { p.plan = { gear, cards: idx, boost: p.engine >= 4 && Math.random() < .3 }; break; }
  }
  if (!p.plan) p.plan = autoPlan(p);
  p.answered = true; p.correct = Math.random() < .75; p.total++; if (p.correct) p.right++;
}
function validPlan(p, gear, cards, boost) {
  gear = Math.round(Number(gear));
  if (!(gear >= 1 && gear <= 4)) return null;
  const diff = Math.abs(gear - p.gear);
  if (diff > 2) return null;
  if (diff === 2 && p.engine < 1) return null;
  if (!Array.isArray(cards) || cards.length !== gear) return null;
  const set = new Set(cards.map(Number));
  if (set.size !== gear) return null;
  for (const i of set) if (!(i >= 0 && i < p.hand.length)) return null;
  return { gear, cards: [...set], boost: !!boost };
}
function autoPlan(p) {
  const gear = Math.min(4, Math.max(1, p.gear));
  const idx = p.hand.map((v, i) => ({ v, i })).sort((a, b) => score(b.v) - score(a.v)).slice(0, gear).map(x => x.i);
  function score(v) { return typeof v === 'number' ? v : v === 'S' ? 0.5 : -1; }
  return { gear: Math.min(gear, p.hand.length), cards: idx, boost: false, auto: true };
}
function playersSorted(g) {
  return Object.values(g.players).sort((a, b) => (b.finished - a.finished) || (b.pos - a.pos) || (a.order - b.order));
}
function freeSpot(g, p, target, floor) {
  // 한 칸에 차는 2대까지. 꽉 차 있으면 뒤로 물러나요.
  let t = target;
  while (t > floor && Object.values(g.players).filter(o => o !== p && o.pos === t).length >= MAX_PER_SPACE) t--;
  return t;
}
function cornersBetween(from, to) {
  // from < 코너선 ≤ to-1 (코너 칸을 지나치면 통과)
  const out = [];
  const L = TRACK.len;
  for (let lap = Math.floor((from - L) / L); lap <= Math.floor(to / L) + 1; lap++) {
    for (const cn of TRACK.corners) { const abs = lap * L + cn.at; if (abs >= from && abs < to) out.push({ abs, limit: cn.limit, at: cn.at }); }
  }
  return out.sort((a, b) => a.abs - b.abs);
}

function resolveRound(c, room) {
  const g = room.game;
  if (g.phase !== 'plan') return;
  const ps = Object.values(g.players);
  for (const p of ps) {
    if (!p.plan) { p.plan = autoPlan(p); p.q = p.q || null; }
    if (!p.answered) { p.answered = true; p.correct = false; p.timeout = true; } else p.timeout = false;
  }
  // 꼴찌 보너스(아드레날린): 2~4명이면 꼴찌 1명, 5명이면 꼴찌 2명
  const sorted = playersSorted(g).filter(p => !p.finished);
  const adrN = ps.length >= 5 ? 2 : (ps.length >= 2 ? 1 : 0);
  const adr = new Set(sorted.slice(-adrN).map(p => p.id));
  const moves = [];
  const L = TRACK.len, goal = g.laps * L;
  for (const p of sorted) {
    const plan = p.plan; const m = { id: p.id, from: p.pos, cards: [], speed: 0, heat: 0, boost: 0, adr: adr.has(p.id) ? 1 : 0, slip: 0, spin: false, cool: 0,
      correct: p.correct, timeout: !!p.timeout, auto: !!plan.auto, gear: plan.gear, corners: [] };
    // 기어 바꾸기 (2단 건너뛰면 열 1)
    if (Math.abs(plan.gear - p.gear) === 2) m.heat += payHeat(p, 1);
    p.gear = plan.gear;
    const idx = plan.cards.slice().sort((a, b) => b - a);
    const played = idx.map(i => p.hand.splice(i, 1)[0]);
    for (const card of played) {
      let v = 0;
      if (typeof card === 'number') v = card;
      else if (card === 'S') v = p.correct ? r4() : 0;
      m.cards.push({ card, v }); m.speed += v;
    }
    if (!p.correct) { const h = payHeat(p, 1); m.heat += h; m.overheat = h > 0; }
    if (plan.boost && p.correct && p.engine > 0) { m.heat += payHeat(p, 1); m.boost = r4(); m.speed += m.boost; }
    const move = m.speed + m.adr;
    let target = p.pos + move;
    // 코너 검사
    for (const cn of cornersBetween(p.pos, target)) {
      const over = m.speed - cn.limit;
      if (over <= 0) { m.corners.push({ at: cn.at, limit: cn.limit, ok: true }); continue; }
      if (p.engine >= over) { m.heat += payHeat(p, over); m.corners.push({ at: cn.at, limit: cn.limit, paid: over }); continue; }
      // 스핀!
      m.heat += payHeat(p, p.engine);
      m.spin = true; m.corners.push({ at: cn.at, limit: cn.limit, spin: true });
      const stress = p.gear >= 3 ? 2 : 1;
      for (let i = 0; i < stress; i++) p.hand.push('S');
      m.stress = stress; p.gear = 1; p.spins++;
      target = cn.abs; break;
    }
    p.pos = freeSpot(g, p, target, p.pos - 1);
    // 슬립스트림: 앞차 바로 뒤나 같은 칸이면 +2칸 (코너에서 넘치면 안 해요)
    if (!m.spin && move > 0 && p.pos < goal) {
      const near = ps.some(o => o !== p && !o.finished && (o.pos === p.pos || o.pos === p.pos + 1));
      if (near) {
        const t2 = p.pos + 2;
        const risky = cornersBetween(p.pos, t2).some(cn => m.speed > cn.limit);
        if (!risky) { const np = freeSpot(g, p, t2, p.pos); if (np > p.pos) { m.slip = np - p.pos; p.pos = np; } }
      }
    }
    // 정비(냉각): 정답일 때만 — 1단 3장, 2단 1장, 꼴찌 보너스 +1
    if (p.correct) {
      let cool = (p.gear === 1 ? 3 : p.gear === 2 ? 1 : 0) + m.adr;
      while (cool > 0 && p.hand.includes('H')) { p.hand.splice(p.hand.indexOf('H'), 1); p.engine++; cool--; m.cool++; }
    }
    for (const card of played) p.discard.push(card);
    draw(p);
    m.to = p.pos;
    if (p.pos >= goal && !p.finished) { p.finished = true; p.finishedAt = now(); g.finishOrder.push(p.id); m.finish = true; }
    moves.push(m);
  }
  g.lastMoves = moves; g.lastRound = g.round;
  g.log.push({ round: g.round, moves: moves.map(m => ({ id: m.id, from: m.from, to: m.to, speed: m.speed, spin: m.spin, correct: m.correct })) });
  if (g.log.length > 40) g.log.shift();
  g.phase = 'show';
  g.showUntil = now() + (FAST ? 300 : 2800 + 1300 * moves.length);
}
function afterShow(c, room) {
  const g = room.game;
  const anyFinished = Object.values(g.players).some(p => p.finished);
  if (anyFinished || now() >= g.endsAt) endGame(c, room, anyFinished ? 'finish' : 'time');
  else newRound(c, room);
}
function endGame(c, room, why) {
  const g = room.game; if (!g || g.phase === 'done') return;
  g.phase = 'done'; g.endReason = why; room.status = 'finished'; room.finishedAt = now();
  const ranked = playersSorted(g);
  const PTS = [5, 3, 2, 1, 1];
  const rec = { no: g.no, room: room.name, at: now(), units: g.units, rounds: g.round, reason: why, players: [] };
  ranked.forEach((p, i) => {
    p.rank = i + 1;
    const s = c.students[p.id];
    if (!s) { if (p.bot) rec.players.push({ id: p.id, name: p.botName, rank: i + 1, pts: 0, bot: true, right: p.right, total: p.total, spins: p.spins }); return; }
    const pts = PTS[i] || 1;
    s.stats.games++; s.stats.points += pts; if (i === 0) s.stats.wins++;
    s.lastGroup = 'g' + g.no;
    rec.players.push({ id: p.id, name: s.name, rank: i + 1, pts, laps: Math.max(0, p.pos) / TRACK.len, right: p.right, total: p.total, spins: p.spins });
  });
  c.results.push(rec);
  save();
}
function returnToLobby(c, room) {
  for (const id of room.playerIds) { const s = c.students[id]; if (s && s.roomId === room.id) s.roomId = null; }
  delete c.rooms[room.id];
  c.lobbyChangedAt = now();
}
function rematch(c, room) {
  room.game = null; room.status = 'waiting';
  room.playerIds = room.playerIds.filter(id => c.students[id] && c.students[id].roomId === room.id);
  startCountdown(c, room, FAST ? 500 : 3000);
}

/* ===================== 시계 ===================== */
setInterval(() => {
  const t = now();
  for (const c of Object.values(classes)) {
    let changed = false;
    if (c.paused) continue;
    for (const room of Object.values(c.rooms)) {
      if (room.paused) continue;
      if (room.status === 'countdown' && t >= room.startAt) {
        room.playerIds = room.playerIds.filter(id => c.students[id] && c.students[id].roomId === room.id);
        if (room.playerIds.length) { startGame(c, room); changed = true; } else { delete c.rooms[room.id]; changed = true; }
        continue;
      }
      const g = room.game;
      if (room.status === 'playing' && g) {
        if (g.phase === 'plan') {
          const online = Object.values(g.players).filter(p => c.students[p.id] && c.students[p.id].online);
          if (!online.length) { g.deadline += 250; g.endsAt += 250; continue; } // 모두 연결이 끊기면 저절로 진행하지 않고 기다려요
          const humansDone = online.every(p => p.answered);
          for (const p of Object.values(g.players)) if (p.bot && !p.answered && (t >= p.botAt || humansDone)) { botAct(c, room, p); changed = true; }
          const allDone = humansDone && Object.values(g.players).every(p => !p.bot || p.answered);
          if (t >= g.deadline || allDone) { resolveRound(c, room); changed = true; }
        } else if (g.phase === 'show' && t >= g.showUntil) { afterShow(c, room); changed = true; }
      }
      if (room.status === 'finished' && c.settings.autoMode && t - room.finishedAt > (FAST ? 600 : 25000)) { returnToLobby(c, room); changed = true; }
    }
    for (const s of Object.values(c.students)) { if (s.online && !s.roomId) { if (!s.lobbyAt) s.lobbyAt = t; } else s.lobbyAt = 0; }
    if (c.settings.autoMode) {
      const lobby = lobbyStudents(c);
      // 혼자(1~2명) 오래 기다리는 친구는 막 시작한 경기에 끼워 넣어요
      if (lobby.length && lobby.length < c.settings.minSize) {
        for (const s of lobby) {
          if (t - s.lobbyAt < (FAST ? 500 : 6000)) continue;
          const nBots = r => Object.values(r.game.players).filter(x => x.bot).length;
          const cand = Object.values(c.rooms).filter(r => !r.paused && r.status === 'playing' && r.game && r.game.phase === 'plan' && remain(r.game.deadline) > 10000
            && ((nBots(r) > 0 && r.game.round <= 6) || (r.game.round <= 3 && Object.keys(r.game.players).length < c.settings.maxSize)))
            .sort((a, b) => nBots(b) - nBots(a) || Object.keys(a.game.players).length - Object.keys(b.game.players).length);
          if (cand.length) { lateJoin(c, cand[0], s); changed = true; }
        }
        // 끼워 넣을 경기가 없으면 10초 안에 출발: AI 친구가 빈자리를 채워요 (AI를 끄면 2명이라도 출발)
        const left = lobbyStudents(c);
        const longest = left.length ? Math.min(...left.map(x => x.lobbyAt || t)) : t;
        if (left.length && left.length < c.settings.minSize && t - longest > (FAST ? 900 : 6000)) {
          if (c.settings.aiFill) { const r = createRoom(c, left.map(x => x.id), false); addBots(c, r, c.settings.minSize - left.length); startCountdown(c, r, FAST ? 800 : 5000); changed = true; }
          else if (left.length >= 2) { createRoom(c, left.map(x => x.id), true); changed = true; }
        }
      }
      const oldest = lobby.length ? Math.min(...lobby.map(x => x.lobbyAt || t)) : t;
      if (lobby.length >= c.settings.minSize && (t - c.lobbyChangedAt > (FAST ? 300 : 4000) || t - oldest > (FAST ? 800 : 9000) || lobby.length >= c.settings.maxSize * 2)) {
        if (assignLobby(c, true, true)) changed = true;
      }
    }
    if (changed) push(c);
  }
}, 250);

/* ===================== 보내기 ===================== */
const pushTimers = {};
function push(c) {
  if (pushTimers[c.code]) return;
  pushTimers[c.code] = setTimeout(() => { delete pushTimers[c.code]; pushNow(c); }, 60);
}
function pushNow(c) {
  for (const s of Object.values(c.students)) if (s.online && s.socketId) io.to(s.socketId).emit('state', studentView(c, s));
  io.to('t:' + c.code).emit('tstate', teacherView(c));
}
function remain(t) { return Math.max(0, t - now()); }
function pubPlayer(c, g, p) {
  const s = c.students[p.id] || (p.bot ? { name: p.botName, online: true } : {});
  return { id: p.id, name: s.name || '?', car: p.car || s.car || 'red', online: !!s.online, bot: !!p.bot, pos: p.pos, gear: p.gear, engine: p.engine,
    hand: p.hand.length, heatInHand: p.hand.filter(x => x === 'H').length, ready: !!p.plan, answered: p.answered, finished: p.finished, rank: p.rank || 0,
    right: p.right, total: p.total, spins: p.spins };
}
function trackInfo(c, units) {
  const u = units && units.length ? units : c.settings.units;
  return { len: TRACK.len, corners: TRACK.corners, sectorLen: TRACK.sectorLen,
    sectors: [0, 1, 2].map(i => { const un = u[i % u.length]; return { unit: un, zone: UNITS[un].zone, icon: UNITS[un].icon }; }),
    units: u.slice(), spaceUnits: Array.from({ length: TRACK.len }, (_, i) => zoneUnit(u, i)) };
}
function gameView(c, room, forId) {
  const g = room.game; if (!g) return null;
  const players = playersSorted(g).map(p => pubPlayer(c, g, p));
  const v = { no: g.no, round: g.round, phase: g.phase, laps: g.laps, remain: g.phase === 'plan' ? remain(g.deadline) : 0,
    timeLeft: remain(g.endsAt), players, moves: g.lastMoves, movesRound: g.lastRound || 0, track: trackInfo(c, g.units), endReason: g.endReason || '' };
  const me = g.players[forId];
  if (me) {
    v.me = { wrongs: g.phase === 'done' ? me.wrongs : undefined, late: !!me.late, hand: me.hand, deck: me.deck.length, discard: me.discard.length, discardHeat: me.discard.filter(x => x === 'H').length,
      deckHeat: me.deck.filter(x => x === 'H').length, engine: me.engine, gear: me.gear, pos: me.pos,
      plan: me.plan ? { gear: me.plan.gear, cards: me.plan.cards, boost: me.plan.boost } : null, answered: me.answered, correct: me.correct, choice: me.choice,
      unitHere: unitForSpace(c, Math.max(0, me.pos), g.units) };
    if (me.q) v.me.q = { q: me.q.q, choices: me.q.choices, unit: me.q.unit, level: me.q.level,
      answer: me.answered ? me.q.answer : -1, exp: me.answered ? me.q.exp : '' };
  }
  return v;
}
function studentView(c, s) {
  const base = { me: { id: s.id, name: s.name, car: s.car, stats: s.stats }, code: c.code, paused: c.paused,
    settings: { units: c.settings.units, laps: c.settings.laps, roundSec: c.settings.roundSec, autoMode: c.settings.autoMode, aiFill: c.settings.aiFill },
    units: UNITS, cars: CARS, takenCars: [] };
  const room = s.roomId && c.rooms[s.roomId];
  if (!room) return Object.assign(base, { stage: 'lobby', lobby: lobbyStudents(c).map(x => ({ name: x.name, car: x.car })),
    playingRooms: Object.values(c.rooms).filter(r => r.status === 'playing').length, minSize: c.settings.minSize });
  base.room = { id: room.id, name: room.name, status: room.status, paused: room.paused || c.paused, startIn: room.status === 'countdown' ? remain(room.startAt) : 0,
    members: (() => { const used = new Set(); return room.playerIds.map(id => c.students[id]).filter(Boolean).map(x => { const car = used.has(x.car) ? (CARS.find(k => !used.has(k)) || x.car) : x.car; used.add(car); return { id: x.id, name: x.name, car, online: x.online }; }).concat((room.bots || []).map(b => { const car = used.has(b.car) ? (CARS.find(k => !used.has(k)) || b.car) : b.car; used.add(car); return { id: b.id, name: b.name, car, online: true, bot: true }; })); })() };
  base.stage = room.status === 'playing' || room.status === 'finished' ? 'game' : 'room';
  base.game = gameView(c, room, s.id);
  return base;
}
function teacherView(c) {
  return {
    code: c.code, settings: c.settings, paused: c.paused, units: UNITS,
    students: Object.values(c.students).map(s => ({ id: s.id, name: s.name, car: s.car, online: s.online, roomId: s.roomId, stats: s.stats, waitSec: s.lobbyAt ? Math.floor((now() - s.lobbyAt) / 1000) : 0 })),
    rooms: Object.values(c.rooms).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })).map(r => {
      const g = r.game;
      return { id: r.id, name: r.name, status: r.status, paused: r.paused, startIn: r.status === 'countdown' ? remain(r.startAt) : 0, playerIds: r.playerIds, bots: (r.bots || []).map(b => ({ id: b.id, name: b.name, car: b.car, bot: true, online: true })),
        game: g ? { no: g.no, round: g.round, phase: g.phase, laps: g.laps, remain: g.phase === 'plan' ? remain(g.deadline) : 0, timeLeft: remain(g.endsAt),
          track: trackInfo(c, g.units), endReason: g.endReason || '',
          players: playersSorted(g).map(p => Object.assign(pubPlayer(c, g, p), {
            q: p.q ? { q: p.q.q, choices: p.q.choices, answer: p.q.answer, unit: p.q.unit, level: p.q.level } : null, choice: p.choice, correct: p.correct,
            plan: p.plan ? { gear: p.plan.gear, boost: p.plan.boost } : null })),
          log: g.log.slice(-6) } : null };
    }),
    lobby: lobbyStudents(c).map(s => s.id),
    resultsCount: c.results.length,
  };
}

/* ===================== 소켓 ===================== */
io.on('connection', socket => {
  let cls = null, sid = null, isTeacher = false;
  const ack = (cb, v) => { if (typeof cb === 'function') cb(v); };
  const T = (fn) => (...args) => { const cb = args[args.length - 1]; if (!isTeacher || !cls) return ack(cb, { ok: false, msg: '교사 연결이 끊겼어요. 새로고침하세요.' }); try { fn(...args); push(cls); save(); } catch (e) { console.error(e); ack(cb, { ok: false, msg: '오류: ' + e.message }); } };

  // ---------- 교사 ----------
  const ip = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '').split(',')[0].trim();
  function pwGate(pw, cb) {
    const f = pwFails[ip] || { n: 0, until: 0 };
    if (f.until > now()) { ack(cb, { ok: false, pw: true, msg: `비밀번호를 여러 번 틀렸어요. ${Math.ceil((f.until - now()) / 1000)}초 뒤에 다시 해 주세요.` }); return false; }
    if (!checkPw(pw)) { f.n++; if (f.n >= 5) { f.until = now() + 60000; f.n = 0; } pwFails[ip] = f; ack(cb, { ok: false, pw: true, msg: '비밀번호가 맞지 않아요.' }); return false; }
    delete pwFails[ip]; return true;
  }
  socket.on('teacher:login', ({ pw } = {}, cb) => { if (pwGate(pw, cb)) ack(cb, { ok: true }); });
  socket.on('teacher:create', ({ pw } = {}, cb) => {
    if (!pwGate(pw, cb)) return;
    const code = newCode(); const key = uid(12);
    classes[code] = blankClass(code, key);
    cls = classes[code]; isTeacher = true; socket.join('t:' + code); save();
    ack(cb, { ok: true, code, key }); push(cls);
  });
  socket.on('teacher:resume', ({ code, key, pw } = {}, cb) => {
    if (!pwGate(pw, cb)) return;
    const c = classes[code];
    if (!c || c.teacherKey !== key) return ack(cb, { ok: false, msg: '이전 수업을 찾을 수 없어요. 새 수업을 만들어 주세요.' });
    cls = c; isTeacher = true; socket.join('t:' + code); ack(cb, { ok: true, code }); push(cls);
  });
  socket.on('teacher:settings', T((st, cb) => {
    const s = cls.settings;
    if (Array.isArray(st.units)) { const u = st.units.map(Number).filter(x => UNITS[x]); if (u.length) s.units = [...new Set(u)].sort(); }
    if (st.laps) s.laps = Math.min(3, Math.max(1, Math.round(st.laps)));
    if (st.roundSec) s.roundSec = Math.min(120, Math.max(20, Math.round(st.roundSec)));
    if (st.timeLimitMin) s.timeLimitMin = Math.min(40, Math.max(3, Math.round(st.timeLimitMin)));
    if (st.minSize) s.minSize = Math.min(5, Math.max(2, Math.round(st.minSize)));
    if (st.maxSize) s.maxSize = Math.min(6, Math.max(s.minSize, Math.round(st.maxSize)));
    if (typeof st.aiFill === 'boolean') s.aiFill = st.aiFill;
    if (typeof st.autoMode === 'boolean') { s.autoMode = st.autoMode; cls.lobbyChangedAt = now() - 10000; }
    ack(cb, { ok: true });
  }));
  socket.on('teacher:assign', T((_, cb) => {
    const n = assignLobby(cls, cls.settings.autoMode);
    ack(cb, n ? { ok: true, msg: `${n}개 방을 만들었어요.` } : { ok: false, msg: `대기실 학생이 ${cls.settings.minSize}명보다 적어요.` });
  }));
  socket.on('teacher:startAll', T((_, cb) => {
    let n = 0; for (const r of Object.values(cls.rooms)) if (r.status === 'waiting') { startCountdown(cls, r, FAST ? 300 : 3000); n++; }
    ack(cb, n ? { ok: true, msg: `${n}개 방이 곧 출발해요.` } : { ok: false, msg: '출발을 기다리는 방이 없어요.' });
  }));
  socket.on('teacher:pauseAll', T((_, cb) => {
    if (!cls.paused) { cls.paused = true; cls.pausedAt = now(); }
    else { const d = now() - cls.pausedAt; cls.paused = false; shiftTimes(cls, Object.values(cls.rooms), d); }
    ack(cb, { ok: true, paused: cls.paused });
  }));
  socket.on('teacher:endAll', T((_, cb) => {
    for (const r of Object.values(cls.rooms)) {
      if (r.status === 'playing') { if (r.game.phase === 'plan') resolveRound(cls, r); endGame(cls, r, 'teacher'); }
    }
    ack(cb, { ok: true });
  }));
  socket.on('teacher:allToLobby', T((_, cb) => {
    for (const r of Object.values(cls.rooms)) if (r.status !== 'playing') returnToLobby(cls, r);
    ack(cb, { ok: true });
  }));
  socket.on('teacher:room', T(({ roomId, action } = {}, cb) => {
    const r = cls.rooms[roomId]; if (!r) return ack(cb, { ok: false, msg: '방이 없어요.' });
    if (action === 'start' && (r.status === 'waiting')) startCountdown(cls, r, FAST ? 300 : 3000);
    else if (action === 'pause') { if (!r.paused) { r.paused = true; r.pausedAt = now(); } else { r.paused = false; shiftTimes(cls, [r], now() - r.pausedAt); } }
    else if (action === 'end' && r.status === 'playing') { if (r.game.phase === 'plan') resolveRound(cls, r); endGame(cls, r, 'teacher'); }
    else if (action === 'rematch' && r.status === 'finished') rematch(cls, r);
    else if (action === 'lobby') { if (r.status === 'playing') endGame(cls, r, 'teacher'); returnToLobby(cls, r); }
    else if (action === 'skip' && r.status === 'playing' && r.game.phase === 'plan') resolveRound(cls, r);
    ack(cb, { ok: true });
  }));
  socket.on('teacher:newRoom', T((_, cb) => { const r = createRoom(cls, [], false); ack(cb, { ok: true, id: r.id }); }));
  socket.on('teacher:move', T(({ sid: id, to } = {}, cb) => {
    const s = cls.students[id]; if (!s) return ack(cb, { ok: false, msg: '학생이 없어요.' });
    const from = s.roomId && cls.rooms[s.roomId];
    if (to && to !== 'lobby') {
      const r = cls.rooms[to]; if (!r) return ack(cb, { ok: false, msg: '방이 없어요.' });
      if (r.status === 'playing') return ack(cb, { ok: false, msg: '경기 중인 방에는 넣을 수 없어요. 경기가 끝난 뒤 옮겨 주세요.' });
      if (r.playerIds.length >= 6) return ack(cb, { ok: false, msg: '한 방은 6명까지예요.' });
    }
    if (from) {
      from.playerIds = from.playerIds.filter(x => x !== id);
      if (from.game && from.game.players[id] && from.status === 'playing') delete from.game.players[id];
      if (!from.playerIds.length) delete cls.rooms[from.id];
    }
    s.roomId = null;
    if (to && to !== 'lobby') { const r = cls.rooms[to]; r.playerIds.push(id); s.roomId = r.id; }
    cls.lobbyChangedAt = now();
    ack(cb, { ok: true });
  }));
  socket.on('teacher:kick', T(({ sid: id } = {}, cb) => {
    const s = cls.students[id]; if (!s) return ack(cb, { ok: false });
    const from = s.roomId && cls.rooms[s.roomId];
    if (from) { from.playerIds = from.playerIds.filter(x => x !== id); if (from.game) delete from.game.players[id]; if (!from.playerIds.length) delete cls.rooms[from.id]; }
    if (s.socketId) io.to(s.socketId).emit('kicked');
    delete cls.students[id]; ack(cb, { ok: true });
  }));
  socket.on('teacher:questions', (_, cb) => {
    if (!isTeacher || !cls) return ack(cb, { ok: false });
    const off = new Set(cls.disabled);
    ack(cb, { ok: true, list: allQuestions(cls).map(q => Object.assign({}, q, { on: !off.has(q.id), custom: q.id.startsWith('c-') })) });
  });
  socket.on('teacher:qToggle', T(({ ids, on } = {}, cb) => {
    const set = new Set(cls.disabled); for (const id of ids || []) on ? set.delete(id) : set.add(id);
    cls.disabled = [...set]; ack(cb, { ok: true });
  }));
  socket.on('teacher:qAdd', T(({ rows, replace } = {}, cb) => {
    if (replace) cls.custom = [];
    let ok = 0, bad = 0, dup = 0;
    const seen = new Set(allQuestions(cls).map(q => q.unit + '|' + q.q));
    for (const r of rows || []) {
      const unit = Number(String(r.unit).replace(/[^0-9]/g, '')), level = Number(String(r.level).replace(/[^0-9]/g, '')) || 2;
      const choices = (r.choices || []).map(x => String(x || '').trim());
      const ans = Number(r.answer) - 1;
      if (!UNITS[unit] || !(level >= 1 && level <= 4) || !String(r.q || '').trim() || choices.length !== 4 || choices.some(x => !x) || !(ans >= 0 && ans <= 3)) { bad++; continue; }
      const key = unit + '|' + String(r.q).trim(); if (seen.has(key)) { dup++; continue; } seen.add(key);
      const ordered = [choices[ans], ...choices.filter((_, i) => i !== ans)];
      cls.custom.push({ id: 'c-' + uid(4), unit, level, q: String(r.q).trim(), choices: ordered, exp: String(r.exp || '').trim() }); ok++;
    }
    ack(cb, { ok: true, added: ok, bad, dup });
  }));
  socket.on('teacher:qDelete', T(({ ids } = {}, cb) => { const del = new Set(ids || []); cls.custom = cls.custom.filter(q => !del.has(q.id)); ack(cb, { ok: true }); }));
  socket.on('teacher:results', (_, cb) => {
    if (!isTeacher || !cls) return ack(cb, { ok: false });
    ack(cb, { ok: true, results: cls.results, wrongs: cls.wrongs.slice(-2000),
      students: Object.values(cls.students).map(s => ({ id: s.id, name: s.name, stats: s.stats })) });
  });
  socket.on('teacher:resetResults', T((_, cb) => {
    cls.results = []; cls.wrongs = [];
    for (const s of Object.values(cls.students)) s.stats = blankStats();
    ack(cb, { ok: true });
  }));

  // ---------- 학생 ----------
  socket.on('student:join', ({ code, name, token, car } = {}, cb) => {
    code = String(code || '').trim(); const c = classes[code];
    if (!c) return ack(cb, { ok: false, msg: '방 코드를 다시 확인해 주세요.' });
    let s = token && Object.values(c.students).find(x => x.token === token);
    if (!s) {
      name = String(name || '').trim().slice(0, 12);
      if (!name) return ack(cb, { ok: false, msg: '이름을 입력해 주세요.' });
      const same = Object.values(c.students).find(x => x.name === name);
      if (same && same.online) return ack(cb, { ok: false, msg: '같은 이름이 이미 들어와 있어요. 번호를 붙여 주세요. (예: 3번 김하늘)' });
      if (same) s = same; // 같은 이름으로 다시 들어오면 이어서
      else {
        s = { id: 's' + uid(4), name, car: CARS.includes(car) ? car : CARS[Object.keys(c.students).length % CARS.length], token: uid(10), online: true,
          roomId: null, lastGroup: null, stats: blankStats() };
        c.students[s.id] = s;
      }
    }
    if (s.socketId && s.socketId !== socket.id) io.to(s.socketId).emit('kicked', '다른 기기에서 같은 이름으로 들어왔어요.');
    s.socketId = socket.id; s.online = true; cls = c; sid = s.id;
    c.lobbyChangedAt = now();
    ack(cb, { ok: true, token: s.token, id: s.id }); push(c); save();
  });
  socket.on('student:car', ({ car } = {}, cb) => {
    const s = cls && cls.students[sid]; if (!s || !CARS.includes(car)) return ack(cb, { ok: false });
    s.car = car; ack(cb, { ok: true }); push(cls); save();
  });
  socket.on('student:plan', ({ gear, cards, boost } = {}, cb) => {
    const s = cls && cls.students[sid]; const room = s && s.roomId && cls.rooms[s.roomId]; const g = room && room.game;
    if (!g || g.phase !== 'plan' || room.paused || cls.paused) return ack(cb, { ok: false, msg: '지금은 고를 수 없어요.' });
    const p = g.players[sid]; if (!p || p.plan) return ack(cb, { ok: false, msg: '이미 출발 준비를 했어요.' });
    const plan = validPlan(p, gear, cards, boost);
    if (!plan) return ack(cb, { ok: false, msg: '기어 수만큼 카드를 골라 주세요.' });
    p.plan = plan;
    p.q = pickQuestion(cls, p, unitForSpace(cls, Math.max(0, p.pos), g.units), plan.gear);
    ack(cb, { ok: true }); push(cls);
  });
  socket.on('student:answer', ({ choice } = {}, cb) => {
    const s = cls && cls.students[sid]; const room = s && s.roomId && cls.rooms[s.roomId]; const g = room && room.game;
    if (!g || g.phase !== 'plan') return ack(cb, { ok: false, msg: '시간이 끝났어요.' });
    const p = g.players[sid]; if (!p || !p.q || p.answered) return ack(cb, { ok: false });
    p.choice = Number(choice); p.answered = true; p.correct = p.choice === p.q.answer;
    p.total++; if (p.correct) p.right++;
    const st = s.stats; st.total++; if (p.correct) st.correct++;
    st.byUnit[p.q.unit] = st.byUnit[p.q.unit] || { c: 0, t: 0 }; st.byUnit[p.q.unit].t++; if (p.correct) st.byUnit[p.q.unit].c++;
    if (!p.correct) p.wrongs.push({ unit: p.q.unit, level: p.q.level, q: p.q.q, chosen: p.q.choices[p.choice] || '', answer: p.q.choices[p.q.answer], exp: p.q.exp || '' });
    if (!p.correct) cls.wrongs.push({ at: now(), name: s.name, unit: p.q.unit, level: p.q.level, q: p.q.q, chosen: p.q.choices[p.choice] || '', answer: p.q.choices[p.q.answer] });
    ack(cb, { ok: true, correct: p.correct, answer: p.q.answer, exp: p.q.exp }); push(cls); save();
  });
  socket.on('student:leave', (_, cb) => {
    // 경기가 끝난 방에서 먼저 대기실로 가기
    const s = cls && cls.students[sid]; const room = s && s.roomId && cls.rooms[s.roomId];
    if (!room || room.status !== 'finished') return ack(cb, { ok: false, msg: '경기가 끝난 뒤에 갈 수 있어요.' });
    s.roomId = null; room.playerIds = room.playerIds.filter(x => x !== sid);
    if (!room.playerIds.some(id => cls.students[id] && cls.students[id].roomId === room.id)) delete cls.rooms[room.id];
    cls.lobbyChangedAt = now();
    ack(cb, { ok: true }); push(cls);
  });
  socket.on('disconnect', () => {
    if (!cls || !sid || isTeacher) return;
    const s = cls.students[sid]; if (!s || s.socketId !== socket.id) return;
    s.online = false; s.socketId = null; cls.lobbyChangedAt = now(); push(cls);
  });
});
function blankStats() { return { games: 0, wins: 0, points: 0, correct: 0, total: 0, byUnit: {} }; }
function shiftTimes(c, rooms, d) {
  for (const r of rooms) {
    if (r.startAt) r.startAt += d;
    const g = r.game; if (!g) continue;
    g.deadline += d; g.showUntil += d; g.endsAt += d;
  }
}

load();
server.listen(PORT, () => console.log(`부릉부릉 영어 그랑프리 서버: http://localhost:${PORT}  (교사: /teacher.html)`));
module.exports = { _test: { groupSizes, partition, cornersBetween } };
