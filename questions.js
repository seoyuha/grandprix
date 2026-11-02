// 부릉부릉 영어 그랑프리 — 기본 문제 은행 (6학년 영어 10·11·12단원, 지도서 주요 단어·표현 기준)
// 단계(level)는 기어와 같아요: 1단 단어 뜻 · 2단 문장 뜻 · 3단 빈칸 채우기 · 4단 대화·문장 순서
// 문제 형식: { id, unit, level, q, choices:[정답, 오답, 오답, 오답], exp }  ← 정답은 항상 첫 번째로 적고, 보여 줄 때 섞어요.

const UNITS = {
  10: { title: "I'd Like to Have the Fruit Salad", topic: '음식 주문 · 맛 표현', zone: '푸드 스트리트', icon: '🍝' },
  11: { title: 'Do You Know About Songpyeon?', topic: '전통문화 · 권유하기', zone: '한옥 마을', icon: '🏯' },
  12: { title: 'We Should Save the World', topic: '환경 보호', zone: '그린 어스 로드', icon: '🌏' },
};

const WORDS = {
  10: [['fruit', '과일'], ['salad', '샐러드'], ['spaghetti', '스파게티'], ['steak', '스테이크'], ['ice cream', '아이스크림'],
    ['lemon juice', '레몬주스'], ['cake', '케이크'], ['bibimbap', '비빔밥'], ['bulgogi', '불고기'], ['tteokbokki', '떡볶이'],
    ['vegetable', '채소'], ['egg', '달걀'], ['restaurant', '식당'], ['sweet', '달콤한'], ['salty', '짠'], ['sour', '신'],
    ['hot', '매운'], ['delicious', '맛있는']],
  11: [['songpyeon', '송편'], ['hanbok', '한복'], ['gat', '갓'], ['Hanji', '한지'], ['Tuho', '투호'], ['hanok', '한옥'],
    ['Gongginori', '공기놀이'], ['Yunnori', '윷놀이'], ['tteokguk', '떡국'], ['kimchi', '김치'], ['traditional', '전통의'],
    ['paper', '종이'], ['game', '놀이, 게임'], ['hat', '모자'], ['house', '집'], ['try on', '입어 보다'], ['make', '만들다'],
    ['Chuseok', '추석'], ['Seollal', '설날']],
  12: [['recycle', '재활용하다'], ['reuse', '재사용하다'], ['can', '캔'], ['bottle', '병'], ['light', '불, 전등'],
    ['stairs', '계단'], ['Earth', '지구'], ['energy', '에너지'], ['forest', '숲'], ['plastic', '플라스틱'], ['quickly', '빨리'],
    ['save', '아끼다, 구하다'], ['turn off', '끄다'], ['throw away', '버리다'], ['plastic bag', '비닐봉지'],
    ['paper cup', '종이컵'], ['use a cup', '컵을 사용하다'], ['use the stairs', '계단을 이용하다']],
};

