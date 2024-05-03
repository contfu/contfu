import type { MediaOptimizer, MediaStore } from "@contfu/client";
import { isImg, type Block, type Connection, type Page } from "@contfu/client";
import { FileStore } from "@contfu/client/src/media/file-store";
import type { PageData } from "@contfu/client/src/pages/data/page-data";
import { getLastChangedPage } from "@contfu/client/src/pages/data/page-datasource";
import { iterateDb, type DbQuery } from "./notion";
import { iteratePages, type ParsedPage } from "./pages";

type NotionConnectionOptions<C extends Record<string, Page>> = Pick<
  Connection,
  "name"
> &
  Partial<Pick<Connection, "mediaStore" | "mediaOptimizer">> & {
    key: string;
    pruneInterval?: number;
    pullInterval?: number;
    collections: CollectionDefs<C>;
  };

type CollectionDefs<C extends Record<string, Page>> = {
  [k in keyof C]: {
    dbId: string;
    pullInterval?: number;
    pruneInterval?: number;
    collect: PageCollector<C[k]>;
  };
};

type PageCollector<P extends Page> = (
  data: ParsedPage<P>
) => Omit<PageData<P>, "id"> | Promise<Omit<PageData<P>, "id>">>;

export class NotionConnection<C extends Record<string, Page>>
  implements Connection<keyof C & string>
{
  id!: number;
  readonly name: string;
  readonly key: string;
  readonly mediaStore: MediaStore;
  readonly mediaOptimizer?: MediaOptimizer;
  readonly pruneInterval?: number;
  readonly pullInterval?: number;
  readonly collections: CollectionDefs<C>;

  get collectionNames() {
    return Object.keys(this.collections);
  }

  constructor(options: NotionConnectionOptions<C>) {
    this.name = options.name;
    this.mediaStore = options.mediaStore ?? new FileStore("./media");
    this.mediaOptimizer = options.mediaOptimizer;
    this.key = options.key;
    this.pruneInterval = options.pruneInterval;
    this.pullInterval = options.pullInterval;
    this.collections = options.collections;
  }

  async *pullCollectionRefs(collection: keyof C) {
    const pruneInterval =
      this.collections[collection].pruneInterval ?? this.pruneInterval;
    if (!pruneInterval) return;
    while (true) {
      const ids: string[] = [];
      for await (const { id } of iterateDb(
        this.key,
        this.collections[collection].dbId,
        { filter_properties: ["title"] }
      )) {
        ids.push(id);
      }
      yield ids;
      await Bun.sleep(pruneInterval);
    }
  }

  async *pull(collection: keyof C & string) {
    const pullInterval =
      this.collections[collection].pullInterval ?? this.pullInterval;
    do {
      const since = await this.getSince(collection);
      if (!since) return yield* this._pull(collection);
      yield* this._pull(collection, createdFilter(since));
      yield* this._pull(collection, updatedFilter(since));
      if (pullInterval) await Bun.sleep(pullInterval * 1000);
    } while (pullInterval);
  }

  async fetchAsset(url: string): Promise<ReadableStream> {
    const res = await fetch(url);
    return res.body!;
  }

  private async *_pull(
    collection: keyof C & string,
    filter?: DbQuery["filter"]
  ) {
    const { dbId, collect } = this.collections[collection];
    for await (const parsed of iteratePages(this.key, dbId, {
      connection: this.id,
      collection,
      fetchContent: true,
      filter,
    })) {
      const page = await collect(parsed as any);
      const assets = [
        parsed.props.icon as Block,
        parsed.props.icon as Block,
        ...parsed.content,
      ]
        .filter(isImg)
        .map((block) => {
          const url = block[1];
          return { block, ref: parseS3AssetUrlToCanonical(url), url };
        });
      yield { page, assets: [] as any[] };
    }
  }

  private async getSince(collection: string): Promise<number | null> {
    const page = await getLastChangedPage(this.id, collection);
    return page?.changedAt ?? null;
  }
}

function createdFilter(since: number): DbQuery["filter"] {
  return {
    timestamp: "created_time",
    created_time: { after: new Date(since).toISOString() },
  };
}

function updatedFilter(since: number): DbQuery["filter"] {
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_before: new Date(since).toISOString() },
      },
      {
        timestamp: "last_edited_time",
        last_edited_time: { after: new Date(since).toISOString() },
      },
    ],
  };
}

function parseS3AssetUrlToCanonical(url: string) {
  const match = url.match(/\/([\w-]{36})\/[^\/]+\.(.+)\?/);
  if (!match) throw new Error(`Invalid S3 asset URL: ${url}`);
  const [, id, ext] = match;
  return `${id.replace(/-/g, "")}.${ext}`;
}
