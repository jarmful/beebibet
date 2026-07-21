"use strict";
/* ============================================================
   USA LAHTISED — jagatud andmefail (US Open 2026)
   ============================================================
   KÕIK kuus mängu loevad andmed SIIT failist. Kui päris loosimine
   selgub, asenda ainult selle faili sisu — mängud ei vaja muutmist.

   Struktuur:
   - USOPEN.meta      — turniiri nimi/kuupäevad
   - USOPEN.players   — 32 mängijat (16 ATP + 16 WTA):
        id, name, tour, seed (null = asetuseta), outright (turniirivõidu
        koefitsient), tier ("favorite" | "mid" | "longshot"),
        color (kiibi värv lehtedel),
        adv — edasijõudmiskoefitsiendid ringide kaupa:
              [R1, R2, R3, R4, QF, SF, F]  (Survivor Spin kasutab)
   - USOPEN.matches   — 1. päeva mängukava: 8 matši, igas:
        id, tour, court, time, p1, p2 (mängija id-d),
        odds1/odds2      — matšivõidu koefitsiendid (1X2 stiilis),
        straight1/straight2 — "võidab puhtalt" (3:0 / 2:0) koef,
        totalSets        — settide koguarvu koefitsiendid
                           (ATP: "3","4","5"; WTA: "2","3"),
        tiebreakYes/tiebreakNo — "matšis tuleb tiebreak" koefitsiendid
   ============================================================ */

