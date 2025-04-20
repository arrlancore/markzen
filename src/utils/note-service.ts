// src/utils/note-service.ts

export interface NoteData {
  content: string;
  lastModified: string;
}

class NoteService {
  private static STORAGE_KEY = "markzen-temp-note";
  private content: string = "";
  private saveTimeoutId: number | null = null;
  private lastSaved: Date = new Date();

  /**
   * Load note content from storage
   */
  async loadNote(): Promise<string> {
    try {
      console.log("Loading note from storage...");
      const data = await this.getNoteData();
      this.content = data?.content || "";
      console.log(`Loaded note with ${this.content.length} characters`);
      return this.content;
    } catch (error) {
      console.error("Error loading note:", error);
      return "";
    }
  }

  /**
   * Save note content to storage with debounce
   * @param content The content to save
   * @param immediate Whether to save immediately or debounce
   */
  saveNote(content: string, immediate: boolean = false): void {
    // Update the content
    this.content = content;

    // Clear any existing timeout
    if (this.saveTimeoutId !== null) {
      window.clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }

    const saveFunction = () => {
      try {
        console.log(`Saving note with ${this.content.length} characters...`);
        const noteData: NoteData = {
          content: this.content,
          lastModified: new Date().toISOString(),
        };

        // Use Chrome storage API
        chrome.storage.local.set(
          { [NoteService.STORAGE_KEY]: noteData },
          () => {
            if (chrome.runtime.lastError) {
              console.error("Chrome storage error:", chrome.runtime.lastError);
            } else {
              console.log("Note saved successfully to storage");
              this.lastSaved = new Date();
            }
          }
        );

        this.saveTimeoutId = null;
      } catch (error) {
        console.error("Error saving note:", error);
      }
    };

    if (immediate) {
      // Save immediately
      saveFunction();
    } else {
      // Debounce save for 500ms
      this.saveTimeoutId = window.setTimeout(saveFunction, 500);
    }
  }

  /**
   * Get raw note data from storage
   */
  private async getNoteData(): Promise<NoteData | undefined> {
    return new Promise((resolve) => {
      chrome.storage.local.get([NoteService.STORAGE_KEY], (result) => {
        resolve(result[NoteService.STORAGE_KEY] as NoteData);
      });
    });
  }

  /**
   * Get the time since last save in seconds
   */
  getTimeSinceLastSave(): number {
    return Math.floor((new Date().getTime() - this.lastSaved.getTime()) / 1000);
  }
}

export const noteService = new NoteService();
export default noteService;
