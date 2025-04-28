// src/utils/fuzzy-search.ts

import { Bookmark } from "../models/bookmark";

/**
 * Interface representing a search match result
 */
export interface SearchMatch {
  item: Bookmark;
  score: number; // Higher is better
  matchPositions: Array<{
    fieldName: string;
    indices: Array<[number, number]>; // tuple of [startIndex, length]
  }>;
}

/**
 * Performs a fuzzy search on bookmarks
 * @param bookmarks Array of bookmarks to search
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @returns Array of search matches with scores
 */
export function fuzzySearch(
  bookmarks: Bookmark[],
  query: string,
  maxResults: number = 8
): SearchMatch[] {
  const searchQuery = query.toLowerCase().trim();

  // If query is empty, return empty results
  if (!searchQuery) return [];

  // Split query into words
  const queryWords = searchQuery.split(/\s+/).filter(Boolean);

  // Calculate scores for each bookmark
  const results: SearchMatch[] = bookmarks.map(bookmark => {
    // Try word-based fuzzy matching first
    const wordMatchResult = wordBasedFuzzyMatch(bookmark, queryWords);

    if (wordMatchResult.matched) {
      return {
        item: bookmark,
        score: wordMatchResult.score,
        matchPositions: wordMatchResult.matchPositions
      };
    }

    // Fall back to simple substring matching if word matching failed
    return simpleSubstringMatch(bookmark, searchQuery);
  })
  .filter(match => match.score > 0) // Only keep matches with a score > 0
  .sort((a, b) => b.score - a.score); // Sort by score (descending)

  return results.slice(0, maxResults);
}

/**
 * Performs a word-based fuzzy match on a bookmark
 * @param bookmark Bookmark to match against
 * @param queryWords Array of query words
 * @returns Match result with score and positions
 */