window.USOPEN = {
  meta: {
    name: "USA Lahtised",
    sub: "US Open · New York",
    day1: "E 31.08.2026",
    rounds: ["R1", "R2", "R3", "R4", "QF", "SF", "F"],
    champLabel: "Tšempion"
  },

  players: [
    /* ---------------- ATP (16) ---------------- */
    { id: "a1",  name: "Carlos Alcaraz",    tour: "ATP", seed: 1,    outright: 2.80,   tier: "favorite", color: "#D62828",
      adv: [1.03, 1.05, 1.08, 1.14, 1.25, 1.45, 1.65] },
    { id: "a2",  name: "Jannik Sinner",     tour: "ATP", seed: 2,    outright: 3.10,   tier: "favorite", color: "#F77F00",
      adv: [1.03, 1.05, 1.09, 1.15, 1.27, 1.48, 1.68] },
    { id: "a3",  name: "Novak Djokovic",    tour: "ATP", seed: 5,    outright: 9.00,   tier: "favorite", color: "#003DA5",
      adv: [1.06, 1.10, 1.16, 1.28, 1.45, 1.70, 1.90] },
    { id: "a4",  name: "Alexander Zverev",  tour: "ATP", seed: 3,    outright: 12.00,  tier: "favorite", color: "#111111",
      adv: [1.07, 1.12, 1.19, 1.32, 1.50, 1.78, 2.00] },
    { id: "a5",  name: "Jack Draper",       tour: "ATP", seed: 4,    outright: 15.00,  tier: "favorite", color: "#00247D",
      adv: [1.08, 1.13, 1.21, 1.34, 1.55, 1.82, 2.05] },
    { id: "a6",  name: "Taylor Fritz",      tour: "ATP", seed: 6,    outright: 21.00,  tier: "mid",      color: "#3C3B6E",
      adv: [1.09, 1.15, 1.24, 1.40, 1.62, 1.95, 2.20] },
    { id: "a7",  name: "Ben Shelton",       tour: "ATP", seed: 7,    outright: 26.00,  tier: "mid",      color: "#B31942",
      adv: [1.10, 1.17, 1.27, 1.45, 1.70, 2.05, 2.30] },
    { id: "a8",  name: "Holger Rune",       tour: "ATP", seed: 8,    outright: 34.00,  tier: "mid",      color: "#C8102E",
      adv: [1.12, 1.20, 1.32, 1.50, 1.78, 2.15, 2.40] },
    { id: "a9",  name: "Daniil Medvedev",   tour: "ATP", seed: 11,   outright: 29.00,  tier: "mid",      color: "#5B7C99",
      adv: [1.11, 1.18, 1.30, 1.48, 1.75, 2.10, 2.35] },
    { id: "a10", name: "Lorenzo Musetti",   tour: "ATP", seed: 9,    outright: 41.00,  tier: "mid",      color: "#008C45",
      adv: [1.13, 1.22, 1.35, 1.55, 1.85, 2.25, 2.50] },
    { id: "a11", name: "Tommy Paul",        tour: "ATP", seed: 12,   outright: 51.00,  tier: "mid",      color: "#0A3161",
      adv: [1.15, 1.25, 1.40, 1.60, 1.95, 2.35, 2.60] },
    { id: "a12", name: "Frances Tiafoe",    tour: "ATP", seed: 14,   outright: 81.00,  tier: "longshot", color: "#6F2DA8",
      adv: [1.30, 1.45, 1.65, 1.90, 2.25, 2.65, 2.90] },
    { id: "a13", name: "Jakub Menšík",      tour: "ATP", seed: 16,   outright: 101.00, tier: "longshot", color: "#11457E",
      adv: [1.35, 1.55, 1.75, 2.00, 2.40, 2.80, 3.00] },
    { id: "a14", name: "João Fonseca",      tour: "ATP", seed: null, outright: 126.00, tier: "longshot", color: "#009739",
      adv: [1.45, 1.65, 1.90, 2.20, 2.60, 3.00, 3.20] },
    { id: "a15", name: "Gabriel Diallo",    tour: "ATP", seed: null, outright: 201.00, tier: "longshot", color: "#D80621",
      adv: [1.70, 1.95, 2.25, 2.60, 3.00, 3.30, 3.50] },
    { id: "a16", name: "Valentin Vacherot", tour: "ATP", seed: null, outright: 251.00, tier: "longshot", color: "#CE1126",
      adv: [1.90, 2.20, 2.55, 2.90, 3.20, 3.50, 3.70] },

    /* ---------------- WTA (16) ---------------- */
    { id: "w1",  name: "Aryna Sabalenka",   tour: "WTA", seed: 1,    outright: 3.20,   tier: "favorite", color: "#00AF66",
      adv: [1.03, 1.06, 1.10, 1.17, 1.30, 1.50, 1.70] },
    { id: "w2",  name: "Iga Świątek",       tour: "WTA", seed: 2,    outright: 4.50,   tier: "favorite", color: "#DC143C",
      adv: [1.04, 1.07, 1.12, 1.20, 1.34, 1.55, 1.75] },
    { id: "w3",  name: "Coco Gauff",        tour: "WTA", seed: 3,    outright: 6.50,   tier: "favorite", color: "#B31942",
      adv: [1.05, 1.09, 1.15, 1.25, 1.40, 1.62, 1.85] },
    { id: "w4",  name: "Elena Rybakina",    tour: "WTA", seed: 5,    outright: 11.00,  tier: "favorite", color: "#00AFCA",
      adv: [1.07, 1.12, 1.19, 1.30, 1.48, 1.72, 1.95] },
    { id: "w5",  name: "Mirra Andreeva",    tour: "WTA", seed: 4,    outright: 13.00,  tier: "favorite", color: "#8E44AD",
      adv: [1.08, 1.13, 1.20, 1.32, 1.52, 1.78, 2.00] },
    { id: "w6",  name: "Madison Keys",      tour: "WTA", seed: 6,    outright: 23.00,  tier: "mid",      color: "#E86100",
      adv: [1.10, 1.16, 1.26, 1.42, 1.65, 2.00, 2.25] },
    { id: "w7",  name: "Jasmine Paolini",   tour: "WTA", seed: 7,    outright: 34.00,  tier: "mid",      color: "#008C45",
      adv: [1.12, 1.20, 1.32, 1.50, 1.78, 2.15, 2.40] },
    { id: "w8",  name: "Qinwen Zheng",      tour: "WTA", seed: 8,    outright: 29.00,  tier: "mid",      color: "#DE2910",
      adv: [1.11, 1.18, 1.29, 1.47, 1.72, 2.08, 2.32] },
    { id: "w9",  name: "Emma Navarro",      tour: "WTA", seed: 9,    outright: 41.00,  tier: "mid",      color: "#1D4E89",
      adv: [1.13, 1.22, 1.35, 1.55, 1.85, 2.25, 2.50] },
    { id: "w10", name: "Amanda Anisimova",  tour: "WTA", seed: 10,   outright: 34.00,  tier: "mid",      color: "#FF6F91",
      adv: [1.12, 1.21, 1.33, 1.52, 1.80, 2.18, 2.45] },
    { id: "w11", name: "Jelena Ostapenko",  tour: "WTA", seed: 13,   outright: 51.00,  tier: "mid",      color: "#9E3039",
      adv: [1.16, 1.26, 1.42, 1.62, 1.95, 2.35, 2.60] },
    { id: "w12", name: "Naomi Osaka",       tour: "WTA", seed: 16,   outright: 67.00,  tier: "longshot", color: "#BC002D",
      adv: [1.28, 1.42, 1.62, 1.88, 2.20, 2.60, 2.85] },
    { id: "w13", name: "Emma Raducanu",     tour: "WTA", seed: null, outright: 101.00, tier: "longshot", color: "#012169",
      adv: [1.40, 1.60, 1.85, 2.15, 2.55, 2.95, 3.15] },
    { id: "w14", name: "Clara Tauson",      tour: "WTA", seed: 14,   outright: 91.00,  tier: "longshot", color: "#C8102E",
      adv: [1.35, 1.55, 1.78, 2.05, 2.45, 2.85, 3.05] },
    { id: "w15", name: "Linda Nosková",     tour: "WTA", seed: 15,   outright: 81.00,  tier: "longshot", color: "#11457E",
      adv: [1.32, 1.50, 1.72, 2.00, 2.38, 2.78, 3.00] },
    { id: "w16", name: "Victoria Mboko",    tour: "WTA", seed: null, outright: 126.00, tier: "longshot", color: "#D80621",
      adv: [1.55, 1.80, 2.05, 2.40, 2.80, 3.15, 3.35] }
  ],

  /* 1. päeva mängukava — 8 matši (4 ATP + 4 WTA) */
  matches: [
    { id: "m1", tour: "ATP", court: "Arthur Ashe",       time: "19:00", p1: "a1",  p2: "a15",
      odds1: 1.20, odds2: 4.60, straight1: 1.55, straight2: 9.00,
      totalSets: { "3": 1.85, "4": 3.10, "5": 5.00 }, tiebreakYes: 1.85, tiebreakNo: 1.95 },
    { id: "m2", tour: "ATP", court: "Louis Armstrong",   time: "18:00", p1: "a3",  p2: "a14",
      odds1: 1.55, odds2: 2.45, straight1: 2.30, straight2: 5.00,
      totalSets: { "3": 2.20, "4": 2.90, "5": 4.20 }, tiebreakYes: 1.72, tiebreakNo: 2.10 },
    { id: "m3", tour: "ATP", court: "Grandstand",        time: "20:30", p1: "a7",  p2: "a13",
      odds1: 1.70, odds2: 2.15, straight1: 2.75, straight2: 3.80,
      totalSets: { "3": 2.45, "4": 2.75, "5": 3.60 }, tiebreakYes: 1.50, tiebreakNo: 2.50 },
    { id: "m4", tour: "ATP", court: "Court 17",          time: "22:00", p1: "a9",  p2: "a12",
      odds1: 1.80, odds2: 2.05, straight1: 3.00, straight2: 3.40,
      totalSets: { "3": 2.60, "4": 2.70, "5": 3.30 }, tiebreakYes: 1.62, tiebreakNo: 2.25 },
    { id: "m5", tour: "WTA", court: "Arthur Ashe",       time: "02:00", p1: "w1",  p2: "w16",
      odds1: 1.25, odds2: 4.00, straight1: 1.65, straight2: 6.50,
      totalSets: { "2": 1.60, "3": 2.30 }, tiebreakYes: 2.60, tiebreakNo: 1.48 },
    { id: "m6", tour: "WTA", court: "Louis Armstrong",   time: "21:30", p1: "w2",  p2: "w13",
      odds1: 1.30, odds2: 3.50, straight1: 1.75, straight2: 5.50,
      totalSets: { "2": 1.65, "3": 2.25 }, tiebreakYes: 2.75, tiebreakNo: 1.42 },
    { id: "m7", tour: "WTA", court: "Grandstand",        time: "18:00", p1: "w6",  p2: "w14",
      odds1: 1.65, odds2: 2.25, straight1: 2.30, straight2: 3.60,
      totalSets: { "2": 1.85, "3": 1.95 }, tiebreakYes: 2.30, tiebreakNo: 1.60 },
    { id: "m8", tour: "WTA", court: "Court 5",           time: "19:30", p1: "w8",  p2: "w12",
      odds1: 1.55, odds2: 2.40, straight1: 2.15, straight2: 4.00,
      totalSets: { "2": 1.80, "3": 2.00 }, tiebreakYes: 2.40, tiebreakNo: 1.55 }
  ]
};
