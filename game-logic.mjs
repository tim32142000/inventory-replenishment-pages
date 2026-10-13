/** Pure game logic. No DOM or persistence, so rules can be tested independently. */
export const DAYS_DEFAULT = 14;
export const RESTOCK = 10;
export const INITIAL_STOCK = 5;

export const CATALOG = Object.freeze([
  { name: '礦泉水', icon: '💧', maxDemand: 3, color: '#40a7c2' },
  { name: '泡麵', icon: '🍜', maxDemand: 4, color: '#e9a138' },
  { name: '牛奶', icon: '🥛', maxDemand: 5, color: '#9279c8' },
  { name: '麵包', icon: '🥖', maxDemand: 2, color: '#d98b66' },
  { name: '衛生紙', icon: '🧻', maxDemand: 4, color: '#71a896' },
  { name: '餅乾', icon: '🍪', maxDemand: 3, color: '#bd836c' },
  { name: '咖啡', icon: '☕', maxDemand: 5, color: '#967453' },
  { name: '洗衣精', icon: '🫧', maxDemand: 2, color: '#749db8' },
]);

export function randomSeed() {
  // Generates a shareable non-secret identifier for the random sequence.
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

// Mulberry32: deterministic across all modern JavaScript engines.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSchedule(n, days, seed) {
  if (!Number.isInteger(n) || n < 3 || n > CATALOG.length) throw new Error('商品數量必須為 3～8。');
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('天數不正確。');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('隨機種子不正確。');
  const next = mulberry32(seed);
  return Array.from({ length: days }, () => CATALOG.slice(0, n).map(p => Math.floor(next() * (p.maxDemand + 1))));
}

export function newGame({ n = 5, days = DAYS_DEFAULT, seed = randomSeed() } = {}) {
  const schedule = createSchedule(n, days, seed);
  return {
    n, days, seed, schedule,
    stock: Array(n).fill(INITIAL_STOCK),
    history: [],
    phase: 'choose',
  };
}

export function playDay(game, choice) {
  if (game.phase !== 'choose' || game.history.length >= game.days) throw new Error('目前不能補貨。');
  if (!Number.isInteger(choice) || choice < 0 || choice >= game.n) throw new Error('商品選擇不正確。');
  const before = [...game.stock];
  const replenished = before.map((value, i) => value + (i === choice ? RESTOCK : 0));
  const demand = [...game.schedule[game.history.length]];
  const sold = demand.map((need, i) => Math.min(need, replenished[i]));
  const lost = demand.map((need, i) => need - sold[i]);
  const after = replenished.map((count, i) => count - sold[i]);
  const result = {
    day: game.history.length + 1, choice, before, replenished, demand, sold, lost, after,
    demandTotal: sum(demand), soldTotal: sum(sold), lostTotal: sum(lost),
  };
  return {
    ...game, stock: after, history: [...game.history, result], phase: 'review',
  };
}

export function advance(game) {
  if (game.phase !== 'review') throw new Error('尚未完成今天的營業。');
  return { ...game, phase: game.history.length >= game.days ? 'finished' : 'choose' };
}

export const sum = values => values.reduce((a, b) => a + b, 0);

export function statistics(game) {
  const sold = sum(game.history.map(h => h.soldTotal));
  const lost = sum(game.history.map(h => h.lostTotal));
  const demand = sold + lost;
  return { sold, lost, demand, rate: demand ? sold / demand : 1 };
}

export function chooseBot(game, strategy) {
  // Both bots use only stock and known public demand ranges, never future draws.
  const products = CATALOG.slice(0, game.n);
  const candidates = products.map((product, i) => ({
    i, stock: game.stock[i], avg: product.maxDemand / 2,
  }));
  if (strategy === 'lowest') {
    candidates.sort((a, b) => a.stock - b.stock || b.avg - a.avg || a.i - b.i);
  } else if (strategy === 'coverage') {
    candidates.sort((a, b) => a.stock / a.avg - b.stock / b.avg || b.avg - a.avg || a.i - b.i);
  } else throw new Error('未知策略。');
  return candidates[0].i;
}

export function runBot(source, strategy) {
  let game = newGame({ n: source.n, days: source.days, seed: source.seed });
  for (let day = 0; day < game.days; day++) {
    game = playDay(game, chooseBot(game, strategy));
    game = advance(game);
  }
  return statistics(game);
}

/** Validate localStorage state so a stale/tampered save cannot break rendering. */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { n, days, seed, history, phase } = raw;
  if (!Number.isInteger(n) || !Number.isInteger(days) || !Number.isInteger(seed) ||
      !Array.isArray(history) || history.length > days || days > 365 ||
      !['choose', 'review', 'finished'].includes(phase)) return null;
  try {
    let game = newGame({ n, days, seed });
    for (const old of history) {
      if (!old || !Number.isInteger(old.choice)) return null;
      game = playDay(game, old.choice);
      if (game.history.length < history.length || phase !== 'review') game = advance(game);
    }
    // The phase is derived from actions, not trusted from storage.
    if (game.phase !== phase) return null;
    return game;
  } catch { return null; }
}