const SENTS = {
  10: [["What would you like to have?", '무엇을 드시겠어요?'], ["I'd like to have the fruit salad.", '과일 샐러드로 할게요.'],
    ["I'd like to have the steak.", '스테이크로 할게요.'], ["I'd like to have the spaghetti.", '스파게티로 할게요.'],
    ["I'd like to have some lemon juice.", '레몬주스를 좀 마실게요.'], ["I'd like to have some ice cream.", '아이스크림을 좀 먹을게요.'],
    ["How's the food?", '음식 맛이 어때요?'], ["How's your bibimbap?", '네 비빔밥 맛이 어때?'], ["It's sweet.", '달콤해요.'],
    ["It's salty.", '짜요.'], ["It's sour.", '셔요.'], ["It's very hot.", '아주 매워요.'], ["It's delicious.", '맛있어요.'],
    ["It's so hot, but delicious.", '아주 맵지만 맛있어요.'], ['Here you are.', '여기 있어요.'],
    ["What's your favorite food?", '가장 좋아하는 음식이 뭐니?'], ['My favorite food is pizza.', '내가 가장 좋아하는 음식은 피자야.']],
  11: [['Do you know about songpyeon?', '송편에 대해 알고 있니?'], ['Do you know about hanbok?', '한복에 대해 알고 있니?'],
    ['Yes, I do.', '응, 알아.'], ["No, I don't.", '아니, 몰라.'], ['What is it?', '그게 뭐니?'],
    ["It's a traditional Korean food.", '그것은 한국의 전통 음식이야.'], ["It's a traditional Korean game.", '그것은 한국의 전통 놀이야.'],
    ["It's a traditional Korean hat.", '그것은 한국의 전통 모자야.'], ["It's a traditional Korean house.", '그것은 한국의 전통 집이야.'],
    ["It's traditional Korean paper.", '그것은 한국의 전통 종이야.'], ['How about making songpyeon?', '송편을 만들어 보는 게 어때?'],
    ['How about playing Tuho?', '투호를 해 보는 게 어때?'], ['How about trying it on?', '그것을 입어 보는 게 어때?'],
    ['Sounds good.', '좋아.'], ['We eat songpyeon on Chuseok.', '우리는 추석에 송편을 먹어.']],
  12: [['We should save the world.', '우리는 세상을 구해야 해.'], ['We should save water.', '우리는 물을 아껴야 해.'],
    ['We should save energy.', '우리는 에너지를 아껴야 해.'], ['We should save the forest.', '우리는 숲을 지켜야 해.'],
    ['We should recycle cans and bottles.', '우리는 캔과 병을 재활용해야 해.'], ['We should ride a bike.', '우리는 자전거를 타야 해.'],
    ["Don't forget to recycle cans and bottles.", '캔과 병을 재활용하는 것을 잊지 마.'], ["Don't forget to reuse paper.", '종이를 재사용하는 것을 잊지 마.'],
    ["Don't forget to turn off the light.", '불 끄는 것을 잊지 마.'], ["Don't forget to turn off the water.", '물 잠그는 것을 잊지 마.'],
    ["Don't forget to use a cup.", '컵을 사용하는 것을 잊지 마.'], ["Don't forget to use the stairs.", '계단을 이용하는 것을 잊지 마.'],
    ['The Earth is sick.', '지구가 아파.'], ['The Earth is our home.', '지구는 우리의 집이야.'],
    ["Don't use plastic bags.", '비닐봉지를 쓰지 마.'], ['How about using the stairs?', '계단을 이용하는 게 어때?']],
};

