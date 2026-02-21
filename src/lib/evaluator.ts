/**
 * Gives safety eval given a prompt from 0-100
 */
export default function evaluator(message: string) {
  const heuristic1_score = heuristic1(message);

  console.log(heuristic1_score);

  return heuristic1_score;
}

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
