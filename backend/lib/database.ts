import path from "path";
import fs from "fs";
import mkdirp from "mkdirp";
import { cloneObject, deepFreeze } from "./utils.js";
import Database from "../interfaces/Database.js";

const DB_FILE_SUFFIX = ".db.json";
let DATA_FOLDER = null;
let UPLOAD_PATH = null;
const loadedDBs = [];


const readJSONFileInDataFolder = (filename) => {
  try {
    const json = fs.readFileSync(path.join(DATA_FOLDER, filename), "utf8");
    const object = JSON.parse(json);
    return object;
  } catch (e) {
    console.log(e);
    console.error("Could not find or parse file " + filename);
    return null;
  }
};

const writeJSONFileInDataFolder = (filename, value) => {
  fs.writeFileSync(
    path.join(DATA_FOLDER, filename),
    JSON.stringify(value),
    "utf8",
  );
};


/**
  EXPORTS
**/

const init = (config) => {
  console.log("Initializing DB module...");
  DATA_FOLDER = config.dataFolderPath;
  UPLOAD_PATH = path.join(DATA_FOLDER, "uploads");
  mkdirp.sync(DATA_FOLDER);
};


const get = (id):Database => {
  const dbFromLoadedDBs:Database = loadedDBs.find((db) => db.id === id);
  if (dbFromLoadedDBs) {
    deepFreeze(dbFromLoadedDBs);
    return dbFromLoadedDBs;
  }

  const dbFromFile:Database = readJSONFileInDataFolder(id + DB_FILE_SUFFIX);
  if (dbFromFile) {
    deepFreeze(dbFromFile);
    loadedDBs.push(dbFromFile);
    return dbFromFile;
  }

  const newDB:Database = {
    timestamp: Date.now(),
    id: id,
    notes: [],
    links: [],
    idCounter: 0,
    screenPosition: {
      translateX: 0,
      translateY: 0,
      scale: 1,
    },
  };
  deepFreeze(newDB);
  writeJSONFileInDataFolder(id + DB_FILE_SUFFIX, newDB);
  return newDB;
};


const set = (db:Database) => {
  db.timestamp = Date.now();
  Object.freeze(db);

  const dbFromLoadedDBsIndex = loadedDBs.findIndex((loadedDB) => {
    return loadedDB.id === db.id;
  });

  if (dbFromLoadedDBsIndex > -1) {
    loadedDBs[dbFromLoadedDBsIndex] = db;
  } else {
    loadedDBs.push(db);
  }

  writeJSONFileInDataFolder(db.id + DB_FILE_SUFFIX, db);
  return true;
};


const forEach = (handler) => {
  return fs.readdirSync(DATA_FOLDER)
    .filter((filename) => {
      return filename.endsWith(DB_FILE_SUFFIX);
    })
    .forEach((filename) => {
      const id = filename.substr(0, filename.indexOf(DB_FILE_SUFFIX));
      const db = get(id);
      const dbCopy = cloneObject(db);
      handler(dbCopy);
      set(dbCopy);
    });
};


const addBlob = (name, sourcePath) => {
  mkdirp.sync(UPLOAD_PATH);
  const newpath = path.join(UPLOAD_PATH, name);
  fs.renameSync(sourcePath, newpath);
};

const deleteBlob = (name) => {
  fs.unlinkSync(path.join(UPLOAD_PATH, name));
};

const getBlob = (name) => {
  return path.join(UPLOAD_PATH, name);
};


const getDBFile = (name) => {
  return path.join(DATA_FOLDER, name + DB_FILE_SUFFIX);
};


export {
  init,
  get,
  set,
  forEach,
  addBlob,
  deleteBlob,
  getBlob,
  getDBFile,
};
