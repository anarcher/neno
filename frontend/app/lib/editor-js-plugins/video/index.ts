/*
@license

MIT License

Copyright (c) 2019 Editor.js

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


import "./index.css";
import * as svgs from "./svgs.js";
import {
  make,
  getFilenameFromUrl,
} from "../utils.js";
import {
  humanFileSize,
} from "../../utils";

const LOADER_TIMEOUT = 500;

/**
 * @typedef {object} VideoToolData
 * @description Video Tool's output data format
 * @property {VideoFileData} file - object containing information about the file
 * @property {string} title - file's title
 */

/**
 * @typedef {object} VideoFileData
 * @description Video Tool's file format
 * @property {string} [url] - file's upload url
 * @property {string} [size] - file's size
 * @property {string} [extension] - file's extension
 * @property {string} [name] - file's name
 */

/**
 * @typedef {object} FileData
 * @description Video Tool's response from backend
 * @property {string} url - file's url
 * @property {string} name - file's name with extension
 * @property {string} extension - file's extension
 */

/**
 * @typedef {object} UploadResponseFormat
 * @description This format expected from backend on file upload
 * @property {number} success  - 1 for successful uploading, 0 for failure
 * @property {FileData} file - backend response with uploaded file data.
 */

/**
 * @typedef {object} VideoToolConfig
 * @description Config supported by Tool
 * @property {string} endpoint - file upload url
 * @property {string} field - field name for uploaded file
 * @property {string} types - available mime-types
 * @property {string} placeholder
 * @property {string} errorMessage
 * - allows to pass custom headers with Request
 */

/**
 * @class VideoTool
 * @classdesc VideoTool for Editor.js 2.0
 *
 * @property {API} api - Editor.js API
 * @property {VideoToolData} data
 * @property {VideoToolConfig} config
 */
export default class VideoTool {
  api;
  nodes;
  _data;
  config;

  /**
   * @param {VideoToolData} data
   * @param {object} config
   * @param {API} api
   */
  constructor({ data, config, api }) {
    this.api = api;

    this.nodes = {
      wrapper: null,
      button: null,
      title: null,
    };

    this._data = {
      file: {},
      title: "",
    };

    this.config = {
      field: "file",
      types: config.types || "*",
      buttonText: "Select video",
      errorMessage: "File upload failed",
      fileHandling: config.fileHandling,
    };

    this.data = data;
  }

  /**
   * Get Tool toolbox settings
   * icon - Tool icon's SVG
   * title - title to show in toolbox
   */
  static get toolbox() {
    return {
      icon: svgs.toolbox,
      title: "Video",
    };
  }

  /**
   * Tool's CSS classes
   */
  get CSS() {
    return {
      baseClass: this.api.styles.block,
      apiButton: this.api.styles.button,
      loader: this.api.styles.loader,
      /**
       * Tool's classes
       */
      wrapper: "cdx-video",
      wrapperWithFile: "cdx-video--with-file",
      wrapperLoading: "cdx-video--loading",
      button: "cdx-video__button",
      title: "cdx-video__title",
      size: "cdx-video__size",
      downloadButton: "cdx-video__download-button",
      fileInfo: "cdx-video__file-info",
      fileIcon: "cdx-video__file-icon",
    };
  }


  /**
   * Specify paste substitutes
   *
   * @see {@link https://github.com/codex-team/editor.js/blob/master/docs/tools.md#paste-handling}
   * @return {{
   *   tags: string[],
   *   patterns: object<string, RegExp>,
   *   files: {extensions: string[], mimeTypes: string[]}
   * }}
   */
  static get pasteConfig() {
    return {
      /**
       * Paste HTML into Editor
       */
      tags: ["video"],

      /**
       * Paste URL of audio into the Editor
       * We have disabled this because we want to be able to insert a
       * url without turning it into an audio block
       */
      /* patterns: {
        audio: /https?:\/\/\S+\.mp4$/i,
      },*/

      /**
       * Drag n drop file from into the Editor
       */
      files: {
        mimeTypes: ["video/mp4", "video/webm"],
        extensions: ["mp4", "webm"],
      },
    };
  }

  /**
   * Specify paste handlers
   *
   * @public
   * @see {@link https://github.com/codex-team/editor.js/blob/master/docs/tools.md#paste-handling}
   * @param {CustomEvent} event - editor.js custom paste event
   *                              {@link https://github.com/codex-team/editor.js/blob/master/types/tools/paste-events.d.ts}
   * @return {void}
   */
  onPaste(event) {
    switch (event.type) {
      case "tag": {
        const video = event.detail.data;
        this.#uploadFileByUrlAndRefreshUI(video.src);
        break;
      }
      case "pattern": {
        const url = event.detail.data;
        this.#uploadFileByUrlAndRefreshUI(url);
        break;
      }
      case "file": {
        const file = event.detail.file;
        this.#uploadFileAndRefreshUI(file);
        break;
      }
    }
  }


  /**
   * Return Block data
   *
   * @param {HTMLElement} toolsContent
   * @return {VideoToolData}
   */
  save(toolsContent) {
    /**
     * If file was uploaded
     */
    if (this.pluginHasData()) {
      const title = toolsContent.querySelector(`.${this.CSS.title}`).innerHTML;

      Object.assign(this.data, { title });
    }

    return this.data;
  }

  /**
   * Renders Block content
   *
   * @return {HTMLDivElement}
   */
  render() {
    const holder = make("div", this.CSS.baseClass);

    this.nodes.wrapper = make("div", [this.CSS.wrapper]);

    if (this.pluginHasData()) {
      this.showFileData();
    } else {
      this.prepareUploadButton();
    }

    holder.appendChild(this.nodes.wrapper);

    return holder;
  }

