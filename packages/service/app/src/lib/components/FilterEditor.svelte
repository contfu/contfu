<script lang="ts">
  // @ts-nocheck
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "@contfu/ui";
  import { FilterOperator, getOperatorsForType, PropertyType, type Filter, type CollectionSchema } from "@contfu/svc-core";
  import X from "@lucide/svelte/icons/x";
  import Plus from "@lucide/svelte/icons/plus";

  interface Props {
    schema: CollectionSchema | null;
    filters: Filter[];
    onchange: (filters: Filter[]) => void;
  }

  let { schema, filters, onchange }: Props = $props();

  const operatorLabels: Record<string, string> = {
    [FilterOperator.EQ]: "equals",
    [FilterOperator.NE]: "not equals",
    [FilterOperator.LT]: "less than",
    [FilterOperator.LTE]: "less than or equal",
    [FilterOperator.GT]: "greater than",
    [FilterOperator.GTE]: "greater than or equal",
    [FilterOperator.CONTAINS]: "contains",
    [FilterOperator.STARTS_WITH]: "starts with",
    [FilterOperator.ENDS_WITH]: "ends with",
    [FilterOperator.IN]: "in",
    [FilterOperator.NOT_IN]: "not in",
    [FilterOperator.IS_NULL]: "is empty",
    [FilterOperator.IS_NOT_NULL]: "is not empty",
  };

  const properties = $derived(
    schema ? Object.entries(schema).map(([name, type]) => ({ name, type })) : []
  );

  function addFilter() {
    if (properties.length === 0) return;
    const first = properties[0];
    const validOps = getOperatorsForType(first.type);
    onchange([...filters, { property: first.name, operator: validOps[0], value: "" }]);
  }

  function removeFilter(index: number) {
    onchange(filters.filter((_, i) => i !== index));
  }

  function updateFilter(index: number, updates: Partial<Filter>) {
    const newFilters = [...filters];
    const current = newFilters[index];
    
    // If property changed, update operator to a valid one for the new type
    if (updates.property && updates.property !== current.property) {
      const newType = schema?.[updates.property] ?? PropertyType.STRING;
      const validOps = getOperatorsForType(newType);
      if (!validOps.includes(current.operator)) {
        updates.operator = validOps[0];
      }
    }
    
    newFilters[index] = { ...current, ...updates };
    onchange(newFilters);
  }

  function getOperatorsForProperty(propertyName: string) {
    const type = schema?.[propertyName] ?? PropertyType.STRING;
    return getOperatorsForType(type);
  }

  function needsValue(operator: string): boolean {
    return operator !== FilterOperator.IS_NULL && operator !== FilterOperator.IS_NOT_NULL;
  }

  function getPropertyTypeName(type: number): string {
    const names: Record<number, string> = {
      [PropertyType.STRING]: "text",
      [PropertyType.STRINGS]: "text list",
      [PropertyType.NUMBER]: "number",
      [PropertyType.NUMBERS]: "number list",
      [PropertyType.BOOLEAN]: "boolean",
      [PropertyType.REF]: "reference",
      [PropertyType.REFS]: "references",
      [PropertyType.FILE]: "file",
      [PropertyType.FILES]: "files",
      [PropertyType.DATE]: "date",
    };
    return names[type] ?? "unknown";
  }
</script>

<div class="space-y-3">
  {#if filters.length === 0}
    <p class="text-sm text-muted-foreground">No filters configured. All items will pass through.</p>
  {/if}

  {#each filters as filter, index}
    <div class="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <!-- Property selector -->
        <div class="min-w-[140px]">
          <Select
            size="sm"
            class="w-full text-sm"
            value={filter.property}
            onchange={(e) => updateFilter(index, { property: e.currentTarget.value })}
            options={properties.map((p) => ({
              value: p.name,
              label: `${p.name} (${getPropertyTypeName(p.type)})`,
            }))}
          />
        </div>

        <!-- Operator selector -->
        <div class="min-w-[140px]">
          <Select
            size="sm"
            class="w-full text-sm"
            value={filter.operator}
            onchange={(e) => updateFilter(index, { operator: e.currentTarget.value as Filter["operator"] })}
            options={getOperatorsForProperty(filter.property).map((op) => ({
              value: op,
              label: operatorLabels[op] ?? op,
            }))}
          />
        </div>

        <!-- Value input -->
        {#if needsValue(filter.operator)}
          <Input
            type="text"
            placeholder="Value"
            value={String(filter.value ?? "")}
            oninput={(e) => updateFilter(index, { value: e.currentTarget.value })}
            class="h-8 min-w-[120px] flex-1 text-sm"
          />
        {/if}
      </div>

      <Button
        variant="ghost"
        size="icon"
        class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onclick={() => removeFilter(index)}
      >
        <X class="h-4 w-4" />
      </Button>
    </div>
  {/each}

  {#if properties.length > 0}
    <Button variant="outline" size="sm" onclick={addFilter} class="gap-1">
      <Plus class="h-4 w-4" />
      Add filter
    </Button>
  {:else}
    <p class="text-sm text-muted-foreground">
      No schema available for this source collection. Filters cannot be configured.
    </p>
  {/if}

  {#if filters.length > 1}
    <p class="text-xs text-muted-foreground">
      Multiple filters are combined with AND logic (all must match).
    </p>
  {/if}
</div>