// 3단: 빈칸 채우기 [문제, 정답, 오답1, 오답2, 오답3, 해설]
const BLANKS = {
  10: [
    ["What would you like to ____?", 'have', 'has', 'having', 'to have', 'What would you like to have? (무엇을 드시겠어요?)'],
    ["I'd like to ____ the fruit salad.", 'have', 'has', 'having', 'had', "I'd like to + 동사원형"],
    ["I'd ____ to have the steak.", 'like', 'likes', 'liking', 'liked', "I'd like to have ~. (~로 할게요)"],
    ["I'd like to have ____ lemon juice.", 'some', 'a', 'an', 'many', '음료는 some lemon juice'],
    ["____ the food? — It's sweet.", "How's", "What's", "Where's", "Who's", "맛을 물을 때 How's the food?"],
    ["How's the food? — It's ____. (매워요)", 'hot', 'sweet', 'sour', 'salty', '맵다 = hot'],
    ["How's the lemon juice? — It's ____. (셔요)", 'sour', 'salty', 'hot', 'sweet', '시다 = sour'],
    ["It's so hot, ____ delicious.", 'but', 'and', 'or', 'so', '맵지만 맛있다 → but'],
    ["____ you are. (여기 있어요)", 'Here', 'There', 'What', 'How', '음식을 건넬 때 Here you are.'],
    ["My ____ food is pizza.", 'favorite', 'like', 'want', 'delicious', 'My favorite food is ~. (가장 좋아하는 음식)'],
  ],
  11: [
    ['Do you ____ about songpyeon?', 'know', 'knows', 'knowing', 'known', 'Do you know about ~? (~에 대해 알고 있니?)'],
    ['Do you know ____ hanbok?', 'about', 'to', 'at', 'for', 'know about ~ (~에 대해 알다)'],
    ['Do you know about Tuho? — Yes, I ____.', 'do', 'am', 'can', 'is', 'Do you ~? 질문에는 Yes, I do.'],
    ["Do you know about Hanji? — No, I ____.", "don't", "am not", "can't", "isn't", "모를 때 No, I don't."],
    ['How about ____ songpyeon? (만들어 보는 게 어때?)', 'making', 'make', 'makes', 'to make', 'How about 뒤에는 -ing'],
    ['How about ____ Yunnori? (해 보는 게 어때?)', 'playing', 'play', 'plays', 'played', 'How about 뒤에는 -ing'],
    ['How about ____ it on? (입어 보는 게 어때?)', 'trying', 'try', 'tries', 'tried', '입어 보다 = try on'],
    ["It's a traditional Korean ____. (한옥)", 'house', 'food', 'game', 'hat', '한옥은 전통 집(house)'],
    ["It's a traditional Korean ____. (송편)", 'food', 'house', 'hat', 'paper', '송편은 전통 음식(food)'],
    ["It's traditional Korean ____. (한지)", 'paper', 'food', 'game', 'hat', '한지는 전통 종이(paper)'],
    ['We eat songpyeon on ____.', 'Chuseok', 'Seollal', 'Christmas', 'Hangeul Day', '송편은 추석(Chuseok)에 먹어요.'],
  ],
  12: [
    ['We ____ save the world.', 'should', 'shoulds', 'to should', 'should to', 'We should ~. (~해야 해)'],
    ['We should ____ water.', 'save', 'saves', 'saving', 'to save', 'should 뒤에는 동사원형'],
    ["Don't forget ____ turn off the light.", 'to', 'for', 'at', 'in', "Don't forget to + 동사원형"],
    ["Don't ____ to reuse paper.", 'forget', 'forgets', 'forgot', 'forgetting', "Don't forget to ~. (~하는 것을 잊지 마)"],
    ["Don't forget to ____ cans and bottles.", 'recycle', 'recycles', 'recycling', 'recycled', 'to 뒤에는 동사원형'],
    ["Don't forget to turn ____ the water.", 'off', 'on', 'in', 'at', '끄다/잠그다 = turn off'],
    ["Don't forget to use the ____. (계단)", 'stairs', 'light', 'cup', 'forest', '계단 = stairs'],
    ['We should save ____. (에너지)', 'energy', 'forest', 'paper', 'water', '에너지 = energy'],
    ['The Earth is our ____.', 'home', 'cup', 'bottle', 'stairs', '지구는 우리의 집(home)'],
    ["Don't forget to turn off the light. — ____ We should save energy.", 'Sure.', 'No, I don\'t.', 'Here you are.', "It's sweet.", '알겠다고 대답할 때 Sure. / Okay.'],
  ],
};

