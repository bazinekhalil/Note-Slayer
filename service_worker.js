// Background service worker for context menu & keyboard command
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-selection",
    title: "إضافة إلى Note Slayer",
    contexts: ["selection"]
  });
});

async function saveNoteFromSelection(tabId) {
  try {
    const [{result}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const sel = window.getSelection && String(window.getSelection());
        return { text: sel || "", url: location.href, title: document.title };
      }
    });
    const { text, url, title } = result || {};
    if (!text) return;
    const { notes = [] } = await chrome.storage.local.get(["notes"]);
    const note = {
      id: crypto.randomUUID(),
      title: title || "",
      content: text + "\n\n" + (url ? `🔗 ${url}` : ""),
      tags: [], pinned: false, color: "#071019",
      created: Date.now(), updated: Date.now(), url: url || ""
    };
    notes.push(note);
    await chrome.storage.local.set({ notes });
  } catch(e){ console.error(e); }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "add-selection" && tab?.id) {
    await saveNoteFromSelection(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-selection") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await saveNoteFromSelection(tab.id);
  }
});
