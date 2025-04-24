// fuzzy-search.ts
// A utility to perform advanced fuzzy searching on bookmarks
//
// This implementation provides smart multi-word matching for bookmark searching,
// allowing queries like "aws dash" to find "AWS dashboard admin" by:
// 1. Supporting sequential word matching with skipped words
// 2. Applying prefix matching for partial words
// 3. Implementing special handling for title fields
// 4. Using dynamic thresholds for different query types

/**
 * Interface for a search match result
 */
export interface FuzzySearchResult<T> {
  item: T;             // The original item
  score: number;       // Score (higher is better match)
  matches: string[];   // What parts matched
  matchPositions: {    // Positions of matches for highlighting
    fieldName: string;
    indices: number[];
  }[];
}

/**
 * Extract all tokens (words) from a string
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Create an acronym from a string by taking the first character of each word
 */
function getAcronym(text: string): string {
  if (!text) return '';
  return tokenize(text)
    .map(word => word[0])
    .join('');
}

/**
 * Calculate Levenshtein edit distance between two strings
 * @returns Lower score means more similar
 */
function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  const costs: number[] = [];

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(
            newValue,
            lastValue,
            costs[j]
          ) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }

  return costs[s2.length];
}

/**
 * Calculate similarity between two strings (0-1)
 * Higher score means more similar
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 && !s2) return 1; // Both empty = perfect match
  if (!s1 || !s2) return 0; // One empty = no match

  const distance = editDistance(s1, s2);
  const longerLength = Math.max(s1.length, s2.length);

  // Convert edit distance to similarity (0-1)
  return (longerLength - distance) / longerLength;
}

/**
 * Check if a search term has a prefix match in a target string
 */
function hasPrefixMatch(searchTerm: string, target: string): boolean {
  if (!searchTerm || !target) return false;

  const targetTokens = tokenize(target);
  searchTerm = searchTerm.toLowerCase();

  return targetTokens.some(token => token.startsWith(searchTerm));
}

/**
 * Check if multiple words appear in sequence in the target, allowing skipped words
 * This helps with queries like "aws dash" matching "AWS dashboard admin"
 */
function hasSequentialWordMatch(searchTerms: string[], target: string): {matched: boolean; ratio: number} {
  if (!searchTerms.length || !target) return {matched: false, ratio: 0};

  const targetTokens = tokenize(target);
  if (!targetTokens.length) return {matched: false, ratio: 0};

  let matchCount = 0;
  let currentTargetIndex = 0;

  // For each search term, try to find a matching target token
  for (const searchTerm of searchTerms) {
    let found = false;

    // Look for a match at or after the current position
    for (let i = currentTargetIndex; i < targetTokens.length; i++) {
      const targetToken = targetTokens[i];

      // Match if target token starts with search term
      if (targetToken.startsWith(searchTerm)) {
        matchCount++;
        currentTargetIndex = i + 1; // Move past this match
        found = true;
        break;
      }
    }

    // If we didn't find this term, try just matching anywhere
    if (!found) {
      for (let i = 0; i < targetTokens.length; i++) {
        if (targetTokens[i].startsWith(searchTerm)) {
          matchCount += 0.5; // Partial credit for unordered matches
          found = true;
          break;
        }
      }
    }
  }

  const ratio = matchCount / searchTerms.length;
  return {
    matched: ratio > 0,
    ratio: ratio
  };
}

/**
 * Calculate match score for search
 * Higher score indicates better match
 */
