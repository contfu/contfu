import { Select as SelectPrimitive } from "bits-ui";
import Root from "./select.svelte";
import Trigger from "./select-trigger.svelte";
import Content from "./select-content.svelte";
import Item from "./select-item.svelte";
import Group from "./select-group.svelte";
import GroupLabel from "./select-group-label.svelte";

const Portal = SelectPrimitive.Portal;

export {
  Root,
  Root as Select,
  Trigger,
  Trigger as SelectTrigger,
  Content,
  Content as SelectContent,
  Item,
  Item as SelectItem,
  Group,
  Group as SelectGroup,
  GroupLabel,
  GroupLabel as SelectGroupLabel,
  Portal,
  Portal as SelectPortal,
};
