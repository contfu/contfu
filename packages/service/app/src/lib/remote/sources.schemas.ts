import * as v from "valibot";

export const updateSourceNameSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.pipe(v.string(), v.nonEmpty("Name is required")),
});
