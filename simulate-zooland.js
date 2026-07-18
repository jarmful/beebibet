#!/usr/bin/env node
/* ============================================================
   Zooland — peata simulaator
   Jooksutab sama matemaatikamootorit mis mäng (zooland-math.js).

   Kasutus:
     node simulate-zooland.js [--spins=1000000] [--seed=12345] [--buys=100000]
   ============================================================ */
"use strict";

const M = require("./zooland-math.js");

const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^--([a-z]+)=(\d+)$/);
  if (m) args[m[1]] = parseInt(m[2], 10);
});

const SPINS = args.spins || 1000000;
const SEED = args.seed != null ? args.seed : M.randomSeed();
const BUYS = args.buys != null ? args.buys : 100000;
const BET = 1;

console.log(`Zooland simulaator — ${SPINS.toLocaleString("en")} keerutust, seed=${SEED}`);
console.log(`Kaalud: [${M.WEIGHTS.join(", ")}], pomm p=${M.BOMB_P}`);
console.log("");

function runBase(label, ante, seed) {
  const rng = M.makeRng(seed);
  const cost = ante ? 1.25 * BET : BET;
  let totalCost = 0, totalWin = 0, baseWinSum = 0, bonusWinSum = 0;
  let hits = 0, bonuses = 0, retriggers = 0, capHits = 0;
  let maxRoundWin = 0, bonusSpinTotal = 0;
  const t0 = Date.now();

  for (let i = 0; i < SPINS; i++) {
    const r = M.playRound(rng, BET, { ante });
    totalCost += cost;
    totalWin += r.totalWin;
    baseWinSum += r.baseWin;
    if (r.totalWin > 0) hits++;
    if (r.bonus) {
      bonuses++;
      bonusWinSum += r.bonus.win;
      retriggers += r.bonus.retriggers;
      bonusSpinTotal += r.bonus.spinsPlayed;
    }
    if (r.capped) capHits++;
    if (r.totalWin > maxRoundWin) maxRoundWin = r.totalWin;
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`--- ${label} (${secs}s) ---`);
  console.log(`RTP:               ${(totalWin / totalCost * 100).toFixed(2)}% (panustatud ${cost.toFixed(2)}/keerutus)`);
  console.log(`  sh baaskeerutus: ${(baseWinSum / totalCost * 100).toFixed(2)}%`);
  console.log(`  sh boonus:       ${(bonusWinSum / totalCost * 100).toFixed(2)}%`);
  console.log(`Tabamussagedus:    ${(hits / SPINS * 100).toFixed(2)}% (1 : ${(SPINS / Math.max(hits, 1)).toFixed(2)})`);
  console.log(`Boonusesagedus:    1 : ${(SPINS / Math.max(bonuses, 1)).toFixed(0)} (${bonuses} tk)`);
  console.log(`Keskm boonusvõit:  ${(bonusWinSum / Math.max(bonuses, 1)).toFixed(1)}x`);
  console.log(`Keskm boonuse kestus: ${(bonusSpinTotal / Math.max(bonuses, 1)).toFixed(1)} keerutust, retriggereid ${(retriggers / Math.max(bonuses, 1)).toFixed(2)}/boonus`);
  console.log(`Max võit (${M.MAX_WIN_X}x): ${capHits} korda (1 : ${capHits ? (SPINS / capHits).toFixed(0) : "—"})`);
  console.log(`Suurim ringivõit:  ${maxRoundWin.toFixed(1)}x`);
  console.log("");
}

runBase("Baasmäng (ante VÄLJAS)", false, SEED);
runBase("Baasmäng (ante SEES, hind 1.25x)", true, SEED ^ 0x51ab3d2f);

/* ---------- Boonusost ---------- */
if (BUYS > 0) {
  const rng2 = M.makeRng(SEED ^ 0x9e3779b9);
  let buyCost = 0, buyWin = 0, buyCaps = 0, maxBuy = 0;
  for (let i = 0; i < BUYS; i++) {
    const r = M.playRound(rng2, BET, { buy: true });
    buyCost += 100 * BET;
    buyWin += r.totalWin;
    if (r.capped) buyCaps++;
    if (r.totalWin > maxBuy) maxBuy = r.totalWin;
  }
  console.log(`--- Boonusost (${BUYS.toLocaleString("en")} ostu à 100x) ---`);
  console.log(`Ostu-RTP:          ${(buyWin / buyCost * 100).toFixed(2)}%`);
  console.log(`Keskm ostuvõit:    ${(buyWin / BUYS).toFixed(1)}x`);
  console.log(`Max võite:         ${buyCaps} (1 : ${buyCaps ? (BUYS / buyCaps).toFixed(0) : "—"})`);
  console.log(`Suurim ostuvõit:   ${maxBuy.toFixed(1)}x`);
}
