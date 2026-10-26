function say(m) {
  G.log.unshift(m);
  G.log.length = Math.min(G.log.length, 5);
}
function toast(m) {
  $("toast").textContent = m;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("toast").textContent = ""), 2200);
}

function dealHands() {
  const pictureRanks = new Set(["J", "Q", "K"]);
  while (true) {
    const deck = Array.from({ length: 52 }, (_, card) => card);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const hands = Array.from({ length: 4 }, (_, player) =>
      deck.slice(player * 13, player * 13 + 13).sort((a, b) => a - b),
    );
    const dealtCards = hands.flat();
    const completeDeck =
      dealtCards.length === 52 && new Set(dealtCards).size === 52;
    const validHands = hands.every(
      (hand) =>
        hand.length === 13 &&
        hand.some((card) => pictureRanks.has(R[rk(card)])),
    );
    if (completeDeck && validHands) return hands;
  }
}

function newGame() {
  const hands = dealHands();
  const first = hands.findIndex((h) => h.includes(THREE_OF_SPADES));
  G = {
    hands,
    table: null,
    last: -1,
    turn: first,
    passes: 0,
    passed: [],
    first: true,
    openingThrees: true,
    done: [],
    log: [],
    over: false,
    bomWin: false,
    bub: {},
    discard: [],
    nextPlayId: 0,
    playSnapshots: {},
    undo: null,
    reverts: [],
    afterHuman: null,
    openingPlayer: first,
    openingPending: true,
  };
  sel.clear();
  ver++;
  $("over").classList.remove("show");
  $("revert").classList.remove("show");
  const hd = $("hand");
  hd.classList.add("deal");
  setTimeout(() => hd.classList.remove("deal"), 1500);
  say(
    "Kartu dibagi. Pemegang 3♠ jalan duluan; keluarkan semua kartu 3 sebelum permainan dimulai.",
  );
  schedule();
}
function schedule() {
  clearTimeout(timer);
  render();
  if (G.over) return;
  if (G.turn !== 0) timer = setTimeout(botTurn, fast ? 1200 : 1600);
}
function nextThreeHolder(p) {
  for (let step = 1; step <= 4; step++) {
    const player = (p + step) % 4;
    if (
      !G.done.includes(player) &&
      G.hands[player].some((card) => rk(card) === 0)
    )
      return player;
  }
  return -1;
}
function playOpeningThrees(p, cs) {
  if (
    !cs.length ||
    cs.some((card) => rk(card) !== 0) ||
    (G.first && (cs.length !== 1 || cs[0] !== THREE_OF_SPADES))
  )
    return false;
  const combo = classify(cs);
  if (!combo) return false;
  G.hands[p] = G.hands[p].filter((card) => !cs.includes(card));
  G.discard.push({
    id: G.nextPlayId++,
    player: p,
    cards: [...cs],
    combo: label(combo),
    isPlay: false,
    revertable: false,
    opening: true,
  });
  G.table = combo;
  G.last = p;
  G.passes = 0;
  G.passed = [];
  G.first = false;
  G.openingPending = true;
  G.bub = {};
  G.bub[p] = "Mengeluarkan kartu 3";
  G.skak = false;
  G.show = null;
  fast = p !== 0;
  ver++;
  say(`${names[p]} mengeluarkan ${label(combo)} pada pembukaan.`);
  const next = nextThreeHolder(p);
  if (next < 0) {
    G.openingThrees = false;
    G.table = null;
    G.last = -1;
    G.turn = p;
    G.openingPlayer = p;
    G.bub = {};
    say(`Semua kartu 3 sudah keluar. ${names[p]} bebas membuka permainan.`);
  } else {
    G.turn = next;
    say(`${names[next]} keluarkan kartu 3 sebelum permainan dimulai.`);
  }
  schedule();
  return true;
}
function play(p, cs) {
  if (G.openingThrees) return playOpeningThrees(p, cs);
  const c = classify(cs);
  const skakmat =
    c.t === "bom" &&
    G.table &&
    ["single", "pair", "tris"].includes(G.table.t) &&
    rk(G.table.v) === 12;
  const takebackState = snapshotPlayState();
  const playId = G.nextPlayId++;
  if (p === 0) {
    G.undo = null;
    G.reverts = [];
  } else rememberUndo(p, c, playId);
  G.openingPending = false;
  G.discard.push({
    id: playId,
    player: p,
    cards: [...cs],
    combo: label(c),
    isPlay: true,
    revertable: p !== 0,
  });
  G.playSnapshots[playId] = takebackState;
  G.hands[p] = G.hands[p].filter((x) => !cs.includes(x));
  G.table = c;
  G.last = p;
  G.passes = 0;
  G.passed = [];
  G.first = false;
  ver++;
  say(`${names[p]} keluar ${label(c)}`);
  G.skak = false;
  G.show = null;
  G.bub = {};
  G.bub[p] = TN[c.t] + "<br>Ada yang lawan?";
  fast = p !== 0;
  if (G.hands[p].length === 1) say(`${names[p]}: "Sisa satu!"`);
  if (!G.hands[p].length) {
    if (G.done.length === 0 && c.t === "bom") G.bomWin = true;
    G.done.push(p);
    say(`${names[p]} habis! Juara ${G.done.length}`);
  }
  if (G.done.length >= 3) return endGame();
  if (skakmat) {
    say(`SKAKMAT! ${names[p]} membatalkan kartu 2.`);
    return clearTable(p);
  }
  if (["single", "pair", "tris"].includes(c.t) && rk(c.v) === 12)
    return twoCheck(p, c, []);
  if (G.done.includes(p)) {
    const heir = nextActive(p);
    say(`WARIS! ${names[heir]} bebas membuka kombinasi apa saja.`);
    clearTable(p);
    if (G.turn === 0) toast("Waris! Kamu bebas membuka kombinasi apa saja.");
    return;
  }
  const opp = active().filter((x) => x !== p);
  if (!opp.some((o) => combos(G.hands[o]).some((k) => beats(k, c)))) {
    say(`SAPU BERSIH! Tidak ada yang bisa melawan ${nm(c.v)}.`);
    if (p === 0) toast("Tidak ada yang bisa melawan. Kamu jalan lagi!");
    return clearTable(p);
  }
  G.turn = nextTurn(p);
  schedule();
}
function twoCheck(p, c, skip) {
  clearTimeout(timer);
  const owners = active().filter(
    (o) =>
      o !== p &&
      !skip.includes(o) &&
      combos(G.hands[o]).some((k) => k.t === "bom" && beats(k, c)),
  );
  if (!owners.length) {
    say(`${names[p]} keluar 2, jalan lagi!`);
    return clearTable(p);
  }
  const o = owners[0];
  G.turn = o;
  if (o === 0) {
    G.skak = true;
    say("Ada 2! Kamu punya bom, skakmat atau pass?");
    toast("Skakmat pakai bom, atau Pass");
    return render();
  }
  say(`SKAKMAT! ${names[o]} punya bom.`);
  render();
  const v = ver;
  setTimeout(() => {
    if (ver !== v || G.over) return;
    const k = combos(G.hands[o])
      .filter((k) => k.t === "bom" && beats(k, c))
      .sort((a, b) => a.v - b.v)[0];
    play(o, k.a);
  }, 1000);
}
function buka3() {
  const got = [];
  let h3 = -1;
  G.hands.forEach((h, p) => {
    const t = h.filter((c) => rk(c) === 0);
    if (!t.length) return;
    stash(t, p, "Buka kartu 3");
    G.hands[p] = h.filter((c) => rk(c) !== 0);
    t.forEach((c) => {
      got.push(c);
      if (c === 3) h3 = p;
    });
    G.bub[p] = `Buang ${t.length}× kartu 3`;
  });
  if (!got.length) return;
  ver++;
  G.show = { cs: got.sort((a, b) => a - b), h: h3 };
  say(
    h3 >= 0
      ? `Semua buka kartu 3. ${names[h3]} pegang 3♠, jalan duluan!`
      : "Semua buka kartu 3.",
  );
  if (h3 >= 0) G.turn = h3;
  G.hands.forEach((h, p) => {
    if (!h.length && !G.done.includes(p)) {
      G.done.push(p);
      say(`${names[p]} habis! Juara ${G.done.length}`);
    }
  });
  if (G.done.length >= 3) return endGame();
  if (G.done.includes(G.turn)) G.turn = nextActive(G.turn);
}
function clearTable(lead) {
  const wasBom = G.table && G.table.t === "bom";
  G.afterHuman = null;
  G.table = null;
  G.passes = 0;
  G.passed = [];
  G.last = -1;
  ver++;
  G.bub = {};
  fast = false;
  G.turn = G.done.includes(lead) ? nextActive(lead) : lead;
  if (wasBom) {
    buka3();
    if (G.over) return;
  }
  G.openingPlayer = G.turn;
  G.openingPending = true;
  say(`${names[G.turn]} bebas membuka.`);
  schedule();
}
function pass(p) {
  if (!G.table || p !== G.turn || p === G.last || G.done.includes(p)) return;
  if (!G.passed.includes(p)) G.passed.push(p);
  G.passes = G.passed.length;
  say(`${names[p]} pass`);
  G.bub[p] = "Pass";
  const opponents = active().filter((x) => x !== G.last);
  const remaining = opponents.filter((x) => !G.passed.includes(x));
  if (!remaining.length) {
    const lead = G.last;
    say(`Semua lawan pass. ${names[lead]} jalan lagi!`);
    if (lead === 0) toast("Semua lawan pass. Kamu jalan lagi!");
    return clearTable(lead);
  }
  G.turn = nextResponder(p);
  schedule();
}
function botTurn() {
  if (G.over) return;
  const p = G.turn,
    h = G.hands[p],
    t = G.table;
  if (G.openingThrees) {
    const threes = h.filter((card) => rk(card) === 0);
    if (G.first) {
      if (h.includes(THREE_OF_SPADES)) return play(p, [THREE_OF_SPADES]);
      const starter = G.hands.findIndex((hand) =>
        hand.includes(THREE_OF_SPADES),
      );
      if (starter >= 0) {
        G.turn = starter;
        return schedule();
      }
    }
    if (threes.length) return play(p, threes);
    const next = nextThreeHolder(p);
    if (next >= 0) {
      G.turn = next;
      return schedule();
    }
    G.openingThrees = false;
    G.table = null;
    G.last = -1;
    G.turn = p;
    G.openingPlayer = p;
    G.openingPending = true;
    ver++;
    say(`Semua kartu 3 sudah keluar. ${names[p]} bebas membuka permainan.`);
    return schedule();
  }
  let opts = combos(h).filter((k) => beats(k, t));
  if (G.first) opts = opts.filter((k) => k.a.includes(3));
  const danger = active().some((o) => o !== p && G.hands[o].length <= 2);
  const key = (k) =>
    (k.t === "bom" ? 2000 : 0) + (rk(k.v) === 12 ? 1000 : 0) + k.v - k.n * 12;
  if (!t) {
    opts.sort((a, b) => key(a) - key(b));
    return play(p, opts[0].a);
  }
  const same = opts
    .filter((k) => k.t !== "bom" || t.t === "bom")
    .sort((a, b) => a.v - b.v);
  const boms = opts
    .filter((k) => k.t === "bom" && t.t !== "bom")
    .sort((a, b) => a.v - b.v);
  if (same.length) {
    let k = danger ? same.at(-1) : same[0];
    if (rk(k.v) === 12 && h.length > 5 && !danger && Math.random() < 0.6)
      return pass(p);
    return play(p, k.a);
  }
  if (boms.length && (h.length <= 6 || danger || Math.random() < 0.3))
    return play(p, boms[0].a);
  pass(p);
}