  /**
   * Prepares button for file uploading
   */
  prepareUploadButton() {
    this.nodes.button = make("div", [this.CSS.apiButton, this.CSS.button]);
    this.nodes.button.innerHTML = this.config.buttonText;
    /*
      editorjs core will automatically click on this button because we assign
      it CSS classes defined by the editorjs core API.
      that is why we need to use an arrow function here because otherwise "this"
      is not this class anymore and the event handler does not work.
    */
    this.nodes.button.addEventListener("click", () => {
      this.#selectAndUploadFile();
    });
    this.nodes.wrapper.appendChild(this.nodes.button);
  }


  async #selectAndUploadFile() {
    // @ts-ignore
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Video file",
          accept: {
            "video/mp4": [".mp4"],
            "video/webm": [".webm"],
          },
        },
      ],
    });

    const file = await fileHandle.getFile();

    this.nodes.wrapper.classList.add(
      this.CSS.wrapperLoading,
      this.CSS.loader,
    );

    await this.#uploadFileAndRefreshUI(file);
  }


  async #uploadFileByUrlAndRefreshUI(url) {
    const result = await this.config.fileHandling.uploadByUrl(url);
    const filename = getFilenameFromUrl(url);
    result.file.name = filename;
    this.#onUploadFinished(result);
  }


  async #uploadFileAndRefreshUI(file) {
    const result = await this.config.fileHandling.uploadByFile(file);
    this.#onUploadFinished(result);
  }

  /**
   * Fires after clicks on the Toolbox VideoTool Icon
   * Initiates click on the Select File button
   *
   * @public
   */
  appendCallback() {
    this.nodes.button.click();
  }

  /**
   * Checks if any of Tool's fields have data
   *
   * @return {boolean}
   */
  pluginHasData() {
    return this.data.title !== ""
      || Object.values(this.data.file).some(
        (item) => typeof item !== "undefined",
      );
  }


  /**
   * File uploading callback
   *
   * @param {UploadResponseFormat} response
   */
  #onUploadFinished(response) {
    if (response.success && response.file) {
      const receivedFileData = response.file || {};
      const filename = receivedFileData.name;
      const extension = filename && filename.split(".").pop();

      this.data = {
        file: {
          ...receivedFileData,
          extension,
        },
        title: filename || "",
      };

      this.nodes.button.remove();
      this.showFileData();
      this.moveCaretToEnd(this.nodes.title);
      this.nodes.title.focus();
      this.removeLoader();
    } else {
      this.uploadingFailed(this.config.errorMessage);
    }
  }


  /**
   * Removes tool's loader
   */
  removeLoader() {
    // eslint-disable-next-line
    setTimeout(() => this.nodes.wrapper.classList.remove(
      this.CSS.wrapperLoading, this.CSS.loader),
    LOADER_TIMEOUT,
    );
  }

  /**
   * If upload is successful, show info about the file
   */
  async showFileData() {
    this.nodes.wrapper.classList.add(this.CSS.wrapperWithFile);

    const { file: { size }, title } = this.data;

    const fileInfo = make("div", [this.CSS.fileInfo]);

    if (title) {
      this.nodes.title = make("div", [this.CSS.title], {
        contentEditable: true,
      });

      this.nodes.title.textContent = title;
      fileInfo.appendChild(this.nodes.title);
    }

    if (size) {
      const fileSize = make("div", [this.CSS.size]);
      fileSize.textContent = humanFileSize(size);
      fileInfo.appendChild(fileSize);
    }

    const downloadIcon = make("a", [this.CSS.downloadButton], {
      innerHTML: svgs.arrowDownload,
    });

    downloadIcon.addEventListener("click", () => {
      this.config.fileHandling.onDownload(this.data.file);
    });

    const firstLine = make("div", ["cdx-video-first-line"]);

    firstLine.appendChild(fileInfo);
    firstLine.appendChild(downloadIcon);

    const secondLine = make("div", ["cdx-video-second-line"]);
    secondLine.setAttribute("data-mutation-free", "true");

    const videoElement = document.createElement("video");
    videoElement.controls = true;
    videoElement.src = await this.config.fileHandling.getUrl(this.data.file);
    videoElement.style.width = "100%";
    videoElement.style.marginTop = "20px";
    // this prevents editor.js from triggering the onChange callback as soon
    // as the audio loads
    videoElement.setAttribute("data-mutation-free", "true");
    secondLine.appendChild(videoElement);

    this.nodes.wrapper.appendChild(firstLine);
    this.nodes.wrapper.appendChild(secondLine);
  }

  /**
   * If file uploading failed, remove loader and show notification
   *
   * @param {string} errorMessage -  error message
   */
  uploadingFailed(errorMessage) {
    console.log(errorMessage);
    this.removeLoader();
  }

  /**
   * Return Video Tool's data
   *
   * @return {VideoToolData}
   */
  get data() {
    return this._data;
  }

  /**
   * Stores all Tool's data
   *
   * @param {VideoToolData} data
   */
  set data({ file, title }) {
    this._data = Object.assign({}, {
      file: {
        url: (file && file.url) || this._data.file.url,
        name: (file && file.name) || this._data.file.name,
        extension: (file && file.extension) || this._data.file.extension,
        size: (file && file.size) || this._data.file.size,
        ...file,
      },
      title: title || this._data.title,
    });
  }

  /**
   * Moves caret to the end of contentEditable element
   *
   * @param {HTMLElement} element - contentEditable element
   */
  moveCaretToEnd(element) {
    // eslint-disable-next-line no-undef
    const range = document.createRange();
    // eslint-disable-next-line no-undef
    const selection = window.getSelection();

    range.selectNodeContents(element);
    range.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}