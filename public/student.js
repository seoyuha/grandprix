/* 부릉부릉 영어 그랑프리 — 학생 화면 (새 그래픽) */
(function () {
  const { unitAt, Track, CAR_NAMES, COLORS, face, sideCar, IMG, preload } = window.RaceCommon;
  const $app = document.getElementById('app');
  const socket = io({ reconnection: true, reconnectionDelay: 800 });
  const LV = { 1: '1단 · 단어 뜻', 2: '2단 · 문장 뜻', 3: '3단 · 빈칸 채우기', 4: '4단 · 대화와 문장' };
  const PTS = [5, 3, 2, 1, 1];
  const HEAT_X = [16.2, 28.8, 41.7, 54.3, 67.2, 80.0];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('gp_' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('gp_' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('gp_' + k); } catch (e) {} },
  };
  let S = null, gotAt = 0;
  let session = store.get('session');
  let joined = false, screen = '', connected = false;
  let ui = { round: -1, gear: 1, sel: [], boost: false, sending: false };
  let track = null, trackKey = '';
  let anim = { done: 0, running: false };
  let qState = { key: '', result: null, sending: false };
  let helpOpen = false, lastCd = '', goShownFor = '', resultShownFor = '', lateShownFor = '', lastTick = -1;

  /* ---------- 효과음 (따로 파일 없이 만들어요) ---------- */
  const Snd = (() => {
    let ctx = null, on = store.get('sound') !== false;
    const unlock = () => { try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} };
    ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true }));
    function tone(f, d, type = 'sine', vol = 0.18, delay = 0, f2) {
      if (!on || !ctx) return;
      try {
        const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.05);
      } catch (e) {}
    }
    const fx = {
      click: () => tone(900, .05, 'square', .06),
      beep: () => tone(660, .18, 'square', .12),
      go: () => { tone(880, .12, 'square', .14); tone(1320, .35, 'square', .14, .1); },
      correct: () => { tone(784, .12, 'triangle', .2); tone(1175, .25, 'triangle', .2, .1); },
      wrong: () => tone(220, .35, 'sawtooth', .12, 0, 140),
      engine: () => tone(110, .12, 'sawtooth', .05, 0, 150),
      boost: () => tone(300, .5, 'sawtooth', .1, 0, 1400),
      spin: () => { for (let i = 0; i < 4; i++) tone(500 - i * 70, .12, 'triangle', .14, i * .1, 300 - i * 50); },
      slip: () => tone(600, .3, 'sine', .1, 0, 1600),
      cool: () => tone(1500, .4, 'sine', .08, 0, 500),
      tick: () => tone(1200, .04, 'square', .07),
      finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .18, i * .13)),
    };
    return { play(n) { unlock(); fx[n] && fx[n](); }, get on() { return on; }, toggle() { on = !on; store.set('sound', on); if (!on && window.speechSynthesis) speechSynthesis.cancel(); return on; } };
  })();
  /* ---------- 영어 읽어 주기 ---------- */
  function englishParts(text) {
    return (String(text).replace(/_{2,}/g, ' blank ').match(/[A-Za-z][A-Za-z'’ ,.?!-]*[A-Za-z.?!]/g) || []).filter(x => /[A-Za-z]{2,}/.test(x)).join('. ');
  }
  function say(list) {
    if (!window.speechSynthesis) return toast('이 기기에서는 읽어 주기를 쓸 수 없어요.');
    speechSynthesis.cancel();
    const voices = speechSynthesis.getVoices(); const v = voices.find(x => /en[-_]US/i.test(x.lang)) || voices.find(x => /^en/i.test(x.lang));
    list.filter(Boolean).forEach(t => { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-US'; u.rate = .88; if (v) u.voice = v; speechSynthesis.speak(u); });
  }
  const sndBtn = () => `<button class="sndBtn" data-snd aria-label="소리 켜기/끄기" title="소리 켜기/끄기">${Snd.on ? '🔊' : '🔇'}</button>`;
  function bindSnd(root) { root.querySelectorAll('[data-snd]').forEach(b => b.onclick = () => { const o = Snd.toggle(); root.querySelectorAll('[data-snd]').forEach(x => x.textContent = o ? '🔊' : '🔇'); if (o) Snd.play('click'); }); }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ibtn = (img, label, attrs = '', cls = '') => `<button class="ib ${cls}" style="--img:url(${IMG}${img}.webp)" aria-label="${esc(label)}" ${attrs}><span class="sr">${esc(label)}</span></button>`;
  const cardImg = v => `${IMG}card_${typeof v === 'number' ? v : v}.webp`;
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
  function toggleFull() { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {}); else d.exitFullscreen && d.exitFullscreen().catch(() => {}); }

  // 알림 그림 (정답/아쉬워요/부스트/스핀/슬립스트림/냉각/코너 주의)
  const NOTICE = { correct: ['n_correct', 560 / 366, 69, 93], wrong: ['n_wrong', 560 / 367, 69, 93], boost: ['n_boost', 560 / 373, 69.4, 93], spin: ['n_spin', 560 / 369, 69, 93],
    slip: ['n_slip', 560 / 376, 72.3, 93.4], cool: ['n_cool', 560 / 420, 73.3, 93.8], corner: ['n_corner', 560 / 393, 72.8, 93.4] };
  function noticeHTML(kind, text, extraCls) {
    const [img, ratio, t, b] = NOTICE[kind];
    return `<div class="notice ${extraCls || ''}" style="background-image:url(${IMG}${img}.webp);aspect-ratio:${ratio}"><p style="top:${t}%;height:${b - t}%">${esc(text)}</p></div>`;
  }
  const noticeQ = [];
  function notify(kind, text) {
    noticeQ.push([kind, text]);
    if (noticeQ.length === 1) runNotice();
  }
  function runNotice() {
    const layer = document.getElementById('notice');
    if (!noticeQ.length) { layer.innerHTML = ''; return; }
    const [k, t] = noticeQ[0];
    layer.innerHTML = noticeHTML(k, t);
    setTimeout(() => { noticeQ.shift(); runNotice(); }, 1500);
  }

  /* ---------------- 첫 화면 ---------------- */
  const SLOTS = [[8.0, 34.7], [30.0, 34.7], [51.8, 34.7], [73.5, 34.7], [8.0, 50.5], [30.0, 50.5], [51.8, 50.5], [73.5, 50.5]];
  function renderJoin(msg) {
    screen = 'join'; track = null;
    const params = new URLSearchParams(location.search);
    const code = params.get('code') || (session && session.code) || '';
    const name = (session && session.name) || '';
    let pick = store.get('car') || 'red';
    $app.innerHTML = `
      <div class="scr join">
        <div class="joinWrap">
          <img class="logoBig" src="${IMG}logo.webp" alt="부릉부릉 영어 그랑프리">
          <div class="jpanel">
            <label class="jslot" style="left:8.5%;top:15.5%;width:83.5%;height:6.8%"><img src="${IMG}plate_name.webp" alt="이름"><input id="jn" maxlength="12" placeholder="예: 3번 김하늘" value="${esc(name)}" autocomplete="off"></label>
            <label class="jslot" style="left:8.5%;top:24.7%;width:83.5%;height:6.9%"><img src="${IMG}plate_code.webp" alt="방 코드"><input id="jc" class="code" maxlength="4" inputmode="numeric" placeholder="0000" value="${esc(code)}" autocomplete="off"></label>
            ${COLORS.map((c, i) => `<button type="button" class="jcar ${c === pick ? 'on' : ''}" data-c="${c}" aria-label="${CAR_NAMES[c]} 자동차" style="left:${SLOTS[i][0]}%;top:${SLOTS[i][1]}%;width:19.1%;height:13.6%"><img src="${sideCar(c)}" alt=""><span>${CAR_NAMES[c]}</span></button>`).join('')}
            <p class="jerr" id="jerr">${esc(msg || '')}</p>
            ${ibtn('btn_join', '참가하기', 'id="go"')}
            <a href="teacher.html" class="ib" id="tlink" style="--img:url(${IMG}btn_teacher.webp);left:28%;top:85%;width:44%;aspect-ratio:516/144" aria-label="교사 관리"><span class="sr">교사 관리</span></a>
          </div>
        </div>
      </div>`;
    const go = $app.querySelector('#go');
    Object.assign(go.style, { left: '13%', top: '68.6%', width: '74%', aspectRatio: '767/219' });
    $app.querySelectorAll('.jcar').forEach(b => b.onclick = () => { pick = b.dataset.c; $app.querySelectorAll('.jcar').forEach(x => x.classList.toggle('on', x === b)); });
    const submit = () => {
      const n = $app.querySelector('#jn').value.trim(), c = $app.querySelector('#jc').value.trim();
      if (!n) return $app.querySelector('#jerr').textContent = '이름을 입력해 주세요.';
      if (!/^\d{4}$/.test(c)) return $app.querySelector('#jerr').textContent = '방 코드 4자리를 입력해 주세요.';
      store.set('car', pick);
      join({ code: c, name: n, car: pick });
    };
    go.onclick = submit;
    $app.querySelectorAll('.jslot input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') submit(); });
  }
  function join(data) {
    socket.emit('student:join', data, res => {
      if (!res || !res.ok) { joined = false; if (data.token) { store.del('session'); session = null; } renderJoin(res && res.msg); return; }
      session = { code: data.code, token: res.token, name: data.name || (session && session.name) };
      store.set('session', session); joined = true;
      if (data.car) socket.emit('student:car', { car: data.car });
    });
  }
  socket.on('connect', () => {
    connected = true; document.querySelector('.overlay.conn')?.remove();
    if (session && session.token) join({ code: session.code, token: session.token }); else if (!joined) renderJoin();
  });
  socket.on('disconnect', () => { connected = false; if (joined) setTimeout(showConn, 1500); });
  socket.on('kicked', msg => { joined = false; store.del('session'); session = null; renderJoin(msg || '선생님이 수업에서 내보냈어요.'); });
  socket.on('state', st => { S = st; gotAt = Date.now(); render(); });

  function showConn() {
    if (connected || document.querySelector('.overlay.conn')) return;
    const o = document.createElement('div'); o.className = 'overlay conn';
    o.innerHTML = `<div class="pauseBox conn"><p>인터넷 연결이 끊겼어요.<br>와이파이를 확인하면 저절로 다시 들어가요.</p></div>${ibtn('btn_reconnect', '다시 연결', 'id="rc"', 'rc')}`;
    document.body.appendChild(o);
    o.querySelector('#rc').onclick = () => { socket.connect(); setTimeout(() => { if (!connected) location.reload(); }, 3000); };
  }

  /* ---------------- 화면 고르기 ---------------- */
  function render() {
    if (!S) return;
    document.querySelector('.overlay.pause')?.remove();
    if (S.stage === 'lobby') renderLobby();
    else if (S.stage === 'room') renderRoom();
    else renderGame();
    if (S.paused || (S.room && S.room.paused)) {
      const o = document.createElement('div'); o.className = 'overlay pause';
      o.innerHTML = `<div class="pauseBox"><p>잠깐 멈췄어요.<br>선생님이 다시 시작할 때까지 기다려요.</p></div>`;
      document.body.appendChild(o);
    }
  }
  function topbar(title) {
    const plate = title === '레이싱 대기실' ? `<img class="titleImg" src="${IMG}title_lobby.webp" alt="레이싱 대기실">` : `<div class="plate titlePlate"><b>${esc(title)}</b></div>`;
    return `<header class="topbar"><img class="logoS" src="${IMG}logo.webp" alt="부릉부릉 영어 그랑프리">${plate}<span class="sp"></span>${sndBtn()}${ibtn('btn_help', '게임 방법', 'data-help', 'rbtn')}${ibtn('btn_full', '전체 화면', 'data-full', 'rbtn')}</header>`;
  }
  function bindTop() {
    $app.querySelectorAll('[data-help]').forEach(b => b.onclick = showHelp);
    $app.querySelectorAll('[data-full]').forEach(b => b.onclick = toggleFull);
    bindSnd($app);
  }
  function pcard(p, opts = {}) {
    return `<div class="pcard">
      <img class="pface" src="${face(p.car)}" alt="">
      <div class="pname"><span>${esc(p.name)}</span></div>
      <img class="pcar" src="${sideCar(p.car)}" alt="">
      <div class="pfoot">${esc(opts.foot || CAR_NAMES[p.car] || '')}</div>
      ${opts.me ? `<img class="ptag" src="${IMG}tag_me.webp" alt="나">` : ''}
      ${opts.status ? `<img class="pst" src="${IMG}${opts.status}.webp" alt="">` : ''}
    </div>`;
  }

  function lobbyMsg() {
    if (!S.settings.autoMode) return '선생님이 방을 정해 줄 때까지 기다려요.';
    const n = S.lobby.length, min = S.minSize || 3;
    if (n >= min) return '친구들이 모였어요! 곧 방이 정해져요.';
    if (S.settings.aiFill) return `친구가 모자라면 잠시 뒤 🤖 AI 친구와 함께 달려요! (지금 ${n}명)`;
    if (S.playingRooms) return `다른 친구들의 경기가 끝나면 같이 달려요! (지금 ${n}명)`;
    return `친구들이 ${min}명 모이면 자동으로 방이 정해져요! (지금 ${n}명)`;
  }
  /* ---------------- 대기실 ---------------- */
  function renderLobby() {
    const st = S.me.stats || {};
    const key = 'lobby|' + S.me.car + '|' + S.lobby.map(x => x.name + x.car).join(',') + '|' + S.settings.units.join() + S.settings.autoMode + '|' + S.playingRooms;
    if (screen === 'lobby' && $app.dataset.key === key) return;
    screen = 'lobby'; $app.dataset.key = key; track = null; resultShownFor = '';
    const mix = S.settings.units.length > 1;
    $app.innerHTML = `
      <div class="scr lobby">
        ${topbar('레이싱 대기실')}
        <main class="lobbyGrid">
          <section class="myBlock">${pcard(S.me, { me: true, status: 'st_wait', foot: `경기 ${st.games || 0}번 · 1등 ${st.wins || 0}번` })}</section>
          <section class="lobbyRight">
            <div class="cpanel"><h3>🏁 이번 레이스 주제</h3>
              <div class="units">${S.settings.units.map(u => `<img src="${IMG}unit_${u}.webp" alt="${u}단원">`).join('')}${mix ? '<span class="mix">구역마다 단원이 섞여 나와요!</span>' : ''}</div></div>
            <div class="cpanel"><h3>👋 대기실 친구들 <small style="color:var(--muted)">${S.lobby.length}명</small></h3>
              <div class="chips">${S.lobby.map(x => `<span class="chip"><img src="${face(x.car)}" alt="">${esc(x.name)}</span>`).join('')}</div></div>
            <div class="cpanel"><h3>🎨 내 자동차 바꾸기</h3>
              <div class="colorPick">${COLORS.map(c => `<button type="button" data-c="${c}" class="${c === S.me.car ? 'on' : ''}" aria-label="${CAR_NAMES[c]}"><img src="${sideCar(c)}" alt=""></button>`).join('')}</div></div>
            <div class="navyBox rules">
              <div class="navyT" style="margin:0 0 2px;font-size:1.15rem">📘 게임 진행 규칙</div>
              <div><img src="${IMG}ico_ok.webp" alt="">기어를 고르고 스피드 카드를 내요. 영어 미션을 맞히면 계획대로 달려요.</div>
              <div><img src="${IMG}ico_ok.webp" alt="">기어가 높을수록 빠르지만 문제가 어려워져요.</div>
              <div><img src="${IMG}ico_ok.webp" alt="">코너 제한 속도를 넘으면 엔진 열을 써요. 열이 모자라면 스핀!</div>
            </div>
          </section>
        </main>
        <div class="plate lobbyMsg"><b style="font-size:clamp(1rem,2.6vw,1.35rem)">${lobbyMsg()}</b></div>
      </div>`;
    bindTop();
    $app.querySelectorAll('.colorPick button').forEach(b => b.onclick = () => { store.set('car', b.dataset.c); socket.emit('student:car', { car: b.dataset.c }); });
  }

  /* ---------------- 방 / 카운트다운 ---------------- */
  function cdHTML(sec, status) {
    if (status !== 'countdown') return `<div class="cdText">곧 출발해요</div>`;
    if (sec <= 5) return `<img class="cdImg" src="${IMG}cd_${Math.max(1, sec)}.webp" alt="${sec}">`;
    return `<div class="cdText">준비!</div>`;
  }
  function renderRoom() {
    const r = S.room;
    const sec = Math.ceil(Math.max(0, r.startIn - (Date.now() - gotAt)) / 1000);
    const key = 'room|' + r.id + '|' + r.status + '|' + r.members.map(m => m.name + m.car + m.online).join(',');
    if (!(screen === 'room' && $app.dataset.key === key)) {
      screen = 'room'; $app.dataset.key = key; track = null; lastCd = '';
      preload(r.members.map(m => m.car));
      $app.innerHTML = `
        <div class="scr room">
          ${topbar(r.name)}
          <main>
            <div id="cd">${cdHTML(sec, r.status)}</div>
            <div class="members">${r.members.map(m => pcard(m, { me: m.id === S.me.id, status: m.online ? 'st_ready' : 'st_off', foot: m.bot ? '🤖 AI 친구' : '' })).join('')}</div>
            <div class="plate" style="width:min(560px,92vw)"><b style="font-size:clamp(1rem,2.6vw,1.3rem)">${r.status === 'countdown' ? '모두 모였어요! 곧 출발해요.' : '선생님이 출발 신호를 줄 때까지 기다려요.'}</b></div>
          </main>
        </div>`;
      bindTop();
    }
  }

  /* ---------------- 레이스 ---------------- */
  function renderGame() {
    const g = S.game; if (!g) return;
    const tKey = g.no + '|' + g.track.sectors.map(s => s.unit).join(',');
    if (screen !== 'game' || trackKey !== tKey || !track) {
      screen = 'game'; trackKey = tKey; $app.dataset.key = '';
      $app.innerHTML = `
        <div class="scr game">
          <div class="hudbar">
            <div class="hud lap"><b id="lp"></b></div>
            <div class="hud round"><b id="rd"></b></div>
            <div class="hud time"><b id="tl"></b></div>
            <div class="tbar" id="tm" title="이번 라운드 남은 시간"><i></i></div>
            ${sndBtn()}${ibtn('btn_help', '게임 방법', 'data-help', 'rbtn')}${ibtn('btn_full', '전체 화면', 'data-full', 'rbtn')}
          </div>
          <div class="gmain">
            <div class="gleft"><div class="trackBox" id="tbox"><svg id="trk" role="img" aria-label="레이스 트랙"></svg></div><div id="rankBox"></div></div>
            <aside class="side" id="side"></aside>
          </div>
        </div>`;
      track = Track(document.getElementById('trk'), g.track);
      anim = { done: g.movesRound, running: false };
      bindTop();
      if (g.me && g.me.late && lateShownFor !== String(g.no)) { lateShownFor = String(g.no); setTimeout(() => notify('slip', '달리고 있는 경기에 들어왔어요! 꼴찌 보너스로 따라잡아요'), 600); }
      if (g.round <= 1 && g.phase === 'plan' && goShownFor !== String(g.no)) {
        goShownFor = String(g.no);
        const go = document.createElement('img'); go.className = 'goFlash'; go.src = IMG + 'cd_go.webp'; go.alt = 'GO!';
        document.getElementById('tbox').appendChild(go); setTimeout(() => go.remove(), 1300); Snd.play('go');
      }
    }
    document.getElementById('rd').textContent = g.round;
    const me = g.players.find(p => p.id === S.me.id);
    const myLap = me ? Math.min(g.laps, Math.max(1, Math.floor(Math.max(0, me.pos) / g.track.len) + 1)) : 1;
    document.getElementById('lp').textContent = `${myLap} / ${g.laps}`;
    if (g.movesRound > anim.done && g.moves && g.moves.length) {
      anim.done = g.movesRound; anim.running = true;
      const moves = g.moves; const wait = () => (document.getElementById('qm') ? setTimeout(wait, 150) : playMoves(moves));
      wait();
    }
    if (!anim.running) track.setPlayers(g.players, S.me.id, null);
    renderSide();
    renderQuestion();
    renderResult();
  }

  function nextCorner(pos, t) {
    const L = t.len; const sp = ((pos % L) + L) % L; let best = null;
    for (const c of t.corners) { let d = c.at - sp + 1; if (d <= 0) d += L; if (!best || d < best.d) best = { d, limit: c.limit }; }
    return best;
  }
  function previewPlan(me, t, sum, hasS, jump) {
    const L = t.len, from = me.pos, to = me.pos + sum;
    let need = 0; const hit = [];
    for (let lap = Math.floor(from / L) - 1; lap <= Math.floor(to / L) + 1; lap++) for (const c of t.corners) {
      const abs = lap * L + c.at; if (abs >= from && abs < to) { const over = sum - c.limit; if (over > 0) { need += over; hit.push(c.limit); } }
    }
    const spare = me.engine - (jump ? 1 : 0) - (ui.boost ? 1 : 0);
    let html = `⭐ 예상 도착: <b>${sum}칸</b> 앞${hasS ? ' (+깜짝 카드)' : ''}`;
    if (!need) return { cls: '', html: html + ' · 코너 걱정 없어요!' };
    if (need > spare) return { cls: 'danger', html: html + `<br>⚠️ 코너 제한 ${hit.join(', ')}을(를) 넘어요. 엔진 열이 <b>${need}개</b> 필요한데 ${Math.max(0, spare)}개뿐이라 <b>스핀</b>할 수 있어요!` };
    return { cls: 'warn', html: html + `<br>🔥 코너 제한 ${hit.join(', ')}을(를) 넘어서 엔진 열 <b>${need}개</b>를 써요.` };
  }
  function heatHTML(n) { return `<div class="heat" aria-label="엔진 열 ${n}개">${HEAT_X.map((x, i) => `<i class="${i < n ? '' : 'empty'}" style="left:${x}%"></i>`).join('')}</div>`; }
  const UNIT_ZONE = { 10: '음식 거리', 11: '한옥 마을', 12: '친환경 도시' };

  function rankHTML(g) {
    const rows = g.players.map((p, i) => {
      const lap = Math.min(g.laps, Math.floor(Math.max(0, p.pos) / g.track.len) + 1);
      let st = '';
      if (g.phase === 'done') st = `정답 ${p.right}/${p.total}`;
      else if (g.phase === 'plan') st = p.answered ? `<img src="${IMG}st_ready.webp" alt="준비 완료">` : p.ready ? '미션 중' : '고르는 중';
      else st = `${p.gear}단 · <img src="${IMG}ico_fire.webp" alt="엔진 열" style="height:18px">${p.engine}`;
      return `<div class="rrow ${p.id === S.me.id ? 'me' : ''} ${p.online ? '' : 'off'}">
        <img class="rk" src="${IMG}rank_${Math.min(5, i + 1)}.webp" alt="${i + 1}등"><img class="fc" src="${face(p.car)}" alt="">
        <span class="nm">${p.bot ? '🤖' : ''}${esc(p.name)}<small>${p.finished ? '🏁' : lap + '바퀴'}</small></span><span class="st">${st}</span>
        ${p.id === S.me.id ? `<img class="meTag" src="${IMG}tag_me2.webp" alt="나">` : ''}</div>`;
    }).join('');
    return `<div class="navyBox rankUnder"><div class="navyT"><img src="${IMG}trophy.webp" alt="">현재 순위</div><div class="rrows">${rows}</div></div>`;
  }

  function renderSide() {
    const g = S.game; const side = document.getElementById('side'); if (!side) return;
    const me = g.me;
    const rb = document.getElementById('rankBox'); const rh = rankHTML(g); if (rb && rb.dataset.h !== rh) { rb.innerHTML = rh; rb.dataset.h = rh; }
    let html = '';
    if (g.phase === 'done') { side.innerHTML = html; return; }
    if (!me) { side.innerHTML = html + `<div class="cpanel"><p class="tip">관전 중이에요.</p></div>`; return; }
    if (g.phase === 'plan' && !me.plan) {
      if (ui.round !== g.round) ui = { round: g.round, gear: me.gear, sel: [], boost: false, sending: false };
      const handNums = ui.sel.map(i => me.hand[i]);
      const sum = handNums.reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
      const hasS = handNums.includes('S');
      const nc = nextCorner(me.pos, g.track);
      const zone = { unit: unitAt(g.track, Math.max(0, me.pos)) };
      const jump = Math.abs(ui.gear - me.gear) === 2;
      const pv = previewPlan(me, g.track, sum, hasS, jump);
      html += `<div class="navyBox" style="padding:10px 12px 12px">
          <div class="gearHead"><b>기어 선택 · 지금 ${me.gear}단</b></div>
          <div class="gears">${[1, 2, 3, 4].map(n => {
            const d = Math.abs(n - me.gear); const dis = d > 2 || (d === 2 && me.engine < 1);
            const note = n === me.gear ? '그대로' : d === 2 ? '열 1' : d > 2 ? '못 바꿈' : '';
            return `<button class="gearBtn ${n === ui.gear ? 'on' : ''}" data-g="${n}" ${dis ? 'disabled' : ''} aria-label="기어 ${n}단" style="background-image:url(${IMG}gear_${n === ui.gear ? 'on_' : ''}${n}.webp)"><small>${note}</small></button>`;
          }).join('')}</div>
          <p class="gearNote">${ui.gear}단 → 카드 <b>${ui.gear}장</b> · <b>${LV[ui.gear]}</b> 미션${jump ? ' · <b>열 1</b>을 내요' : ''}</p>
        </div>
        <div class="cpanel">
          <h3><img src="${IMG}card_1.webp" alt="" style="height:26px">스피드 카드 ${ui.gear}장 고르기 <small style="color:var(--muted)">${ui.sel.length}/${ui.gear}</small></h3>
          <div class="hand" id="hand">${me.hand.map((v, i) => `<button class="card ${ui.sel.includes(i) ? 'sel' : ''}" data-i="${i}" aria-label="${typeof v === 'number' ? '속도 ' + v : v === 'S' ? '깜짝 카드' : '열 카드'}" style="background-image:url(${cardImg(v)})"></button>`).join('')}</div>
          <div class="speedSum">예상 속도 <b>${sum}${hasS ? '+?' : ''}</b></div>
          ${ui.sel.length ? `<div class="preview ${pv.cls}">${pv.html}</div>` : ''}
          <button class="boostRow ${ui.boost ? 'on' : ''}" id="bst" ${me.engine < 1 ? 'disabled' : ''}><img class="tg" src="${IMG}${ui.boost ? 'tog_on' : 'tog_off'}.webp" alt=""><img class="rk" src="${IMG}ico_rocket.webp" alt=""><span><b>부스트</b> · 열 1을 내고, 정답이면 속도 +1~4</span></button>
          <div class="heatLbl"><span>엔진 열</span><span>${me.engine} / 6</span></div>${heatHTML(me.engine)}
          <p class="tip">🚩 다음 코너까지 <b>${nc.d}칸</b> · 제한 속도 <b>${nc.limit}</b>. 넘은 만큼 열을 내고, 모자라면 <b class="warn">스핀!</b>${zone ? `<br>📍 ${UNIT_ZONE[zone.unit] || ''} 구역 · <b>${zone.unit}단원</b> 미션` : ''}</p>
          <button class="ib readyBtn" style="--img:url(${IMG}btn_ready.webp)" id="ready" ${ui.sel.length !== ui.gear || ui.sending ? 'disabled' : ''} aria-label="출발 준비"><span class="sr">출발 준비</span></button>
        </div>`;
      side.innerHTML = html;
      if (track && !anim.running) track.ghost(ui.sel.length ? me.pos : null, me.pos + sum, pv.cls !== '');
      side.querySelectorAll('.gearBtn').forEach(b => b.onclick = () => { Snd.play('click'); ui.gear = +b.dataset.g; ui.sel = ui.sel.slice(0, ui.gear); renderSide(); });
      side.querySelectorAll('#hand .card').forEach(b => b.onclick = () => {
        Snd.play('click'); const i = +b.dataset.i;
        if (ui.sel.includes(i)) ui.sel = ui.sel.filter(x => x !== i);
        else if (ui.sel.length < ui.gear) ui.sel.push(i);
        else { ui.sel.shift(); ui.sel.push(i); }
        renderSide();
      });
      side.querySelector('#bst').onclick = () => { ui.boost = !ui.boost; renderSide(); };
      side.querySelector('#ready').onclick = () => {
        ui.sending = true; renderSide(); track && track.ghost(null);
        socket.emit('student:plan', { gear: ui.gear, cards: ui.sel, boost: ui.boost }, res => { ui.sending = false; if (!res || !res.ok) { toast((res && res.msg) || '다시 해 주세요.'); renderSide(); } });
      };
      return;
    }
    if (track && !anim.running) track.ghost(null);
    if (g.phase === 'plan') {
      const done = g.players.filter(p => p.answered).length;
      html += `<div class="cpanel" style="text-align:center">
          ${me.answered ? `<img class="doneBadge" src="${IMG}btn_done.webp" alt="준비 완료">` : '<h3 style="justify-content:center">📝 영어 미션을 풀어요</h3>'}
          <div class="planCards">${me.plan.cards.map(i => `<span class="card" style="background-image:url(${cardImg(me.hand[i])})"></span>`).join('')}${me.plan.boost ? `<img src="${IMG}ico_rocket.webp" alt="부스트" style="height:44px">` : ''}</div>
          <p class="tip">기어 <b>${me.plan.gear}단</b> · 친구들 준비 <b>${done}/${g.players.length}</b><br>모두 끝나면 다 같이 달려요!</p>
          <div class="heatLbl"><span>엔진 열</span><span>${me.engine} / 6</span></div>${heatHTML(me.engine)}
        </div>`;
      side.innerHTML = html; return;
    }
    const lines = (g.moves || []).map(moveText).join('');
    html += `<div class="npanel"><img class="nhead" src="${IMG}recent_head.webp" alt="최근 라운드"><div class="nbody"><div class="ncream"><div class="log"><div style="background:none;border:0;padding:0 2px">📣 ${g.movesRound}라운드 결과</div>${lines}</div></div></div></div>`;
    side.innerHTML = html;
  }
  function pOf(id) { return S.game.players.find(x => x.id === id) || {}; }
  function moveText(m) {
    const p = pOf(m.id); const bits = [];
    bits.push(`<img class="fc" src="${face(p.car)}" alt=""><b style="font-weight:400">${esc(p.name || '?')}</b> ${m.correct ? '⭕' : m.timeout ? '⌛' : '❌'} ${m.gear}단 · 속도 <b>${m.speed}</b>`);
    if (m.boost) bits.push(`🚀+${m.boost}`);
    if (m.adr) bits.push('💪꼴찌 +1');
    if (m.overheat) bits.push('🔥과열');
    for (const c of m.corners || []) { if (c.spin) bits.push(`<b class="warn" style="font-weight:400">💫 스핀!</b>`); else if (c.paid) bits.push(`🚩코너 열 ${c.paid}`); }
    if (m.slip) bits.push(`💨+${m.slip}`);
    if (m.cool) bits.push(`❄️정비 ${m.cool}`);
    if (m.finish) bits.push('🏁 결승!');
    return `<div class="${m.spin ? 'spin' : m.finish ? 'fin' : ''}">${bits.join(' · ')}</div>`;
  }

  /* ---------------- 이동 연출 ---------------- */
  function playMoves(moves) {
    const g = S.game; if (!track) return;
    anim.running = true;
    const disp = {};
    for (const p of g.players) disp[p.id] = p.pos;
    for (const m of moves) disp[m.id] = m.from;
    track.setPlayers(g.players, S.me.id, disp);
    let k = 0;
    const step = () => {
      if (k >= moves.length || !track) { anim.running = false; if (S && S.game && track) track.setPlayers(S.game.players, S.me.id, null); return; }
      const m = moves[k++]; const mine = m.id === S.me.id;
      const pre = m.to - m.slip;
      let pos = m.from; const dist = pre - m.from;
      const spaceMs = Math.max(80, Math.min(170, 950 / Math.max(1, dist)));
      track.pop(m.from, `${m.correct ? '⭕' : '❌'} 속도 ${m.speed}`, m.correct ? 'good' : 'bad');
      if (mine && m.boost) { notify('boost', `로켓 출발! 속도 +${m.boost}`); Snd.play('boost'); }
      if (mine && (m.auto || m.timeout)) notify('wrong', m.auto ? '시간이 끝나서 자동으로 출발했어요' : '시간 안에 답하지 못했어요');
      track.mode(m.id, m.boost ? 'boost' : 'drive');
      const tick = () => {
        if (!track) return;
        if (pos < pre) { pos++; disp[m.id] = pos; track.setPlayers(S.game.players, S.me.id, disp); if (mine) Snd.play('engine'); setTimeout(tick, spaceMs); return; }
        const paid = (m.corners || []).reduce((a, c) => a + (c.paid || 0), 0);
        if (m.spin) { Snd.play('spin'); track.mode(m.id, 'spin'); track.pop(pos, '💫 스핀!', 'bad'); if (mine) notify('spin', '코너 제한 속도를 넘었어요! 1단으로 다시 출발해요'); }
        else { track.mode(m.id, 'idle'); if (paid) { track.pop(pos, `🔥 코너 열 ${paid}`, 'boost'); if (mine) notify('corner', `코너에서 엔진 열 ${paid}개를 썼어요`); } }
        if (m.finish) Snd.play('finish');
        if (mine && m.cool) Snd.play('cool');
        if (mine && m.cool) notify('cool', `엔진을 식혔어요! 열 카드 ${m.cool}장 정비`);
        if (m.slip) {
          setTimeout(() => {
            if (!track) return; disp[m.id] = m.to; track.setPlayers(S.game.players, S.me.id, disp); track.pop(m.to, '💨 +' + m.slip, 'good');
            if (mine) { notify('slip', `앞차 뒤에 붙어서 +${m.slip}칸!`); Snd.play('slip'); }
            setTimeout(step, 700);
          }, 300);
        } else setTimeout(step, m.spin ? 950 : 550);
      };
      setTimeout(tick, 250);
    };
    step();
  }

  /* ---------------- 영어 미션 ---------------- */
  function renderQuestion() {
    const g = S.game; const me = g && g.me;
    let modal = document.getElementById('qm');
    const want = g && g.phase === 'plan' && me && me.plan && me.q;
    const key = want ? g.no + '-' + g.round : '';
    if (!want) {
      if (modal && qState.result && Date.now() - qState.result.at < 1800) { setTimeout(() => document.getElementById('qm')?.remove(), 1800 - (Date.now() - qState.result.at)); return; }
      if (modal) modal.remove();
      return;
    }
    if (qState.key !== key) qState = { key, result: null, sending: false };
    if (me.answered && !qState.result) qState.result = { correct: me.correct, answer: me.q.answer, choice: me.choice, exp: me.q.exp, at: Date.now() - 1000 };
    if (qState.result && Date.now() - qState.result.at > 2600) { if (modal) modal.remove(); return; }
    if (!modal) { modal = document.createElement('div'); modal.className = 'modal new'; modal.id = 'qm'; document.body.appendChild(modal); setTimeout(() => modal.classList.remove('new'), 400); }
    const q = me.q; const r = qState.result;
    const html = `<div class="mission" role="dialog" aria-label="영어 미션">
      <img class="nhead" src="${IMG}mission_head.webp" alt="ENGLISH MISSION">
      <div class="mbody"><div class="mcream">
        <div class="mtags"><span class="lvPill">${LV[q.level] || q.level + '단'}</span><img src="${IMG}unit_${q.unit}.webp" alt="${q.unit}단원"><button class="sayBtn" id="sayQ" aria-label="영어 듣기">🔊 듣기</button></div>
        <div class="qtext">${esc(q.q)}</div>
        <div class="answers">${q.choices.map((c, i) => {
          let cls = '', mark = '';
          if (r) { if (i === r.answer) { cls = 'right'; mark = 'ico_ok'; } else if (i === r.choice) { cls = 'wrong'; mark = 'ico_no'; } else cls = 'dim'; }
          return `<button class="ans a${i + 1} ${cls}" data-i="${i}" ${r || qState.sending ? 'disabled' : ''}><span>${esc(c)}</span>${mark ? `<img class="mark" src="${IMG}${mark}.webp" alt="">` : ''}</button>`;
        }).join('')}</div>
      </div></div>
      ${r ? `<div class="answerNotice">${noticeHTML(r.correct ? 'correct' : 'wrong', r.correct ? (r.exp || '계획대로 달려요!') : `${r.exp ? r.exp + ' · ' : ''}엔진 열 1이 빠져요`, 'stay')}</div>` : ''}
    </div>`;
    if (modal.dataset.html !== html) { modal.innerHTML = html; modal.dataset.html = html; }
    const sq = modal.querySelector('#sayQ');
    if (sq) sq.onclick = e => { e.stopPropagation(); const parts = [englishParts(q.q)].concat(q.choices.map((c, i) => { const en = englishParts(c); return en ? `${i + 1}. ${en}` : ''; })); if (!parts.some(Boolean)) return toast('이 문제는 읽을 영어가 없어요.'); say(parts); };
    modal.querySelectorAll('.ans').forEach(b => b.onclick = () => {
      if (qState.sending || qState.result) return;
      qState.sending = true;
      socket.emit('student:answer', { choice: +b.dataset.i }, res => {
        qState.sending = false;
        if (res && res.ok) { qState.result = { correct: res.correct, answer: res.answer, choice: +b.dataset.i, exp: res.exp, at: Date.now() }; Snd.play(res.correct ? 'correct' : 'wrong'); if (window.speechSynthesis) speechSynthesis.cancel(); }
        else toast((res && res.msg) || '다시 눌러 주세요.');
        renderQuestion();
        setTimeout(renderQuestion, 2700);
      });
    });
    if (r) modal.onclick = () => { qState.result.at = 0; modal.remove(); };
  }

  /* ---------------- 결과 ---------------- */
  function renderResult() {
    const g = S.game; const ex = document.getElementById('res');
    if (!g || g.phase !== 'done') { ex && ex.remove(); return; }
    const k = g.no + '|' + g.players.map(p => p.id).join();
    if (ex && resultShownFor === k) return;
    resultShownFor = k; ex && ex.remove();
    const ps = g.players; const myIdx = ps.findIndex(p => p.id === S.me.id); const me = ps[myIdx];
    const spots = [[1, 16.5, 20], [0, 50, 3], [2, 83.5, 28]]; // [순위 index, x%, top%]
    const why = g.endReason === 'time' ? '시간이 다 됐어요!' : g.endReason === 'teacher' ? '선생님이 경기를 마쳤어요.' : '';
    const el = document.createElement('div'); el.className = 'result'; el.id = 'res';
    el.innerHTML = `
      <img class="banner" src="${IMG}banner_complete.webp" alt="RACE COMPLETE!">
      <div class="podiumWrap">
        <img class="pod" src="${IMG}podium.webp" alt="">
        ${spots.filter(([i]) => ps[i]).map(([i, x, t]) => `<div class="spot ${ps[i].id === S.me.id ? 'me' : ''}" style="left:${x}%;top:${t}%"><span class="who"><img src="${face(ps[i].car)}" alt="">${esc(ps[i].name)} · ${i + 1}등</span><img class="car" src="${sideCar(ps[i].car)}" alt=""></div>`).join('')}
      </div>
      ${me ? `<div class="recs">
        <div class="rec" style="background-image:url(${IMG}rec_rank.webp)"><b>${myIdx + 1}등 / ${ps.length}명</b></div>
        <div class="rec" style="background-image:url(${IMG}rec_score.webp)"><b>+${PTS[myIdx] || 1}점</b></div>
        <div class="rec" style="background-image:url(${IMG}rec_acc.webp)"><b>${me.total ? Math.round(me.right / me.total * 100) : 0}% (${me.right}/${me.total})</b></div>
      </div>` : ''}
      ${ps.length > 3 ? `<div class="others">${ps.slice(3).map((p, j) => `<div class="rrow ${p.id === S.me.id ? 'me' : ''}"><img class="rk" src="${IMG}rank_${Math.min(5, j + 4)}.webp" alt=""><img class="fc" src="${face(p.car)}" alt=""><span class="nm">${esc(p.name)}</span><span class="st">정답 ${p.right}/${p.total}</span></div>`).join('')}</div>` : ''}
      ${g.me ? `<div class="review"><div class="cpanel"><h3><span>📒 틀린 문제 다시 보기</span><small class="muted">${(g.me.wrongs || []).length}문제</small></h3>
        ${(g.me.wrongs || []).length ? g.me.wrongs.map((w, i) => `<div class="rv"><div class="q">${esc(w.q)}</div><div class="mine">✗ 내 답: ${esc(w.chosen)}</div><div class="good">✓ 정답: ${esc(w.answer)} ${englishParts(w.answer) || englishParts(w.q) ? `<button class="sayBtn sm" data-say="${i}" aria-label="영어 듣기">🔊</button>` : ''}</div>${w.exp ? `<div class="ex">${esc(w.exp)}</div>` : ''}</div>`).join('') : '<div class="allRight">이번 경기 영어 미션을 모두 맞혔어요! 👏</div>'}
      </div></div>` : ''}
      <div class="foot">
        ${ibtn('btn_lobby', '대기실로', 'id="toLobby"')}
        <p>${why} ${S.settings.autoMode ? '잠시 뒤 저절로 대기실로 가서 새 친구들과 다시 달려요!' : '선생님의 안내를 기다려요.'}</p>
      </div>`;
    document.body.appendChild(el);
    if (me) Snd.play(myIdx === 0 ? 'finish' : 'correct');
    el.querySelectorAll('[data-say]').forEach(b => b.onclick = () => { const w = g.me.wrongs[+b.dataset.say]; say([englishParts(w.answer) || englishParts(w.q)]); });
    el.querySelector('#toLobby').onclick = () => socket.emit('student:leave', {}, res => { if (!res || !res.ok) toast((res && res.msg) || '잠시 뒤 다시 눌러 주세요.'); });
  }

  /* ---------------- 게임 방법 ---------------- */
  function showHelp() {
    if (helpOpen) return; helpOpen = true;
    const m = document.createElement('div'); m.className = 'modal new';
    const I = n => `<img src="${IMG}${n}.webp" alt="">`;
    m.innerHTML = `<div class="helpWrap" role="dialog" aria-label="게임 방법">
      <img class="nhead" src="${IMG}help_head.webp" alt="게임 방법">
      <div class="hframe"><div class="hbody">
        <p style="margin:6px 0">정해진 바퀴를 먼저 돌면 1등이에요. 모두 <b>동시에</b> 고르고, 다 같이 달려요.</p>
        <h4>${I('gear_on_1')}1. 기어 고르기</h4>
        <ul><li>기어 1~4단. 기어 수만큼 카드를 내요.</li><li>한 번에 1단씩 바꿀 수 있어요. 2단을 한꺼번에 바꾸면 열 1을 내요.</li><li>기어가 높을수록 <b>어려운 미션</b>이 나와요. (1단 단어 → 4단 대화)</li></ul>
        <h4>${I('card_3')}2. 스피드 카드</h4>
        <ul><li>숫자 카드 = 속도. <b>?</b> 깜짝 카드는 정답이면 1~4 중 하나가 나와요.</li><li>🔥 열 카드는 속도 0이에요. 정비를 해야 없어져요.</li></ul>
        <h4>${I('ico_ok')}3. 영어 미션</h4>
        <ul><li>맞히면 계획대로 달리고, 부스트도 쓸 수 있어요.</li><li>틀려도 달리지만 엔진 열 1이 빠져요.</li></ul>
        <h4>${I('sign_4')}코너</h4>
        <ul><li>표지판 숫자 = 제한 속도. 넘은 만큼 엔진 열을 내요.</li><li>열이 모자라면 <b>스핀!</b> 코너 앞에 멈추고 1단 기어가 돼요.</li></ul>
        <h4>${I('ico_snow')}좋은 것들</h4>
        <ul><li>💨 슬립스트림: 앞차 바로 뒤에 서면 +2칸</li><li>❄️ 냉각(정비): 1단(3장)·2단(1장)으로 달리고 정답이면 손의 열 카드가 엔진으로 돌아가요.</li><li>💪 꼴찌 보너스: 꼴찌는 +1칸, 정비 +1</li></ul>
        ${ibtn('btn_close', '닫기', 'id="hx"', 'closeB')}
      </div></div></div>`;
    document.body.appendChild(m);
    const close = () => { m.remove(); helpOpen = false; };
    m.querySelector('#hx').onclick = close; m.onclick = e => { if (e.target === m) close(); };
  }

  /* ---------------- 시계 ---------------- */
  setInterval(() => {
    if (!S) return;
    if (screen === 'room' && S.room && S.room.status === 'countdown') {
      const sec = Math.ceil(Math.max(0, S.room.startIn - (Date.now() - gotAt)) / 1000); const el = document.getElementById('cd');
      const h = cdHTML(sec, 'countdown'); if (el && lastCd !== h) { el.innerHTML = h; lastCd = h; if (sec <= 5) Snd.play('beep'); }
    }
    if (screen === 'game' && S.game) {
      const g = S.game; const tm = document.getElementById('tm'); const tl = document.getElementById('tl');
      const frozen = S.paused || (S.room && S.room.paused);
      const el2 = frozen ? 0 : Date.now() - gotAt;
      if (tm) {
        const left = g.phase === 'plan' ? Math.max(0, g.remain - el2) : 0;
        const waiting = g.phase === 'plan' && g.me && !g.me.answered;
        const sec = Math.ceil(left / 1000);
        tm.classList.toggle('blink', waiting && left > 0 && left <= 10000);
        if (waiting && sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; Snd.play('tick'); }
        const total = (S.settings.roundSec || 60) * 1000;
        tm.style.setProperty('--p', (g.phase === 'plan' ? Math.max(0, Math.min(100, left / total * 100)) : 0) + '%');
        tm.classList.toggle('low', left < 10000);
      }
      if (tl) { const s = Math.max(0, Math.floor((g.timeLeft - el2) / 1000)); tl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    }
  }, 250);

  if (!session) renderJoin(); else $app.innerHTML = '<div class="scr lobby" style="display:grid;place-items:center"><div class="plate" style="width:min(420px,80vw)"><b>연결하는 중…</b></div></div>';
})();
