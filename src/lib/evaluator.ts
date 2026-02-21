export interface HeuristicMatch {
  title: string;
  description: string;
  score: number;
  keywords: string[];
}

export interface EvaluationResult {
  score: number;
  matches: HeuristicMatch[];
}

/**
 * Gives safety eval given a prompt from 0-100, along with detailed explanations.
 */
export default function evaluator(message: string): EvaluationResult {
  const matches: HeuristicMatch[] = [];

  const h1Match = heuristic1(message);
  if (h1Match) matches.push(h1Match);

  const h2Match = heuristic2(message);
  if (h2Match) matches.push(h2Match);

  const h3Match = heuristic3(message);
  if (h3Match) matches.push(h3Match);

  // Sum the highest scores from each triggered heuristic
  const totalScore = matches.reduce((sum, match) => sum + match.score, 0);

  return {
    score: Math.min(totalScore, 100),
    matches,
  };
}

/**
 * Heuristic 1: Contextual Heuristics
 * Matches specific high-risk vocabulary.
 */
function heuristic1(message: string): HeuristicMatch | null {
  const rules = [
    { keyword: "database dump", score: 8 },
    { keyword: "production", score: 6 },
    { keyword: "client data", score: 6 },
    { keyword: "confidential", score: 5 },
    { keyword: "internal", score: 4 },
    { keyword: "proprietary", score: 4 },
  ];

  const normalizedMessage = message.toLowerCase();
  const matchedKeywords: string[] = [];
  let maxScore = 0;

  for (const rule of rules) {
    if (normalizedMessage.includes(rule.keyword)) {
      matchedKeywords.push(rule.keyword);
      maxScore = Math.max(maxScore, rule.score);
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      title: "Sensitive Keywords Detected",
      description:
        "The text contains terms commonly associated with internal, restricted, or proprietary company data.",
      score: maxScore,
      keywords: matchedKeywords,
    };
  }

  return null;
}

/**
 * Luhn Algorithm for Credit Card validation (Helper for H2)
 */
function isValidLuhn(ccNum: string): boolean {
  const sanitized = ccNum.replace(/[- ]/g, "");
  let sum = 0;
  let shouldDouble = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (shouldDouble && (digit *= 2) > 9) digit -= 9;
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0 && sanitized.length >= 13;
}

/**
 * Heuristic 2: Pattern Matching (Regex & Luhn)
 * Identifies API Keys, PII, and financial data formats.
 */
function heuristic2(message: string): HeuristicMatch | null {
  const matchedTypes: string[] = [];
  let maxScore = 0;

  const regexRules = [
    { name: "Private Key", regex: /-----BEGIN PRIVATE KEY-----/, score: 60 },
    { name: "AWS Key", regex: /\bAKIA[0-9A-Z]{16}\b/, score: 50 },
    { name: "OpenAI Key", regex: /\bsk-[a-zA-Z0-9]{32,}\b/, score: 50 },
    {
      name: "JWT Token",
      regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/,
      score: 40,
    },
    {
      name: "IBAN",
      regex: /\b[A-Z]{2}[0-9]{2}(?:[ ]?[0-9a-zA-Z]{4}){3,7}\b/,
      score: 30,
    },
    {
      name: "Email Address",
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      score: 20,
    },
    {
      name: "High-Entropy Pattern",
      regex: /\b(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{30,}\b/,
      score: 30,
    },
  ];

  // 1. Check strict regex patterns
  for (const rule of regexRules) {
    if (rule.regex.test(message)) {
      matchedTypes.push(rule.name);
      maxScore = Math.max(maxScore, rule.score);
    }
  }

  // 2. Check Credit Cards with Luhn validation
  const ccMatches = message.match(/\b(?:\d[ -]*?){13,16}\b/g);
  if (ccMatches) {
    const validCCs = ccMatches.filter(isValidLuhn);
    if (validCCs.length > 0) {
      matchedTypes.push("Credit Card (Luhn Validated)");
      maxScore = Math.max(maxScore, 50);
    }
  }

  if (matchedTypes.length > 0) {
    return {
      title: "Credential & PII Patterns",
      description:
        "The text contains structures matching known API keys, financial data, or personally identifiable information.",
      score: maxScore,
      keywords: matchedTypes, // Note: We pass the RULE NAME here, not the actual secret, to keep the UI safe!
    };
  }

  return null;
}

/**
 * Calculates Shannon entropy of a string (Helper for H3)
 */
function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies: Record<string, number> = {};

  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  return Object.values(frequencies).reduce((entropy, count) => {
    const p = count / len;
    return entropy - p * Math.log2(p);
  }, 0);
}

/**
 * Heuristic 3: Entropy Detection
 * Catches randomized strings that look like un-regexable secrets.
 */
function heuristic3(message: string): HeuristicMatch | null {
  let maxScore = 0;
  const matchedMasks: string[] = [];

  const words = message.split(/[\s,;:"'()[\]{}]+/);
  const base64Regex = /^[a-zA-Z0-9+/=\-_]+$/;

  for (const word of words) {
    if (word.length > 24 && base64Regex.test(word)) {
      const entropy = calculateEntropy(word);
      let score = 0;

      if (entropy > 4.5) {
        score = 25;
      } else if (entropy >= 4.0) {
        score = 15;
      } else if (entropy >= 3.5) {
        score = 10;
      }

      if (score > 0) {
        maxScore = Math.max(maxScore, score);
        // Mask the string so we don't display a raw secret in the Details overlay
        const masked = `${word.substring(0, 4)}...${word.substring(
          word.length - 4
        )}`;
        matchedMasks.push(`Entropy ${entropy.toFixed(2)}: ${masked}`);
      }
    }
  }

  if (matchedMasks.length > 0) {
    return {
      title: "High Entropy Secrets",
      description:
        "Detected dense, randomized text blocks that heavily resemble cryptographic keys or base64 encoded payloads.",
      score: maxScore,
      keywords: matchedMasks,
    };
  }

  return null;
}
