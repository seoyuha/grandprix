/* 부릉부릉 영어 그랑프리 — 교사 관제실 (새 그래픽) */
(function () {
  const { Track, face, IMG } = window.RaceCommon;
  const socket = io({ reconnection: true });
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k) { try { return JSON.parse(localStorage.getItem('gpT_' + k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('gpT_' + k, JSON.stringify(v)); } catch (e) {} } };
  const LVN = { 1: '1단 단어', 2: '2단 문장', 3: '3단 빈칸', 4: '4단 대화' };
  const STATUS = { waiting: '출발 대기', countdown: '곧 출발', playing: '경기 중', finished: '경기 끝' };
  const ST_IMG = { waiting: 'st_wait', countdown: 'st_ready', playing: 'st_playing', finished: 'st_ready' };
  const FACE_X = [7.0, 25.9, 44.5, 63.1, 81.9];
  const NAME_X = [3.8, 22.4, 41.1, 59.8, 78.5];
  let T = null, gotAt = 0, session = store.get('session');
  // 비밀번호는 이 탭에서만 기억해요 (탭을 닫으면 다시 입력)
  const pwGet = () => { try { return sessionStorage.getItem('gpT_pw') || ''; } catch (e) { return ''; } };
  const pwSet = v => { try { sessionStorage.setItem('gpT_pw', v); } catch (e) {} };
  const typedPw = () => $('#tPw').value || pwGet();
  $('#tPw').value = pwGet();
  $('#tPw').onkeydown = e => { if (e.key === 'Enter') (session ? resume(true) : $('#bCreate').click()); };
  let view = 'dash', monRoom = '';
  let qList = [];
  const roomEls = {};
  let monTrack = null, monKey = '';

  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  function emit(ev, data) { return new Promise(r => socket.emit(ev, data || {}, res => { if (res && res.msg) toast(res.msg); r(res || {}); })); }
  const studentUrl = () => `${location.origin}/?code=${T ? T.code : ''}`;
  const faceImg = (c, cls = '', style = '') => `<img class="${cls}" src="${face(c)}" alt="" style="${style}">`;

  /* ---------- 시작 ---------- */
  if (session) $('#bResume').classList.remove('hidden');
  $('#bCreate').onclick = async () => {
    if (session && !confirm('새 수업을 만들면 학생들이 새 방 코드로 들어와야 해요. 만들까요?')) return;
    const pw = typedPw(); if (!pw) { $('#startErr').textContent = '교사 비밀번호를 입력해 주세요.'; $('#tPw').focus(); return; }
    const r = await new Promise(res => socket.emit('teacher:create', { pw }, res));
    if (r && r.ok) { pwSet(pw); session = { code: r.code, key: r.key }; store.set('session', session); enter(); }
    else { $('#startErr').textContent = (r && r.msg) || '수업을 만들 수 없어요.'; if (r && r.pw) { pwSet(''); $('#tPw').select(); } }
  };
  $('#bResume').onclick = () => resume(true);
  function resume(show) {
    const pw = typedPw(); if (!pw) { if (show) { $('#startErr').textContent = '교사 비밀번호를 입력해 주세요.'; $('#tPw').focus(); } return; }
    socket.emit('teacher:resume', Object.assign({ pw }, session), r => {
      if (r && r.ok) { pwSet(pw); enter(); return; }
      if (r && r.pw) { pwSet(''); $('#vApp').classList.add('hidden'); $('#vStart').classList.remove('hidden'); }
      if (show || (r && r.pw)) $('#startErr').textContent = (r && r.msg) || '이전 수업을 열 수 없어요.';
    });
  }
  socket.on('connect', () => { if (session && T) resume(false); });
  function enter() { $('#vStart').classList.add('hidden'); $('#vApp').classList.remove('hidden'); }
  socket.on('tstate', s => { const first = !T || T.code !== s.code; T = s; gotAt = Date.now(); if (first) drawQR(); render(); });

  function drawQR() {
    ['#qr', '#qr2', '#qrBig'].forEach(id => $(id).innerHTML = '');
    if (window.QRCode) { [['#qr', 240], ['#qr2', 240], ['#qrBig', 512]].forEach(([id, n]) => new QRCode($(id), { text: studentUrl(), width: n, height: n })); }
    else { $('#qr').innerHTML = $('#qr2').innerHTML = '<small style="color:#64748b">QR을 불러오지 못했어요</small>'; }
  }
  ['#qr', '#qr2'].forEach(id => $(id).onclick = () => $('#qrModal').classList.remove('hidden'));
  $('#qrClose').onclick = () => $('#qrModal').classList.add('hidden');

  /* ---------- 메뉴 ---------- */
  document.querySelectorAll('#tabs .menu').forEach(b => b.onclick = () => go(b.dataset.v));
  function go(v) {
    view = v;
    document.querySelectorAll('#tabs .menu').forEach(x => {
      const on = x.dataset.v === v; x.classList.toggle('on', on);
      x.style.setProperty('--img', `url(${IMG}${on ? x.dataset.on : x.dataset.off}.webp)`);
    });
    document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
    if (v === 'questions') loadQ();
    if (v === 'results') loadResults();
    render();
  }

  /* ---------- 위쪽 버튼 ---------- */
  $('#bAuto').onclick = () => { const on = !T.settings.autoMode; emit('teacher:settings', { autoMode: on }).then(() => toast(on ? '자동 배정을 켰어요.' : '자동 배정을 껐어요. [지금 배정]으로 방을 만들어요.')); };
  $('#bAssign').onclick = () => emit('teacher:assign');
  $('#bStart').onclick = () => emit('teacher:startAll');
  $('#bPause').onclick = () => emit('teacher:pauseAll').then(r => toast(r.paused ? '모든 방을 멈췄어요. 한 번 더 누르면 다시 시작해요.' : '다시 시작했어요.'));
  $('#bEnd').onclick = () => { if (confirm('지금 달리는 모든 경기를 끝낼까요? 지금 순위로 결과가 저장돼요.')) emit('teacher:endAll'); };
  $('#bFull').onclick = () => { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {}); else d.exitFullscreen && d.exitFullscreen().catch(() => {}); };
  $('#bGear').onclick = () => go('settings');
  $('#bNewRoom').onclick = () => emit('teacher:newRoom');
  $('#bAllLobby').onclick = () => emit('teacher:allToLobby');

  /* ---------- 그리기 ---------- */
  function render() {
    if (!T) return;
    ['#code', '#code2', '#code3'].forEach(id => $(id).textContent = T.code);
    $('#url').textContent = studentUrl(); $('#url2').textContent = studentUrl();
    $('#bAuto').classList.toggle('off', !T.settings.autoMode);
    $('#autoTog').src = IMG + (T.settings.autoMode ? 'tog_on' : 'tog_off') + '.webp';
    $('#bAuto').title = T.settings.autoMode ? '자동 배정 켜짐 (누르면 꺼져요)' : '자동 배정 꺼짐 (누르면 켜져요)';
    $('#bPause').classList.toggle('paused', !!T.paused); $('#bPause').title = T.paused ? '다시 시작' : '일시 정지';
    const online = T.students.filter(s => s.online).length;
    const playing = T.rooms.filter(r => r.status === 'playing').length;
    const sh = `<span class="stat"><img src="${IMG}ico_eye.webp" alt="">접속 학생<b>${online}</b>/ ${T.students.length}명</span>
      <span class="stat">🪑 대기실<b>${T.lobby.length}</b>명</span>
      <span class="stat"><img src="${IMG}checker.webp" alt="" style="height:16px">경기 중<b>${playing}</b>/ ${T.rooms.length}방</span>
      <span class="stat"><img src="${IMG}trophy.webp" alt="">끝난 경기<b>${T.resultsCount}</b>판</span>
      <span class="stat">${T.settings.units.map(u => `<img src="${IMG}unit_${u}.webp" alt="${u}단원">`).join('')}${T.settings.units.length > 1 ? '섞기' : ''}</span>
      <span class="stat">🤖 자동 배정 <b style="font-size:1.05rem;font-family:var(--font);font-weight:400;color:${T.settings.autoMode ? '#15803d' : '#b91c1c'}">${T.settings.autoMode ? '켜짐' : '꺼짐'}</b></span>
      ${T.paused ? '<span class="stat warn">⏸ 전체 일시 정지 중</span>' : ''}`;
    if ($('#stats').dataset.h !== sh) { $('#stats').innerHTML = sh; $('#stats').dataset.h = sh; }
    if (view === 'dash') renderDash();
    if (view === 'monitor') renderMonitor();
    if (view === 'settings') renderSettings();
  }

  function roomOptions(sel) {
    return `<option value="lobby" ${!sel ? 'selected' : ''}>대기실</option>` + T.rooms.map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''} ${r.status === 'playing' && r.id !== sel ? 'disabled' : ''}>${esc(r.name)}${r.status === 'playing' ? ' (경기 중)' : ''}</option>`).join('');
  }
  function renderDash() {
    const byId = Object.fromEntries(T.students.map(s => [s.id, s]));
    $('#lobbyN').textContent = `${T.lobby.length}명`;
    const wt = sec => sec < 60 ? `${sec}초` : `${Math.floor(sec / 60)}분 ${sec % 60}초`;
    const plus = Math.floor((Date.now() - gotAt) / 1000);
    const lh = T.lobby.map(id => byId[id]).filter(Boolean).map(s => { const w = (s.waitSec || 0) + plus; return `<span class="chip ${w >= 60 ? 'long' : ''}" title="기다린 시간">${faceImg(s.car)}${esc(s.name)} <small class="muted">${wt(w)}</small></span>`; }).join('') || '<span class="muted">대기 중인 학생이 없어요.</span>';
    if ($('#lobby').dataset.h !== lh) { $('#lobby').innerHTML = lh; $('#lobby').dataset.h = lh; }
    $('#studN').textContent = `${T.students.length}명`;
    const sorted = T.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
    const html = sorted.map(s => {
      const acc = s.stats.total ? Math.round(s.stats.correct / s.stats.total * 100) + '%' : '-';
      const room = s.roomId && T.rooms.find(r => r.id === s.roomId);
      const st = !s.online ? 'st_off' : room ? (room.status === 'playing' ? 'st_playing' : 'st_ready') : 'st_wait';
      return `<tr><td class="nm">${faceImg(s.car)}${esc(s.name)}</td><td><img class="stImg" src="${IMG}${st}.webp" alt=""></td>
        <td><select data-mv="${s.id}">${roomOptions(s.roomId)}</select></td><td>${s.stats.games}</td><td>${acc}</td><td><button class="ib kick" style="--img:url(${IMG}btn_x.webp)" data-kick="${s.id}" title="수업에서 내보내기" aria-label="내보내기"></button></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="muted">아직 들어온 학생이 없어요.</td></tr>';
    const tb = $('#studs');
    if (tb.dataset.h !== html && !tb.contains(document.activeElement)) {
      tb.innerHTML = html; tb.dataset.h = html;
      tb.querySelectorAll('[data-mv]').forEach(sel => sel.onchange = () => emit('teacher:move', { sid: sel.dataset.mv, to: sel.value }));
      tb.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { if (confirm('이 학생을 수업에서 내보낼까요? 기록도 지워져요.')) emit('teacher:kick', { sid: b.dataset.kick }); });
    }
    // 방 카드
    const box = $('#rooms');
    const live = new Set(T.rooms.map(r => r.id));
    for (const id in roomEls) if (!live.has(id)) { roomEls[id].wrap.remove(); delete roomEls[id]; }
    if (!T.rooms.length) {
      if (!box.querySelector('.empty')) box.innerHTML = `<div class="cpanel empty"><p class="muted" style="margin:0">아직 방이 없어요. ${T.settings.autoMode ? '학생이 3명 이상 들어오면 자동으로 방이 만들어지고 출발해요.' : '[지금 배정]을 누르면 대기실 학생으로 방을 만들어요.'}</p></div>`;
      return;
    }
    box.querySelector('.empty')?.remove();
    T.rooms.forEach(r => {
      let re = roomEls[r.id];
      if (!re) {
        const wrap = document.createElement('div'); wrap.className = 'rcardWrap';
        wrap.innerHTML = `<div class="rcard"><div class="rn"></div><div class="ri"></div><span class="rdot"></span><div class="rmain"><svg></svg><div class="rmsg"></div></div><div class="rppl"></div></div><div class="racts"></div>`;
        box.appendChild(wrap); re = roomEls[r.id] = { wrap, el: wrap.querySelector('.rcard'), track: null, tkey: '' };
      }
      const el = re.el; const g = r.game;
      el.querySelector('.rn').innerHTML = `${esc(r.name)} <img src="${IMG}${ST_IMG[r.status]}.webp" alt="${STATUS[r.status]}">`;
      el.querySelector('.rdot').className = 'rdot ' + r.status;
      el.querySelector('.ri').textContent = (r.paused ? '⏸ ' : '') + (g ? (g.phase === 'done' ? '경기 끝' : `${g.round}라운드 · ${g.phase === 'plan' ? Math.ceil(Math.max(0, g.remain - (Date.now() - gotAt)) / 1000) + '초' : '달리는 중'}`) : r.status === 'countdown' ? '곧 출발' : `${r.playerIds.length}명`);
      const svg = el.querySelector('svg'); const msg = el.querySelector('.rmsg');
      if (g) {
        const k = g.no + '|' + (g.track.units || []).join();
        if (re.tkey !== k) { svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); re.track = Track(svg, g.track, { small: true }); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); re.tkey = k; }
        svg.style.display = ''; msg.innerHTML = ''; re.track.setPlayers(g.players, null, null);
      } else {
        svg.style.display = 'none';
        msg.innerHTML = r.status === 'countdown' ? `<div class="bigCd">${Math.max(1, Math.ceil((r.startIn - (Date.now() - gotAt)) / 1000))}</div>곧 출발해요` : '출발 대기 중이에요.<br>[출발]을 누르면 시작해요.';
      }
      const byId2 = Object.fromEntries(T.students.map(s => [s.id, s]));
      const ps = g ? g.players : r.playerIds.map(id => byId2[id]).filter(Boolean).map(s => ({ id: s.id, name: s.name, car: s.car, online: s.online })).concat(r.bots || []);
      const ph = ps.slice(0, 5).map((p, i) => `<img class="rface ${p.online === false ? 'off' : ''}" src="${face(p.car)}" alt="" style="left:${FACE_X[i]}%"><div class="rnm" style="left:${NAME_X[i]}%">${p.bot ? '🤖' : ''}${g && g.phase !== 'done' ? (g.phase === 'plan' ? (p.answered ? (p.correct ? '⭕' : '❌') : p.ready ? '📝' : '') : '') : g ? i + 1 + '등 ' : ''}${esc(p.name)}</div>`).join('')
        + (ps.length > 5 ? `<div class="rnm" style="left:84%;top:70%;width:12%">+${ps.length - 5}명</div>` : '');
      const pp = el.querySelector('.rppl'); if (pp.dataset.h !== ph) { pp.innerHTML = ph; pp.dataset.h = ph; pp.style.display = 'contents'; }
      const acts = [];
      if (r.status === 'waiting') acts.push(['start', 't_start']);
      if (r.status === 'playing') acts.push(['pause', 't_pause'], ['end', 't_end']);
      if (r.status === 'finished') acts.push(['rematch', 'b_rematch', '같은 팀 다시']);
      acts.push(['lobby', 't_lobby', '대기실로'], ['watch', 'b_watch', '크게 보기']);
      const NM = { start: '출발', pause: '멈춤', end: '경기 종료' };
      const ah = acts.map(([a, img, t]) => `<button class="ib tbs ${img.startsWith('b_') ? 'txt' : ''}" data-a="${a}" style="--img:url(${IMG}${img}.webp)" aria-label="${t || NM[a]}" title="${t || NM[a]}"></button>`).join('');
      const ra = re.wrap.querySelector('.racts');
      if (ra.dataset.h !== ah) {
        ra.innerHTML = ah; ra.dataset.h = ah;
        ra.querySelectorAll('button').forEach(b => b.onclick = () => {
          const a = b.dataset.a;
          if (a === 'watch') { monRoom = r.id; monKey = ''; go('monitor'); return; }
          const cur = T.rooms.find(x => x.id === r.id);
          if ((a === 'end' || a === 'lobby') && cur && cur.status === 'playing' && !confirm('이 방의 경기를 끝낼까요?')) return;
          emit('teacher:room', { roomId: r.id, action: a });
        });
      }
    });
  }

  /* ---------- 모니터링 ---------- */
  document.querySelectorAll('[data-ra]').forEach(b => b.onclick = () => {
    if (!monRoom) return toast('방을 먼저 골라 주세요.');
    const a = b.dataset.ra; if ((a === 'end' || a === 'lobby') && !confirm('이 방의 경기를 끝낼까요?')) return;
    emit('teacher:room', { roomId: monRoom, action: a });
  });
  $('#monSel').onchange = e => { monRoom = e.target.value; monKey = ''; renderMonitor(); };
  function renderMonitor() {
    if (!T.rooms.find(r => r.id === monRoom)) { monRoom = (T.rooms.find(r => r.game) || T.rooms[0] || {}).id || ''; monKey = ''; }
    const opts = T.rooms.map(r => `<option value="${r.id}" ${r.id === monRoom ? 'selected' : ''}>${esc(r.name)} — ${STATUS[r.status]}</option>`).join('') || '<option>방이 없어요</option>';
    if ($('#monSel').dataset.h !== opts) { $('#monSel').innerHTML = opts; $('#monSel').dataset.h = opts; }
    const r = T.rooms.find(x => x.id === monRoom); const g = r && r.game;
    if (!g) { $('#monInfo').textContent = r ? '아직 경기가 시작되지 않았어요.' : '방이 없어요.'; $('#monPlayers').innerHTML = ''; $('#monLog').innerHTML = ''; return; }
    const k = r.id + g.no;
    if (monKey !== k) { monTrack = Track($('#monTrack'), g.track); monKey = k; }
    monTrack.setPlayers(g.players, null, null);
    $('#monInfo').textContent = `${g.round}라운드 · ${g.phase === 'plan' ? '고르는 중' : g.phase === 'show' ? '달리는 중' : '경기 끝'} · ${g.laps}바퀴 경기${r.paused ? ' · ⏸ 멈춤' : ''}`;
    const ph = g.players.map((p, i) => {
      const lap = Math.min(g.laps, Math.floor(Math.max(0, p.pos) / g.track.len) + 1);
      let q = '', a = '', icon = '';
      if (p.q) {
        q = `[${p.q.unit}단원 ${LVN[p.q.level]}] ${p.q.q}`;
        a = `<span class="ok">정답: ${esc(p.q.choices[p.q.answer])}</span>${p.choice >= 0 ? `<span>고른 답: ${esc(p.q.choices[p.choice])}</span>` : '<span>아직 고르지 않았어요</span>'}`;
        icon = p.choice >= 0 ? (p.correct ? 'ico_ok' : 'ico_no') : 'ico_eye';
      } else { q = g.phase === 'plan' ? (p.ready ? '' : '기어와 카드를 고르는 중') : '이번 라운드 문제 없음'; a = `<span>정답 ${p.right}/${p.total}</span>`; }
      return `<div class="mrow ${p.online ? '' : 'off'}">
        <img class="mf" src="${face(p.car)}" alt=""><img class="mrk" src="${IMG}rank_${Math.min(5, i + 1)}.webp" alt="${i + 1}등">
        <div class="mn">${p.bot ? '🤖 ' : ''}${esc(p.name)} <small>${p.bot ? 'AI 친구' : p.online ? '' : '연결 끊김'}</small></div>
        <div class="s1">${p.finished ? '🏁' : lap + '/' + g.laps}<small>바퀴</small></div>
        <div class="s2">${p.gear}단<small>기어</small></div>
        <div class="s3">🔥${p.engine}<small>엔진</small></div>
        <div class="mq">${esc(q)}</div><div class="ma">${a}</div>
        <div class="mi">${icon ? `<img src="${IMG}${icon}.webp" alt="">` : ''}</div>
      </div>`;
    }).join('');
    if ($('#monPlayers').dataset.h !== ph) { $('#monPlayers').innerHTML = ph; $('#monPlayers').dataset.h = ph; }
    const pl = Object.fromEntries(g.players.map(p => [p.id, p]));
    $('#monLog').innerHTML = g.log.slice().reverse().map(l => l.late ? `<div>➕ ${l.round}라운드 · <b style="font-weight:400">${esc(l.late)}</b> 학생이 늦게 들어왔어요</div>` : `<div><b style="font-weight:400">${l.round}라운드</b> · ${l.moves.map(m => `${esc((pl[m.id] || {}).name || '?')} ${m.correct ? '⭕' : '❌'}${m.speed}${m.spin ? '💫' : ''}`).join(' · ')}</div>`).join('') || '<div>아직 기록이 없어요.</div>';
  }

  /* ---------- 설정 ---------- */
  function renderSettings() {
    const s = T.settings;
    const uh = Object.entries(T.units).map(([u, info]) => `<button class="ucard ${s.units.includes(+u) ? 'on' : ''}" data-u="${u}" aria-pressed="${s.units.includes(+u)}"><span class="uin"><img src="${IMG}unit_${u}.webp" alt="${u}단원"><b>${esc(info.title)}</b><small>${esc(info.topic)}</small></span></button>`).join('');
    const box = $('#unitCards');
    if (box.dataset.h !== uh) {
      box.innerHTML = uh; box.dataset.h = uh;
      box.querySelectorAll('.ucard').forEach(b => b.onclick = () => {
        const u = +b.dataset.u; let list = T.settings.units.slice();
        list = list.includes(u) ? list.filter(x => x !== u) : list.concat(u);
        if (!list.length) return toast('단원을 하나 이상 골라 주세요.');
        emit('teacher:settings', { units: list });
      });
    }
    const setSel = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = String(v); };
    setSel('#sLaps', s.laps); setSel('#sRound', s.roundSec); setSel('#sLimit', s.timeLimitMin); setSel('#sSize', `${s.minSize}-${s.maxSize}`);
    $('#sAuto').checked = s.autoMode;
    $('#sAi').checked = s.aiFill !== false;
  }
  $('#sLaps').onchange = e => emit('teacher:settings', { laps: +e.target.value });
  $('#sRound').onchange = e => emit('teacher:settings', { roundSec: +e.target.value });
  $('#sLimit').onchange = e => emit('teacher:settings', { timeLimitMin: +e.target.value });
  $('#sSize').onchange = e => { const [a, b] = e.target.value.split('-').map(Number); emit('teacher:settings', { minSize: a, maxSize: b }); };
  $('#sAuto').onchange = e => emit('teacher:settings', { autoMode: e.target.checked });
  $('#sAi').onchange = e => emit('teacher:settings', { aiFill: e.target.checked }).then(() => toast(e.target.checked ? 'AI 친구가 빈자리를 채워요.' : 'AI 친구를 껐어요.'));

  /* ---------- 문제 관리 ---------- */
  async function loadQ() { const r = await emit('teacher:questions'); if (r.ok) { qList = r.list; drawQ(); } }
  ['#qUnit', '#qLevel'].forEach(id => $(id).onchange = drawQ); $('#qSearch').oninput = drawQ;
  $('#qAddOpen').onclick = () => $('#addQ').classList.toggle('hidden');
  function drawQ() {
    const u = $('#qUnit').value, l = $('#qLevel').value, s = $('#qSearch').value.trim().toLowerCase();
    const list = qList.filter(q => (!u || q.unit == u) && (!l || q.level == l) && (!s || (q.q + q.choices.join(' ')).toLowerCase().includes(s)));
    const on = qList.filter(q => q.on); const cnt = {};
    on.forEach(q => cnt[q.unit] = (cnt[q.unit] || 0) + 1);
    $('#qInfo').innerHTML = `전체 ${qList.length}문제 · 사용 중 ${on.length}문제 (10단원 ${cnt[10] || 0} · 11단원 ${cnt[11] || 0} · 12단원 ${cnt[12] || 0}) · 직접 넣은 문제 ${qList.filter(q => q.custom).length}개 · 지금 보이는 문제 ${list.length}개`;
    $('#qBody').innerHTML = list.slice(0, 600).map(q => `<tr><td>${q.unit}</td><td>${LVN[q.level]}</td><td class="q">${esc(q.q)}</td><td>${esc(q.choices[0])}</td><td class="muted">${q.choices.slice(1).map(esc).join(' / ')}</td>
      <td><input type="checkbox" class="ck" data-on="${q.id}" ${q.on ? 'checked' : ''} aria-label="사용"></td><td>${q.custom ? `<button class="ib kick" style="--img:url(${IMG}btn_x.webp)" data-del="${q.id}" aria-label="삭제" title="삭제"></button>` : ''}</td></tr>`).join('');
    $('#qBody').querySelectorAll('[data-on]').forEach(c => c.onchange = async () => { await emit('teacher:qToggle', { ids: [c.dataset.on], on: c.checked }); const q = qList.find(x => x.id === c.dataset.on); if (q) q.on = c.checked; drawQ(); });
    $('#qBody').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await emit('teacher:qDelete', { ids: [b.dataset.del] }); loadQ(); });
    $('#qAll').checked = list.length > 0 && list.every(q => q.on);
  }
  $('#qAll').onchange = async e => {
    const ids = [...document.querySelectorAll('#qBody [data-on]')].map(c => c.dataset.on);
    if (!ids.length) return;
    if (!confirm(`지금 보이는 ${ids.length}문제를 모두 ${e.target.checked ? '켤' : '끌'}까요?`)) { e.target.checked = !e.target.checked; return; }
    await emit('teacher:qToggle', { ids, on: e.target.checked }); loadQ();
  };
  $('#aAdd').onclick = async () => {
    const row = { unit: $('#aUnit').value, level: $('#aLevel').value, q: $('#aQ').value, choices: ['#aC1', '#aC2', '#aC3', '#aC4'].map(x => $(x).value), answer: 1, exp: $('#aExp').value };
    const r = await emit('teacher:qAdd', { rows: [row] });
    if (r.added) { toast('문제를 넣었어요.'); ['#aQ', '#aC1', '#aC2', '#aC3', '#aC4', '#aExp'].forEach(x => $(x).value = ''); loadQ(); }
    else toast('문제와 보기 4개를 모두 채워 주세요.');
  };
  const HEAD = ['단원', '단계(1~4)', '문제', '보기1', '보기2', '보기3', '보기4', '정답번호(1~4)', '해설'];
  function downloadSheet(rows, name, sheet) {
    if (!window.XLSX) return toast('엑셀 기능을 불러오지 못했어요. 인터넷 연결을 확인하세요.');
    const wb = XLSX.utils.book_new();
    if (Array.isArray(sheet)) sheet.forEach(([n, r]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(r), n));
    else XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet || '문제');
    XLSX.writeFile(wb, name);
  }
  $('#qTpl').onclick = () => downloadSheet([HEAD, [10, 3, "I'd like to ____ the steak.", 'have', 'has', 'having', 'had', 1, "I'd like to + 동사원형"], [12, 2, '"우리는 물을 아껴야 해."에 알맞은 영어 문장은?', 'We should save energy.', 'We should save water.', "Don't forget to use a cup.", 'Save the forest.', 2, '']], '그랑프리_문제_양식.xlsx');
  $('#qExport').onclick = () => downloadSheet([HEAD].concat(qList.map(q => [q.unit, q.level, q.q, ...q.choices, 1, q.exp || ''])), '그랑프리_전체문제.xlsx');
  $('#qFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!window.XLSX) return toast('엑셀 기능을 불러오지 못했어요.');
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).filter(r => r.some(x => String(x).trim()));
    if (rows.length && !/\d/.test(String(rows[0][0]))) rows.shift();
    const data = rows.map(r => ({ unit: r[0], level: r[1], q: r[2], choices: [r[3], r[4], r[5], r[6]], answer: r[7], exp: r[8] }));
    const replace = confirm(`${data.length}줄을 읽었어요.\n\n[확인] 직접 넣은 문제를 이 파일로 바꾸기\n[취소] 지금 문제에 더하기`);
    const r = await emit('teacher:qAdd', { rows: data, replace });
    toast(`넣은 문제 ${r.added || 0}개 · 잘못된 줄 ${r.bad || 0}개 · 겹친 문제 ${r.dup || 0}개`);
    loadQ();
  };

  /* ---------- 결과 ---------- */
  let R = null;
  async function loadResults() { const r = await emit('teacher:results'); if (!r.ok) return; R = r; drawResults(); }
  function pct(c, t) { return t ? Math.round(c / t * 100) + '%' : '-'; }
  function drawResults() {
    const st = R.students.slice().sort((a, b) => b.stats.points - a.stats.points || b.stats.correct - a.stats.correct);
    const tc = R.students.reduce((a, s) => a + s.stats.correct, 0), tt = R.students.reduce((a, s) => a + s.stats.total, 0);
    $('#cStud').textContent = R.students.length + '명'; $('#cGames').textContent = R.results.length + '판'; $('#cAcc').textContent = pct(tc, tt);
    $('#rStud').innerHTML = st.map((s, i) => { const u = s.stats.byUnit || {}; const f = n => u[n] ? `${pct(u[n].c, u[n].t)} <span class="muted">(${u[n].c}/${u[n].t})</span>` : '-';
      return `<tr><td>${i < 5 ? `<img src="${IMG}rank_${i + 1}.webp" alt="${i + 1}" style="width:28px;vertical-align:middle">` : i + 1}</td><td>${esc(s.name)}</td><td>${s.stats.games}</td><td>${s.stats.wins}</td><td>${s.stats.points}</td><td>${pct(s.stats.correct, s.stats.total)} <span class="muted">(${s.stats.correct}/${s.stats.total})</span></td><td>${f(10)}</td><td>${f(11)}</td><td>${f(12)}</td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">아직 기록이 없어요.</td></tr>';
    $('#rGames').innerHTML = R.results.slice().reverse().map(g => `<tr><td>#${g.no}</td><td>${esc(g.room)}</td><td>${g.units.join('+')}</td><td>${g.players.map(p => `${p.rank}. ${esc(p.name)} (${p.right}/${p.total})`).join(' · ')}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">아직 끝난 경기가 없어요.</td></tr>';
    const wc = {}; R.wrongs.forEach(w => { const k = w.unit + '|' + w.q; (wc[k] = wc[k] || { unit: w.unit, q: w.q, answer: w.answer, n: 0 }).n++; });
    $('#rWrong').innerHTML = Object.values(wc).sort((a, b) => b.n - a.n).slice(0, 30).map(w => `<tr><td>${w.unit}</td><td class="q">${esc(w.q)}</td><td>${esc(w.answer)}</td><td>${w.n}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">틀린 문제가 아직 없어요.</td></tr>';
  }
  $('#rDown').onclick = async () => {
    await loadResults(); if (!R) return;
    const s1 = [['이름', '경기 수', '1등', '점수', '정답', '푼 문제', '정답률', '10단원', '11단원', '12단원']].concat(R.students.map(s => { const u = s.stats.byUnit || {}; const f = n => u[n] ? `${u[n].c}/${u[n].t}` : ''; return [s.name, s.stats.games, s.stats.wins, s.stats.points, s.stats.correct, s.stats.total, pct(s.stats.correct, s.stats.total), f(10), f(11), f(12)]; }));
    const s2 = [['경기', '방', '단원', '라운드', '순위', '이름', '점수', '정답', '푼 문제', '스핀']]; R.results.forEach(g => g.players.forEach(p => s2.push([g.no, g.room, g.units.join('+'), g.rounds, p.rank, p.name, p.pts, p.right, p.total, p.spins])));
    const s3 = [['시각', '이름', '단원', '단계', '문제', '고른 답', '정답']].concat(R.wrongs.map(w => [new Date(w.at).toLocaleTimeString('ko-KR'), w.name, w.unit, w.level, w.q, w.chosen, w.answer]));
    downloadSheet(null, `그랑프리_결과_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.xlsx`, [['학생별', s1], ['경기별', s2], ['틀린 문제', s3]]);
  };
  $('#rReset').onclick = async () => { if (confirm('모든 결과와 학생 누적 기록을 지울까요? 되돌릴 수 없어요.')) { await emit('teacher:resetResults'); loadResults(); } };

  setInterval(() => { if (T && view === 'dash') renderDash(); }, 1000);
  if (session && pwGet()) resume(false);
})();
