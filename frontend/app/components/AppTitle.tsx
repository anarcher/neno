import React from "react";
import { ASSETS_PATH } from "../config";
import { l } from "../lib/intl";


const AppTitle = ({ toggleAppMenu }) => {
  return <img
    width="40"
    height="40"
    onClick={toggleAppMenu}
    id="heading"
    src={ASSETS_PATH + "app-icon/logo-circle.svg"}
    alt={l("app.menu-button.alt")}
    style={{
      cursor: toggleAppMenu ? "pointer" : "inherit",
    }}
  />;
};

export default AppTitle;
