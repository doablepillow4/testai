export type ThreatType =
  | "pandemic"
  | "bioterror"
  | "conflict"
  | "energy"
  | "climate"
  | "financial"
  | "political"
  | "nuclear"
  | "cyber"
  | "supply_chain"
  | "unknown";

export type ThreatSeverity = "watch" | "concern" | "elevated" | "critical";

export interface ThreatClassification {
  type: ThreatType;
  label: string;
  severity: ThreatSeverity;
  lockdownRisk: number;
  economicDisruptionRisk: number;
  marketImpactScore: number;
  timeHorizon: string;
  affectedSectors: string[];
  affectedTickers: string[];
  polymarketSearchTerms: string[];
  narrative: string;
}

interface ThreatProfile {
  baseLockdownRisk: number;
  baseEconomicRisk: number;
  baseMarketImpact: number;
  timeHorizon: string;
  label: string;
  affectedSectors: string[];
  affectedTickers: string[];
  polymarketSearchTerms: string[];
  narrativeTemplate: (title: string, severity: ThreatSeverity) => string;
}

const THREAT_PROFILES: Record<ThreatType, ThreatProfile> = {
  pandemic: {
    label: "Pandemic Signal",
    baseLockdownRisk: 0.35,
    baseEconomicRisk: 0.65,
    baseMarketImpact: 0.70,
    timeHorizon: "3–18 months",
    affectedSectors: ["Travel", "Hospitality", "Healthcare", "E-commerce", "Pharma"],
    affectedTickers: ["UAL", "DAL", "MAR", "XLV", "AMZN", "PFE", "ZM", "SPY"],
    polymarketSearchTerms: ["pandemic", "outbreak", "lockdown", "disease", "virus", "health", "WHO", "CDC"],
    narrativeTemplate: (title, sev) =>
      `${title} — Early-stage health signal detected. ${sev === "critical" ? "WHO/CDC escalation likely." : "Monitor for case trajectory escalation."} Historical pandemic analog (COVID-19 Q1 2020): travel sector drawdown −40–60%, healthcare sector +15–25%, e-commerce +20–30% if restrictions imposed. Lockdown risk drives defensive rotation into XLV, AMZN, ZM and safe havens (GLD, TLT). Short exposure to UAL, DAL, MAR, CCL. Key monitors: case doubling time, R₀ estimate, hospital utilization, WHO PHEIC declaration.`,
  },
  bioterror: {
    label: "Bio-Security Alert",
    baseLockdownRisk: 0.60,
    baseEconomicRisk: 0.80,
    baseMarketImpact: 0.85,
    timeHorizon: "Immediate – 6 months",
    affectedSectors: ["Travel", "Hospitality", "Healthcare", "Defence", "Pharma"],
    affectedTickers: ["GLD", "BTC", "XLV", "TLT", "LMT", "RTX"],
    polymarketSearchTerms: ["bioterror", "biological", "attack", "agent", "security"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Bio-security event triggers immediate lockdown risk and elevated defence spending. Healthcare (XLV, pharma) and defence contractors (LMT, RTX) outperform. Government emergency spending programmes likely. Travel, hospitality face sharp drawdowns. Safe havens (GLD, TLT, BTC) attract capital flight. Expect significant volatility (VIX spike) on confirmation. Monitor government attribution statements.`,
  },
  conflict: {
    label: "Geopolitical Conflict",
    baseLockdownRisk: 0.05,
    baseEconomicRisk: 0.55,
    baseMarketImpact: 0.60,
    timeHorizon: "1–6 months",
    affectedSectors: ["Energy", "Defence", "Commodities", "Shipping", "European Equities"],
    affectedTickers: ["LMT", "RTX", "NOC", "XOM", "CVX", "GLD", "BTC", "CORN"],
    polymarketSearchTerms: ["war", "conflict", "ceasefire", "invasion", "attack", "troops", "military"],
    narrativeTemplate: (title, sev) =>
      `${title} — ${sev === "critical" || sev === "elevated" ? "Active conflict escalation." : "Conflict risk rising."} Defence contractors (LMT, RTX, NOC) historically outperform +15–30% in active conflict phases. Energy exposure depends on geography — oil shock risk if Strait of Hormuz or key pipelines threatened. Grain/commodity disruption if Black Sea/Eastern Europe involved. Safe havens (GLD, USD, Treasuries) bid. BTC shows mixed correlation — risk-off initially, then potential safe-haven bid. Monitor NATO/UN response and sanctions escalation path.`,
  },
  nuclear: {
    label: "Nuclear Threat",
    baseLockdownRisk: 0.20,
    baseEconomicRisk: 0.90,
    baseMarketImpact: 0.95,
    timeHorizon: "Immediate – 3 months",
    affectedSectors: ["All — severe risk-off across the board"],
    affectedTickers: ["GLD", "TLT", "BTC", "VIX", "UUP"],
    polymarketSearchTerms: ["nuclear", "warhead", "nuke", "north korea", "icbm", "nuclear war"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Nuclear escalation triggers maximum risk-off across all asset classes. Historical nuclear scares (Cuban Missile Crisis, India-Pakistan tensions 1999) show SPY −10–25% intraday, gold +8–15%, USD bid. V-shaped recovery typical if crisis de-escalated diplomatically. Extended conflict: treasury yields collapse (flight to safety), VIX spikes 50–80+. BTC correlation spikes with risk assets in stress — not a safe haven at this severity level. Watch for DEFCON level changes and UN Security Council emergency sessions.`,
  },
  energy: {
    label: "Energy Disruption",
    baseLockdownRisk: 0.02,
    baseEconomicRisk: 0.50,
    baseMarketImpact: 0.55,
    timeHorizon: "1–4 months",
    affectedSectors: ["Energy", "Airlines", "Industrials", "Consumer Discretionary"],
    affectedTickers: ["XOM", "CVX", "USO", "AAL", "DAL", "SPY", "XLI"],
    polymarketSearchTerms: ["oil", "opec", "energy", "barrel", "gas", "pipeline", "brent"],
    narrativeTemplate: (title, sev) =>
      `${title} — ${sev === "elevated" || sev === "critical" ? "Supply disruption accelerating." : "Energy market stress developing."} Oil shock scenario: CPI impact +0.3–0.8pp per $10/barrel increase, Fed policy complication. Airlines (AAL, DAL) face 15–25% margin compression per $20/barrel move. Integrated majors (XOM, CVX) benefit on production side. Consumer discretionary pressured via fuel costs. Monitor OPEC+ emergency meetings and US strategic reserve release decisions.`,
  },
  financial: {
    label: "Financial Systemic Risk",
    baseLockdownRisk: 0.00,
    baseEconomicRisk: 0.65,
    baseMarketImpact: 0.70,
    timeHorizon: "1–6 months",
    affectedSectors: ["Financials", "Real Estate", "Credit Markets", "Broad Equities"],
    affectedTickers: ["XLF", "KRE", "GLD", "TLT", "BTC", "UUP"],
    polymarketSearchTerms: ["recession", "bank", "credit", "default", "gdp", "inflation", "fed", "financial crisis"],
    narrativeTemplate: (title, sev) =>
      `${title} — ${sev === "elevated" || sev === "critical" ? "Systemic stress indicators elevated." : "Financial risk building."} Credit spread widening is lead indicator — watch IG/HY CDS indices. Regional bank stress (KRE) historically precedes broader contagion. Gold and short-duration Treasuries outperform in credit crisis. BTC may decouple bearishly as margin calls force liquidation (2022 pattern). Monitor Fed emergency response probability and Treasury backstop mechanisms.`,
  },
  political: {
    label: "Political Instability",
    baseLockdownRisk: 0.03,
    baseEconomicRisk: 0.35,
    baseMarketImpact: 0.40,
    timeHorizon: "3–12 months",
    affectedSectors: ["Policy-sensitive sectors", "Healthcare", "Energy", "Defence"],
    affectedTickers: ["SPY", "TLT", "DXY", "BTC", "XLV", "XOM"],
    polymarketSearchTerms: ["election", "trump", "vote", "congress", "government", "impeach", "coup"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Political uncertainty drives sector rotation rather than broad market collapse. Healthcare reform risk (XLV −10–20% on adverse legislation), energy deregulation (XOM +5–15% on looser rules), defence spending (LMT, RTX on budget signals). Tax policy changes affect broad market multiples. Fiscal trajectory impacts TLT/bond markets. BTC typically volatile around election cycles — regulatory uncertainty is key watchpoint. Monitor polling trajectory and congressional composition.`,
  },
  climate: {
    label: "Climate / Natural Disaster",
    baseLockdownRisk: 0.02,
    baseEconomicRisk: 0.30,
    baseMarketImpact: 0.35,
    timeHorizon: "6–24 months",
    affectedSectors: ["Insurance", "Agriculture", "Energy", "Infrastructure", "Reinsurance"],
    affectedTickers: ["ICLN", "CORN", "WEAT", "XOM", "CB", "AIG"],
    polymarketSearchTerms: ["climate", "disaster", "flood", "hurricane", "earthquake", "wildfire", "temperature"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Climate events create localized economic damage with reinsurance sector exposure (CB, AIG −5–15% post-event). Agricultural commodities (CORN, WEAT) spiking on weather extremes. Energy sector mixed — clean energy (ICLN) benefits from long-term transition narrative, fossil fuels impacted by carbon regulation risk. Infrastructure capex cycle beneficiary. Monitor reinsurance pricing signals (Lloyd's of London, Swiss Re commentary).`,
  },
  cyber: {
    label: "Cyber Attack",
    baseLockdownRisk: 0.05,
    baseEconomicRisk: 0.40,
    baseMarketImpact: 0.45,
    timeHorizon: "1–6 weeks",
    affectedSectors: ["Technology", "Financials", "Critical Infrastructure", "Utilities"],
    affectedTickers: ["CRWD", "PANW", "S", "BTC", "MSFT"],
    polymarketSearchTerms: ["cyber", "hack", "breach", "ransomware", "attack", "infrastructure"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Cyberattacks on critical infrastructure trigger sharp but typically short-lived dislocations. Cybersecurity vendors (CRWD, PANW, S) historically gap +5–15% on major incidents. Financial system attacks create broader contagion risk — watch SWIFT/banking network disruption. Nation-state attribution escalates geopolitical risk premium. BTC may spike as payment/ransom mechanism. Recovery typically 2–6 weeks for non-infrastructure targets. Monitor CISA advisories and government response.`,
  },
  supply_chain: {
    label: "Supply Chain Shock",
    baseLockdownRisk: 0.08,
    baseEconomicRisk: 0.45,
    baseMarketImpact: 0.50,
    timeHorizon: "2–8 months",
    affectedSectors: ["Technology", "Consumer Goods", "Industrials", "Autos", "Shipping"],
    affectedTickers: ["NVDA", "AAPL", "TSM", "FDX", "UPS", "GM", "F"],
    polymarketSearchTerms: ["supply chain", "semiconductor", "trade", "tariff", "shipping", "chip"],
    narrativeTemplate: (title, _sev) =>
      `${title} — Supply chain disruption drives input cost inflation and earnings pressure across consumer/tech sectors. Semiconductor shortage scenario: NVDA, AAPL face 10–20% revenue risk if Taiwan/fab disrupted. Nearshoring beneficiaries: Mexico, India-exposed funds. Shipping rate spikes (Baltic Dry) signal demand-supply imbalance. Monitor lead time data from ISM surveys and earnings guidance revisions. Inventory build-then-destocking cycle typical 6–18 month resolution.`,
  },
  unknown: {
    label: "Unclassified Signal",
    baseLockdownRisk: 0.08,
    baseEconomicRisk: 0.20,
    baseMarketImpact: 0.25,
    timeHorizon: "1–3 months",
    affectedSectors: ["Broad Markets"],
    affectedTickers: ["SPY", "GLD", "BTC"],
    polymarketSearchTerms: [],
    narrativeTemplate: (title, _sev) =>
      `${title} — Emerging signal detected without clear threat classification. Default defensive posture: reduce risk concentration, increase GLD and TLT allocation. Monitor for escalation into a classifiable threat category. Key watchpoints: official government statements, international body responses, and secondary market reactions.`,
  },
};

const PANDEMIC_KEYWORDS =
  /hantavirus|mpox|monkeypox|ebola|marburg|sars|mers|h5n1|h1n1|bird flu|swine flu|avian flu|pandemic|epidemic|outbreak|novel virus|new strain|pathogen|contagion|plague|cholera|dengue|zika|virus spread|cases rising|new cases|quarantine|cases reported|health emergency|disease outbreak|deadly virus|infectious|transmissible|spreading disease|WHO declares|WHO warning|CDC alert|health alert|vaccination|vaccine rollout|lockdown.*virus|virus.*lockdown/;

const BIOTERROR_KEYWORDS =
  /bioterror|biological attack|bio-weapon|bioweapon|anthrax|nerve agent|chemical weapon|weaponised/;

const NUCLEAR_KEYWORDS =
  /nuclear.*weapon|nuclear.*strike|nuclear.*threat|nuclear.*test|warhead|icbm|ballistic missile.*nuclear|nuclear.*escalat|radiation.*release|dirty bomb|plutonium|uranium.*enrichment.*weapon|nuclear.*north korea/;

const CONFLICT_KEYWORDS =
  /military strike|airstrike|troops.*invad|invasion|bombing|offensive.*military|missiles.*launched|ground forces|casualties.*military|forces.*attack|naval.*blockade|ceasefire.*broken|escalation.*military/;

const ENERGY_KEYWORDS =
  /opec.*cut|oil.*supply.*shock|gas.*price.*spike|energy.*crisis|pipeline.*attack|pipeline.*shut|lng.*shortage|fuel.*shortage|oil.*sanctions|refinery.*attack/;

const FINANCIAL_KEYWORDS =
  /bank.*collapse|bank.*crisis|credit.*crunch|systemic.*risk|financial.*contagion|debt.*default|sovereign.*default|currency.*crisis|bank.*run|liquidity.*crisis|svb|lehman|bear stearns|systemic.*collapse/;

const NUCLEAR_GEOPOLITICS_TERMS = /north korea.*missile|iran.*nuclear|russia.*nuclear|china.*nuclear/;

function computeSeverity(type: ThreatType, text: string, isBreaking: boolean): ThreatSeverity {
  const CRITICAL_TERMS = [
    "declare",
    "emergency",
    "unprecedented",
    "catastrophic",
    "mass casualt",
    "global pandemic",
    "nuclear launch",
    "imminent",
    "confirmed attack",
  ];
  const ELEVATED_TERMS = [
    "spread",
    "escalat",
    "rapidly",
    "surge",
    "outbreak",
    "invasion",
    "strike",
    "explosion",
    "confirmed",
    "multiple countries",
  ];

  const criticalHits = CRITICAL_TERMS.filter((t) => text.includes(t)).length;
  const elevatedHits = ELEVATED_TERMS.filter((t) => text.includes(t)).length;

  if (type === "nuclear" || criticalHits >= 2) return "critical";
  if (criticalHits >= 1 || elevatedHits >= 3 || (isBreaking && elevatedHits >= 1)) return "elevated";
  if (elevatedHits >= 1 || isBreaking) return "concern";
  return "watch";
}

function severityMultiplier(sev: ThreatSeverity): number {
  return { watch: 0.6, concern: 0.8, elevated: 1.0, critical: 1.25 }[sev];
}

export function classifyThreat(
  title: string,
  description: string,
  isBreaking = false,
): ThreatClassification {
  const text = (title + " " + description).toLowerCase();

  let type: ThreatType = "unknown";
  if (BIOTERROR_KEYWORDS.test(text)) type = "bioterror";
  else if (NUCLEAR_KEYWORDS.test(text) || NUCLEAR_GEOPOLITICS_TERMS.test(text)) type = "nuclear";
  else if (PANDEMIC_KEYWORDS.test(text)) type = "pandemic";
  else if (CONFLICT_KEYWORDS.test(text)) type = "conflict";
  else if (ENERGY_KEYWORDS.test(text)) type = "energy";
  else if (FINANCIAL_KEYWORDS.test(text)) type = "financial";
  else if (/cyberattack|ransomware|hack.*critical|critical.*infrastructure.*breach/.test(text))
    type = "cyber";
  else if (/climate.*disaster|major.*flood|catastrophic.*wildfire|devastating.*earthquake/.test(text))
    type = "climate";
  else if (/election.*crisis|coup|government.*collapse|political.*turmoil/.test(text))
    type = "political";
  else if (/supply chain.*crisis|semiconductor.*shortage|trade.*war.*escalat/.test(text))
    type = "supply_chain";
  // Fallback: broader geopolitical terms
  else if (/war|conflict|attack|missile|troops|bombing|military/.test(text)) type = "conflict";
  else if (/virus|disease|outbreak|infected|contagious|pathogen|epidemic/.test(text))
    type = "pandemic";
  else if (/oil|opec|gas|energy.*price|barrel/.test(text)) type = "energy";
  else if (/recession|bank|credit|default|financial crisis|economic collapse/.test(text))
    type = "financial";
  else if (/election|trump|vote|congress|political/.test(text)) type = "political";

  const profile = THREAT_PROFILES[type];
  const severity = computeSeverity(type, text, isBreaking);
  const mult = severityMultiplier(severity);

  return {
    type,
    label: profile.label,
    severity,
    lockdownRisk: Math.min(1, parseFloat((profile.baseLockdownRisk * mult).toFixed(2))),
    economicDisruptionRisk: Math.min(1, parseFloat((profile.baseEconomicRisk * mult).toFixed(2))),
    marketImpactScore: Math.min(1, parseFloat((profile.baseMarketImpact * mult).toFixed(2))),
    timeHorizon: profile.timeHorizon,
    affectedSectors: profile.affectedSectors,
    affectedTickers: profile.affectedTickers,
    polymarketSearchTerms: profile.polymarketSearchTerms,
    narrative: profile.narrativeTemplate(title, severity),
  };
}

export function scoreEmergence(
  title: string,
  description: string,
  category: string,
  isBreaking: boolean,
  publishedAt: string,
  polymarketMatchCount: number,
): number {
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageHours = ageMs / 3_600_000;

  let score = 0;
  if (ageHours < 2) score += 40;
  else if (ageHours < 8) score += 25;
  else if (ageHours < 24) score += 10;

  if (isBreaking) score += 25;

  const EMERGING_CATEGORY_SCORES: Record<string, number> = {
    pandemic: 40,
    health: 35,
    conflict: 20,
    energy: 15,
    nuclear: 35,
    cyber: 20,
    macro: 5,
    geopolitics: 10,
  };
  score += EMERGING_CATEGORY_SCORES[category] ?? 0;

  const text = (title + " " + description).toLowerCase();
  if (
    /hantavirus|mpox|novel virus|new strain|new outbreak|emerging|unconfirmed|first.*cases|initial reports/.test(
      text,
    )
  )
    score += 35;
  if (/spreading|spread to|cases in|reported in.*countries|multiple|cluster/.test(text)) score += 20;
  if (/warning|alert|urgent|concern|watch|monitor/.test(text)) score += 10;

  // Boost if there's low Polymarket coverage (novel/unknown topic)
  if (polymarketMatchCount === 0) score += 20;
  else if (polymarketMatchCount === 1) score += 5;

  return score;
}
