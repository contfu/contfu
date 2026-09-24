declare const plugin: () => {
  routes: Record<string, unknown>;
  controllers: Record<string, unknown>;
  register(): void;
  bootstrap({ strapi }: { strapi: unknown }): void;
};

export = plugin;
