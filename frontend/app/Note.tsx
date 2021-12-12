import React, { useEffect, useRef, useState } from "react";
import NoteListItem from "./NoteListItem";
import * as Editor from "./lib/editor";
import NoteStats from "./NoteStats";
import isEqual from "react-fast-compare";
import NoteControls from "./NoteControls";
import useGoToNote from "./hooks/useGoToNote";
import SearchInput from "./SearchInput";
import {
  useNavigate,
} from "react-router-dom";
// import { DatabaseMode } from "./enum/DatabaseMode.js";
import { paths } from "./lib/config";
import NoteListItemType from "../../lib/notes/interfaces/NoteListItem";


const Note = ({
  note,
  setNoteTitle,
  displayedLinkedNotes,
  onLinkAddition,
  onLinkRemoval,
  setUnsavedChanges,
  databaseProvider,
  createNewNote,
  handleNoteSaveRequest,
  removeActiveNote,
  unsavedChanges,
  pinOrUnpinNote,
  duplicateNote,
  openInGraphView,
}) => {
  const previousBlocks = useRef(null);
  const blocks = note?.blocks;
  const goToNote = useGoToNote();
  const [searchString, setSearchString] = useState("");
  const [searchResults, setSearchResults] = useState<NoteListItemType[]>([]);
  const noteTitleElementRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  const handleInvalidCredentialsError = async () => {
    await databaseProvider.removeAccess();
    // setDatabaseMode(DatabaseMode.NONE);
    navigate(paths.login);
  };

  const refreshNotesList = async () => {
    const options = {
      page: 1,
      sortMode: "UPDATE_DATE_DESCENDING",
      searchString,
      caseSensitive: false,
      limit: 10,
    };

    // @ts-ignore randomUUID not yet in types
    // const requestId = crypto.randomUUID();
    // currentRequestId.current = requestId;
    try {
      const {
        results,
      } = await databaseProvider.getNotes(options);

      /*
      // ... some time later - check if this is the current request
      if (currentRequestId.current === requestId) {
        setNoteListItems(results);
        setNumberOfResults(numberOfResults);
        setNoteListIsBusy(false);
      }
      */

      setSearchResults(results);
    } catch (e) {
      // if credentials are invalid, go to LoginView. If not, throw.
      if (e.message === "INVALID_CREDENTIALS") {
        await handleInvalidCredentialsError();
      } else {
        throw new Error(e);
      }
    }
  };

  useEffect(() => {
    if (
      searchString.length === 0
    ) {
      setSearchResults([]);
      return;
    }
    refreshNotesList();
  }, [searchString]);


  useEffect(() => {
    const parent = document.getElementById("editor");
    if (!parent) return;

    if (isEqual(blocks, previousBlocks.current)) {
      return;
    }

    Editor.load({
      data: blocks,
      parent,
      onChange: () => setUnsavedChanges(true),
      databaseProvider,
    })
      .then(() => {
        previousBlocks.current = blocks;
      });

  // it is important that we only perform this effect when the block content
  // changes, because otherwise it is executed more often and editor loading
  // takes some time
  }, [blocks]);

  useEffect(() => {
    if (noteTitleElementRef.current === null) return;
    noteTitleElementRef.current.style.height = "0px";
    noteTitleElementRef.current.style.height
      = (noteTitleElementRef.current.scrollHeight) + "px";
  }, [note.title]);

  return <>
    <NoteControls
      activeNote={note}
      createNewNote={createNewNote}
      handleNoteSaveRequest={handleNoteSaveRequest}
      removeActiveNote={removeActiveNote}
      unsavedChanges={unsavedChanges}
      setUnsavedChanges={setUnsavedChanges}
      pinOrUnpinNote={pinOrUnpinNote}
      duplicateNote={duplicateNote}
      openInGraphView={openInGraphView}
    />
    <section id="note">
      <div id="note-content">
        <textarea
          ref={noteTitleElementRef}
          id="noteTitle"
          onInput={(e) => {
            const element = e.currentTarget;
            setNoteTitle(element.value);
          }}
          value={note.title}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              Editor.focus();
            }
          }}
        />
        <hr/>
        <div id="editor"></div>
        <hr/>
        <div id="links">
          <h2>Linked notes</h2>
          {
            displayedLinkedNotes.length === 0
              ? <p className="note-meta-paragraph"
              >There are no notes linked to this one yet.</p>
              : null
          }
          <div id="links">
            {
              displayedLinkedNotes.map((displayedLinkedNote) => <NoteListItem
                note={displayedLinkedNote}
                key={"note-link-list-item-" + displayedLinkedNote.id}
                onSelect={() => goToNote(displayedLinkedNote.id)}
                isActive={false}
                isLinked={true}
                onLinkChange={() => onLinkRemoval(displayedLinkedNote.id)}
                isLinkable={true}
              />)
            }
          </div>
          <h2>Add links</h2>
          <SearchInput
            value={searchString}
            placeholder="Search notes..."
            onChange={(newValue) => setSearchString(newValue)}
            autoComplete="off"
            inputStyle={{
              width: "100%",
              marginTop: 0,
            }}
          />
          {
            searchResults
              .filter((noteListItem) => {
                return (
                  noteListItem.id !== note.id
                  && !displayedLinkedNotes
                    .map((note) => note.id)
                    .includes(noteListItem.id)
                );
              })
              .map((noteListItem) => {
                return <NoteListItem
                  note={noteListItem}
                  onSelect={() => goToNote(noteListItem.id)}
                  isActive={false}
                  isLinked={false}
                  key={"noteLinkAdditionSearchResult-" + noteListItem.id}
                  onLinkChange={() => onLinkAddition(noteListItem)}
                  isLinkable={true}
                />;
              })
          }
        </div>
        {
          (!note.isUnsaved)
            ? <NoteStats note={note} databaseProvider={databaseProvider} />
            : null
        }
      </div>
    </section>
  </>;
};

export default Note;
