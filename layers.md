# Heuristic 1 - Pattern Matching (High Precision)

Detect:

    - API keys (regex patterns: sk-, AIza, JWT structure)
    - AWS keys
    - Private keys (-----BEGIN PRIVATE KEY-----)
    - Email addresses
    - IBAN
    - Credit card numbers (Luhn check)
    - Long high-entropy strings

Example thresholds

## Critical (40–60)

    -----BEGIN PRIVATE KEY----- → +60
    Valid AWS key format → +50
    OpenAI sk- key → +50
    JWT structure with long payload → +40
    Credit card passing Luhn → +50

## Medium (20–40)

    Email address → +20
    IBAN → +30
    API-like key without validation → +30


# Heuristic 2 - Entropy Detection

Secrets tend to be:

    Long
    Random-looking
    Base64 / hex-like

Compute:

    Shannon entropy
    Length thresholds

Example thresholds:

    length < 20 → 0
    entropy < 3.5 → 0
    entropy 3.5–4.0 → +10
    entropy 4.0–4.5 → +15
    entropy > 4.5 → +25
    
    Also require:
        length > 24
        alphanumeric / base64-like

Fast. Local. No AI needed.

# Heuristic 3 - Contextual Heuristics

Keyword triggers:

    - "database dump" → +8
    - "production" → +6
    - "confidential" → +5
    - "internal" → +4
    - "client data" → +6
    - "proprietary" → +4



<!-- 
Heuristic 4 (Optional) - Local Mini Model

If you want sophistication:

Use a tiny local classifier (simple TF-IDF + logistic regression)

Or small ONNX model

Runs client-side

But honestly, not required for demo. 
-->