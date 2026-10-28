const R = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"],
  S = ["♦", "♣", "♥", "♠"];
const THREE_OF_SPADES = 3;
const rk = (c) => c >> 2,
  st = (c) => c & 3,
  nm = (c) => R[rk(c)] + S[st(c)];
const isFireFinish = (hand, cards) =>
    hand.length === cards.length && cards.some((card) => rk(card) === 12),
  hasOnlyTwos = (hand) => hand.length > 0 && hand.every((card) => rk(card) === 12);
function openingSpadeReady() {
  if (!G?.hands || !G?.discard) return false;
  const playedSuits = new Set(
    G.discard
      .filter((group) => group.opening)
      .flatMap((group) => group.cards.map(st)),
  );
  return (
    G.hands.some((hand) => hand.includes(THREE_OF_SPADES)) &&
    [0, 1, 2].every((suit) => playedSuits.has(suit))
  );
}
const names = ["Kamu", "Budi", "Citra", "Dedi"],
  TN = {
    single: "Single",
    pair: "Per",
    tris: "Tris",
    polo: "Polo",
    seri: "Seri",
    bom: "Bom",
    stop: "Stop Poker",
  };
let G,
  scores = [0, 0, 0, 0],
  timer,
  ver = 0,
  sel = new Set(),
  fast = false,
  previousWinner = -1,
  dragState = null,
  suppressHandClick = false;
const $ = (id) => document.getElementById(id);

function classify(cs) {
  const a = [...cs].sort((x, y) => x - y),
    n = a.length,
    r = a.map(rk),
    same = r.every((x) => x === r[0]),
    v = a[n - 1];
  const o = (t) => ({ t, n, v, r, a });
  if (n === 1) return o("single");
  if (n === 2 && same) return o("pair");
  if (n === 3 && same) return o("tris");
    if (n === 4 && same) return o("stop");
  if (n === 5) {
    const cnt = {};
    r.forEach((x) => (cnt[x] = (cnt[x] || 0) + 1));
    const k = Object.keys(cnt);
    if (k.length === 2 && Object.values(cnt).includes(3)) {
      const tr = +k.find((x) => cnt[x] === 3),
        z = o("polo");
      z.v = Math.max(...a.filter((c) => rk(c) === tr));
      return z;
    }
  }
  if (
    n >= 3 &&
    a.every((c) => st(c) === st(a[0])) &&
    r.every((x, i) => i === 0 || x === r[i - 1] + 1) &&
    r[n - 1] <= 11
  ) {
    if (n === 5 && r.join(",") === "7,8,9,10,11") return o("bom");
    return o("seri");
  }
  return null;
}
function compareRanks(a, b) {
  const rankDifference = rk(a) - rk(b);
      if (rankDifference) return rankDifference;
      return rk(a) === 0 ? st(a) - st(b) : 0;
}
function beats(c, t) {
  if (!t) return true;
  const comparison = compareRanks(c.v, t.v);
  if (c.t === "bom") return t.t !== "bom" || comparison > 0;
  if (c.t === "stop")
    return ["single", "pair", "tris"].includes(t.t) && rk(t.v) === 12;
  return c.t === t.t && c.n === t.n && comparison > 0;
}
function combos(h) {
  const out = [],
    by = {};
  h.forEach((c) => (by[rk(c)] ??= []).push(c));
  for (const k in by) {
    const g = by[k];
    g.forEach((c) => out.push([c]));
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++) {
        out.push([g[i], g[j]]);
        for (let l = j + 1; l < g.length; l++) out.push([g[i], g[j], g[l]]);
      }
    if (g.length === 4) out.push(g.slice());
  }
  for (let s = 0; s < 4; s++) {
    const rs = h
      .filter((c) => st(c) === s && rk(c) <= 11)
      .map(rk)
      .sort((a, b) => a - b);
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 2; j < rs.length && rs[j] - rs[i] === j - i; j++)
        out.push(rs.slice(i, j + 1).map((x) => x * 4 + s));
  }
  for (const k in by) {
    const g = by[k];
    if (g.length < 3) continue;
    for (const tr of [g.slice(0, 3), g.slice(-3)])
      for (const m in by) {
        if (m === k || by[m].length < 2) continue;
        const p = by[m];
        for (const pr of [p.slice(0, 2), p.slice(-2)]) out.push([...tr, ...pr]);
      }
  }
  return out.map((cs) => classify(cs));
}
const label = (c) => TN[c.t] + " " + c.a.map(nm).join(" ");
const active = () => [0, 1, 2, 3].filter((i) => !G.done.includes(i));
const nextActive = (p) => {
  for (let i = 1; i <= 4; i++) {
    const q = (p + i) % 4;
    if (!G.done.includes(q)) return q;
  }
};
