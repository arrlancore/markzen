// src/utils/theme-service.ts
import storageService from "./storage";

class ThemeService {
  private mediaQuery: MediaQueryList;

  constructor() {
    // Initialize media query for system preference
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Listen for system theme changes
    this.mediaQuery.addEventListener("change", () => {
      this.applyThemeFromSettings();
    });
  }

  /**
   * Apply theme based on saved settings
   */
  async applyThemeFromSettings(): Promise<void> {
    try {
      const settings = await storageService.getSettings();
      const theme = settings?.theme || "system";
      this.applyTheme(theme);
    } catch (error) {
      console.error("Error applying theme:", error);
      // Default to system theme if there's an error
      this.applyTheme("system");
    }
  }

  /**
   * Apply a specific theme
   */
  applyTheme(theme: "light" | "dark" | "system"): void {
    if (theme === "system") {
      // Check system preference
      const isDark = this.mediaQuery.matches;
      document.documentElement.setAttribute(
        "data-theme",
        isDark ? "dark" : "light"
      );
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }
}

// Create singleton instance
const themeService = new ThemeService();
export default themeService;