// 4단: 대화에 알맞은 말 [문제, 정답, 오답1, 오답2, 오답3, 해설]
const DIALOGS = {
  10: [
    ["A: What would you like to have?\nB: ____", "I'd like to have the steak.", "It's sweet.", 'Yes, I do.', 'Here you are.', '주문을 물으면 I\'d like to have ~.'],
    ["A: How's the food?\nB: ____", "It's delicious.", "I'd like to have the salad.", 'Here you are.', "No, I don't.", '맛을 물으면 It\'s ~.'],
    ["A: I'd like to have the bibimbap.\nB: ____", 'Here you are.', "It's sour.", 'How about you?', 'Yes, I do.', '음식을 건넬 때 Here you are.'],
    ["A: ____\nB: It's very hot.", "How's the tteokbokki?", 'What would you like to have?', "What's your name?", 'Do you know about it?', '맛을 묻는 질문 How\'s ~?'],
    ["A: ____\nB: I'd like to have some ice cream.", 'What would you like to have?', "How's the food?", 'Do you like it?', 'Where is it?', '주문을 묻는 질문'],
    ["A: I'd like to have the spaghetti. How about you?\nB: ____", "I'd like to have the steak.", "It's salty.", 'Here you are.', 'Thank you.', 'How about you? → 나는 ~로 할게.'],
    ["A: What's your favorite food?\nB: ____", 'My favorite food is pizza.', "It's sweet.", "I'd like it.", 'Yes, I do.', '가장 좋아하는 음식을 말해요.'],
    ["A: How's the lemon juice?\nB: ____", "It's sour.", "I'd like to have the cake.", 'It is a restaurant.', 'Here you are.', '레몬주스는 시어요(sour).'],
  ],
  11: [
    ['A: Do you know about songpyeon?\nB: Yes, I do. ____', "It's a traditional Korean food.", "It's a traditional Korean hat.", "No, I don't.", 'How about playing it?', '송편은 전통 음식'],
    ["A: Do you know about Hanji?\nB: No, I don't. ____", 'What is it?', 'Yes, I do.', 'Sounds good.', 'Here you are.', '모를 때는 What is it?'],
    ['A: How about making songpyeon?\nB: ____', 'Sounds good.', "No, I don't.", 'Yes, I do.', "It's a hat.", '권유에 찬성: Sounds good.'],
    ['A: Do you know about Gongginori?\nB: Yes, I do. ____', 'How about playing it?', 'How about eating it?', 'How about wearing it?', "No, I don't.", '놀이는 play'],
    ["A: This is a hanbok. It's beautiful!\nB: ____", 'How about trying it on?', 'How about eating it?', 'How about playing it?', 'What would you like?', '옷은 try on (입어 보다)'],
    ['A: ____\nB: Yes, I do. It\'s a traditional Korean house.', 'Do you know about hanok?', 'Do you know about kimchi?', 'How about playing Tuho?', "What's your name?", '한옥 = 전통 집'],
    ['A: What is Tuho?\nB: ____', "It's a traditional Korean game.", "It's traditional Korean paper.", "It's a traditional Korean food.", 'Yes, I do.', '투호 = 전통 놀이'],
    ['A: Do you know about gat?\nB: Yes, I do. ____', "It's a traditional Korean hat.", "It's a traditional Korean house.", "It's a traditional Korean game.", 'How about making it?', '갓 = 전통 모자'],
  ],
  12: [
    ["A: Don't forget to turn off the light.\nB: ____", 'Sure. We should save energy.', "No, I don't.", "It's delicious.", 'Here you are.', '불을 끄면 에너지를 아껴요.'],
    ["A: Don't forget to use a cup.\nB: ____", 'I know. We should save water.', 'Yes, I do.', "It's a traditional game.", "I'd like to have it.", '양치할 때 컵을 쓰면 물을 아껴요.'],
    ['A: How about using the stairs?\nB: ____', 'Sounds great! We should save energy.', "No, I don't.", "It's sour.", 'Here you are.', '계단 이용 → 에너지 절약'],
    ['A: What can we do for the Earth?\nB: ____', 'We should recycle cans and bottles.', "It's sweet.", 'Yes, I do.', 'Do you know about hanbok?', '지구를 위해 할 수 있는 일'],
    ['A: The Earth is sick.\nB: ____', 'We should save the Earth.', "I'd like to have the salad.", "No, I don't.", 'How about trying it on?', '지구를 지켜야 해요.'],
    ["A: ____\nB: Okay. I'll turn off the water.", "Don't forget to turn off the water.", "Don't forget to use the stairs.", "How's the food?", 'Do you know about Tuho?', '물을 잠그라고 말해요.'],
    ["A: ____\nB: Sure. I'll reuse it.", "Don't forget to reuse paper.", "Don't forget to turn off the light.", 'What is it?', 'Here you are.', '종이를 재사용해요.'],
    ['A: Look at the forest. It\'s beautiful.\nB: ____', 'We should save the forest.', 'We should ride a bike.', "It's salty.", 'Yes, I do.', '숲을 지켜야 해요.'],
  ],
};

