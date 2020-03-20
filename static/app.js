const editorContainer = document.getElementById("editor");
const newButton = document.getElementById("button_new");
const uploadButton = document.getElementById("button_upload");
const removeButton = document.getElementById("button_remove");
const listContainer = document.getElementById("list");
const spanActiveNoteId = document.getElementById("span_activeNoteId");

const placeholderNoteObject = {
  "time": 1582493003964,
  "blocks": [
    {
      "type": "header",
      "data": {
        "text": "Note title",
        "level": 1,
      },
    },
    {
      "type": "paragraph",
      "data": {
        "text": "Note text",
      },
    },
    {
      "type": "linkTool",
      "data": {
        "link": "",
        "meta": {},
      },
    },
  ],
  "version": "2.16.1",
};

let editor;
let activeNote = null;

const loadEditor = (data) => {
  editor && editor.destroy();

  // eslint-disable-next-line no-undef
  editor = new EditorJS({
    holder: editorContainer,
    data: data || placeholderNoteObject,
    autofocus: true,
    placeholder: "Let's write an awesome note!",
    hideToolbar: false,
    tools: {
      header: {
        // eslint-disable-next-line no-undef
        class: Header,
        placeholder: "Note title",
      },
      linkTool: {
        // eslint-disable-next-line no-undef
        class: LinkTool,
        config: {
          endpoint: "/api/link-data",
        },
      },
    },
  });
};


const loadNote = (noteId) => {
  if (typeof noteId !== "number") {
    activeNote = null;
    spanActiveNoteId.innerHTML = "No ID";
    loadEditor(null);
    removeButton.disabled = true;
    return;
  }

  return fetch("/api/note/" + noteId, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((note) => {
      activeNote = note;
      spanActiveNoteId.innerHTML = activeNote.id;
      loadEditor(note.editorData);
      removeButton.disabled = false;
      refreshNotesList();
    });
};


const createAndAppendNoteListItem = (note) => {
  const listItem = document.createElement("tr");

  if (activeNote && (note.id === activeNote.id)) {
    listItem.classList.add("active");
  }

  const tdId = document.createElement("td");
  tdId.innerHTML = note.id;
  listItem.appendChild(tdId);

  const tdTitle = document.createElement("td");
  tdTitle.innerHTML = note.title;
  listItem.appendChild(tdTitle);

  const tdTime = document.createElement("td");
  tdTime.innerHTML = new Date(note.time).toLocaleString();
  listItem.appendChild(tdTime);

  listContainer.appendChild(listItem);
  listItem.addEventListener("click", () => {
    loadNote(note.id);
  });
};


const createNotesList = (notes) => {
  listContainer.innerHTML = "";
  notes.forEach(createAndAppendNoteListItem);
};


const refreshNotesList = () => {
  return fetch("/api/notes", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((notes) => {
      createNotesList(notes);
    });
};


const saveNote = () => {
  editor.save().then((outputData) => {
    let note = {
      editorData: outputData,
      time: outputData.time,
    };

    if (
      typeof activeNote === "object"
      && activeNote !== null
    ) {
      note = {
        ...activeNote,
        ...note,
      };
    }

    fetch("/api/note", {
      method: "PUT",
      body: JSON.stringify(note),
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        console.log("Note created");
        return response.json();
      })
      .then((responseJSON) => {
        console.log(responseJSON);
        activeNote = responseJSON.note;
        spanActiveNoteId.innerHTML = activeNote.id;
        removeButton.disabled = false;
        return refreshNotesList();
      })
      .catch((error) => {
        console.log("Saving failed: ", error);
      });
  });
};


const removeActiveNote = () => {
  if (activeNote === null) {
    return;
  }

  fetch("/api/note/" + activeNote.id, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      console.log("Note deleted");
      return response.json();
    })
    .then((responseJSON) => {
      console.log(responseJSON);
      loadNote(null);
      return refreshNotesList();
    })
    .catch((error) => {
      console.log("Saving failed: ", error);
    });
};


const init = () => {
  loadEditor(null);
  newButton.addEventListener("click", () => {
    loadNote();
    refreshNotesList();
  });
  uploadButton.addEventListener("click", saveNote);
  removeButton.addEventListener("click", removeActiveNote);
  refreshNotesList();
};

init();


