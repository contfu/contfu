import { db } from "../../infra/db/db";
import { incidentTable } from "../../infra/db/schema";
import { eq, max } from "drizzle-orm";
import { pack, unpack } from "msgpackr";
import { IncidentType, type SchemaIncompatibleDetails } from "@contfu/core";

export interface CreateIncidentInput {
  influxId: number;
  type: IncidentType;
  message: string;
  details?: SchemaIncompatibleDetails | Record<string, unknown>;
}

export interface IncidentResult {
  id: number;
  userId: number;
  influxId: number;
  type: IncidentType;
  message: string;
  details: Record<string, unknown> | null;
  resolved: boolean;
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * Create a new incident for an influx.
 */
export async function createIncident(
  userId: number,
  input: CreateIncidentInput,
): Promise<IncidentResult> {
  // Get next ID for this user
  const [maxIdResult] = await db
    .select({ maxId: max(incidentTable.id) })
    .from(incidentTable)
    .where(eq(incidentTable.userId, userId));

  const nextId = (maxIdResult?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(incidentTable)
    .values({
      id: nextId,
      userId,
      influxId: input.influxId,
      type: input.type,
      message: input.message,
      details: input.details ? pack(input.details) : null,
    })
    .returning();

  return {
    id: inserted.id,
    userId: inserted.userId,
    influxId: inserted.influxId,
    type: Number(inserted.type) as IncidentType,
    message: inserted.message,
    details: inserted.details ? (unpack(inserted.details) as Record<string, unknown>) : null,
    resolved: inserted.resolved,
    createdAt: inserted.createdAt,
    resolvedAt: inserted.resolvedAt,
  };
}