let _seed = 20261101;
function rnd() { _seed = (_seed * 1103515245 + 12345) % 2147483648; return _seed / 2147483648; }
function pickOthers(pool, avoid, n) {
  const c = pool.filter(x => x !== avoid);
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return c.slice(0, n);
}
function scramble(sentence) {
  // 어순 오답 만들기: 낱말 두 개 자리 바꾸기
  const w = sentence.replace(/[.?!]$/, '').split(' ');
  if (!/^(I|I'd|I'll)$/.test(w[0])) w[0] = w[0].charAt(0).toLowerCase() + w[0].slice(1);
  const end = sentence.match(/[.?!]$/) ? sentence.slice(-1) : '';
  const out = new Set();
  let guard = 0;
  while (out.size < 3 && guard++ < 60) {
    const a = w.slice(); const i = Math.floor(rnd() * a.length); let j = Math.floor(rnd() * a.length);
    if (i === j) continue; [a[i], a[j]] = [a[j], a[i]];
    let s = a.join(' '); s = s.charAt(0).toUpperCase() + s.slice(1) + end;
    if (s !== sentence) out.add(s);
  }
  return [...out];
}

function build() {
  const list = [];
  for (const u of [10, 11, 12]) {
    let n = 0; const id = () => `u${u}-${++n}`;
    const en = WORDS[u].map(w => w[0]), ko = WORDS[u].map(w => w[1]);
    WORDS[u].forEach(([e, k]) => {
      list.push({ id: id(), unit: u, level: 1, q: `"${e}"의 뜻은?`, choices: [k, ...pickOthers(ko, k, 3)], exp: `${e} = ${k}` });
      list.push({ id: id(), unit: u, level: 1, q: `"${k}"을(를) 영어로 하면?`, choices: [e, ...pickOthers(en, e, 3)], exp: `${k} = ${e}` });
    });
    const sEn = SENTS[u].map(s => s[0]), sKo = SENTS[u].map(s => s[1]);
    SENTS[u].forEach(([e, k]) => {
      list.push({ id: id(), unit: u, level: 2, q: `"${k}"에 알맞은 영어 문장은?`, choices: [e, ...pickOthers(sEn, e, 3)], exp: `${e} = ${k}` });
      list.push({ id: id(), unit: u, level: 2, q: `"${e}"의 뜻은?`, choices: [k, ...pickOthers(sKo, k, 3)], exp: `${e} = ${k}` });
    });
    BLANKS[u].forEach(([q, a, b, c, d, exp]) => list.push({ id: id(), unit: u, level: 3, q: `빈칸에 알맞은 말은?\n${q}`, choices: [a, b, c, d], exp }));
    DIALOGS[u].forEach(([q, a, b, c, d, exp]) => list.push({ id: id(), unit: u, level: 4, q: `빈칸에 알맞은 말은?\n${q}`, choices: [a, b, c, d], exp }));
    SENTS[u].filter(([e]) => e.split(' ').length >= 4).forEach(([e, k]) => {
      const wrong = scramble(e);
      if (wrong.length === 3) list.push({ id: id(), unit: u, level: 4, q: `순서가 바른 문장은?\n(${k})`, choices: [e, ...wrong], exp: `${e}` });
    });
  }
  return list;
}

module.exports = { UNITS, buildQuestions: build };
