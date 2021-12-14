import { cloneObject, stringContainsUUID } from "../utils.js";
import { FileId } from "./interfaces/FileId.js";
import { Readable } from "stream";
import Graph from "./interfaces/Graph.js";
import ReadableWithMimeType from "./interfaces/ReadableWithMimeType.js";
import * as config from "./config.js";
import { ErrorMessage } from "./interfaces/ErrorMessage.js";
import { GraphId } from "../../backend/interfaces/GraphId.js";
import updateGraphDataStructure from "./updateGraphDataStructure.js";
import cleanUpGraph from "./cleanUpGraph.js";


export default class DatabaseIO {
  #storageProvider;
  #loadedGraphs:Map<GraphId, Graph> = new Map();

  #GRAPH_FILE_NAME = "graph.json";
  #NAME_OF_FILES_SUBDIRECTORY = "files";


  private async readGraphFile(
    graphId: GraphId,
  ):Promise<Graph | null> {
    try {
      const json = await this.#storageProvider.readObjectAsString(
        graphId,
        this.#GRAPH_FILE_NAME,
      );
      const object:Graph = JSON.parse(json);
      return object;
    } catch (e) {
      return null;
    }
  }


  private async writeGraphFile (graphId: GraphId, value) {
    await this.#storageProvider.writeObject(
      graphId,
      this.#GRAPH_FILE_NAME,
      JSON.stringify(value),
    );
  }


  private async createGraph (
    graphId: GraphId,
  ): Promise<Graph> {
    const newGraph:Graph = {
      creationTime: Date.now(),
      updateTime: Date.now(),
      notes: [],
      links: [],
      idCounter: 0,
      screenPosition: {
        translateX: 200, // good value to see INPI completely
        translateY: 200, // good value to see INPI completely
        scale: 1,
      },
      initialNodePosition: {
        x: 0,
        y: 0,
      },
      pinnedNotes: [],
    };
    await this.writeGraphFile(graphId, newGraph);

    return newGraph;
  }


  /**
    PUBLIC
  **/

  constructor(config) {
    this.#storageProvider = config.storageProvider;
  }


  async getGraph(graphId: GraphId):Promise<Graph> {
    // when we are trying to get a graph object, we can try it in 3 ways:

    // Way 1: try to get it from loaded graph objects
    if (this.#loadedGraphs.has(graphId)){
      return this.#loadedGraphs.get(graphId) as Graph;
    }

    // Way 2: try to get it from file
    const graphFromFile:Graph | null
      = await this.readGraphFile(graphId);
    if (graphFromFile) {
      // when we open a graph from file for the first time, let's make sure
      // it has the up-to-date data structure and is cleaned up.
      updateGraphDataStructure(graphFromFile);
      cleanUpGraph(graphFromFile);

      // flushing these changes will also save the graph in memory for
      // faster access the next time
      await this.flushChanges(graphId, graphFromFile);

      // manually saving it in memory is not needed anymore here.
      // this.#loadedGraphs.set(graphId, graphFromFile);
  
      return graphFromFile;
    }

    // Way 3: Create a new graph object and return it
    const newGraph:Graph = await this.createGraph(graphId);
    return newGraph;
  }

  // flushChanges makes sure that the changes applied to the graph object are
  // written to the disk and thus are persistent. it should always be called
  // after any operations on the main data object have been performed.
  async flushChanges (graphId:GraphId, graph:Graph):Promise<boolean> {
    graph.updateTime = Date.now();
    this.#loadedGraphs.set(graphId, graph);
    await this.writeGraphFile(graphId, graph);
    return true;
  }


  async addFile(
    graphId:GraphId,
    fileId:FileId,
    source:Readable,
  ):Promise<number> {
    const filepath = this.#storageProvider.joinPath(
      this.#NAME_OF_FILES_SUBDIRECTORY,
      fileId,
    );
    const size = await this.#storageProvider.writeObjectFromReadable(
      graphId,
      filepath,
      source,
    );
    return size;
  }


  async deleteFile(
    graphId:GraphId,
    fileId:FileId,
  ):Promise<void> {
    await this.#storageProvider.removeObject(
      graphId,
      this.#storageProvider.joinPath(
        this.#NAME_OF_FILES_SUBDIRECTORY,
        fileId,
      ),
    );
  }


  async getReadableGraphStream(
    graphId:GraphId,
    withFiles:boolean,
  ):Promise<Readable> {
    if (!withFiles) {
      const stream = await this.#storageProvider.getReadableStream(
        graphId,
        this.#GRAPH_FILE_NAME,
      );
      return stream;
    }

    return this.#storageProvider.getArchiveStreamOfFolder(graphId, "");
  }


  async getReadableFileStream(
    graphId: GraphId,
    fileId:FileId,
    range,
  ):Promise<ReadableWithMimeType> {
    const filepath = this.#storageProvider.joinPath(
      this.#NAME_OF_FILES_SUBDIRECTORY,
      fileId,
    );

    const stream = await this.#storageProvider.getReadableStream(
      graphId,
      filepath,
      range,
    );

    const fileEnding = fileId.substring(fileId.lastIndexOf(".") + 1)
      .toLocaleLowerCase();

    const fileInfo = config.ALLOWED_FILE_TYPES
      .find((filetype) => {
        return filetype.ending === fileEnding;
      });

    if (!fileInfo) {
      throw Error(ErrorMessage.INVALID_FILE_ENDING);
    }

    const mimeType = fileInfo.mimeType;

    return {
      readable: stream,
      mimeType,
    };
  }


  async getFileSize(
    graphId: GraphId,
    fileId:FileId,
  ):Promise<number> {
    const filepath = this.#storageProvider.joinPath(
      this.#NAME_OF_FILES_SUBDIRECTORY,
      fileId,
    );
    const fileSize
      = await this.#storageProvider.getFileSize(graphId, filepath);

    return fileSize;
  }


  async getSizeOfGraphFiles(
    graphId: GraphId,
  ):Promise<number> {
    // maybe the file folder was not created yet, so let's just try
    try {
      const size = await this.#storageProvider.getFolderSize(
        graphId,
        this.#NAME_OF_FILES_SUBDIRECTORY,
      );
      return size;
    } catch (e) {
      return 0;
    }
  }


  async getSizeOfGraph(
    graphId: GraphId,
  ):Promise<number> {
    const fileSize
      = await this.#storageProvider.getFileSize(graphId, this.#GRAPH_FILE_NAME);

    return fileSize;
  }


  async getSizeOfGraphWithFiles(
    graphId: GraphId,
  ):Promise<number> {
    const sizes = await Promise.all([
      this.getSizeOfGraph(graphId),
      this.getSizeOfGraphFiles(graphId),
    ]);

    return sizes[0] + sizes[1];
  }


  async getNumberOfFiles(
    graphId: GraphId,
  ):Promise<number> {
    // it could be that the directory does not exist yet
    try {
      const directoryListing = await this.#storageProvider.listDirectory(
        graphId,
        this.#NAME_OF_FILES_SUBDIRECTORY,
      )
      // filter out system files
      const files = directoryListing.filter(stringContainsUUID);
      return files.length;
    } catch (e) {
      return 0;
    }
  }
}