function calculateScore(
  searchTerm: string,
  fieldValue: string,
  options: { fieldWeight: number; isTitle: boolean }
): number {
  if (!searchTerm || !fieldValue) return 0;

  searchTerm = searchTerm.toLowerCase();
  const fieldValueLower = fieldValue.toLowerCase();

  let score = 0;

  // Direct inclusion gives high score
  if (fieldValueLower.includes(searchTerm)) {
    score += 100 * options.fieldWeight;

    // Even higher if it's at the beginning
    if (fieldValueLower.startsWith(searchTerm)) {
      score += 50 * options.fieldWeight;
    }

    // Exact match is the highest
    if (fieldValueLower === searchTerm) {
      score += 200 * options.fieldWeight;
    }
  }

  // Check for tokenized prefix matches
  const tokens = tokenize(fieldValue);
  for (const token of tokens) {
    if (token.startsWith(searchTerm)) {
      score += 80 * options.fieldWeight;
    }
  }

  // Check for tokenized search terms
  const searchTokens = tokenize(searchTerm);
  let matchedTokens = 0;

  for (const searchToken of searchTokens) {
    // Skip very short search tokens (less than 2 chars)
    if (searchToken.length < 2) continue;

    // Give higher scores to prefix matches
    for (const token of tokens) {
      if (token.startsWith(searchToken)) {
        matchedTokens += 1.2; // Extra boost for prefix matches
        break;
      } else if (token.includes(searchToken)) {
        matchedTokens += 1.0; // Normal score for inclusion
        break;
      }
    }
  }

  // Reward for matching multiple search tokens
  if (searchTokens.length > 1 && matchedTokens > 0) {
    // Give a significantly higher score for multi-word matches
    score += (matchedTokens / searchTokens.length) * 120 * options.fieldWeight;

    // For title fields, do an additional sequential word match with higher weight
    if (options.isTitle && searchTokens.length > 1) {
      const sequentialMatch = hasSequentialWordMatch(searchTokens, fieldValue);
      if (sequentialMatch.matched) {
        // This is a major boost for sequential matches in titles - crucial for multi-word searches
        score += sequentialMatch.ratio * 300 * options.fieldWeight;
      }
    }
  }

  // Check for acronym match
  const acronym = getAcronym(fieldValue);
  if (acronym.includes(searchTerm)) {
    score += 60 * options.fieldWeight;
  }

  // Add similarity score for fuzzy matching
  const similarity = stringSimilarity(searchTerm, fieldValueLower);
  score += similarity * 40 * options.fieldWeight;

  return score;
}

/**
 * Perform a fuzzy search on an array of items
 * @param items The array of items to search
 * @param searchFields Configuration for which fields to search and their weights
 * @param searchText The search text (query)
 * @param options Optional parameters like limit
 * @returns Array of results with match information, sorted by score
 */
export function fuzzySearch<T>(
  items: T[],
  searchFields: {
    name: keyof T;
    weight: number;
  }[],
  searchText: string,
  options: {
    limit?: number;
    threshold?: number;
  } = {}
): FuzzySearchResult<T>[] {
  // Clean up search input
  const sanitizedSearch = searchText.trim().toLowerCase();
  if (!sanitizedSearch) return [];

  // Default options - lower threshold to catch more potential matches
  const threshold = options.threshold || 5;

  // Search tokens (split search into words)
  const searchTokens = tokenize(sanitizedSearch);

  // Process all items
  const results: FuzzySearchResult<T>[] = [];

  for (const item of items) {
    let totalScore = 0;
    const matches: string[] = [];
    const matchPositions: { fieldName: string; indices: number[] }[] = [];

    // Score each field
    for (const field of searchFields) {
      const fieldName = field.name;
      const fieldValue = String(item[fieldName] || '');
      const isTitle = String(fieldName).toLowerCase() === 'title';

      // Overall field matching
      const fieldScore = calculateScore(sanitizedSearch, fieldValue, {
        fieldWeight: field.weight,
        isTitle
      });

      totalScore += fieldScore;

      // Also check individual token matches
      for (const token of searchTokens) {
        if (token.length < 2) continue; // Skip very short tokens

        const tokenScore = calculateScore(token, fieldValue, {
          fieldWeight: field.weight / 2, // Reduce weight for token matches
          isTitle
        });

        totalScore += tokenScore;

        // Record match positions for highlighting later
        if (tokenScore > 0) {
          const fieldValueLower = fieldValue.toLowerCase();
          const tokenLower = token.toLowerCase();

          // Find all instances of token in field
          let pos = fieldValueLower.indexOf(tokenLower);
          const indices: number[] = [];

          while (pos !== -1) {
            indices.push(pos);
            pos = fieldValueLower.indexOf(tokenLower, pos + 1);
          }

          if (indices.length > 0) {
            matchPositions.push({
              fieldName: String(fieldName),
              indices
            });

            matches.push(fieldValue);
          }
        }
      }
    }

    // Only include results that exceed the threshold
    if (totalScore > threshold) {
      results.push({
        item,
        score: totalScore,
        matches,
        matchPositions
      });
    }
  }

  // Sort results by score (descending)
  results.sort((a, b) => b.score - a.score);

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
}

/**
 * Format text for display in omnibox with highlights
 */
export function formatTextWithHighlights(
  text: string,
  matchPositions: number[],
  matchLength: number = 1
): { content: string; description: string } {
  if (!text) return { content: '', description: '' };

  // Sort positions to process from end to start
  const sortedPositions = [...matchPositions].sort((a, b) => b - a);

  // Build highlighted string with <match> tags
  let highlighted = text;
  for (const pos of sortedPositions) {
    const matchEnd = Math.min(pos + matchLength, text.length);
    highlighted =
      highlighted.substring(0, pos) +
      '<match>' + highlighted.substring(pos, matchEnd) + '</match>' +
      highlighted.substring(matchEnd);
  }

  return {
    content: text,
    description: highlighted
  };
}
