// import all modules dynamically, so that webpack writes them into a separate
// bundles

import "react-tippy/dist/tippy.css";
import {
  BrowserRouter as Router,
} from "react-router-dom";

Promise.all([
  import("react"),
  import("react-dom"),
  import("./App.js"),
])
  .then((modules) => {
    const [
      React,
      ReactDOM,
      App,
    ] = modules.map((module) => module.default);

    const appContainer = document.getElementById("app");
    ReactDOM.render(<Router><App /></Router>, appContainer);
  });
