import {
  CATALOG, INITIAL_STOCK, RESTOCK, newGame, playDay, advance,
  statistics, runBot, restoreGame, randomSeed
} from './game-logic.mjs';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'restock-game-state-v1';
const BEST_PREFIX = 'restock-game-best-v1-';
const DEFAULT_N = 5;
const DEFAULT_DAYS = 14;
const isValidSeed = v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
const parseNumeric = (v, fallback) => /^\d+$/.test(String(v)) ? Number(v) : fallback;

function urlConfig() {
  const query = new URLSearchParams(location.search);
  const n = parseNumeric(query.get('n'), DEFAULT_N);
  const days = parseNumeric(query.get('days'), DEFAULT_DAYS);
  const seed = parseNumeric(query.get('seed'), NaN);
  if (n >= 3 && n <= 8 && [7,14,21,30].includes(days) && isValidSeed(seed)) return { n, days, seed };
  return null;
}

function loadSaved() {
  try { return restoreGame(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return null; }
}

const cfg = urlConfig();
const old = loadSaved();
let game = cfg ? ((old && old.n === cfg.n && old.days === cfg.days && old.seed === cfg.seed) ? old : newGame(cfg))
  : (old || newGame({ n: DEFAULT_N, days: DEFAULT_DAYS }));
let toastTimer = null;

function saveProgress() {
  try {
    const { n, days, seed, history, phase } = game;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ n, days, seed, history: history.map(h => ({ choice: h.choice })), phase }));
  } catch { /* The game remains playable without persistent storage. */ }
}

function syncUrl() {
  try {
    const target = new URL(location.href);
    target.searchParams.set('n', String(game.n));
    target.searchParams.set('days', String(game.days));
    target.searchParams.set('seed', String(game.seed));
    history.replaceState(null, '', target);
  } catch { /* file previews and restricted contexts do not require this. */ }
}

