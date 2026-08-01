#!/usr/bin/env node
/* ============================================================
   Dogs of Olympics — peata simulaator
   Jooksutab sama matemaatikamootorit mis mäng (dogs-math.js).

   Kasutus:
     node simulate-dogs.js [--spins=1000000] [--seed=12345]
   ============================================================ */
"use strict";

const M = require("./dogs-math.js");

const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^--([a-z]+)=(\d+)$/);
  if (m) args[m[1]] = parseInt(m[2], 10);
});

const SPINS = args.spins || 1000000;
const SEED = args.seed != null ? args.seed : M.randomSeed();
const BET = 1;

console.log(`Dogs of Olympics simulaator — ${SPINS.toLocaleString("en")} keerutust, seed=${SEED}`);
console.log(`Kaalud: [${M.WEIGHTS.join(", ")}], maius p=${M.ORB_P}, õnnistus p=${M.BLESS_P}`);
console.log("");

function runBase(label, ante, seed) {
  const rng = M.makeRng(seed);
  const cost = ante ? 1.25 * BET : BET;
  let totalCost = 0, totalWin = 0, baseWinSum = 0, bonusWinSum = 0;
  let hits = 0, bonuses = 0, retriggers = 0, capHits = 0;
  let maxRoundWin = 0, bonusSpinTotal = 0, multSum = 0;
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
      multSum += r.bonus.totalMult;
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
  console.log(`Keskm kogukordaja boonuse lõpus: x${(multSum / Math.max(bonuses, 1)).toFixed(1)}`);
  console.log(`Max võit (${M.MAX_WIN_X}x): ${capHits} korda (1 : ${capHits ? (SPINS / capHits).toFixed(0) : "—"})`);
  console.log(`Suurim ringivõit:  ${maxRoundWin.toFixed(1)}x`);
  console.log("");
}

runBase("Baasmäng (ante VÄLJAS)", false, SEED);
runBase("Baasmäng (ante SEES, hind 1.25x)", true, SEED ^ 0x51ab3d2f);
