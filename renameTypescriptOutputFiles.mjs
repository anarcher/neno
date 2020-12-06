import fs from "fs";
import path from "path";
import * as url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const distFolder = path.join(__dirname, "dist");

const listDir = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      fileList = listDir(path.join(dir, file), fileList);
    } else {
      if (/\.js$/.test(file)) {
        const newName = file.split(".")[0].replace(/\s/g, "_") + ".mjs";
        const src = path.join(dir, file);
        const newSrc = path.join(dir, newName);
        fileList.push({
          oldSrc: src,
          newSrc: newSrc,
        });
      }
    }
  });

  return fileList;
};

const foundFiles = listDir(distFolder);
console.log(foundFiles);

foundFiles.forEach((f) => {
  fs.renameSync(f.oldSrc, f.newSrc);
});


/*
TODO:
replace
import***.js"
with
import***.mjs"
*/
