declare const plugin: () => {
  register(): void;
  bootstrap({ strapi }: { strapi: unknown }): void;
};

export = plugin;
