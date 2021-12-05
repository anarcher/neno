import fs from "fs/promises";
import fsClassic from "fs";
import * as path from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import archiver from "archiver";


async function asyncFilter<T>(
  arr:Array<T>,
  callback,
):Promise<Array<T>> {
  const fail: unique symbol = Symbol();

  const values: Array<T | symbol> = await Promise.all(
    arr.map(
      async (item:T) => (await callback(item)) ? item : fail
    ),
  );

  const passedValues:Array<T> = values.filter(
    (val: T | symbol):boolean => {
      return val !== fail;
    },
  ) as Array<T>;

  return passedValues;
}


export default class FileSystemStorageProvider {
  #dataPath;

  constructor(dataPath: string) {
    this.#dataPath = dataPath;
    fsClassic.mkdirSync(path.dirname(dataPath), { recursive: true });
  }

  async writeObject(
    requestPath: string,
    data: string | Buffer,
  ):Promise<void> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, data);
  }

  async writeObjectFromReadable(
    requestPath: string,
    readableStream: Readable,
  ):Promise<number> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    const writableStream = fsClassic.createWriteStream(finalPath);
    readableStream.pipe(writableStream);

    // One important caveat is that if the Readable stream emits an error
    // during processing, the Writable destination is not closed automatically.
    // If an error occurs, it will be necessary to manually close each stream
    // in order to prevent memory leaks.
    // https://nodejs.org/api/stream.html#readablepipedestination-options
    try {
      await finished(readableStream);
    } catch (e) {
      // we must not pass the error event to destroy, because we do not handle
      // it there explicitly
      writableStream.destroy();
      readableStream.destroy();
      await this.removeObject(requestPath);
      throw new Error(
        "Readable stream ended unexpectedly.",
        // @ts-ignore
        {
          cause: e,
        }
      );

    }

    const size = await this.getFileSize(requestPath);
    return size;
  }

  async readObjectAsString(requestPath:string):Promise<string> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    const content = await fs.readFile(finalPath);
    const string = content.toString();
    return string;
  }

  async getReadableStream(requestPath:string, range):Promise<Readable> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    const readableStream = fsClassic.createReadStream(finalPath, range);
    return readableStream;
  }

  async getFileSize(requestPath:string):Promise<number> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    const stats = await fs.stat(finalPath);
    const size = stats.size;
    return size;
  }

  async removeObject(requestPath:string):Promise<void> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    await fs.unlink(finalPath);
  }

  async listSubDirectories(requestPath):Promise<string[]> {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    const filenames:string[] = await fs.readdir(finalPath);
    
    const directories:string[] = await asyncFilter(
      filenames,
      async (objectName:string):Promise<boolean> => {
        const stat = await fs.stat(this.joinPath(finalPath, objectName));
        return stat.isDirectory();
      },
    );

    return directories;
  }

  async listDirectory(requestPath) {
    const finalPath = this.joinPath(this.#dataPath, requestPath);
    const filenames = await fs.readdir(finalPath);
    return filenames;
  }


  getArchiveStreamOfFolder(requestPath) {
    const archive = archiver("zip");
  
    archive.on("error", function(err) {
      throw new Error(err);
    });

    const finalPath = this.joinPath(this.#dataPath, requestPath);
    archive.directory(finalPath, false);
    archive.finalize();
    return archive;
  }

  joinPath(...args) {
    return path.join(...args);
  }


  async getFolderSize(folderPath) {
    const path = this.joinPath(this.#dataPath, folderPath);
    const files = await fs.readdir(path);
    const validFiles = files.filter((file) => !file.startsWith("."));
    const statsPromises = validFiles.map((file) => {
      return fs.stat(this.joinPath(this.#dataPath, folderPath, file));
    });
    const stats = await Promise.all(statsPromises);
    const folderSize =  stats.reduce((accumulator, {size}) => {
      return accumulator + size;
    }, 0 );

    return folderSize;
  }
}