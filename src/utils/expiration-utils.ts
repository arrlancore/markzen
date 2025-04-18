// src/utils/expiration-utils.ts

import { Bookmark } from "../models/bookmark";
import { AppSettings } from "./storage";

/**
 * Check if a bookmark is expired based on app settings
 * @param bookmark The bookmark to check
 * @param settings Application settings with expiration configuration
 * @returns Object containing expiration status and days since last visit
 */
export function checkBookmarkExpiration(
  bookmark: Bookmark,
  settings: AppSettings
): { isExpired: boolean; daysSinceLastVisit: number | null } {
  // If expiration is disabled, bookmark is never expired
  if (settings.bookmarkExpirationDays === "never") {
    return { isExpired: false, daysSinceLastVisit: null };
  }

  // If bookmark has never been visited, check against creation date
  const lastVisitDate = bookmark.lastVisited
    ? new Date(bookmark.lastVisited)
    : bookmark.createdAt
    ? new Date(bookmark.createdAt)
    : null;

  // If we can't determine the date, treat as not expired
  if (!lastVisitDate) {
    return { isExpired: false, daysSinceLastVisit: null };
  }

  // Calculate days since last visit
  const now = new Date();
  const timeDiff = now.getTime() - lastVisitDate.getTime();
  const daysSinceLastVisit = Math.floor(timeDiff / (1000 * 3600 * 24));

  // Check if the bookmark is expired
  const isExpired = daysSinceLastVisit >= settings.bookmarkExpirationDays;

  return { isExpired, daysSinceLastVisit };
}

/**
 * Get a user-friendly description of time since last visit
 * @param days Number of days since last visit
 * @returns Human-readable time description
 */
export function formatTimeSinceLastVisit(days: number | null): string {
  if (days === null) return "Never visited";

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";

  const months = Math.floor(days / 30);
  return `${months} months ago`;
}
