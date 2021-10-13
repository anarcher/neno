import * as path from "path";
import * as url from "url";

const API_PATH = "/api/";

// in bytes
const MAX_UPLOAD_FILE_SIZE = 524_288_000; // 500 MB

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// since ts files will be compiled to dist/ directory, we need to go two levels
// above to arrive at the repo directory
const REPO_PATH = path.join(__dirname, "..", "..");

// the name of the cookie in which the auth token is stored
const SESSION_COOKIE_NAME = "NENO_token";

export {
  API_PATH,
  MAX_UPLOAD_FILE_SIZE,
  REPO_PATH,
  SESSION_COOKIE_NAME,
}