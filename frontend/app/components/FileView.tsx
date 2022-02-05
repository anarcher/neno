import React, { useState, useEffect } from "react";
import HeaderContainer from "./HeaderContainer";
import {
  useParams, Link,
} from "react-router-dom";
import NoteListItem from "../../../lib/notes/interfaces/NoteListItem";
import { getAppPath } from "../lib/utils";
import { PathTemplate } from "../enum/PathTemplate";


const FileView = ({
  databaseProvider,
  toggleAppMenu,
}) => {
  const [src, setSrc] = useState<string>("");
  // status can be READY, BUSY
  const [notes, setNotes] = useState<NoteListItem[]>([]);

  const { fileId } = useParams();

  useEffect(() => {
    if (!databaseProvider) return;

    const updateSrc = async () => {
      const src = await databaseProvider.getUrlForFileId(fileId);
      setSrc(src);
    };

    const getNotes = async () => {
      const response = await databaseProvider.getNotes({
        searchString: "has-file:" + fileId,
      });
      setNotes(response.results);
    };

    updateSrc();
    getNotes();
  }, [databaseProvider, fileId]);

  return <>
    <HeaderContainer
      toggleAppMenu={toggleAppMenu}
    />
    <section className="content-section-wide">
      <p><Link to="/files">See all files</Link></p>
      <h1>{fileId}</h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <img
          style={{
            marginRight: "15px auto",
            maxWidth: "95vw",
          }}
          src={src}
          loading="lazy"
        />
      </div>
      <h2>Used in</h2>
      {
        notes.map((note) => {
          return <p key={"notelink-" + note.id}>
            <Link
              to={
                getAppPath(
                  PathTemplate.EDITOR_WITH_NOTE,
                  new Map([["NOTE_ID", note.id.toString()]]),
                )
              }
            >{note.title}</Link>
          </p>;
        })
      }
    </section>
  </>;
};

export default FileView;