function bestKey() { return `${BEST_PREFIX}${game.n}-${game.days}`; }
function loadBest() {
  try {
    const b = JSON.parse(localStorage.getItem(bestKey()));
    return b && Number.isFinite(b.rate) && b.rate >= 0 && b.rate <= 1 && Number.isInteger(b.lost) ? b : null;
  } catch { return null; }
}
function recordBest() {
  const stat = statistics(game);
  const oldBest = loadBest();
  const isBest = !oldBest || stat.rate > oldBest.rate + 1e-10 ||
    (Math.abs(stat.rate - oldBest.rate) <= 1e-10 && stat.lost < oldBest.lost);
  if (isBest) {
    try { localStorage.setItem(bestKey(), JSON.stringify({ rate: stat.rate, lost: stat.lost, sold: stat.sold })); } catch {}
  }
  return isBest;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const percent = v => (v * 100).toFixed(1);
const total = (arr) => arr.reduce((a,b) => a+b, 0);
const getLast = () => game.history[game.history.length - 1];

function renderChoose() {
  $('productGrid').innerHTML = CATALOG.slice(0, game.n).map((p, i) => {
    const stock = game.stock[i];
    const low = stock <= Math.max(2, Math.ceil(p.maxDemand / 2));
    const stockScale = Math.min(100, stock / 18 * 100);
    return `<button type="button" class="product-card ${low?'low':''}" data-choice="${i}" style="--product-color:${p.color}" aria-label="補貨 ${escapeHtml(p.name)} 十件，目前剩 ${stock} 件">
      <span class="product-icon" aria-hidden="true">${p.icon}</span>
      <span class="product-name">${escapeHtml(p.name)}</span>
      <span class="product-range">每日需求 0～${p.maxDemand}</span>
      <span class="product-stock-line"><span>目前庫存</span><strong>${stock}<span class="sr-only"> 件</span></strong></span>
      <span class="stock-bar"><span style="width:${stockScale}%"></span></span>
      <span class="product-action">補貨 +${RESTOCK} ↗</span>
    </button>`;
  }).join('');
}

function renderReview() {
  const last = getLast();
  const happy = last.lostTotal === 0;
  const p = CATALOG[last.choice];
  const rows = CATALOG.slice(0, game.n).map((product, i) => {
    const missed = last.lost[i];
    return `<div class="result-row"><span class="result-name">${product.icon} ${escapeHtml(product.name)} ${last.choice===i?'✚':''}</span><span>${last.demand[i]}</span><span>${last.sold[i]}</span><span class="${missed?'missed':''}">${missed ? `−${missed}` : '—'}</span></div>`;
  }).join('');
  $('reviewScreen').innerHTML = `<div class="review-banner"><span class="review-emoji" aria-hidden="true">${happy?'🎉':'🧾'}</span><div><h3>${happy?'完美營業，沒有漏掉任何客人！':'收工！今天的成績出爐了'}</h3><p>你今天選擇補了 <strong>${p.icon} ${escapeHtml(p.name)} ${RESTOCK} 件</strong>。${happy?'漂亮的選擇。':'明天還有機會調整。'}</p></div></div>
    <div class="day-metrics"><div class="day-metric"><span>今天總需求</span><strong>${last.demandTotal}</strong></div><div class="day-metric"><span>成功賣出</span><strong>${last.soldTotal}</strong></div><div class="day-metric warn"><span>沒賣到</span><strong>${last.lostTotal}</strong></div></div>
    <h4 class="result-heading">商品結算</h4><div class="result-list"><div class="result-row result-header"><span>商品</span><span>需求</span><span>賣出</span><span>少賣</span></div>${rows}</div>
    <div class="next-row"><button class="primary-button" id="advanceButton" type="button">${game.history.length === game.days ? '查看最終成績 🏆' : '繼續第 ' + (game.history.length + 1) + ' 天'} <span aria-hidden="true">→</span></button><span class="subtle-note">下一天的需求還沒揭曉</span></div>`;
  $('advanceButton').addEventListener('click', () => { game = advance(game); render(); window.scrollTo({top: 230, behavior: 'smooth'}); });
}

function compareRow(name, value, player=false) {
  return `<div class="compare-row ${player?'player':''}"><label>${name}</label><div class="compare-bar"><span style="width:${(value*100).toFixed(2)}%"></span></div><strong>${percent(value)}%</strong></div>`;
}

function renderFinished() {
  const stat = statistics(game);
  const lowStock = runBot(game, 'lowest');
  const coverage = runBot(game, 'coverage');
  const best = recordBest();
  let rank = '補貨高手'; let cup = '🏆'; let note = '你的店成功撐過這一段忙碌的日子！';
  if (stat.rate >= .95) { rank = '神級補貨王'; cup = '👑'; note = '幾乎每個客人都買到想要的商品！'; }
  else if (stat.rate >= .85) { rank = '黃金店長'; cup = '🥇'; note = '這間店交給你管理真令人安心。'; }
  else if (stat.rate < .60) { rank = '還能再挑戰！'; cup = '🌱'; note = '生意很多，進貨的取捨也很不容易。'; }
  $('finishedScreen').innerHTML = `
    <div class="finish-header"><div class="finish-cup">${cup}</div><h3>${rank}</h3><p>${note}</p><div class="finish-score">${percent(stat.rate)}<small>%</small></div><div class="finish-subscore">每一天的補貨選擇都算數<br/>共售出 ${stat.sold} 件 · 少賣 ${stat.lost} 件</div></div>
    ${best ? `<div class="best-banner">✨ 新的個人最佳紀錄！</div>` : ''}
    <div class="comparison"><h4>你和電腦店長，誰賣得比較好？</h4><p>三位店長面對完全相同的每日需求；電腦只看已知庫存，不偷看答案。</p>
      ${compareRow('🙋 你',stat.rate,true)}
      ${compareRow('📦 庫存最少先補',lowStock.rate)}
      ${compareRow('📊 最快缺貨先補',coverage.rate)}
    </div>
    <div class="finish-actions"><button class="primary-button" id="sameSeedButton" type="button">🔁 再玩同一局</button><button class="secondary-button" id="freshSeedButton" type="button">🎲 全新隨機挑戰</button><button class="secondary-button" id="shareSeedButton" type="button">🔗 分享這局</button></div>`;
  $('sameSeedButton').addEventListener('click', () => startGame({ n: game.n, days: game.days, seed: game.seed }, false));
  $('freshSeedButton').addEventListener('click', () => startGame({ n: game.n, days: game.days, seed: randomSeed() }, false));
  $('shareSeedButton').addEventListener('click', shareGame);
}

function renderBest() {
  const best = loadBest();
  $('bestRate').textContent = best ? `${percent(best.rate)}%` : '—';
  $('bestText').textContent = best ? `${game.n} 種商品・${game.days} 天的個人最高紀錄` : '玩完一局，就會記下這個設定的最佳成績';
}

function render() {
  const completed = game.history.length;
  const score = statistics(game);
  const isChoose = game.phase === 'choose';
  const isReview = game.phase === 'review';
  const isFinished = game.phase === 'finished';
  $('seedLabel').textContent = String(game.seed).padStart(10, '0');
  $('dayTitle').innerHTML = `${isFinished ? '挑戰結束' : `第 ${isChoose ? completed + 1 : completed} 天`} <span>/ ${game.days} 天</span>`;
  $('dayHint').textContent = isFinished ? '每一天的決策都完成了，來看看成果吧！' : isReview ? '今天營業結束，先看看結果再前往下一天。' : '選一種商品進貨，再看看今天的客人想買什麼。';
  $('dayProgress').setAttribute('aria-valuemax', String(game.days));
  $('dayProgress').setAttribute('aria-valuenow', String(completed));
  $('dayProgressFill').style.width = `${100 * completed/game.days}%`;
  $('soldCount').textContent = String(score.sold);
  $('lostCount').textContent = String(score.lost);
  $('rateCount').textContent = percent(score.rate);
  $('productCount').value = String(game.n);
  $('dayCount').value = String(game.days);
  $('chooseScreen').classList.toggle('hidden', !isChoose);
  $('reviewScreen').classList.toggle('hidden', !isReview);
  $('finishedScreen').classList.toggle('hidden', !isFinished);
  if (isChoose) renderChoose();
  if (isReview) renderReview();
  if (isFinished) renderFinished();
  renderBest();
  saveProgress();
  syncUrl();
}

function startGame(config, ask=true) {
  if (ask && game.history.length > 0 && game.phase !== 'finished' && !confirm('目前這局的進度會被取代。確定開始新遊戲嗎？')) return;
  game = newGame(config);
  render();
  document.querySelector('.game-frame').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2400);
}

async function shareGame() {
  const url = new URL(location.href);
  url.searchParams.set('n', String(game.n));
  url.searchParams.set('days', String(game.days));
  url.searchParams.set('seed', String(game.seed));
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('已複製挑戰連結！分享給朋友試試。');
  } catch {
    window.prompt('複製這個挑戰連結：', url.toString());
  }
}

$('productGrid').addEventListener('click', event => {
  const button = event.target.closest('button[data-choice]');
  if (!button || game.phase !== 'choose') return;
  game = playDay(game, Number(button.dataset.choice));
  render();
  document.querySelector('.status-row').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('applySettings').addEventListener('click', () => {
  startGame({ n: Number($('productCount').value), days: Number($('dayCount').value), seed: randomSeed() });
});
$('newGameButton').addEventListener('click', () => startGame({ n: game.n, days: game.days, seed: randomSeed() }));
$('rulesButton').addEventListener('click', () => $('rulesDialog').showModal());

render();
