import React, { useEffect, useState } from "react";
import {
  useHistory,
} from "react-router-dom";
import { paths } from "./lib/config.js";
import DatabaseModes from "./enum/DatabaseModes.js";

const LoginViewLocal = ({
  localDatabaseProvider,
  setDatabaseMode,
}) => {
  const [localDisclaimer, setLocalDisclaimer]
    = useState(null);
  const [
    localDatabaseFolderHandleName,
    setLocalDatabaseFolderHandleName,
  ] = useState(null);

  const history = useHistory();

  useEffect(async () => {
    if (!localDatabaseProvider) return;
    const folderHandleName = await localDatabaseProvider.getFolderHandleName();
    setLocalDatabaseFolderHandleName(folderHandleName);
  }, [localDatabaseProvider]);

  return <>
    <h1>Local database</h1>
    {
      localDisclaimer === "INVALID_FOLDER_HANDLE"
        ? <p style={{ color: "red" }}>
          There was a problem accessing the database folder.
          Have you moved or deleted it?
        </p>
        : ""
    }
    {
      typeof localDatabaseFolderHandleName === "string"
        ? <>
          <p>
            You have already created a local database that you can just open.
          </p>
          <button
            type="button"
            className="default-button default-action"
            onClick={async () => {
              try {
                await localDatabaseProvider.initializeDatabase();
                setDatabaseMode(DatabaseModes.LOCAL);
                history.push(paths.editor);
              } catch (e) {
                console.error(e);

                // it could be that the folder is not there anymore but we
                // still have a handle
                setLocalDatabaseFolderHandleName(null);
                setLocalDisclaimer("INVALID_FOLDER_HANDLE");
              }
            }}
          >
            Open database {localDatabaseFolderHandleName}
          </button>
        </>
        : ""
    }
    <p>
      Select a folder to be used as database
      (if no database in that folder exists yet, a new one will be created)
    </p>
    <button
      type="button"
      className="default-button default-action"
      onClick={async () => {
        try {
          const folderHandle = await window.showDirectoryPicker();
          await localDatabaseProvider.login(folderHandle);
          setDatabaseMode(DatabaseModes.LOCAL);
          history.push(paths.editor);
        } catch (e) {
          console.error(e);
        }
      }}
    >
      Select database folder
    </button>
  </>;
};

export default LoginViewLocal;
