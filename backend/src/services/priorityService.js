/**
 * priorityService.js
 * ─────────────────────────────────────────────────────────────────────
 * Rule-based priority scoring for SOS/emergency requests.
 *
 * ALL WEIGHTS are defined in one place (SCORING_WEIGHTS) so they can
 * be tuned later without touching any other file.
 *
 * Score range : 0 – 100
 * Priority map:
 *   0  – 30  → low
 *   31 – 60  → medium
 *   61 – 80  → high
 *   81 – 100 → critical
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Scoring weights (change only here) ──────────────────────────────
const SCORING_WEIGHTS = {
  // People count brackets (max 20 pts)
  people_count: [
    { min: 1,  max: 4,          pts: 5  },
    { min: 5,  max: 9,          pts: 10 },
    { min: 10, max: 19,         pts: 14 },
    { min: 20, max: 49,         pts: 17 },
    { min: 50, max: Infinity,   pts: 20 },
  ],

  // Vulnerable group flags (max 20 pts)
  children_present : 10,
  elderly_present  : 10,

  // Medical severity (max 35 pts — these can overlap)
  injured          : 15,
  urgent_medical   : 20,

  // Rescue need in categories (max 15 pts)
  rescue_needed    : 15,

  // Category diversity bonus (max 10 pts)
  category_count: [
    { count: 1, pts: 2  },
    { count: 2, pts: 5  },
    { count: 3, pts: 8  },
    { count: 4, pts: 10 },
    // 5 categories also gets 10 (capped below)
  ],
};

// ── Priority thresholds ──────────────────────────────────────────────
const PRIORITY_THRESHOLDS = [
  { min: 81,  max: 100, level: 'critical' },
  { min: 61,  max: 80,  level: 'high'     },
  { min: 31,  max: 60,  level: 'medium'   },
  { min: 0,   max: 30,  level: 'low'      },
];

/**
 * calculatePriorityScore(requestData)
 *
 * @param {Object} requestData
 * @param {number}   requestData.people_count
 * @param {string[]} requestData.needs         – ['food','water','medical','rescue','shelter']
 * @param {boolean}  requestData.children_present
 * @param {boolean}  requestData.elderly_present
 * @param {boolean}  requestData.injured
 * @param {boolean}  requestData.urgent_medical
 *
 * @returns {{ score: number, priority_level: string, breakdown: Object }}
 */
const calculatePriorityScore = (requestData) => {
  let score    = 0;
  const breakdown = {};

  // 1. People count
  const pc = Math.max(1, parseInt(requestData.people_count) || 1);
  const peoplePts = SCORING_WEIGHTS.people_count.find(
    (b) => pc >= b.min && pc <= b.max
  )?.pts ?? 5;
  score += peoplePts;
  breakdown.people_count = { people: pc, points: peoplePts };

  // 2. Vulnerable groups
  if (requestData.children_present) {
    score += SCORING_WEIGHTS.children_present;
    breakdown.children_present = SCORING_WEIGHTS.children_present;
  }
  if (requestData.elderly_present) {
    score += SCORING_WEIGHTS.elderly_present;
    breakdown.elderly_present = SCORING_WEIGHTS.elderly_present;
  }

  // 3. Medical severity
  if (requestData.injured) {
    score += SCORING_WEIGHTS.injured;
    breakdown.injured = SCORING_WEIGHTS.injured;
  }
  if (requestData.urgent_medical) {
    score += SCORING_WEIGHTS.urgent_medical;
    breakdown.urgent_medical = SCORING_WEIGHTS.urgent_medical;
  }

  // 4. Rescue flag inside needs
  const needs = Array.isArray(requestData.needs) ? requestData.needs : [];
  if (needs.includes('rescue')) {
    score += SCORING_WEIGHTS.rescue_needed;
    breakdown.rescue_needed = SCORING_WEIGHTS.rescue_needed;
  }

  // 5. Category diversity
  const catCount = Math.min(needs.length, 5);
  const catPts = SCORING_WEIGHTS.category_count.reduce(
    (best, b) => (catCount >= b.count ? b.pts : best), 0
  );
  score += catPts;
  breakdown.category_diversity = { categories: catCount, points: catPts };

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // Map to priority level
  const priority_level = PRIORITY_THRESHOLDS.find(
    (t) => score >= t.min && score <= t.max
  )?.level ?? 'low';

  return { score, priority_level, breakdown };
};

module.exports = { calculatePriorityScore, SCORING_WEIGHTS, PRIORITY_THRESHOLDS };
