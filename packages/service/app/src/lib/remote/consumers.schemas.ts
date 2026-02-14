import * as v from "valibot";

export const updateConsumerNameSchema = v.object({
  id: v.pipe(v.number(), v.integer()),
  name: v.pipe(v.string(), v.nonEmpty("Name is required")),
});
