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
  #graphsDirectoryPath;

  constructor(graphsDirectoryPath: string) {
    this.#graphsDirectoryPath = graphsDirectoryPath;
    fsClassic.mkdirSync(path.dirname(graphsDirectoryPath), { recursive: true });
  }

  async writeObject(
    graphId: string,
    requestPath: string,
    data: string | Buffer,
  ):Promise<void> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, data);
  }

  async writeObjectFromReadable(
    graphId: string,
    requestPath: string,
    readableStream: Readable,
  ):Promise<number> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
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
      await finished(writableStream);
    } catch (e) {
      // we must not pass the error event to destroy, because we do not handle
      // it there explicitly
      writableStream.destroy();
      readableStream.destroy();
      await this.removeObject(graphId, requestPath);
      throw new Error(
        "Readable stream ended unexpectedly.",
        // @ts-ignore
        {
          cause: e,
        }
      );

    }

    const size = await this.getFileSize(graphId, requestPath);
    return size;
  }

  async readObjectAsString(
    graphId: string,
    requestPath: string,
  ):Promise<string> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    const content = await fs.readFile(finalPath);
    const string = content.toString();
    return string;
  }

  async getReadableStream(
    graphId: string,
    requestPath: string,
    range,
  ):Promise<Readable> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    const readableStream = fsClassic.createReadStream(finalPath, range);
    return readableStream;
  }

  async getFileSize(
    graphId: string,
    requestPath: string,
  ):Promise<number> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    const stats = await fs.stat(finalPath);
    const size = stats.size;
    return size;
  }

  async removeObject(
    graphId: string,
    requestPath: string,
  ):Promise<void> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    await fs.unlink(finalPath);
  }

  async listSubDirectories(
    graphId: string,
    requestPath: string,
  ):Promise<string[]> {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );

    const entries:string[] = await fs.readdir(finalPath);
    
    const directories:string[] = await asyncFilter(
      entries,
      async (objectName:string):Promise<boolean> => {
        const stat = await fs.stat(this.joinPath(finalPath, objectName));
        return stat.isDirectory();
      },
    );

    return directories;
  }

  async listDirectory(
    graphId: string,
    requestPath: string,
  ) {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    const filenames = await fs.readdir(finalPath);
    return filenames;
  }


  getArchiveStreamOfFolder(
    graphId: string,
    requestPath: string,
  ) {
    const archive = archiver("zip");
  
    archive.on("error", function(err) {
      throw new Error(err);
    });

    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    archive.directory(finalPath, false);
    archive.finalize();
    return archive;
  }


  joinPath(...args) {
    return path.join(...args);
  }


  async getFolderSize(
    graphId: string,
    requestPath: string,
  ) {
    const finalPath = this.joinPath(
      this.#graphsDirectoryPath, graphId, requestPath,
    );
    const files = await fs.readdir(finalPath);
    const validFiles = files.filter((file) => !file.startsWith("."));
    const statsPromises = validFiles.map((filename) => {
      const filepath = this.joinPath(
        this.#graphsDirectoryPath, graphId, requestPath, filename,
      );
      return fs.stat(filepath);
    });
    const stats = await Promise.all(statsPromises);
    const folderSize =  stats.reduce((accumulator, {size}) => {
      return accumulator + size;
    }, 0 );

    return folderSize;
  }
}