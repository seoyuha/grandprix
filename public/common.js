/* 부릉부릉 영어 그랑프리 — 학생·교사 화면이 함께 쓰는 트랙 그리기 (새 그래픽) */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const IMG = 'img/';
  const COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'sky'];
  const CAR_COLORS = { red: '#ef4444', blue: '#2563eb', yellow: '#facc15', green: '#22c55e', purple: '#9333ea', orange: '#f97316', pink: '#ec4899', sky: '#06b6d4' };
  const CAR_NAMES = { red: '레드', blue: '블루', yellow: '옐로', green: '그린', purple: '퍼플', orange: '오렌지', pink: '핑크', sky: '스카이' };
  const W = 1672, H = 941;
  const FRAMES = { idle: [0], drive: [0, 1, 2, 3], boost: [4, 5, 6, 7], spin: [8, 9, 10, 11, 12, 13, 14, 15] };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const img = (name, attrs, parent) => { const e = el('image', Object.assign({ href: IMG + name + '.webp', preserveAspectRatio: 'xMidYMid meet' }, attrs), parent); return e; };
  const face = c => IMG + 'face_' + (COLORS.includes(c) ? c : 'red') + '.webp';
  const sideCar = c => IMG + 'car_' + (COLORS.includes(c) ? c : 'red') + '.webp';

  // 자동차 프레임 미리 불러오기
  const loaded = new Set();
  function preload(colors) {
    for (const c of colors) {
      if (loaded.has(c)) continue; loaded.add(c);
      for (let k = 0; k < 16; k++) { const i = new Image(); i.src = `${IMG}spr_${c}_${k}.webp`; }
    }
  }

  function trackUnits(track) { return track.units || [...new Set(track.sectors.map(s => s.unit))]; }
  function trackKey(track) {
    const units = trackUnits(track).slice().sort();
    const k = units.join('_');
    return units.length <= 2 && window.TRACK_PATHS[k] ? k : 'mix';
  }
  // 칸 번호 → 단원
  function unitAt(track, space) {
    const L = track.len, sp = ((Math.floor(space) % L) + L) % L;
    if (track.spaceUnits) return track.spaceUnits[sp];
    return track.sectors[Math.floor(sp / track.sectorLen)].unit;
  }

  // 트랙 만들기: 돌려주는 객체로 차 위치를 바꿔요.
  function Track(svg, track, opts) {
    opts = opts || {};
    const key = trackKey(track);
    const data = window.TRACK_PATHS[key];
    const P = data.p, N = P.length / 2, RW = data.w;
    const L = track.len;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.innerHTML = '';
    let cx = 0, cy = 0; for (let i = 0; i < N; i++) { cx += P[i * 2]; cy += P[i * 2 + 1]; } cx /= N; cy /= N;
    function pt(f) { // f: 0~1 (한 바퀴)
      f = ((f % 1) + 1) % 1; const x = f * N; const i = Math.floor(x) % N, j = (i + 1) % N, t = x - Math.floor(x);
      return [P[i * 2] + (P[j * 2] - P[i * 2]) * t, P[i * 2 + 1] + (P[j * 2 + 1] - P[i * 2 + 1]) * t];
    }
    function frameAt(f, lane) {
      const a = pt(f), b = pt(f + 0.004), c0 = pt(f - 0.004);
      const ang = Math.atan2(b[1] - c0[1], b[0] - c0[0]);
      let nx = -Math.sin(ang), ny = Math.cos(ang);
      if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; } // n은 늘 안쪽(잔디 쪽)
      return { x: a[0] + nx * lane, y: a[1] + ny * lane, ang: ang * 180 / Math.PI, nx, ny };
    }
    const at = (i, lane) => frameAt((i + 0.5) / L, (lane || 0) * RW * 0.27); // lane: -1(바깥)~1(안쪽)
    const bound = j => frameAt(j / L, 0);

    img(opts.small ? 'track_' + key + '_s' : 'track_' + key, { x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none' }, svg);
    // 칸 경계
    const marks = el('g', { opacity: opts.small ? 0.5 : 0.75 }, svg);
    for (let j = 0; j < L; j++) {
      const b = bound(j); const h = RW / 2 - 6;
      el('line', { x1: b.x - b.nx * h, y1: b.y - b.ny * h, x2: b.x + b.nx * h, y2: b.y + b.ny * h, stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.55 }, marks);
    }
    // 단원 구역 표시
    if (!opts.small) (trackUnits(track).length === 2 ? [6, 13, 22, 30] : [6, 13, 27]).forEach(sp => {
      const m = frameAt(sp / L, RW / 2 + 52);
      img('unit_' + unitAt(track, sp), { x: m.x - 85, y: m.y - 30, width: 170, height: 60 }, svg);
    });
    // 출발선
    const s0 = bound(0);
    img('checker', { x: -RW / 2, y: -14, width: RW, height: 28, preserveAspectRatio: 'none', transform: `translate(${s0.x},${s0.y}) rotate(${s0.ang + 90})` }, svg);
    if (!opts.small) { const sp = frameAt(0, RW / 2 + 70); img('plate_start', { x: sp.x - 55, y: sp.y - 22, width: 110, height: 44 }, svg); }
    // 코너
    for (const cn of track.corners) {
      const b = bound(cn.at + 1); const h = RW / 2 - 4;
      el('line', { x1: b.x - b.nx * h, y1: b.y - b.ny * h, x2: b.x + b.nx * h, y2: b.y + b.ny * h, stroke: '#fde047', 'stroke-width': 7, 'stroke-dasharray': '14 8' }, svg);
      const s = frameAt((cn.at + 1) / L, RW / 2 + 48);
      const z = opts.small ? 90 : 78;
      img(cn.limit >= 3 && cn.limit <= 5 ? 'sign_' + cn.limit : 'sign_blank', { x: s.x - z / 2, y: s.y - z / 2, width: z, height: z }, svg);
    }
    const ghostLayer = el('g', { class: 'ghost' }, svg);
    const carLayer = el('g', {}, svg);
    const nameLayer = el('g', {}, svg);
    const fx = el('g', {}, svg);
    const cars = {};
    const CAR = opts.small ? 150 : 124;

    function lanes(players, posOf) {
      // 같은 칸의 차는 안쪽·바깥쪽으로 나눠 세워요
      const out = {}; const bySpace = {};
      players.forEach(p => { const s = Math.round(posOf(p)); (bySpace[s] = bySpace[s] || []).push(p.id); });
      for (const s in bySpace) bySpace[s].forEach((id, k) => { out[id] = bySpace[s].length === 1 ? 0 : (k % 2 === 0 ? 1 : -1) * (k > 1 ? 0.5 : 1); });
      return out;
    }
    function setFrame(c, k) { c.im.setAttribute('href', `${IMG}spr_${c.color}_${k}.webp`); }
    function place(id, pos, lane) {
      const c = cars[id]; if (!c) return;
      const a = at(pos, lane);
      c.g.setAttribute('transform', `translate(${a.x},${a.y}) rotate(${a.ang + 90})`);
      c.pos = pos;
      if (c.name) { c.name.setAttribute('x', a.x); c.name.setAttribute('y', a.y - 50); }
    }
    return {
      at, key,
      setSub() {},
      setPlayers(players, meId, displayPos) {
        preload(players.map(p => p.car));
        for (const id in cars) if (!players.find(p => p.id === id)) { cars[id].g.remove(); cars[id].name && cars[id].name.remove(); delete cars[id]; }
        for (const p of players) {
          if (!cars[p.id] || cars[p.id].color !== p.car) {
            if (cars[p.id]) { cars[p.id].g.remove(); cars[p.id].name && cars[p.id].name.remove(); }
            const g = el('g', {}, carLayer);
            if (p.id === meId) el('circle', { r: CAR * 0.42, fill: 'rgba(253,224,71,.45)', stroke: '#fde047', 'stroke-width': 5 }, g);
            const im = img(`spr_${p.car}_0`, { x: -CAR / 2, y: -CAR / 2, width: CAR, height: CAR }, g);
            const name = opts.small ? null : el('text', { class: 'carName' + (p.id === meId ? ' me' : ''), 'text-anchor': 'middle', 'font-size': 30, 'stroke-width': 8 }, nameLayer);
            cars[p.id] = { g, im, name, pos: null, color: p.car, timer: null };
          }
          if (cars[p.id].name) cars[p.id].name.textContent = (p.id === meId ? '★' : '') + p.name;
          cars[p.id].g.style.opacity = p.online === false ? 0.55 : 1;
        }
        const posOf = p => (displayPos && displayPos[p.id] != null ? displayPos[p.id] : p.pos);
        const ln = lanes(players, posOf);
        for (const p of players) place(p.id, posOf(p), ln[p.id] || 0);
      },
      place,
      // 자동차 움직임: idle / drive / boost / spin
      mode(id, m) {
        const c = cars[id]; if (!c) return;
        clearInterval(c.timer); c.timer = null;
        const fr = FRAMES[m] || FRAMES.idle; let k = 0;
        setFrame(c, fr[0]);
        if (fr.length > 1) c.timer = setInterval(() => { k++; if (m === 'spin' && k >= fr.length) { clearInterval(c.timer); c.timer = null; setFrame(c, 0); return; } setFrame(c, fr[k % fr.length]); }, m === 'spin' ? 90 : 110);
      },
      pop(pos, text, kind) {
        const a = at(pos, -2.2);
        const g = el('g', { transform: `translate(${a.x},${a.y})`, class: 'pop ' + (kind || '') }, fx);
        const t = el('text', { 'text-anchor': 'middle', y: 9 }, g); t.textContent = text;
        const bb = t.getBBox();
        const r = el('rect', { x: bb.x - 14, y: bb.y - 8, width: bb.width + 28, height: bb.height + 16, rx: 18 }, g);
        g.insertBefore(r, t);
        setTimeout(() => g.remove(), 1700);
      },
      carEl(id) { return cars[id] && cars[id].g; },
      // 카드를 고를 때 예상 도착 칸 표시 (warn: 코너 경고 색)
      ghost(from, to, warn) {
        ghostLayer.innerHTML = '';
        if (from == null || to == null || to <= from) return;
        for (let i = Math.floor(from) + 1; i < to; i++) { const a = at(i, 0); el('circle', { cx: a.x, cy: a.y, r: 7, fill: warn ? '#ff6b3d' : '#7cf7ff', opacity: .85 }, ghostLayer); }
        const a = at(to, 0);
        const g = el('g', { transform: `translate(${a.x},${a.y})` }, ghostLayer);
        el('circle', { r: 46, fill: warn ? 'rgba(255,90,60,.35)' : 'rgba(80,230,255,.35)', stroke: warn ? '#ff5a3c' : '#22c3e6', 'stroke-width': 6, 'stroke-dasharray': '12 8', class: 'ghostRing' }, g);
        const t = el('text', { y: 12, 'text-anchor': 'middle', class: 'ghostTxt' }, g); t.textContent = warn ? '!' : '★';
      },
    };
  }

  window.RaceCommon = { unitAt, trackKey, Track, CAR_COLORS, CAR_NAMES, COLORS, face, sideCar, el, IMG, preload };
})();
