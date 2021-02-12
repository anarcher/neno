import { merge } from "webpack-merge";
import webpack from "webpack";
import commonConfig from "./webpack.common.js";

const config = {
  mode: "production",
  plugins: [
    new webpack.DefinePlugin({
      "ENABLE_SERVER_DATABASE": JSON.stringify(false),
    }),
  ],
};

export default merge(commonConfig, config);
