$("hand").addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".cd[data-c]");
  if (
    !card ||
    e.button !== 0 ||
    G.endingPending ||
    G.openingGathering ||
    (G.turn !== 0 && !G.openingThrees) ||
    G.over
  )
    return;
  dragState = {
    pointerId: e.pointerId,
    card: +card.dataset.c,
    x: e.clientX,
    y: e.clientY,
    dragging: false,
    previous: new Set(sel),
  };
});
window.addEventListener(
  "pointermove",
  (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    if (
      !dragState.dragging &&
      Math.hypot(e.clientX - dragState.x, e.clientY - dragState.y) > 8
    ) {
      dragState.dragging = true;
      dragState.cards = sel.has(dragState.card) ? [...sel] : [dragState.card];
      const rects = dragState.cards
        .map((c) =>
          $("hand")
            .querySelector(`.cd[data-c="${c}"]`)
            ?.getBoundingClientRect(),
        )
        .filter(Boolean);
      const originX = rects.length
        ? (Math.min(...rects.map((r) => r.left)) +
            Math.max(...rects.map((r) => r.right))) /
          2
        : e.clientX;
      const originY = rects.length
        ? (Math.min(...rects.map((r) => r.top)) +
            Math.max(...rects.map((r) => r.bottom))) /
          2
        : e.clientY;
      sel.clear();
      dragState.cards.forEach((c) => sel.add(c));
      $("hand")
        .querySelectorAll(".cd[data-c]")
        .forEach((el) => {
          if (sel.has(+el.dataset.c)) el.classList.add("drag-origin");
        });
      const ghost = document.createElement("div");
      ghost.className = "drag-ghost approach";
      ghost.innerHTML = dragState.cards
        .map(
          (c, i) =>
            `<div style="--drag-turn:${((i - (dragState.cards.length - 1) / 2) * 4).toFixed(1)}deg">${cd(c)}</div>`,
        )
        .join("");
      ghost.querySelectorAll(".cd").forEach((el, i) => {
        el.style.setProperty(
          "--drag-turn",
          `${((i - (dragState.cards.length - 1) / 2) * 4).toFixed(1)}deg`,
        );
        el.style.zIndex = i + 1;
      });
      ghost.style.left = `${originX}px`;
      ghost.style.top = `${originY}px`;
      ghost.style.transform = "translate(-50%, -50%) scale(.92)";
      document.body.append(ghost);
      void ghost.offsetWidth;
      dragState.ghost = ghost;
      setTimeout(() => {
        if (dragState?.ghost === ghost) ghost.classList.remove("approach");
      }, 190);
    }
    if (!dragState.dragging) return;
    e.preventDefault();
    dragState.ghost.style.left = `${e.clientX}px`;
    dragState.ghost.style.top = `${e.clientY}px`;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("#c");
    $("c").classList.toggle("drag-over", !!target);
    dragState.ghost.classList.toggle("over-table", !!target);
  },
  { passive: false },
);
function finishCardDrag(e, cancelled = false) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const state = dragState;
  dragState = null;
  $("c").classList.remove("drag-over");
  state.ghost?.remove();
  $("hand")
    .querySelectorAll(".drag-origin")
    .forEach((el) => el.classList.remove("drag-origin"));
  if (!state.dragging) return;
  suppressHandClick = true;
  setTimeout(() => {
    suppressHandClick = false;
  }, 0);
  const target =
    !cancelled &&
    document.elementFromPoint(e.clientX, e.clientY)?.closest("#c");
  if (!target) {
    sel = state.previous;
    render();
    return;
  }
  if (!humanPlay()) {
    sel = state.previous;
    render();
  }
}
window.addEventListener("pointerup", (e) => finishCardDrag(e));
window.addEventListener("pointercancel", (e) => finishCardDrag(e, true));
$("hand").addEventListener("click", (e) => {
  if (suppressHandClick) return;
  if (G.endingPending || G.openingGathering || G.over) return;
  const el = e.target.closest(".cd[data-c]");
  if (!el || el.disabled) return;
  const c = +el.dataset.c;
  sel.has(c) ? sel.delete(c) : sel.add(c);
  render();
});
document.addEventListener("click", (e) => {
  if (!sel.size || e.target.closest(".cd[data-c], button, [role='dialog']"))
    return;
  if (e.target.closest("#c") && (G.turn === 0 || G.openingThrees)) return;
  sel.clear();
  render();
});
$("c").addEventListener("click", (e) => {
  if (e.target.closest("#openPlayed")) showPlayedCards();
  else if (sel.size) humanPlay();
});
$("playedList").addEventListener("click", (e) => {
  const takeback = e.target.closest("[data-takeback-id]");
  if (takeback) {
    if (!takeback.disabled) takeBackPlayedGroup(+takeback.dataset.takebackId);
    return;
  }
  const button = e.target.closest("[data-play-id]");
  if (!button || button.disabled) return;
  const playId = +button.dataset.playId;
  const index = G.reverts.findIndex((entry) => entry.playId === playId);
  if (index >= 0) {
    closePlayedCards();
    applyRevert(index);
  }
});
$("closePlayed").addEventListener("click", closePlayedCards);
$("playedCards").addEventListener("click", (e) => {
  if (e.target === $("playedCards")) closePlayedCards();
});
$("bPass").onclick = humanPass;
$("cancelRevert").onclick = () => closeRevertList();
$("revertList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-revert]");
  if (b) applyRevert(+b.dataset.revert);
});
$("revert").addEventListener("click", (e) => {
  if (e.target === $("revert")) closeRevertList();
});
$("bCek").onclick = () => {
  if (G.over || G.last !== 0 || !G.table || G.turn === 0) return;
  fast = true;
  say('Kamu: "Ada yang lawan?"');
  schedule();
};
newGame();
