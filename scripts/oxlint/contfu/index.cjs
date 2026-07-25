"use strict";

module.exports = {
  meta: {
    name: "contfu",
  },
  rules: {
    ...require("./enum-conventions.cjs"),
    ...require("./app-backend-boundaries.cjs"),
    ...require("./vertical-slices.cjs"),
  },
};
