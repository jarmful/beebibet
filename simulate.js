#!/usr/bin/env node
/* ============================================================
   KosmosBet — peata simulaator
   Jooksutab sama matemaatikamootorit mis mäng (kosmos-math.js).

   Kasutus:
     node simulate.js [--spins=1000000] [--seed=12345] [--buys=100000]
   ============================================================ */
"use strict";

const M = require("./kosmos-math.js");

const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^--([a-z]+)=(\d+)$/);
  if (m) args[m[1]] = parseInt(m[2], 10);
});

const SPINS = args.spins || 1000000;
const SEED = args.seed != null ? args.seed : M.randomSeed();
const BUYS = args.buys != null ? args.buys : 100000;
const BET = 1;

console.log(`KosmosBet simulaator — ${SPINS.toLocaleString("en")} keerutust, seed=${SEED}`);
console.log(`Kaalud: [${M.WEIGHTS.join(", ")}], scatter p=${M.SCATTER_P}`);
console.log("");

/* ---------- Baasmäng ---------- */
const rng = M.makeRng(SEED);
let totalBet = 0, totalWin = 0, baseWinSum = 0, bonusWinSum = 0;
let hits = 0, bonuses = 0, retriggers = 0, capHits = 0;
let maxRoundWin = 0;
let bonusSpinTotal = 0;
const t0 = Date.now();

for (let i = 0; i < SPINS; i++) {
  const r = M.playRound(rng, BET, false);
  totalBet += BET;
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
console.log(`--- Baasmäng (${secs}s) ---`);
console.log(`RTP:               ${(totalWin / totalBet * 100).toFixed(2)}%`);
console.log(`  sh baaskeerutus: ${(baseWinSum / totalBet * 100).toFixed(2)}%`);
console.log(`  sh boonus:       ${(bonusWinSum / totalBet * 100).toFixed(2)}%`);
console.log(`Tabamussagedus:    ${(hits / SPINS * 100).toFixed(2)}% (1 : ${(SPINS / hits).toFixed(2)})`);
console.log(`Boonusesagedus:    1 : ${(SPINS / Math.max(bonuses, 1)).toFixed(0)} (${bonuses} tk)`);
console.log(`Keskm boonusvõit:  ${(bonusWinSum / Math.max(bonuses, 1)).toFixed(1)}x`);
console.log(`Keskm boonuse kestus: ${(bonusSpinTotal / Math.max(bonuses, 1)).toFixed(1)} keerutust, retriggereid ${(retriggers / Math.max(bonuses, 1)).toFixed(2)}/boonus`);
console.log(`Max võit (5000x):  ${capHits} korda (1 : ${capHits ? (SPINS / capHits).toFixed(0) : "—"})`);
console.log(`Suurim ringivõit:  ${maxRoundWin.toFixed(1)}x`);

/* ---------- Boonusost ---------- */
if (BUYS > 0) {
  const rng2 = M.makeRng(SEED ^ 0x9e3779b9);
  let buyCost = 0, buyWin = 0, buyCaps = 0;
  for (let i = 0; i < BUYS; i++) {
    const r = M.playRound(rng2, BET, true);
    buyCost += 100 * BET;
    buyWin += r.totalWin;
    if (r.capped) buyCaps++;
  }
  console.log("");
  console.log(`--- Boonusost (${BUYS.toLocaleString("en")} ostu à 100x) ---`);
  console.log(`Ostu-RTP:          ${(buyWin / buyCost * 100).toFixed(2)}%`);
  console.log(`Keskm ostuvõit:    ${(buyWin / BUYS).toFixed(1)}x`);
  console.log(`Max võite:         ${buyCaps} (1 : ${buyCaps ? (BUYS / buyCaps).toFixed(0) : "—"})`);
}
