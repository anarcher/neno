// this script is executed each time the popup is opened
/* global chrome */

import {
  getNoteBlocks,
  putNote,
  isAuthenticated,
  getExistingNotesWithThisUrl,
} from "./utils.js";

const mainSection = document.getElementById("section_main");
const addPageButton = document.getElementById("button_addPage");
const serverStatusElement = document.getElementById("server-status");
const controlsContainer = document.getElementById("div_controls");
const noteTitleElement = document.getElementById("input_note-title");
const statusBar = document.getElementById("status-bar");
const existingNotesSection = document.getElementById("section_existing-notes");
const existingNotesContainer = document.getElementById("existing-notes");

const loadAndShowExistingNotesWithThisUrl = async (url, hostUrl, apiKey) => {
  const existingNotesResponse
    = await getExistingNotesWithThisUrl(url, hostUrl, apiKey);
  const existingNotes = existingNotesResponse.payload.results;
  if (existingNotes.length > 0) {
    existingNotes.forEach((note) => {
      const p = document.createElement("p");
      const a = document.createElement("a");
      a.innerHTML = note.title;
      a.href = hostUrl + "/editor/" + note.id;
      a.target = "_blank";
      p.appendChild(a);
      existingNotesContainer.appendChild(p);
    });
  } else {
    existingNotesContainer.innerHTML = "None found.";
  }
  existingNotesSection.style.display = "block";
};

const init = async ({
  apiKey,
  hostUrl,
  activeTab,
}) => {
  addPageButton
    .addEventListener("click", async () => {
      const noteTitle = noteTitleElement.value;

      const noteText
        = document.getElementById("textarea_note-text").value;

      const blocks = getNoteBlocks({
        noteTitle,
        url: activeTab.url,
        pageTitle: activeTab.title,
        noteText,
      });

      const result = await putNote({
        blocks,
        hostUrl,
        apiKey,
      });

      if (result.success) {
        controlsContainer.innerHTML = "Note added. ";
        const a = document.createElement("a");
        a.innerHTML = "Click here to open it in NENO.";
        a.href = hostUrl + "/editor/" + result.payload.id;
        a.target = "_blank";
        controlsContainer.appendChild(a);
      } else {
        serverStatusElement.innerHTML = "Error adding note: " + result.error;
      }
    });

  noteTitleElement.value = activeTab.title;

  const result = await isAuthenticated({
    hostUrl,
    apiKey,
  });

  if (result.success) {
    serverStatusElement.innerHTML
      = "Server ready. User: " + result.payload.dbId;
    statusBar.style.backgroundColor = "green";
  } else {
    serverStatusElement.innerHTML
      = "Authentication error. Please check server and API key. Error: "
      + result.error;
    statusBar.style.backgroundColor = "red";
    addPageButton.disabled = true;
  }

  if (
    activeTab.url.startsWith("chrome://")
    || activeTab.url.startsWith("about:")
  ) {
    mainSection.innerHTML = "This page cannot be added as a note.";
  }

  mainSection.style.display = "block";

  try {
    await loadAndShowExistingNotesWithThisUrl(activeTab.url, hostUrl, apiKey);
  } catch (e) {
    console.log(e);
  }
};


chrome.storage.sync.get(["apiKey", "hostUrl"], ({ apiKey, hostUrl }) => {
  chrome.tabs.query({ active: true, currentWindow: true })
    .then((tabs) => {
      const activeTab = tabs[0];
      init({ apiKey, hostUrl, activeTab });
    });
});

