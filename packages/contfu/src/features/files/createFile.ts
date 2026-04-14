import type { FileData } from "../../infra/types/content-types";
import { db } from "../../infra/db/db";
import { fileToDb } from "../../infra/db/mappers";
import { fileTable } from "../../infra/db/schema";

export function createFile<T extends FileData>(file: T, ctx = db): T {
  ctx.insert(fileTable).values(fileToDb(file)).run();
  return file;
}
