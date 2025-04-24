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
 * or "cloud prod my" matching "Cloudwatch Production MyApp"
 */
function hasSequentialWordMatch(searchTerms: string[], target: string): {matched: boolean; ratio: number; matchQuality: number} {
  if (!searchTerms.length || !target) return {matched: false, ratio: 0, matchQuality: 0};

  const targetTokens = tokenize(target);
  if (!targetTokens.length) return {matched: false, ratio: 0, matchQuality: 0};

  let matchCount = 0;
  let matchQuality = 0; // Track quality of matches (exact vs partial)
  let currentTargetIndex = 0;
  const matchedPositions: number[] = []; // Track which target positions we've matched

  // For each search term, try to find a matching target token
  for (const searchTerm of searchTerms) {
    // Skip empty search terms
    if (searchTerm.length === 0) continue;

    let found = false;
    let bestMatchQuality = 0;
    let bestMatchIndex = -1;

    // First pass: Look for a match at or after the current position (sequential matching)
    for (let i = currentTargetIndex; i < targetTokens.length; i++) {
      const targetToken = targetTokens[i];

      // Calculate match quality based on how many characters match
      // This handles partial matches like "cloud" matching "cloudwatch"
      const termQuality = calculatePartialMatchQuality(searchTerm, targetToken);

      if (termQuality > 0.3 && termQuality > bestMatchQuality) { // Threshold for considering it a match
        bestMatchQuality = termQuality;
        bestMatchIndex = i;
        found = true;

        // If it's an excellent match (>0.8), we can stop looking
        if (termQuality > 0.8) break;
      }
    }

    // If found a sequential match, update state
    if (found && bestMatchIndex >= 0) {
      matchCount++;
      matchQuality += bestMatchQuality;
      currentTargetIndex = bestMatchIndex + 1; // Move past this match
      matchedPositions.push(bestMatchIndex);
    } else {
      // Second pass: If no sequential match, try matching anywhere
      // But ignore positions we've already matched
      for (let i = 0; i < targetTokens.length; i++) {
        if (matchedPositions.includes(i)) continue; // Skip already matched positions

        const termQuality = calculatePartialMatchQuality(searchTerm, targetTokens[i]);

        if (termQuality > 0.3 && termQuality > bestMatchQuality) { // Same threshold for consistency
          bestMatchQuality = termQuality;
          bestMatchIndex = i;
          found = true;

          if (termQuality > 0.8) break;
        }
      }

      // If found a non-sequential match, give partial credit
      if (found && bestMatchIndex >= 0) {
        matchCount += 0.7; // Higher partial credit (was 0.5)
        matchQuality += bestMatchQuality * 0.7; // Scale the quality too
        matchedPositions.push(bestMatchIndex);
      }
    }
  }

  // Calculate match ratio, adjusted for multi-word searches
  const ratio = matchCount / searchTerms.length;

  // Calculate average match quality
  const avgMatchQuality = matchQuality / Math.max(matchCount, 1);

  return {
    matched: ratio > 0,
    ratio: ratio,
    matchQuality: avgMatchQuality
  };
}

/**
 * Calculate how well a search term partially matches a target token
 * Returns a value between 0 and 1, where 1 is a perfect match
 */
