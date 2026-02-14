import * as v from "valibot";

export const updateCollectionNameSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.pipe(v.string(), v.nonEmpty("Name is required")),
});

export const deleteCollectionSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
});
