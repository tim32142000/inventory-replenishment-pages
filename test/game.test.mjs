import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, newGame, createSchedule, playDay, advance, statistics, chooseBot, runBot, restoreGame, RESTOCK, INITIAL_STOCK } from '../game-logic.mjs';

const fresh = () => newGame({ n: 5, days: 14, seed: 2026 });

test('預設遊戲與商品正確', () => {
  const g = fresh();
  assert.equal(g.n, 5);
  assert.equal(g.schedule.length, 14);
  assert.deepEqual(g.stock, Array(5).fill(5));
});

test('相同種子產生相同序列，不同種子不同', () => {
  assert.deepEqual(createSchedule(8, 30, 42), createSchedule(8, 30, 42));
  assert.notDeepEqual(createSchedule(8, 30, 42), createSchedule(8, 30, 43));
});

test('隨機需求每件在公開範圍內', () => {
  const g = newGame({ n: 8, days: 365, seed: 99 });
  for (const day of g.schedule) for (let i=0;i<8;i++) {
    assert.ok(day[i] >= 0 && day[i] <= CATALOG[i].maxDemand);
    assert.ok(Number.isInteger(day[i]));
  }
});

test('每天只能補一種 10 件，然後扣除需求', () => {
  const g = fresh();
  const r = playDay(g, 2);
  assert.equal(r.history[0].replenished[2], INITIAL_STOCK + RESTOCK);
  for (let i=0;i<g.n;i++) if (i!==2) assert.equal(r.history[0].replenished[i], INITIAL_STOCK);
  assert.equal(g.stock[2], 5);  // 原物件不被修改
});

test('售出 + 少賣 = 需求、庫存不為負', () => {
  let g = fresh();
  for (let i=0;i<g.days;i++) {
    g = playDay(g, 0);
    const r = g.history.at(-1);
    for (let j=0;j<g.n;j++) {
      assert.equal(r.sold[j] + r.lost[j], r.demand[j]);
      assert.equal(r.after[j], r.replenished[j] - r.sold[j]);
      assert.ok(r.after[j] >= 0);
    }
    g = advance(g);
  }
  assert.equal(g.phase, 'finished');
});

test('未結算不能連補兩次', () => {
  const g = playDay(fresh(), 0);
  assert.throws(()=>playDay(g, 0));
});

test('需先完成當日才能前往下一天', () => {
  assert.throws(()=>advance(fresh()));
});

test('遊戲結束不能繼續補貨', () => {
  let g = newGame({ n: 3, days: 1, seed: 4 });
  g = advance(playDay(g, 0));
  assert.equal(g.phase, 'finished');
  assert.throws(()=>playDay(g, 1));
});

test('非法商品或設定不能通過', () => {
  assert.throws(()=>playDay(fresh(), -1));
  assert.throws(()=>playDay(fresh(), 5));
  assert.throws(()=>newGame({n:9}));
  assert.throws(()=>newGame({n:2}));
  assert.throws(()=>newGame({seed:-1}));
});

test('需求為零時滿足率為 100%', () => {
  assert.equal(statistics(fresh()).rate, 1);
});

test('電腦比較使用完全相同的需求序列', () => {
  const g = fresh();
  const bot1 = runBot(g, 'lowest');
  const bot2 = runBot(g, 'coverage');
  assert.equal(bot1.demand, bot2.demand);
  assert.equal(bot1.demand, g.schedule.flat().reduce((a,b)=>a+b,0));
  assert.equal(bot1.sold+bot1.lost,bot1.demand);
});

test('電腦不能讀取未來需求決策', () => {
  const g = fresh();
  const other = {...g, schedule:g.schedule.map(day=>day.map(v=>v+1))};
  assert.equal(chooseBot(g, 'lowest'), chooseBot(other, 'lowest'));
  assert.equal(chooseBot(g, 'coverage'), chooseBot(other, 'coverage'));
});

test('儲存後可復原當日結算', () => {
  const g = playDay(fresh(), 1);
  const restored = restoreGame({n:g.n,days:g.days,seed:g.seed,history:[{choice:1}],phase:'review'});
  assert.deepEqual(restored, g);
});

test('儲存後可復原下一天待選狀態', () => {
  let g = advance(playDay(fresh(), 1));
  g = advance(playDay(g, 2));
  const restored = restoreGame({n:g.n,days:g.days,seed:g.seed,history:g.history.map(h=>({choice:h.choice})),phase:'choose'});
  assert.deepEqual(restored, g);
});

test('儲存後可復原已完成狀態', () => {
  let g = newGame({n:3,days:1,seed:42});
  g = advance(playDay(g, 1));
  const restored = restoreGame({n:3,days:1,seed:42,history:[{choice:1}],phase:'finished'});
  assert.deepEqual(restored, g);
});

test('篡改或損壞的紀錄會安全忽略', () => {
  assert.equal(restoreGame({n:8,days:14,seed:3,history:[{choice:99}],phase:'review'}), null);
  assert.equal(restoreGame({n:8,days:14,seed:3,history:[],phase:'finished'}), null);
  assert.equal(restoreGame(null), null);
});