function calculatePartialMatchQuality(searchTerm: string, targetToken: string): number {
  if (!searchTerm || !targetToken) return 0;

  searchTerm = searchTerm.toLowerCase();
  targetToken = targetToken.toLowerCase();

  // Perfect match
  if (searchTerm === targetToken) return 1;

  // Prefix match (e.g., "cloud" matches "cloudwatch")
  if (targetToken.startsWith(searchTerm)) {
    // The longer the search term relative to the target, the better the match
    return 0.7 + (0.3 * searchTerm.length / targetToken.length);
  }

  // Contains match (e.g., "watch" in "cloudwatch")
  if (targetToken.includes(searchTerm)) {
    // Not as good as prefix match, but still valuable
    return 0.5 + (0.2 * searchTerm.length / targetToken.length);
  }

  // Calculate character-by-character similarity for very partial matches
  // This helps with typos and abbreviations
  const maxLength = Math.max(searchTerm.length, targetToken.length);
  let matchingChars = 0;

  // Check if the search term characters appear in order in the target
  // e.g., "cldw" could partially match "cloudwatch"
  let targetIndex = 0;
  for (const char of searchTerm) {
    // Look for this character from the current position onward
    const foundIndex = targetToken.indexOf(char, targetIndex);
    if (foundIndex >= 0) {
      matchingChars++;
      targetIndex = foundIndex + 1; // Continue search after this match
    }
  }

  // If we matched at least half the characters in sequence
  if (matchingChars >= searchTerm.length / 2) {
    return 0.3 + (0.2 * matchingChars / searchTerm.length);
  }

  // Very low quality match or no match
  return 0;
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
        // Use both ratio and matchQuality to better score partial matches across multiple words
        const combinedScore = sequentialMatch.ratio * (0.3 + 0.7 * sequentialMatch.matchQuality);
        score += combinedScore * 350 * options.fieldWeight; // Increased weight (was 300)
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
          const indices: number[] = [];

          // First check for exact matches
          let pos = fieldValueLower.indexOf(tokenLower);
          while (pos !== -1) {
            indices.push(pos);
            pos = fieldValueLower.indexOf(tokenLower, pos + 1);
          }

          // If no exact matches found, look for partial matches at the beginning of words
          if (indices.length === 0 && tokenLower.length >= 2) {
            const words = fieldValueLower.split(/\s+/);
            let wordPos = 0;

            for (const word of words) {
              // Check if the word starts with the token or if token starts with the word
              if (word.startsWith(tokenLower) ||
                  (tokenLower.length >= 2 && tokenLower.startsWith(word))) {
                indices.push(fieldValue.indexOf(word, wordPos));
              }
              // Check for partial matches where at least half the characters match in sequence
              else if (word.length >= 3 && tokenLower.length >= 2) {
                let matchingChars = 0;
                let lastMatchPos = -1;

                for (let i = 0; i < Math.min(tokenLower.length, 3); i++) {
                  const charPos = word.indexOf(tokenLower[i], lastMatchPos + 1);
                  if (charPos !== -1) {
                    if (matchingChars === 0) {
                      // Record position of first matching character
                      indices.push(fieldValue.indexOf(word, wordPos) + charPos);
                    }
                    matchingChars++;
                    lastMatchPos = charPos;
                  }
                }
              }

              // Move position pointer past this word
              wordPos = fieldValue.indexOf(word, wordPos) + word.length;
            }
          }

          if (indices.length > 0) {
            matchPositions.push({
              fieldName: String(fieldName),
              indices
            });

            if (!matches.includes(fieldValue)) {
              matches.push(fieldValue);
            }
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
 * Enhanced to better handle partial matches
 */
export function formatTextWithHighlights(
  text: string,
  matchPositions: number[],
  matchLength: number = 1
): { content: string; description: string } {
  if (!text) return { content: '', description: '' };

  // Handle empty positions array
  if (!matchPositions || matchPositions.length === 0) {
    // If no matches but text contains spaces, try to highlight word prefixes
    if (text.includes(' ')) {
      return highlightWordPrefixes(text);
    }
    return { content: text, description: text };
  }

  // Merge nearby match positions to avoid excessive highlighting
  const mergedPositions: {start: number; end: number}[] = [];

  // Sort positions in ascending order for merging
  const sortedPositions = [...matchPositions].sort((a, b) => a - b);

  // Create initial ranges
  for (const pos of sortedPositions) {
    const matchEnd = Math.min(pos + matchLength, text.length);

    // Try to merge with previous range if they overlap or are very close
    if (mergedPositions.length > 0) {
      const lastRange = mergedPositions[mergedPositions.length - 1];

      // If current position overlaps or is close to previous range, extend it
      if (pos <= lastRange.end + 2) { // Allow a 2-character gap
        lastRange.end = Math.max(lastRange.end, matchEnd);
        continue;
      }
    }

    // Add new range
    mergedPositions.push({
      start: pos,
      end: matchEnd
    });
  }

  // Apply highlights from end to start to avoid position shifting
  let highlighted = text;
  for (let i = mergedPositions.length - 1; i >= 0; i--) {
    const range = mergedPositions[i];
    highlighted =
      highlighted.substring(0, range.start) +
      '<match>' + highlighted.substring(range.start, range.end) + '</match>' +
      highlighted.substring(range.end);
  }

  return {
    content: text,
    description: highlighted
  };
}

/**
 * Highlight the first few characters of each word in multi-word text
 * Useful for partial matches like "cloud prod my" -> "Cloudwatch Production MyApp"
 */
function highlightWordPrefixes(text: string): { content: string; description: string } {
  const words = text.split(/\s+/);
  let highlighted = text;

  // Process words from right to left to preserve positions
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (word.length === 0) continue;

    // Find position of this word in the original text
    const wordPos = highlighted.lastIndexOf(word);
    if (wordPos >= 0) {
      // Highlight first 2-4 characters based on word length
      const charsToHighlight = Math.min(
        word.length,
        Math.max(2, Math.ceil(word.length * 0.4))
      );

      highlighted =
        highlighted.substring(0, wordPos) +
        '<match>' + highlighted.substring(wordPos, wordPos + charsToHighlight) + '</match>' +
        highlighted.substring(wordPos + charsToHighlight);
    }
  }

  return {
    content: text,
    description: highlighted
  };
}
