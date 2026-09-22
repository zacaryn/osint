/**
 * Deterministic headline language for infrastructure reactive triage.
 *
 * **Chokepoints:** noise → de-escalation/negation → strong operational → weak → null.
 * **Pipelines:** attack patterns before generic shut-down (strike + offline = sabotage, not maintenance).
 *
 * **Tuning workflow**
 * 1. Reproduce the headline title (exact wire copy).
 * 2. Add a row to `scripts/test-infrastructure-reactive.mjs` (`LANGUAGE_CASES`).
 * 3. Extend the smallest matching bank below (prefer negation/noise before widening "attack").
 * 4. Run `npm run test:reactive`.
 *
 * `classifyHeadline` is the single source of truth; `infrastructure-reactive.ts` only scores authority + traffic.
 */

export type ReactiveClaim =
  | "access_worse"
  | "access_better"
  | "flow_disruption"
  | "infrastructure_attack"
  | "ceasefire_lull";

export type ClaimStrength = "strong" | "weak";

export type LanguageHit = {
  claim: ReactiveClaim;
  strength: ClaimStrength;
  /** Short tag for tests / debugging */
  rule: string;
};

/** Headlines that mention conflict words but are not operational status. */
const NOISE = [
  /\battack on (the )?(economy|inflation|prices|markets|currencies|budget|reputation|character|credibility)\b/i,
  /\bheart attack\b/i,
  /\bpress attack\b/i,
  /\bpolitical attack\b/i,
  /\bverbal attack\b/i,
  /\bcyber ?attack on (a )?(bank|hospital|insurer|retailer)\b/i,
  /\bransomware attack\b/i,
  /\bopinion:|editorial:/i,
  /\battack on (democracy|human rights|civil liberties|free speech|judiciary|media)\b/i,
  /\b(launch(ed|es)? (an )?attack on|fresh attack on) (the )?(budget|spending|bill|policy)\b/i,
  /\b(counter-?attack|attacking play)\b.*\b(goal|match|game|football|soccer|premier league|champions league)\b/i,
  /\b(panic attack|anxiety attack)\b/i,
];

