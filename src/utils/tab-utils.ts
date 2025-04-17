export function openOrFocusTab(url: string): void {
  chrome.tabs.query({}, (tabs) => {
    const existingTab = tabs.find((tab) => tab.url?.includes(url));
    if (existingTab && existingTab.id) {
      chrome.tabs.update(existingTab.id, { active: true });
    } else {
      chrome.tabs.create({ url });
    }
  });
}
