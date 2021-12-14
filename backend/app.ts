import NoteToTransmit from "../lib/notes/interfaces/NoteToTransmit.js";
import { NoteId } from "../lib/notes/interfaces/NoteId.js";
import Stats from "../lib/notes/interfaces/GraphStats.js";
import { yyyymmdd } from "../lib/utils.js";
import * as config from "./config.js";
import compression from "compression";
import express from "express";
import * as Notes from "../lib/notes/index.js";
import bcrypt from "bcryptjs";
import APIResponse from "./interfaces/APIResponse.js";
import { APIError } from "./interfaces/APIError.js";
import cookieParser from "cookie-parser";
import AppStartOptions from "./interfaces/AppStartOptions.js";
import NoteListPage from "../lib/notes/interfaces/NoteListPage.js";
import FileSystemStorageProvider from "./lib/FileSystemStorageProvider.js";
import http from "http";
import https from "https";
import getUrlMetadata from "./lib/getUrlMetadata.js";
import twofactor from "node-2fa";
import fallback from "express-history-api-fallback";
import * as path from "path";
import session from "express-session";
import User from "./interfaces/User.js";
import { randomUUID } from "crypto";
import FileSessionStore from "./lib/FileSessionStore.js";
import * as logger from "./lib/logger.js";
import { NoteListSortMode } from "../lib/notes/interfaces/NoteListSortMode.js";
import { UserId } from "./interfaces/UserId.js";
import { GraphId } from "./interfaces/GraphId.js";


