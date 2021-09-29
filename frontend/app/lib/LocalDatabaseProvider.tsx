import * as IDB from "idb-keyval";
import FileSystemAccessAPIStorageProvider
  from "./FileSystemAccessAPIStorageProvider.js";


async function verifyPermission(fileHandle, readWrite) {
  const options = {};
  if (readWrite) {
    // @ts-ignore
    options.mode = "readwrite";
  }
  // Check if permission was already granted. If so, return true.
  if ((await fileHandle.queryPermission(options)) === "granted") {
    return true;
  }
  // Request permission. If the user grants permission, return true.
  if ((await fileHandle.requestPermission(options)) === "granted") {
    return true;
  }
  // The user didn't grant permission, so return false.
  return false;
}


export default class LocalDatabaseProvider {
  static #handleStorageKey = "LOCAL_DB_FOLDER_HANDLE";
  #isDatabaseInitialized = false;
  #folderHandle = null;

  /* PUBLIC */

  static features = ["DATABASE_FOLDER"];
  static type = "LOCAL";

  // when we return that we have an access token, the app switches to editor
  // mode and the editor will start fetching data, so we need to be prepared
  // and initialize the database
  async getFolderHandleName() {
    if (this.#folderHandle) {
      //@ts-ignore
      return this.#folderHandle.name;
    }

    const folderHandle = await IDB.get(LocalDatabaseProvider.#handleStorageKey);
    if (typeof folderHandle === "undefined") {
      return null;
    }

    this.#folderHandle = folderHandle;
    //@ts-ignore
    return this.#folderHandle.name;
  }


  /* when using a local db folder, we'll always call this db the same */
  static dbId = "local";

  #notesModule;

  async login(folderHandle) {
    await IDB.set(
      LocalDatabaseProvider.#handleStorageKey,
      folderHandle,
    );

    this.#folderHandle = folderHandle;

    await this.initializeDatabase();
  }


  async getDbId() {
    return LocalDatabaseProvider.dbId;
  }


  async removeAccess() {
    this.#folderHandle = null;
    await IDB.del(LocalDatabaseProvider.#handleStorageKey);

    /*
      When we initialize a local db a 2nd time during runtime, it could be
      another db in another directory. It is important that we then also
      reinitialize the Notes module with an up-to-date storageProvider.
      On removing access, we make sure that we forget about the 1st db
      initialization.
    */
    this.#isDatabaseInitialized = false;
  }


  async initializeDatabase() {
    if (this.#isDatabaseInitialized) {
      return;
    }

    if (!this.#folderHandle) {
      throw new Error(
        "Initializing local DB not possible because folder handle is missing",
      );
    }

    const readWriteAllowed = await verifyPermission(this.#folderHandle, true);

    if (!readWriteAllowed) {
      return false;
    }

    this.#notesModule = await import("../../../lib/notes/index");

    const storageProvider
      = new FileSystemAccessAPIStorageProvider(this.#folderHandle);

    try {
      await this.#notesModule.init(storageProvider);
    } catch (e) {
      console.error(
        "Initializing notes module not possible. "
        + "Removing folder handle because it could be outdated",
      );
      await this.removeAccess();
      throw new Error(e);
    }

    this.#isDatabaseInitialized = true;
  }


  getNote(noteId) {
    return this.#notesModule.get(noteId, LocalDatabaseProvider.dbId);
  }

  getNotes(options) {
    return this.#notesModule.getNotesList(LocalDatabaseProvider.dbId, options);
  }

  getStats(exhaustive) {
    return this.#notesModule.getStats(LocalDatabaseProvider.dbId, exhaustive);
  }

  deleteNote(noteId) {
    return this.#notesModule.remove(noteId, LocalDatabaseProvider.dbId);
  }

  putNote(noteToTransmit, options) {
    return this.#notesModule.put(
      noteToTransmit,
      LocalDatabaseProvider.dbId,
      options,
    );
  }

  importLinksAsNotes(links) {
    return this.#notesModule.importLinksAsNotes(
      LocalDatabaseProvider.dbId,
      links,
    );
  }

  saveGraph(graphObject) {
    return this.#notesModule.setGraph(
      graphObject,
      LocalDatabaseProvider.dbId,
    );
  }

  async getGraph() {
    const graph = await this.#notesModule.getGraph(
      LocalDatabaseProvider.dbId,
    );

    /*
      It's necessary to make the returned object from the notes module
      mutation-resistant, because the graph module would not work correctly
      otherwise: Node dragging would do weird things with INPI.
      So let's serialize and re-parse
    */
    return JSON.parse(JSON.stringify(graph));
  }

  getReadableDatabaseStream(includingImagesAndFiles) {
    return this.#notesModule.getReadableDatabaseStream(
      LocalDatabaseProvider.dbId,
      includingImagesAndFiles,
    );
  }


  uploadFile(file) {
    return this.#notesModule.addFile(
      LocalDatabaseProvider.dbId,
      file.stream(),
      file.type,
    );
  }


  getUrlMetadata(url) {
    return this.#notesModule.getUrlMetadata(url);
  }


  getReadableFileStream(fileId) {
    return this.#notesModule.getReadableFileStream(
      LocalDatabaseProvider.dbId,
      fileId,
    );
  }


  pinNote(noteId) {
    return this.#notesModule.pin(LocalDatabaseProvider.dbId, noteId);
  }

  unpinNote(noteId) {
    return this.#notesModule.unpin(LocalDatabaseProvider.dbId, noteId);
  }

  getPins() {
    return this.#notesModule.getPins(LocalDatabaseProvider.dbId);
  }
}