function humanPlay() {
  if (G.turn !== 0 || G.over) return false;
  const cs = [...sel],
    c = classify(cs);
  if (!c) {
    toast("Kombinasi tidak sah");
    return false;
  }
  if (G.openingThrees) {
    if (cs.some((card) => rk(card) !== 0)) {
      toast("Saat pembukaan, keluarkan kartu 3 saja");
      return false;
    }
    if (G.first && (cs.length !== 1 || cs[0] !== THREE_OF_SPADES)) {
      toast("Pembukaan harus dimulai dengan 3♠ saja");
      return false;
    }
    sel.clear();
    clearTimeout(timer);
    play(0, cs);
    return true;
  }
  if (G.first && !cs.includes(THREE_OF_SPADES)) {
    toast("Giliran pertama wajib mengeluarkan 3♠");
    return false;
  }
  if (!beats(c, G.table)) {
    toast("Kartumu belum cukup tinggi");
    return false;
  }
  sel.clear();
  clearTimeout(timer);
  play(0, cs);
  return true;
}
function humanPass() {
  if (G.turn !== 0 || !G.table || G.over || G.openingThrees) return;
  sel.clear();
  G.undo = null;
  G.reverts = [];
  if (G.skak) {
    G.skak = false;
    say("Kamu tidak memakai bom.");
    return twoCheck(G.last, G.table, [0]);
  }
  pass(0);
}

