/**
 * Gives safety eval given a prompt from 0-100
 */
export default function evaluator(message: string): number {
  const h1_score = heuristic1(message);
  const h2_score = heuristic2(message);
  const h3_score = heuristic3(message);

  // Sum the heuristic scores, capped at 100
  const totalScore = Math.min(h1_score + h2_score + h3_score, 100);

  console.log(`H1: ${h1_score}, H2: ${h2_score}, H3: ${h3_score}, Total: ${totalScore}`);

  return totalScore;
}

/**
 * Heuristic 1: Contextual Heuristics
 * Just matching the keywords
 *
 * - "database dump" -> +8
 * - "production" -> +6
 * - "confidential" -> +5
 * - "internal" -> +4
 * - "client data" -> +6
 * - "proprietary" -> +4
 */
function heuristic1(message: string): number {
  const rules = [
    { keyword: "database dump", score: 8 },
    { keyword: "production", score: 6 },
    { keyword: "client data", score: 6 },
    { keyword: "confidential", score: 5 },
    { keyword: "internal", score: 4 },
    { keyword: "proprietary", score: 4 },
  ];

  const normalizedMessage = message.toLowerCase();

  for (const { keyword, score } of rules) {
    if (normalizedMessage.includes(keyword)) {
      return score;
    }
  }

  return 0;
}

/**
 * Luhn Algorithm for Credit Card validation
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
 * Heuristic 2: Pattern Matching
 *
 *  - API keys (regex patterns: sk-, AIza, JWT structure)
 *  - AWS keys
 *  - Private keys (-----BEGIN PRIVATE KEY-----)
 *  - Email addresses
 *  - IBAN
 *  - Credit card numbers (Luhn check)
 */
function heuristic2(message: string): number {
  let maxScore = 0;

  const regexRules = [
    { regex: /-----BEGIN PRIVATE KEY-----/, score: 60 },
    { regex: /\bAKIA[0-9A-Z]{16}\b/, score: 50 }, // AWS Key
    { regex: /\bsk-[a-zA-Z0-9]{32,}\b/, score: 50 }, // OpenAI Key
    {
      regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/,
      score: 40,
    }, // JWT
    { regex: /\b[A-Z]{2}[0-9]{2}(?:[ ]?[0-9a-zA-Z]{4}){3,7}\b/, score: 30 }, // IBAN
    { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, score: 20 }, // Email
    {
      regex: /\b(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{30,}\b/,
      score: 30,
    }, // High Entropy
  ];

  // 1. Check Regex rules
  for (const { regex, score } of regexRules) {
    if (regex.test(message)) {
      maxScore = Math.max(maxScore, score);
    }
  }

  // 2. Check Credit Cards with Luhn validation
  const ccMatches = message.match(/\b(?:\d[ -]*?){13,16}\b/g);
  if (ccMatches && ccMatches.some(isValidLuhn)) {
    maxScore = Math.max(maxScore, 50);
  }

  return maxScore;
}

/**
 * Calculates Shannon entropy of a string
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
 * Heuristic 3: Entropy Detection (Base64 / Hex-like secrets)
 */
function heuristic3(message: string): number {
  let maxScore = 0;

  // Extract words using boundaries (whitespace, quotes, brackets)
  const words = message.split(/[\s,;:"'()[\]{}]+/);

  // Matches Alphanumeric + standard Base64 characters
  const base64Regex = /^[a-zA-Z0-9+/=\-_]+$/;

  for (const word of words) {
    // Require length > 24 and base64/hex-like format
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

      maxScore = Math.max(maxScore, score);
    }
  }

  return maxScore;
}