/** De-escalation, negated violence, or explicit stand-down — check before "attack" tokens. */
const DEESCALATION = [
  /\b(not to attack|n't attack|nt attack|won't attack|will not attack|would not attack)\b/i,
  /\b(vow not to|pledge not to|promise not to|swear not to)\b/i,
  /\b(no longer attack|stop attacking|stops attacking|halt attacks|attacks halt|attacks pause|paused attacks)\b/i,
  /\b(attack.?free|without attack|no attack on|no attacks on|no significant attack)\b/i,
  /\b(reduced attacks|fewer attacks|attacks fall|attacks decline|attack tempo falls)\b/i,
  /\b(ceasefire|truce|de-?escalat|cooling tensions|eases tensions)\b/i,
  /\b(resume(s|d)? talks|peace talks|negotiat)\b/i,
  /\b(will not target|won't target|would not target|cease targeting|stop targeting)\b/i,
  /\b(suspend(s|ed|ing)? attacks|halt(s|ed|ing)? (maritime )?attacks|attacks suspended)\b/i,
  /\b(end(s|ed|ing)? (its )?maritime campaign|maritime campaign ends)\b/i,
];

const CEASEFIRE_MARK = /\b(ceasefire|truce|pause(s|d)? attacks|attacks pause|de-?escalat)\b/i;

/** Declared / observed tightening — map-moving when strong. */
const ACCESS_WORSE_STRONG = [
  /\b(strait|passage|canal|transit|shipping|tanker|vessel|traffic)\b.*\b(clos(ed|ure|es)|blocked|shut|halted|suspended|denied|barred)\b/i,
  /\b(clos(ed|ure|es)|blocked|shut down|halt(ed|s)?)\b.*\b(strait|passage|canal|transit|shipping|hormuz|mandab|suez|bosphorus)\b/i,
  /\b(block(ed|s)?|halt(ed|s)?|denied|barred)\b.*\b(tanker|transit|shipping|strait|passage|vessel)\b/i,
  /\b(seiz(ed|ure)|detained|boarded|captured)\b.*\b(tanker|vessel|ship)\b/i,
  /\b(tanker|vessel|ship)\b.*\b(seiz(ed|ure)|detained|boarded)\b/i,
  /\b(irgc|navy|houthi|coast guard)\b.*\b(block|close|halt|seize|strike|hit)\b/i,
  /\b(mine(s)? (placed|found|strike)|struck by (a )?missile|missile hit|drone strike|anti-?ship)\b/i,
  /\btransit (collaps|halt|stop|suspend)/i,
  /\b(rerout(e|ed|ing)|divert(ed|ing)|avoid(s|ing|ed)?)\b.*\b(cape|around africa|bab|mandab|red sea|hormuz|suez|strait)\b/i,
  /\battack on (a )?(tanker|vessel|ship|merchant)\b/i,
  /\b(tanker|vessel|ship)\b.*\b(attack(ed|s)?|hit|struck)\b/i,
  /\bwar risk (area|premium)|ukmto\b.*\b(incident|attack|warning)\b/i,
  /\b(suez|panama) canal\b.*\b(block(ed|age)?|clos(ed|ure|es)|ground(ed|ing)|disrupt(ed|ion))\b/i,
  /\b(block(ed|age)?|ground(ed|ing)|disrupt(ed|ion))\b.*\b(suez|panama) canal\b/i,
  /\bhijack(ed|ing)?\b.*\b(vessel|ship|tanker|cargo)\b/i,
  /\b(vessel|ship|tanker)\b.*\bhijack(ed|ing)?\b/i,
  /\b(insurance|war risk) (premiums?|rates?) (surge|spike|soar)\b.*\b(red sea|shipping|vessel)\b/i,
];

const ACCESS_WORSE_WEAK = [
  /\b(could|may|might|expected to|likely to|set to|risk of|threat of|fears?|warns?|looming)\b.*\b(clos|block|disrupt|attack|escalat)/i,
  /\b(clos|block|disrupt|attack)\b.*\b(fears?|concerns?|worries|looms)\b/i,
  /\b(tensions rise|escalating tensions|flare-?up)\b/i,
];

const ACCESS_BETTER_STRONG = [
  /\b(reopen(ed|ing)?|reopened|re-?open)\b.*\b(strait|passage|canal|transit|shipping)\b/i,
  /\b(transit resumes|shipping resumes|traffic resumes|convoy escort|naval escort)\b/i,
  /\b(passage granted|clearance granted|allowed to transit|transit allowed)\b/i,
  /\b(lift(ed|s)? (the )?blockade|blockade lifted)\b/i,
];

const ACCESS_BETTER_WEAK = [
  /\b(could reopen|may reopen|might reopen|may resume|expected to resume|hopes to reopen)\b/i,
  /\b(strait|passage|canal|transit|shipping)\b.*\b(may|could|might) reopen\b/i,
  /\b(ease(s|d)? restrictions|easing restrictions)\b/i,
];

const PIPE_STOP_STRONG = [
  /\b(pipeline|pumping|terminal|compressor)\b.*\b(shut\s*down|offline|out of service|force majeure|zero flow|halt(ed)?)\b/i,
  /\b(shut\s*down|offline|force majeure)\b.*\b(pipeline|pumping|abqaiq|yanbu|petroline|druzhba|nord stream|yamal)\b/i,
  /\bstopped pumping\b/i,
];

const PIPE_ATTACK_STRONG = [
  /\b(drone strike|missile strike|sabotage|explosion|fire)\b.*\b(pipeline|pumping|refinery|terminal|abqaiq|plant)\b/i,
  /\b(pipeline|pumping|refinery|terminal)\b.*\b(drone strike|missile|sabotage|explosion|damaged|hit)\b/i,
];

const PIPE_RESTORE_STRONG = [
  /\b(restart(ed|ing)?|back online|resum(ed|e) (flow|operations| pumping)|flows restored|operating normally)\b/i,
  /\b(repair(ed|s)? damage|restored flow)\b.*\b(pipeline|pumping)\b/i,
];

const PIPE_REDUCE_STRONG = /\b(reduc(ed|e|ing)|partial flow|cut capacity|throttl)\b.*\b(pipeline|flow|output)\b/i;

/** Planned work — do not treat as hostile flow disruption unless attack language is present. */
const PIPE_MAINTENANCE = [
  /\b(scheduled|routine|planned|preventive|annual)\b.*\b(maintenance|inspection|overhaul)\b/i,
  /\b(maintenance|inspection|overhaul)\b.*\b(shut\s*down|offline|outage)\b/i,
  /\bshut\s*down\b.*\bfor maintenance\b/i,
];

const MARITIME_CONTEXT =
  /\b(strait|passage|canal|transit|shipping|tanker|vessel|ship|hormuz|mandab|bab el|red sea|gulf|pipeline|pumping|terminal|port|ukmto|houthi|irgc|navy|maritime)\b/i;

function normalize(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function firstMatch(text: string, rules: { re: RegExp; rule: string }[]): string | null {
  for (const { re, rule } of rules) {
    if (re.test(text)) return rule;
  }
  return null;
}

function isNoise(text: string): boolean {
  return NOISE.some((re) => re.test(text));
}

function deescalationHit(text: string): LanguageHit | null {
  if (!DEESCALATION.some((re) => re.test(text))) return null;
  const claim = CEASEFIRE_MARK.test(text) ? "ceasefire_lull" : "access_better";
  // Generic diplomacy ("resume talks") is not a transit signal without maritime/energy context.
  if (claim === "access_better" && !CEASEFIRE_MARK.test(text) && !MARITIME_CONTEXT.test(text)) {
    return null;
  }
  return { claim, strength: "strong", rule: "de-escalation/negation" };
}

function isPipeMaintenance(text: string): boolean {
  return PIPE_MAINTENANCE.some((re) => re.test(text));
}

function chokepointHit(text: string): LanguageHit | null {
  let rule = firstMatch(
    text,
    ACCESS_WORSE_STRONG.map((re) => ({ re, rule: "access-worse-strong" })),
  );
  if (rule) {
    const claim = /\b(mine|missile|drone|strike|anti-?ship|sabotage|attack on (a )?(tanker|vessel|ship))\b/i.test(
      text,
    )
      ? "infrastructure_attack"
      : "access_worse";
    return { claim, strength: "strong", rule };
  }

  rule = firstMatch(text, ACCESS_BETTER_STRONG.map((re) => ({ re, rule: "access-better-strong" })));
  if (rule) return { claim: "access_better", strength: "strong", rule };

  rule = firstMatch(text, ACCESS_WORSE_WEAK.map((re) => ({ re, rule: "access-worse-weak" })));
  if (rule) {
    const claim = /\b(attack|strike|missile|drone)\b/i.test(text) ? "infrastructure_attack" : "access_worse";
    return { claim, strength: "weak", rule };
  }

  rule = firstMatch(text, ACCESS_BETTER_WEAK.map((re) => ({ re, rule: "access-better-weak" })));
  if (rule) return { claim: "access_better", strength: "weak", rule };

  return null;
}

function pipelineHit(text: string): LanguageHit | null {
  let rule = firstMatch(text, PIPE_ATTACK_STRONG.map((re) => ({ re, rule: "pipe-attack-strong" })));
  if (rule) return { claim: "infrastructure_attack", strength: "strong", rule };

  if (isPipeMaintenance(text) && !PIPE_ATTACK_STRONG.some((re) => re.test(text))) {
    return null;
  }

  rule = firstMatch(text, PIPE_STOP_STRONG.map((re) => ({ re, rule: "pipe-stop-strong" })));
  if (rule) return { claim: "flow_disruption", strength: "strong", rule };

  if (PIPE_REDUCE_STRONG.test(text)) {
    return { claim: "flow_disruption", strength: "strong", rule: "pipe-reduce-strong" };
  }

  rule = firstMatch(text, PIPE_RESTORE_STRONG.map((re) => ({ re, rule: "pipe-restore-strong" })));
  if (rule) return { claim: "access_better", strength: "strong", rule };

  // Fall back to maritime chokepoint patterns for pipeline-named stories in general news
  return chokepointHit(text);
}

/**
 * Classify a single headline title for reactive infrastructure status.
 */
export function classifyHeadline(title: string, kind: "chokepoint" | "pipeline"): LanguageHit | null {
  const text = normalize(title);
  if (!text || text.length < 12) return null;
  if (isNoise(text)) return null;

  const calm = deescalationHit(text);
  if (calm) return calm;

  // Metaphor "attack" without maritime/pipeline context → ignore on chokepoints
  if (kind === "chokepoint" && /\battack\b/i.test(text) && !MARITIME_CONTEXT.test(text)) {
    return null;
  }

  return kind === "pipeline" ? pipelineHit(text) : chokepointHit(text);
}

/** Exported for regression tests — phrase banks should only grow via this module. */
export const REACTIVE_LANGUAGE_RULE_COUNT = {
  noise: NOISE.length,
  deescalation: DEESCALATION.length,
  accessWorseStrong: ACCESS_WORSE_STRONG.length,
  accessWorseWeak: ACCESS_WORSE_WEAK.length,
};
