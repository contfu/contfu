import { Connection, Page } from "@contfu/client";
import { PageData } from "@contfu/client/src/pages/data/page-data";
import { getLastChangedPage } from "@contfu/client/src/pages/data/page-datasource";
import { DbQuery, iterateDb } from "./notion";
import { ParsedPage, iteratePages } from "./pages";

type NotionConnectionOptions<C extends Record<string, Page>> = Required<
  Pick<Connection, "name" | "key">
> &
  Pick<Connection, "pruneInterval" | "pullInterval"> & {
    collections: CollectionDefs<C>;
  };

type CollectionDefs<C extends Record<string, Page>> = {
  [k in keyof C]: { dbId: string; collect: PageCollector<C[k]> };
};

type PageCollector<P extends Page> = (
  data: ParsedPage<P>
) => Omit<PageData<P>, "id"> | Promise<Omit<PageData<P>, "id>">>;

export class NotionConnection<C extends Record<string, Page>>
  implements Connection
{
  id: number;
  readonly name: string;
  readonly key: string;
  readonly type: "notion";
  readonly pruneInterval?: number;
  readonly pullInterval?: number;
  readonly collections: CollectionDefs<C>;

  constructor(options: NotionConnectionOptions<C>) {
    this.name = options.name;
    this.key = options.key;
    this.pruneInterval = options.pruneInterval;
    this.pullInterval = options.pullInterval;
    this.collections = options.collections;
  }

  async *pullAllRefs() {
    if (!this.pruneInterval) return;
    while (true) {
      const ids: string[] = [];
      for (const collection in this.collections) {
        for await (const { id } of iterateDb(
          this.key,
          this.collections[collection].dbId,
          { filter_properties: ["title"] }
        )) {
          ids.push(id);
        }
      }
      yield ids;
      await Bun.sleep(this.pruneInterval);
    }
  }

  async *pull() {
    do {
      const since = await getSince();
      if (!since) return yield* this._pull();
      yield* this._pull(createdFilter(since));
      yield* this._pull(updatedFilter(since));
      if (this.pullInterval) await Bun.sleep(this.pullInterval * 1000);
    } while (this.pullInterval);
  }

  private async *_pull(filter?: DbQuery["filter"]) {
    for (const collection in this.collections) {
      const { dbId, collect } = this.collections[collection];
      for await (const parsed of iteratePages(this.key, dbId, {
        connection: this.id,
        collection,
        fetchContent: true,
        filter,
      })) {
        const page = await collect(parsed as any);
        yield page;
      }
    }
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

async function getSince(): Promise<number | null> {
  const page = await getLastChangedPage();
  return page?.changedAt ?? null;
}
