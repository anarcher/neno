import fs from "fs/promises";
import { constants } from 'fs';
import * as logger from "./lib/logger.js";

const checkDataDirectory = async (directoryPath) => {
  try {
    await fs.access(
      directoryPath,
      constants.R_OK | constants.W_OK,
    );
    logger.info(`Data directory found at ${directoryPath}`);
  } catch (e) {
    logger.warn(
      `No data directory found at ${directoryPath}`,
    );
    logger.info("Creating one...");
    await fs.mkdir(directoryPath, { recursive: true });
  }
};

export default checkDataDirectory;