function wordBasedFuzzyMatch(
  bookmark: Bookmark,
  queryWords: string[]
): {
  matched: boolean;
  score: number;
  matchPositions: Array<{
    fieldName: string;
    indices: Array<[number, number]>;
  }>;
} {
  // No query words, no match
  if (queryWords.length === 0) {
    return { matched: false, score: 0, matchPositions: [] };
  }

  // Split bookmark title and URL into words
  const titleWords = bookmark.title.toLowerCase().split(/\s+/).filter(Boolean);
  const urlParts = bookmark.url.toLowerCase().split(/[\/\.\-_=&?]+/).filter(Boolean);

  // Match positions for highlighting
  const matchPositions: Array<{
    fieldName: string;
    indices: Array<[number, number]>;
  }> = [];

  // Try to match each query word with title words
  let titleMatchCount = 0;
  let titleMatchScore = 0;
  const titleMatchedIndices: Array<[number, number]> = [];

  // For each query word, try to find a matching title word
  for (const queryWord of queryWords) {
    // Try to match with title words
    for (let i = 0; i < titleWords.length; i++) {
      const titleWord = titleWords[i];

      // Skip if this title word was already matched
      if (titleMatchedIndices.some(([index]) => index === i)) continue;

      // Check if title word starts with query word
      if (titleWord.startsWith(queryWord)) {
        // Perfect match - title word starts with query word
        titleMatchCount++;

        // Score is higher for exact matches and shorter words
        const matchScore = queryWord.length / titleWord.length;
        titleMatchScore += matchScore * 10; // Prioritize title matches

        // Find position in original title for highlighting
        const titleIndex = bookmark.title.toLowerCase().indexOf(titleWord);
        if (titleIndex !== -1) {
          titleMatchedIndices.push([i, titleIndex]);
        }

        // Move to next query word
        break;
      }
      // Check if query word is an acronym
      else if (queryWord.length <= 3 && titleWord.length >= 3 && titleWord[0] === queryWord[0]) {
        // This might be an acronym match
        let isAcronym = true;
        let matchLength = 1;

        // Check if remaining letters of query word can be found in title word
        for (let j = 1; j < queryWord.length; j++) {
          const letterIndex = titleWord.indexOf(queryWord[j], matchLength);
          if (letterIndex === -1) {
            isAcronym = false;
            break;
          }
          matchLength = letterIndex + 1;
        }

        if (isAcronym) {
          titleMatchCount++;

          // Score is lower for acronym matches
          titleMatchScore += 5;

          // Find position in original title for highlighting
          const titleIndex = bookmark.title.toLowerCase().indexOf(titleWord);
          if (titleIndex !== -1) {
            titleMatchedIndices.push([i, titleIndex]);
          }

          // Move to next query word
          break;
        }
      }
    }
  }

  // Check URL parts if needed
  let urlMatchScore = 0;
  const urlMatchedIndices: Array<[number, number]> = [];

  // Only check URL if we didn't match all query words in title
  if (titleMatchCount < queryWords.length) {
    // Try to match remaining query words with URL parts
    const unmatchedQueryWords = queryWords.slice(titleMatchCount);

    for (const queryWord of unmatchedQueryWords) {
      for (let i = 0; i < urlParts.length; i++) {
        const urlPart = urlParts[i];

        // Skip if this URL part was already matched
        if (urlMatchedIndices.some(([index]) => index === i)) continue;

        if (urlPart.startsWith(queryWord)) {
          // URL word starts with query word
          titleMatchCount++; // Count towards total match count

          // URL matches have lower score than title matches
          const matchScore = queryWord.length / urlPart.length;
          urlMatchScore += matchScore * 5;

          // Find position in original URL for highlighting
          const urlIndex = bookmark.url.toLowerCase().indexOf(urlPart);
          if (urlIndex !== -1) {
            urlMatchedIndices.push([i, urlIndex]);
          }

          break;
        }
      }
    }
  }

  // Calculate final score and determine if it's a match
  const totalScore = titleMatchScore + urlMatchScore;
  const allQueryWordsMatched = titleMatchCount >= queryWords.length;

  // Build match positions for highlighting
  if (titleMatchedIndices.length > 0) {
    // Find positions in original title string
    const titlePositions: Array<[number, number]> = titleMatchedIndices.map(([_, index]) => {
      const titleWord = bookmark.title.toLowerCase().substring(index).split(/\s+/)[0];
      return [index, titleWord.length];
    });

    matchPositions.push({
      fieldName: "title",
      indices: titlePositions
    });
  }

  if (urlMatchedIndices.length > 0) {
    // Find positions in original URL string
    const urlPositions: Array<[number, number]> = urlMatchedIndices.map(([_, index]) => {
      const urlPart = bookmark.url.toLowerCase().substring(index).split(/[\/\.\-_=&?]+/)[0];
      return [index, urlPart.length];
    });

    matchPositions.push({
      fieldName: "url",
      indices: urlPositions
    });
  }

  // We consider it a match if at least half of the query words matched,
  // or if the score is high enough
  const matched = allQueryWordsMatched ||
                 (titleMatchCount >= queryWords.length / 2 && totalScore >= 5);

  return {
    matched,
    score: totalScore,
    matchPositions
  };
}

/**
 * Performs a simple substring match (fallback method)
 * @param bookmark Bookmark to match against
 * @param query Search query
 * @returns Match result with score and positions
 */
function simpleSubstringMatch(bookmark: Bookmark, query: string): SearchMatch {
  const titleIndex = bookmark.title.toLowerCase().indexOf(query);
  const urlIndex = bookmark.url.toLowerCase().indexOf(query);

  const matchPositions: Array<{
    fieldName: string;
    indices: Array<[number, number]>;
  }> = [];

  let score = 0;

  // Add title match
  if (titleIndex !== -1) {
    score += 3; // Base score for title match

    // Bonus for matching at the beginning of the title
    if (titleIndex === 0) score += 2;

    // Bonus for exact word match (surrounded by spaces or at start/end)
    const beforeChar = titleIndex === 0 ? ' ' : bookmark.title[titleIndex - 1];
    const afterChar = titleIndex + query.length >= bookmark.title.length
      ? ' '
      : bookmark.title[titleIndex + query.length];

    if (beforeChar === ' ' && afterChar === ' ') score += 1;

    matchPositions.push({
      fieldName: "title",
      indices: [[titleIndex, query.length]]
    });
  }

  // Add URL match
  if (urlIndex !== -1) {
    score += 1; // Base score for URL match

    // Bonus for domain match
    if (bookmark.url.indexOf('://') + 3 === urlIndex) score += 0.5;

    matchPositions.push({
      fieldName: "url",
      indices: [[urlIndex, query.length]]
    });
  }

  return {
    item: bookmark,
    score,
    matchPositions
  };
}
