import "./svelte-plugin";

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect, mock } from "bun:test";

expect.extend(matchers);

GlobalRegistrator.register();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
Element.prototype.animate = (() => ({ cancel: () => {} })) as any;

void mock.module("$app/environment", () => {
  return {
    dev: true,
    building: false,
    browser: true,
  };
});
