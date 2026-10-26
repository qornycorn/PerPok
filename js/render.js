function plHTML(i) {
  const n = G.hands[i].length,
    b =
      G.done.includes(i) && !G.over
        ? "Selesai"
        : (G.bub[i] || "").split("<br>")[0];
  const badges = `${previousWinner === i ? '<span class="badge win">🏆 Menang lalu</span>' : ""}${G.openingPending && G.openingPlayer === i ? '<span class="badge start">▶ Mulai</span>' : ""}`;
  return `<span>${names[i]}</span>${badges}<span class="n">${n}</span><span class="bub">${b}</span>`;
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
      return cd(c, sel.has(c), G.openingThrees && rk(c) !== 0).replace(
        "<button",
        `<button style="--r:${(o * 3.5).toFixed(1)}deg;--y:${(o * o * 1.1).toFixed(1)}px;--i:${i}"`,
      );
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
let lastRenderedOpeningThrees = null;
let turnGlowTimeout;
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
      (G.turn === i && !G.over ? " on" : "") +
      (G.done.includes(i) ? " fin" : "");
  });
  const t = G.table,
    tk = ver + "|" + G.over;
  if ($("c").dataset.k !== tk) {
    $("c").dataset.k = tk;
    $("c").innerHTML =
      (t
        ? `<div class="row${G.last > 0 ? " opponent-play" : ""}">${t.a.map((c) => cd(c)).join("")}</div><div class="cap play-cap">${G.openingThrees ? `Kartu 3 dari ${names[G.last]} · ${G.hands.flat().filter((card) => rk(card) === 0).length} tersisa` : `${TN[t.t]} dari ${names[G.last]}`}</div>`
        : G.show && !G.over
          ? `<div class="row">${G.show.cs.map((c) => cd(c)).join("")}</div><div class="cap">Buka kartu 3${G.show.h >= 0 ? ": " + names[G.show.h] + " pegang 3♠, jalan duluan" : ""}</div>`
          : `<div class="cap">${G.over ? "Ronde selesai" : G.openingThrees ? "Fase awal: keluarkan semua kartu 3" : "Meja kosong, bebas buka"}</div>`) +
      discardHTML();
    if (t && G.last > 0) animateOpponentPlay();
  }
  const [gd, tr] = split(G.hands[0]);
  const hand = $("hand");
  hand.innerHTML = fan(gd, "Kartu bagus") + fan(tr, "Sampah");
  if (lastRenderedOpeningThrees === true && !G.openingThrees) {
    const unlocked = [...hand.querySelectorAll(".cd[data-c]")];
    unlocked.forEach((card) => card.classList.add("opening-unlock"));
    setTimeout(
      () => unlocked.forEach((card) => card.classList.remove("opening-unlock")),
      700,
    );
  }
  lastRenderedOpeningThrees = G.openingThrees;
  const me = G.turn === 0 && !G.over;
  if (me) {
    clearTimeout(turnGlowTimeout);
    hand.classList.remove("turn-ending");
    hand.classList.add("my");
  } else if (hand.classList.contains("my")) {
    hand.classList.remove("my");
    hand.classList.add("turn-ending");
    clearTimeout(turnGlowTimeout);
    turnGlowTimeout = setTimeout(
      () => hand.classList.remove("turn-ending"),
      500,
    );
  }
  $("bPass").disabled = !me || !G.table || G.openingThrees;
  $("bCek").disabled =
    G.over || !G.table || G.last !== 0 || G.turn === 0 || G.openingThrees;
}