const startApp = async ({
  users,
  dataPath,
  frontendPath,
  sessionSecret,
  sessionTTL,
  maxUploadFileSize,
  sessionCookieName,
}:AppStartOptions):Promise<Express.Application> => {
  const graphsDirectoryPath = path.join(dataPath, config.GRAPHS_DIRECTORY_NAME);
  const storageProvider = new FileSystemStorageProvider(graphsDirectoryPath);
  logger.info("File system storage ready at " + graphsDirectoryPath);
  logger.info("Session TTL: " + sessionTTL.toString() + " day(s)");
  logger.info(
    "Maximum upload file size: " + maxUploadFileSize.toString() + " byte(s)",
  );
  logger.info("Initializing notes module...");
  await Notes.init(storageProvider, getUrlMetadata, randomUUID);
  logger.info("Initializing routes...")
  const app = express();

  const sessionMiddleware = session({
    secret: sessionSecret,
    saveUninitialized: false,
    cookie: {
      maxAge: sessionTTL * 24 * 60 * 60 * 1000, // days to ms
      path: '/',
      httpOnly: true,
      secure: "auto",
    },
    resave: false,
    name: sessionCookieName,
    unset: "keep",
    store: new (FileSessionStore(session))({
      checkPeriod: 86400000, // prune expired entries every 24h,
      maxNumberOfSessions: 1000,
      filePath: path.join(dataPath, "sessions.json"),
    }),
  });


  const getUserByApiKey = (apiKey:string):User | null => {
    const user = users.find((user) => {
      return user.apiKeys?.includes(apiKey);
    });

    return user ?? null;
  };


  const getGraphIdsForUser = (userId:UserId):GraphId[] => {
    const user = users.find((user) => user.id === userId);
  
    if (!user) {
      throw new Error("Unknown user id");
    }
  
    return user.graphIds;
  }


  const verifyUser = (req, res, next) => {
    if (req.session.userId) {
      // make the user id available in the req object for easier access
      req.userId = req.session.userId;

      // if the user passed a graph id as param, they must have the rights to
      // access it
      if (req.params.graphId) {
        const graphIds = getGraphIdsForUser(req.userId);
        if (!graphIds.includes(req.params.graphId)){
          const response:APIResponse = {
            success: false,
            error: APIError.INVALID_REQUEST,
          };
          return res.status(406).json(response);
        }
      }
      next();

    // if userId has not been set via session, check if api key is present
    } else if (typeof req.headers["x-auth-token"] === "string") {
      const apiKey = req.headers["x-auth-token"];
      const user = getUserByApiKey(apiKey);

      if (user) {
        req.userId = user.id;
        next();
      } else {
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_CREDENTIALS,
        };
        return res.status(401).json(response);
      }
    } else {
      const response:APIResponse = {
        success: false,
        error: APIError.INVALID_CREDENTIALS,
      };
      return res.status(401).json(response);
    }
  };

  //CORS middleware
  const allowCORS = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
      'Access-Control-Allow-Methods',
      'GET, PUT, POST, PATCH, DELETE, OPTIONS',
    );
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, Content-Type, X-Auth-Token',
    );

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    next();
  };

  app.use("/", express.static(frontendPath));
  app.use(compression());
  app.use(cookieParser());
  app.use(allowCORS);


  /* ***************
    Endpoints
  *****************/

  /* ***************
    Endpoints with authentication required
  *****************/

  app.get(
    config.USER_ENDOPINT + "authenticated",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const response:APIResponse = {
        success: true,
        payload: {
          graphIds: getGraphIdsForUser(req.userId),
        },
      };
      res.json(response);
    },
  );


  app.get(
    config.GRAPH_ENDPOINT,
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const graphId = req.params.graphId;
      const withUploads = req.query.withUploads === "true";

      const databaseStream = await Notes.getReadableDatabaseStream(
        graphId,
        withUploads,
      );

      // set the archive name
      const dateSuffix = yyyymmdd(new Date());

      const fileEnding = withUploads ? "zip" : "json";
      const filename = `neno-${graphId}-${dateSuffix}.db.${fileEnding}`;
      res.attachment(filename);

      // this is the streaming magic
      databaseStream.pipe(res);
    },
  );


  app.put(
    config.GRAPH_ENDPOINT,
    sessionMiddleware,
    verifyUser,
    express.json(),
    function(req, res) {
      const graphId = req.params.graphId;
      
      const response:APIResponse = {
        success: false,
      };
    
      try {
        const success = Notes.importDB(req.body, graphId);
        if (!success) throw new Error("INTERNAL_SERVER_ERROR");
        response.success = true;
      } catch(e) {
        response.success = false;
        response.error = APIError.INTERNAL_SERVER_ERROR;
      } finally {
        res.status(response.success ? 200 : 500).json(response);
      }
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "graph-visualization",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const graph = await Notes.getGraphVisualization(req.userId);
      const response:APIResponse = {
        success: true,
        payload: graph,
      };
      res.json(response);
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "stats",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const options = {
        includeMetadata: req.query.includeMetadata === "true",
        includeAnalysis: req.query.includeAnalysis === "true",
      };
      const stats:Stats = await Notes.getStats(req.userId, options);
      const response:APIResponse = {
        success: true,
        payload: stats,
      };
      res.json(response);
    },
  );


  app.post(
    config.GRAPH_ENDPOINT + "graph-visualization",
    sessionMiddleware,
    verifyUser,
    express.json({ limit: "1mb" }), // posting a graph can be somewhat larger
    async function(req, res) {
      const graphId = req.params.graphId;
      try {
        await Notes.setGraphVisualization(req.body, graphId);
        const response:APIResponse = {
          success: true,
        };
        res.json(response);
      } catch (e) {
        const response:APIResponse = {
          success: false,
          error: APIError.INTERNAL_SERVER_ERROR,
        };
        res.json(response);
      }
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "notes",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const graphId = req.params.graphId;
      const searchString = req.query.searchString as (string | undefined) || "";
      const caseSensitive = req.query.caseSensitive === "true";
      const page = typeof req.query.page === "string"
        ? parseInt(req.query.page)
        : 1;
      const sortMode = req.query.sortMode as NoteListSortMode;
      const limit = typeof req.query.limit === "string"
        ? parseInt(req.query.limit)
        : 0;

      const notesListPage:NoteListPage = await Notes.getNotesList(
        graphId,
        {
          searchString,
          caseSensitive,
          page,
          sortMode,
          limit,
        },
      );

      const response:APIResponse = {
        success: true,
        payload: notesListPage,
      };
      res.json(response);
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "note/:noteId",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const noteId:NoteId = parseInt(req.params.noteId);

      try {
        const note:NoteToTransmit = await Notes.get(noteId, req.userId);
        const response:APIResponse = {
          success: true,
          payload: note,
        };
        res.json(response);
      } catch (e) {
        const response:APIResponse = {
          success: false,
          error: e,
        };
        res.json(response);
      }
    },
  );


  app.put(
    config.GRAPH_ENDPOINT + "note",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const reqBody = req.body;

      try {
        const noteToTransmit:NoteToTransmit = await Notes.put(
          reqBody.note,
          req.userId,
          reqBody.options,
        );

        const response:APIResponse = {
          success: true,
          payload: noteToTransmit,
        };
        res.json(response);
      } catch (e) {
        const response:APIResponse = {
          success: false,
          error: e.message,
        };
        res.json(response);
      }
    },
  );


  app.put(
    config.GRAPH_ENDPOINT + "import-links-as-notes",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const reqBody = req.body;
      const links:string[] = reqBody.links;

      const result = await Notes.importLinksAsNotes(req.userId, links);

      const response:APIResponse = {
        payload: result,
        success: true,
      };
      res.json(response);
    },
  );


  app.delete(
    config.GRAPH_ENDPOINT + "note/:noteId",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      try {
        await Notes.remove(parseInt(req.params.noteId), req.userId);
        const response:APIResponse = {
          success: true,
        };
        res.json(response);
      } catch (e) {
        const response:APIResponse = {
          success: false,
          error: e.message,
        };
        res.json(response);
      }
    },
  );


  app.post(
    config.GRAPH_ENDPOINT + "file",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      const sizeString = req.headers["content-length"];

      if (typeof sizeString !== "string") {
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_REQUEST,
        };
        res.status(406).json(response);
        return;
      }

      const size = parseInt(sizeString);

      if (isNaN(size) || size < 1) {
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_REQUEST,
        };
        res.status(406).json(response);
        return;
      }

      if (size > maxUploadFileSize) {
        const response:APIResponse = {
          success: false,
          error: APIError.RESOURCE_EXCEEDS_FILE_SIZE,
        };
        res.status(406).json(response);
        return;
      }

      const mimeType = req.headers["content-type"];

      if (!mimeType) {
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_REQUEST,
        };
        res.status(406).json(response);
        return;
      }

      try {
        logger.debug("Starting file upload. Type: " + mimeType);
        //console.log(req)

        const {fileId, size: transmittedBytes} = await Notes.addFile(
          req.userId,
          req,
          mimeType,
        );

        logger.debug(
          `Expected size: ${size} Transmitted: ${transmittedBytes}`,
        );
        if (size !== transmittedBytes) {
          /* this looks like the request was not completed. we'll remove the
          file */
          logger.debug("Removing file due to incomplete upload");
          await Notes.deleteFile(req.userId, fileId);

          const response:APIResponse = {
            success: false,
            error: APIError.INVALID_REQUEST,
          };
          res.status(406).json(response);
          return;
        }
        const response:APIResponse = {
          success: true,
          payload: {
            fileId,
            size,
          },
        };
        res.json(response);
      } catch (e) {
        logger.debug("Catched an error trying to upload a file:");
        logger.debug(e);
        const response:APIResponse = {
          success: false,
          error: e.message,
        };
        res.status(406).json(response);
      }
    },
  );


  app.post(
    config.GRAPH_ENDPOINT + "file-by-url",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const reqBody = req.body;
      const url = reqBody.url;

      if (!url) {
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_REQUEST,
        };
        res.status(406).json(response);
        return;
      }

      const handleResourceResponse = async (resourceResponse) => {
        const mimeType = resourceResponse.headers['content-type'];
        const size = parseInt(resourceResponse.headers['content-length']);

        if (size > maxUploadFileSize) {
          const response:APIResponse = {
            success: false,
            error: APIError.RESOURCE_EXCEEDS_FILE_SIZE,
          };
          res.status(406).json(response);
          return;
        }

        if (!mimeType) {
          const response:APIResponse = {
            success: false,
            error: APIError.INVALID_REQUEST,
          };
          res.status(406).json(response);
          return;
        }

        try {
          logger.debug("Starting file download. Type: " + mimeType);
          const {fileId, size: transmittedBytes} = await Notes.addFile(
            req.userId,
            resourceResponse,
            mimeType,
          );
          logger.debug(
            `Expected size: ${size} Transmitted: ${transmittedBytes}`,
          );
          if (size !== transmittedBytes) {
            /* this looks like the download was not completed. we'll remove the
            file */
            await Notes.deleteFile(req.userId, fileId);

            const response:APIResponse = {
              success: false,
              error: APIError.INVALID_REQUEST,
            };
            res.status(406).json(response);
            return;
          }

          const response:APIResponse = {
            success: true,
            payload: {
              fileId,
              size,
            },
          };
          res.json(response);
        } catch (e) {
          const response:APIResponse = {
            success: false,
            error: e.message,
          };
          res.status(406).json(response);
        }
      }

      if (url.startsWith("http://")) {
        http
          .get(url, handleResourceResponse)
          // handle possible ECONNRESET errors
          .on("error", (e) => {
            const response:APIResponse = {
              success: false,
              error: e.message as APIError,
            };
            res.status(406).json(response);
          });
      } else if (url.startsWith("https://")) {
        https
          .get(url, handleResourceResponse)
          // handle possible ECONNRESET errors
          .on("error", (e) => {
            const response:APIResponse = {
              success: false,
              error: e.message as APIError,
            };
            res.status(406).json(response);
          });
      } else {
        const response:APIResponse = {
          success: false,
          error: APIError.UNSUPPORTED_URL_SCHEME,
        };
        res.status(406).json(response);
        return;
      }
    },
  );


  app.get(
    // the public name parameter is optionally given but is not used by the API.
    // it's only there for the browser to save/display the file with a custom
    // name with a url like
    // /api/file/ae62787f-4344-4124-8026-3839543fde70.png/my-pic.png
    config.GRAPH_ENDPOINT + "file/:fileId/:publicName*?",
    sessionMiddleware,
    verifyUser,
    async function(req, res) {
      try {

        /** Calculate Size of file */
        const size = await Notes.getFileSize(req.userId, req.params.fileId);
        const range = req.headers.range;

        /** Check for Range header */
        if (range) {
          /** Extracting Start and End value from Range Header */
          const [startString, endString] = range.replace(/bytes=/, "")
            .split("-");

          let start = parseInt(startString, 10);
          let end = endString ? parseInt(endString, 10) : size - 1;

          if (!isNaN(start) && isNaN(end)) {
            // eslint-disable-next-line no-self-assign
            start = start;
            end = size - 1;
          }
          if (isNaN(start) && !isNaN(end)) {
            start = size - end;
            end = size - 1;
          }

          // Handle unavailable range request
          if (start >= size || end >= size) {
            // Return the 416 Range Not Satisfiable.
            res.writeHead(416, {
              "Content-Range": `bytes */${size}`
            });
            return res.end();
          }

          const { readable, mimeType }
            = await Notes.getReadableFileStream(
              req.userId,
              req.params.fileId,
              { start: start, end: end },
            );

          readable.on("error", () => {
            const response:APIResponse = {
              success: false,
              error: APIError.FILE_NOT_FOUND,
            };
            res.json(response);
          });

          /** Sending Partial Content With HTTP Code 206 */
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": mimeType,
          });

          readable.pipe(res);

        } else { // no range request
          const { readable, mimeType }
            = await Notes.getReadableFileStream(req.userId, req.params.fileId);

          readable.on("error", () => {
            const response:APIResponse = {
              success: false,
              error: APIError.FILE_NOT_FOUND,
            };
            res.json(response);
          });

          res.writeHead(200, {
            "Content-Length": size,
            "Content-Type": mimeType
          });

          readable.pipe(res);
        }
      } catch (e) {
        const response:APIResponse = {
          success: false,
          error: e.message,
        };
        res.json(response);
      }
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "url-metadata",
    sessionMiddleware,
    verifyUser,
    async (req, res) => {
      const url = req.query.url;

      try {
        const metadata = await Notes.getUrlMetadata(url as string);
        const response:APIResponse = {
          success: true,
          payload: metadata,
        };
        res.json(response);
      } catch (e) {
        logger.debug("Error while getting URL metadata");
        logger.debug(JSON.stringify(e));
        const response:APIResponse = {
          "success": false,
          "error": e.message,
        };
        res.json(response);
      }
    },
  );


  app.put(
    config.GRAPH_ENDPOINT + "pins",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const reqBody = req.body;
      const noteId = reqBody.noteId;

      const pinnedNotes = await Notes.pin(req.userId, noteId);

      const response:APIResponse = {
        payload: pinnedNotes,
        success: true,
      };
      res.json(response);
    },
  );


  app.delete(
    config.GRAPH_ENDPOINT + "pins",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const reqBody = req.body;
      const noteId = reqBody.noteId;

      const pinnedNotes = await Notes.unpin(req.userId, noteId);

      const response:APIResponse = {
        payload: pinnedNotes,
        success: true,
      };
      res.json(response);
    },
  );


  app.get(
    config.GRAPH_ENDPOINT + "pins",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const pinnedNotes = await Notes.getPins(req.userId);

      const response:APIResponse = {
        payload: pinnedNotes,
        success: true,
      };
      res.json(response);
    },
  );

  app.post(
    config.USER_ENDOPINT + "logout",
    sessionMiddleware,
    verifyUser,
    express.json(),
    async function(req, res) {
      const response:APIResponse = {
        success: true,
      };

      await new Promise((resolve, reject) => {
        req.session.destroy(function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(null);
          }
        })
      })

      return res
        .status(200)
        .clearCookie(
          sessionCookieName,
        )
        .json(response);
    },
  );

  /* ***************
    Endpoints with NO authentication required
  *****************/


  app.get(config.API_PATH, function(req, res) {
    const response:APIResponse = {
      success: true,
      payload: "Hello world!",
    }
    res.json(response);
  });


  app.post(
    config.USER_ENDOPINT + 'login',
    sessionMiddleware,
    express.json(),
    (req, res) => {
      // read username and password from request body
      const submittedUsername = req.body.username;
      const submittedPassword = req.body.password;
      const submittedMfaToken = req.body.mfaToken;

      if (
        (!submittedUsername)
        || (!submittedPassword)
        || (!submittedMfaToken)
      ) {
        // Access denied...
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_CREDENTIALS,
        };
        return res.status(401).json(response);
      }

      const user = users.find((user) => {
        return user.login === submittedUsername;
      });

      if (!user) {
        // Access denied...
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_CREDENTIALS,
        };
        return res.status(401).json(response);
      }

      const mfaTokenIsValid
        = twofactor.verifyToken(
          user.mfaSecret,
          submittedMfaToken,
        )?.delta === 0;

      if (!mfaTokenIsValid) {
        // Access denied...
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_CREDENTIALS,
        };
        return res.status(401).json(response);
      }

      const passwordIsValid
        = bcrypt.compareSync(submittedPassword, user.passwordHash);

      if (!passwordIsValid) {
        // Access denied...
        const response:APIResponse = {
          success: false,
          error: APIError.INVALID_CREDENTIALS,
        };
        return res.status(401).json(response);
      }

      // this modification of the session object initializes the session and
      // makes express-session set the cookie
      req.session.userId = user.login;
      req.session.userAgent = req.headers["user-agent"];
      req.session.userPlatform = req.headers["sec-ch-ua-platform"];

      const response:APIResponse = {
        success: true,
        payload: {
          graphIds: user.graphIds,
        },
      };

      return res.status(200).json(response);
    },
  );


  app.use(
    fallback(
      'index.html',
      {
        root: path.resolve(frontendPath),
      },
    ),
  );

  return app;
};

export default startApp;
