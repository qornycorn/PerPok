function red(c) {
  return st(c) === 0 || st(c) === 2;
}
const SN = ["wajik", "keriting", "hati", "sekop"];
let lastDisplayedTableGroup = null;
function cd(c, sl, locked = false) {
  const cls = `cd${red(c) ? " r" : ""}${sl ? " s" : ""}`,
    face = `<b>${R[rk(c)]}</b><i>${S[st(c)]}</i>`;
  return sl === undefined
    ? `<div class="${cls}">${face}</div>`
    : `<button type="button" class="${cls}" data-c="${c}" aria-pressed="${!!sl}" aria-label="${R[rk(c)]} ${SN[st(c)]}"${locked ? " disabled" : ""}>${face}</button>`;
}
function stash(cs, player, combo = "Buka kartu 3") {
  if (cs && cs.length)
    G.discard.push({
      id: G.nextPlayId++,
      player,
      cards: [...cs],
      combo,
      isPlay: false,
      revertable: false,
    });
}
function snapshotPlayState() {
  const table = G.table
    ? { ...G.table, a: [...G.table.a], r: [...G.table.r] }
    : null;
  return {
    hands: G.hands.map((h) => [...h]),
    table,
    last: G.last,
    turn: G.turn,
    passes: G.passes,
    passed: [...G.passed],
    first: G.first,
    openingThrees: G.openingThrees,
    done: [...G.done],
    log: [...G.log],
    over: G.over,
    bomWin: G.bomWin,
    bombWinner: G.bombWinner,
    bub: { ...G.bub },
    skak: G.skak,
    show: G.show ? { ...G.show, cs: [...G.show.cs] } : null,
    discard: G.discard.map((group) => ({ ...group, cards: [...group.cards] })),
    nextPlayId: G.nextPlayId,
    undo: G.undo,
    reverts: [...G.reverts],
    afterHuman: G.afterHuman,
    openingPlayer: G.openingPlayer,
    openingPending: G.openingPending,
    clearCountdown: G.clearCountdown || 0,
    replyCountdown: G.replyCountdown || 0,
  };
}
function rememberUndo(p, c, playId) {
  const entry = {
    player: p,
    playId,
    combo: label(c),
    state: snapshotPlayState(),
  };
  G.reverts.push(entry);
  G.undo = entry;
}
function nextTurn(p) {
  if (G.afterHuman !== null) {
    const n = G.afterHuman;
    G.afterHuman = null;
    return G.done.includes(n) ? nextActive(p) : n;
  }
  return nextActive(p);
}
function nextResponder(p) {
  for (let step = 1; step <= 4; step++) {
    const player = (p + step) % 4;
    if (
      player !== G.last &&
      !G.done.includes(player) &&
      !G.passed.includes(player)
    )
      return player;
  }
  return -1;
}
function showRevertList() {
  if (!G.reverts.length || G.over || G.done.includes(0)) return;
  clearTimeout(timer);
  ver++;
  $("revertList").innerHTML = G.reverts
    .map((entry, i) => ({ entry, i }))
    .reverse()
    .map(
      ({ entry, i }) =>
        `<button type="button" class="revert-option" data-revert="${i}"><span>${names[entry.player]}</span><small>${entry.combo}</small></button>`,
    )
    .join("");
  $("playedCards").classList.remove("show");
  $("revert").classList.add("show");
}
function closeRevertList(resume = true) {
  $("revert").classList.remove("show");
  if (resume) schedule();
}
function applyRevert(i) {
  const entry = G.reverts[i];
  if (!entry) return;
  clearTimeout(timer);
  clearInterval(clearCountdownTimer);
  clearCountdownTimer = null;
  stopHumanReplyCountdown();
  const prior = G.reverts.slice(0, i);
  Object.assign(G, entry.state);
  G.reverts = prior;
  G.undo = prior.at(-1) || null;
  G.turn = 0;
  G.afterHuman = entry.player;
  ver++;
  trimPlaySnapshots();
  $("revert").classList.remove("show");
  say(`${names[entry.player]}: ${entry.combo} dikembalikan. Giliranmu dulu!`);
  render();
  toast(`Kombinasi ${names[entry.player]} dikembalikan. Kamu jalan dulu!`);
}
function trimPlaySnapshots() {
  const ids = new Set(G.discard.map((group) => group.id));
  G.playSnapshots = Object.fromEntries(
    Object.entries(G.playSnapshots).filter(([id]) => ids.has(+id)),
  );
}
function canTakeBack(group) {
  if (
    !group.isPlay ||
    G.over ||
    G.done.includes(0) ||
    !G.playSnapshots[group.id]
  )
    return false;
  const index = G.discard.findIndex((item) => item.id === group.id);
  if (index < 0) return false;
  const playedCombo = classify(group.cards);
  return !G.discard
    .slice(index + 1)
    .some((later) => later.isPlay && beats(classify(later.cards), playedCombo));
}
function takeBackPlayedGroup(id) {
  const group = G.discard.find((item) => item.id === id);
  const state = G.playSnapshots[id];
  if (!group || !state || !canTakeBack(group)) return;
  clearTimeout(timer);
  clearInterval(clearCountdownTimer);
  clearCountdownTimer = null;
  stopHumanReplyCountdown();
  const owner = group.player;
  Object.assign(G, state);
  trimPlaySnapshots();
  G.turn = 0;
  G.afterHuman = owner === 0 ? null : owner;
  sel.clear();
  ver++;
  $("playedCards").classList.remove("show");
  $("revert").classList.remove("show");
  say(
    `${names[owner]} menarik kembali ${group.combo}. Aksi sesudahnya dibatalkan.`,
  );
  render();
  toast(
    `${group.combo} dikembalikan ke tangan ${names[owner]}. Kamu jalan dulu!`,
  );
}
function allPlayedGroups() {
  return G.discard.map((group) => ({ ...group, cards: [...group.cards] }));
}
function allPlayedCards() {
  return [...new Set(allPlayedGroups().flatMap((group) => group.cards))];
}
function discardHTML() {
  if (G.openingThrees) return "";
  let currentIndex = -1;
  if (G.table) {
    const tableCards = new Set(G.table.a);
    for (let i = G.discard.length - 1; i >= 0; i--) {
      const group = G.discard[i];
      if (
        group.player === G.last &&
        group.cards.length === tableCards.size &&
        group.cards.every((card) => tableCards.has(card))
      ) {
        currentIndex = i;
        break;
      }
    }
  }
  const currentGroup = currentIndex >= 0 ? G.discard[currentIndex] : null;
  const newlyBuried = new Set();
  if (
    lastDisplayedTableGroup &&
    lastDisplayedTableGroup !== currentGroup &&
    G.discard.includes(lastDisplayedTableGroup)
  ) {
    lastDisplayedTableGroup.cards.forEach((card) => newlyBuried.add(card));
  }
  lastDisplayedTableGroup = currentGroup;

  const groups = G.discard.filter((_, index) => index !== currentIndex);
  const cards = [...new Set(groups.flatMap((group) => group.cards))];
  return cards.length
    ? `<button type="button" class="discard" id="openPlayed" aria-label="Lihat ${cards.length} kartu yang sudah keluar"><span class="discard-fan" aria-hidden="true">${cards
        .slice(-4)
        .map((card, index) => {
          const pileCard = cd(card).replace(
            'class="cd',
            `class="cd${newlyBuried.has(card) ? " pile-arrive" : ""}`,
          ).replace("<div ", `<div data-c="${card}" `);
          return pileCard.replace(
            "<div ",
            `<div style="--pile-delay:${index * 55}ms" `,
          );
        })
        .join("")}</span></button>`
    : "";
}
function showPlayedCards() {
  const groups = allPlayedGroups();
  const cards = [...new Set(groups.flatMap((group) => group.cards))];
  $("playedCount").textContent =
    `${cards.length} kartu · terbaru di atas. Tarik kembali membatalkan aksi sesudahnya.`;
  $("playedList").innerHTML = [...groups]
    .reverse()
    .map((group) => {
      const canRevert = group.revertable && !G.over && !G.done.includes(0);
      const revertIndex = canRevert
        ? G.reverts.findIndex((entry) => entry.playId === group.id)
        : -1;
      const revertButton = group.revertable
        ? `<button type="button" class="played-revert" data-play-id="${group.id}" ${revertIndex < 0 ? "disabled" : ""}>${revertIndex < 0 ? "Revert tidak tersedia" : "Revert lawan"}</button>`
        : "";
      const takebackReady = canTakeBack(group);
      const takebackButton = group.isPlay
        ? `<button type="button" class="played-takeback" data-takeback-id="${group.id}" ${takebackReady ? "" : "disabled"} title="${takebackReady ? "Kembalikan kartu ke tangan dan batalkan aksi sesudahnya" : "Tidak tersedia karena kombinasi ini sudah dikalahkan kombinasi yang lebih kuat"}">${takebackReady ? "Tarik kembali" : "Tidak tersedia"}</button>`
        : "";
      return `<article class="played-combo"><div class="played-combo-head"><span><strong>${names[group.player]}</strong> · ${group.combo || "Kartu keluar"}</span><div class="played-combo-actions">${revertButton}${takebackButton}</div></div><div class="played-player-cards">${group.cards.map((c) => cd(c)).join("")}</div></article>`;
    })
    .join("");
  $("playedCards").classList.add("show");
}
function closePlayedCards() {
  $("playedCards").classList.remove("show");
}
