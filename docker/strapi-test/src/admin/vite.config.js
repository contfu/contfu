import { mergeConfig } from "vite";

export default (config) => {
  return mergeConfig(config, {
    server: {
      allowedHosts: true,
    },
  });
};
