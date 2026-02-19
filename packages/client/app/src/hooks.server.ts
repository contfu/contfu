import { connect } from "contfu";

export function init() {
  if (typeof process !== "undefined" && process.env.CONTFU_API_KEY) {
    void runStream();
  }
}

async function runStream() {
  for await (const _ of connect()) {
    // events are persisted inside connect
  }
}
