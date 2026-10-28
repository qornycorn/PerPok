function plHTML(i) {
  const n = G.hands[i].length,
    b =
      G.done.includes(i) && !G.over
        ? "Selesai"
        : (G.bub[i] || "").split("<br>")[0];
  return `<div class="pl-head"><span class="pl-name">${names[i]}</span></div><span class="n">${n}</span><span class="bub">${b || "&nbsp;"}</span>`;
}
function split(h) {
  const cnt = {},
    run = new Set();
  h.forEach((c) => (cnt[rk(c)] = (cnt[rk(c)] || 0) + 1));
  for (let s = 0; s < 4; s++) {
    const rs = h
      .filter((c) => st(c) === s && rk(c) <= 11)
      .map(rk)
      .sort((a, b) => a - b);
    let i = 0;
    while (i < rs.length) {
      let j = i;
      while (j + 1 < rs.length && rs[j + 1] === rs[j] + 1) j++;
      if (j - i >= 2) for (let k = i; k <= j; k++) run.add(rs[k] * 4 + s);
      i = j + 1;
    }
  }
  const good = [],
    trash = [];
  h.forEach((c) =>
    (rk(c) >= 8 || cnt[rk(c)] > 1 || run.has(c) ? good : trash).push(c),
  );
  return [good, trash];
}
function fan(l, lab) {
  if (!l.length) return "";
  const n = l.length;
  return `<div class="rw">${l
    .map((c, i) => {
      const o = i - (n - 1) / 2;
      const locked =
        G.endingPending ||
        (G.openingThrees &&
          (rk(c) !== 0 || (c === THREE_OF_SPADES && !openingSpadeReady()))) ||
        (G.openingGathering && rk(c) !== 0);
      return cd(c, sel.has(c), locked).replace(
        "<button",
        `<button style="--r:${(o * 3.5).toFixed(1)}deg;--y:${(o * o * 1.1).toFixed(1)}px;--i:${i}"`,
      );
    })
    .join("")}</div>`;
}
function openingThreesHTML() {
  const played = new Map();
  G.discard
    .filter((group) => group.opening)
    .forEach((group) => group.cards.forEach((card) => played.set(st(card), card)));
  const newest = G.discard.at(-1);
  return `<div class="opening-row" aria-label="Kartu 3 pembukaan">${[0, 1, 2, 3]
    .map((suit, index) => {
      const card = played.get(suit);
      if (card === undefined) return '<div class="opening-slot" aria-hidden="true"></div>';
      const reveal = newest?.opening && newest.cards.includes(card);
      return cd(card).replace(
        'class="cd',
        `class="cd${reveal ? " opening-reveal" : ""}`,
      ).replace("<div ", `<div data-c="${card}" style="--i:${index}" `);
    })
    .join("")}</div>`;
}
function animateOpponentPlay() {
  const seatId = [null, "w", "n", "e"][G.last];
  const seat = seatId && $(seatId),
    row = $("c").querySelector(".row");
  if (!seat || !row) return;
  const origin = seat.getBoundingClientRect();
  const fromX = origin.left + origin.width / 2,
    fromY = origin.top + origin.height / 2;
  row.querySelectorAll(".cd").forEach((card, index) => {
    if (typeof card.animate !== "function") return;
    const target = card.getBoundingClientRect();
    const dx = fromX - (target.left + target.width / 2);
    const dy = fromY - (target.top + target.height / 2);
    card.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.94)`, opacity: 0.45 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      {
        duration: 240,
        delay: index * 30,
        easing: "cubic-bezier(.2, .8, .2, 1)",
        fill: "backwards",
      },
    );
  });
}
function animateOpeningStackGather(previousPositions) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  requestAnimationFrame(() => {
    $("c").querySelectorAll(".discard-fan .cd[data-c]").forEach((card, index) => {
      const previous = previousPositions.get(+card.dataset.c);
      if (!previous || typeof card.animate !== "function") return;
      const current = card.getBoundingClientRect();
      const dx = previous.left - current.left;
      const dy = previous.top - current.top;
      const transform = getComputedStyle(card).transform;
      card.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) ${transform}`, opacity: 0.82 },
          { transform, opacity: 1 },
        ],
        {
          duration: 560,
          delay: index * 45,
          easing: "cubic-bezier(.2, .8, .2, 1)",
          fill: "backwards",
        },
      );
    });
  });
}
let lastRenderedOpeningGathering = false;
let lastRenderedOpeningThrees = false;
let lastRenderedHandKey = null;
let lastRenderedHandCards = null;
let lastAnimatedPlayVersion = -1;
function render() {
  [
    [1, "w"],
    [2, "n"],
    [3, "e"],
  ].forEach(([i, id]) => {
    const e = $(id);
    e.innerHTML = plHTML(i);
    e.className =
      "pl" +
      (G.turn === i && !G.over && !G.openingThrees && !G.openingGathering ? " on" : "") +
      (G.done.includes(i) ? " fin" : "");
  });
  const t = G.table,
    tk = ver + "|" + G.over;
  if ($("c").dataset.k !== tk) {
    const gatheringOpeningStack = lastRenderedOpeningThrees === true && !G.openingThrees;
    const openingCardPositions = gatheringOpeningStack ? new Map() : null;
    if (gatheringOpeningStack) {
      const suitOrder = [0, 1, 2, 3];
      const finalOpeningGroup = G.discard.at(-1);
      [...$("c").querySelectorAll(".opening-row > *")].forEach((card, index) => {
        const playedCard = Number.isInteger(+card.dataset.c)
          ? +card.dataset.c
          : finalOpeningGroup?.opening
            ? finalOpeningGroup.cards.find((id) => st(id) === suitOrder[index])
            : undefined;
        if (playedCard !== undefined) {
          openingCardPositions.set(playedCard, card.getBoundingClientRect());
        }
      });
    }
    $("c").dataset.k = tk;
    $("c").innerHTML =
      (G.openingThrees
        ? `${openingThreesHTML()}<div class="cap">Keluarkan kartu 3 kapan saja</div>`
        : t
        ? `<div class="row${G.last > 0 ? " opponent-play" : ""}">${t.a.map((c) => cd(c)).join("")}</div><div class="cap play-cap"></div>`
        : G.show && !G.over
          ? `<div class="row">${G.show.cs.map((c) => cd(c)).join("")}</div><div class="cap">Buka kartu 3${G.show.h >= 0 ? ": " + names[G.show.h] + " pegang 3♠, jalan duluan" : ""}</div>`
          : `<div class="cap">${G.over ? "Ronde selesai" : G.openingThrees ? "Fase awal: keluarkan semua kartu 3" : "Meja kosong, bebas buka"}</div>`) +
      discardHTML();
    if (gatheringOpeningStack) animateOpeningStackGather(openingCardPositions);
    if (t && G.last > 0 && lastAnimatedPlayVersion !== ver) {
      animateOpponentPlay();
      lastAnimatedPlayVersion = ver;
    }
  }
  const playCap = $("c").querySelector(".play-cap");
  if (playCap && t) {
    const base = G.openingThrees
      ? `Kartu 3 dari ${names[G.last]} · ${G.hands.flat().filter((card) => rk(card) === 0).length} tersisa`
      : `${TN[t.t]} dari ${names[G.last]}`;
    playCap.textContent = `${base}${G.replyCountdown ? ` · Balas atau pass dalam ${G.replyCountdown}…` : ""}${G.clearCountdown ? ` · Tidak ada yang bisa membalas, lanjut dalam ${G.clearCountdown}…` : ""}`;
  }
  const [gd, tr] = split(G.hands[0]);
  const hand = $("hand");
  const handKey = `${G.hands[0].join(",")}|${G.openingThrees}|${G.openingGathering}|${G.openingThrees && openingSpadeReady()}`;
  if (handKey !== lastRenderedHandKey) {
    const previousCards = lastRenderedHandCards;
    const nextCards = [...G.hands[0]];
    const oldPositions = new Map(
      [...hand.querySelectorAll(".cd[data-c]")].map((card) => [
        +card.dataset.c,
        card.getBoundingClientRect(),
      ]),
    );
    const playedFromHand =
      previousCards &&
      nextCards.length < previousCards.length &&
      nextCards.every((card) => previousCards.includes(card));
    hand.innerHTML = G.hands[0].length
      ? fan(gd, "Kartu bagus") + fan(tr, "Sampah")
      : '<div class="empty-hand" aria-label="Kartu di tangan habis" aria-hidden="false"><span></span><span></span></div>';
    lastRenderedHandKey = handKey;
    lastRenderedHandCards = nextCards;
    if (playedFromHand) {
      requestAnimationFrame(() => {
        hand.querySelectorAll(".cd[data-c]").forEach((card) => {
          const previous = oldPositions.get(+card.dataset.c);
          if (!previous || typeof card.animate !== "function") return;
          const current = card.getBoundingClientRect();
          const dx = previous.left - current.left;
          const dy = previous.top - current.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
          const transform = getComputedStyle(card).transform;
          card.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) ${transform}` },
              { transform },
            ],
            {
              duration: 320,
              easing: "cubic-bezier(.2, .8, .2, 1)",
            },
          );
        });
      });
    }
  }
  hand.querySelectorAll(".cd[data-c]").forEach((card) => {
    const id = +card.dataset.c;
    const selected = sel.has(id);
    card.classList.toggle("s", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  if (
    lastRenderedOpeningGathering &&
    !G.openingGathering &&
    !G.openingThrees
  ) {
    const unlocked = [...hand.querySelectorAll(".cd[data-c]")];
    unlocked.forEach((card) => card.classList.add("opening-unlock"));
    setTimeout(
      () => unlocked.forEach((card) => card.classList.remove("opening-unlock")),
      700,
    );
  }
  lastRenderedOpeningGathering = G.openingGathering;
  lastRenderedOpeningThrees = G.openingThrees;
  const me =
    !G.over &&
    !G.endingPending &&
    !G.openingGathering &&
    (G.turn === 0 ||
      (G.openingThrees &&
        G.hands[0].some((card) => {
          return rk(card) === 0 && (card !== THREE_OF_SPADES || openingSpadeReady());
        })));
  const table = $("c");
  table.classList.toggle("turn-active", me);
  $("bPass").disabled =
    !me ||
    (!G.table && !hasOnlyTwos(G.hands[0])) ||
    G.openingThrees ||
    G.openingGathering;
  $("bCek").disabled =
    G.over || !G.table || G.last !== 0 || G.turn === 0 || G.turn < 0 || G.clearCountdown || G.openingThrees || G.openingGathering;
}