function endGame() {
  G.over = true;
  clearTimeout(timer);
  ver++;
  const loser = active()[0],
    extra = [0, 0, 0, 0];
  if (G.hands[loser].includes(51)) extra[loser] -= 1;
  if (G.hands[loser].length === 13) extra[loser] -= 3;
  if (G.bomWin) extra[G.done[0]] += 1;
  G.done.push(loser);
  previousWinner = G.done[0];
  const pts = [3, 1, -1, -3];
  G.done.forEach((p, i) => {
    scores[p] += pts[i] + extra[p];
  });
  render();
  const champ = scores.some((s) => s >= 15)
    ? scores.indexOf(Math.max(...scores))
    : -1;
  $("ovb").innerHTML =
    `<h2 style="margin:0 0 8px">${G.done[0] === 0 ? "Kamu menang! 🎉" : names[G.done[0]] + " menang"}</h2><ol>${G.done.map((p, i) => `<li>${names[p]}: ${pts[i] >= 0 ? "+" : ""}${pts[i]}${extra[p] ? ` (bonus/denda ${extra[p] > 0 ? "+" : ""}${extra[p]})` : ""}, total ${scores[p]}</li>`).join("")}</ol>` +
    (champ >= 0
      ? `<p><b>${names[champ]} juara tongkrongan (15+ poin)!</b></p>`
      : "") +
    `<div class="btns"><button id="again">${champ >= 0 ? "Main dari nol" : "Ronde baru"}</button></div>`;
  $("over").classList.add("show");
  $("again").focus();
  $("again").onclick = () => {
    if (champ >= 0) {
      scores = [0, 0, 0, 0];
      previousWinner = -1;
    }
    newGame();
  };
}
