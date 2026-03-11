<script lang="ts">
  // @ts-nocheck
  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Command from "$lib/components/ui/command";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import * as Popover from "$lib/components/ui/popover";
  import {
    autoWireMappings,
    FilterOperator,
    getOperatorsForType,
    PropertyType,
    safeCast,
    typeCompatibility,
    type CollectionSchema,
    type Filter,
    type MappingRule,
    type RefTargets,
  } from "@contfu/svc-core";
  import { Select } from "@contfu/ui";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { untrack } from "svelte";

  interface InflowData {
    id: string;
    name: string;
    sourceSchema: CollectionSchema | null;
    mappings: MappingRule[];
    filters?: Filter[];
  }

  interface Props {
    readonly?: boolean;
    targetSchema: CollectionSchema;
    refTargets?: RefTargets;
    availableCollections?: { name: string; displayName: string }[];
    inflows: InflowData[];
    onchange: (changes: {
      targetSchema: CollectionSchema;
      inflowMappings: Map<string, MappingRule[]>;
      inflowFilters: Map<string, Filter[]>;
      refTargets: RefTargets;
    }) => void;
  }

  const operatorLabels: Record<number, string> = {
    [FilterOperator.EQ]: "equals",
    [FilterOperator.NE]: "not equals",
    [FilterOperator.LT]: "<",
    [FilterOperator.LTE]: "<=",
    [FilterOperator.GT]: ">",
    [FilterOperator.GTE]: ">=",
    [FilterOperator.CONTAINS]: "contains",
    [FilterOperator.STARTS_WITH]: "starts with",
    [FilterOperator.ENDS_WITH]: "ends with",
    [FilterOperator.IN]: "in",
    [FilterOperator.NOT_IN]: "not in",
    [FilterOperator.IS_NULL]: "is null",
    [FilterOperator.IS_NOT_NULL]: "is not null",
  };

  let { readonly = false, targetSchema, refTargets, availableCollections, inflows, onchange }: Props = $props();

  // Local mutable state
  let localSchema = $state<CollectionSchema>({ ...targetSchema });
  let localRefTargets = $state<RefTargets>({ ...refTargets });
  let localMappings = $state<Map<string, MappingRule[]>>(new Map());
  let localFilters = $state<Map<string, Filter[]>>(new Map());
  let openItems = $state<string[]>([]);
  let verifiedMappings = $state<Set<string>>(new Set());

  // Effects don't run during SSR — suppress warnings until mount
  let initialized = $state(false);
  $effect(() => { initialized = true; });

  /** Reset internal state back to current props (used by cancel). */
  export function reset() {
    localSchema = { ...targetSchema };
    localRefTargets = { ...refTargets };
    localMappings = new Map();
    localFilters = new Map();
    verifiedMappings = new Set();
    knownIds = new Set();
    syncInflows(inflows);
    emitChange();
  }

  /** Called by parent after a successful save to clear all warnings. */
  export function resolveAll() {
    for (const [name] of targetProperties) {
      for (const inflow of inflows) {
        verifiedMappings.add(mappingKey(inflow.id, name));
      }
    }
  }

  /** Compute initial mappings for a new inflow. */
  function autoWireInflow(inflow: InflowData): MappingRule[] {
    if (inflow.mappings.length > 0) return [...inflow.mappings];
    if (!inflow.sourceSchema) return [];
    if (Object.keys(localSchema).length === 0) {
      return Object.keys(inflow.sourceSchema).map((k) => ({ source: k, target: k }));
    }
    return autoWireMappings(localSchema, inflow.sourceSchema);
  }

  // Shared sync logic — processes inflows and updates local state.
  // Called both synchronously (init) and from $effect (prop changes).
  let knownIds = new Set<string>();
  function syncInflows(current: InflowData[]) {
    const currentIds = new Set(current.filter((i) => i.id).map((i) => i.id));

    // All removed → reset
    if (current.length === 0 && knownIds.size > 0) {
      localSchema = { ...targetSchema };
      localMappings = new Map();
      localFilters = new Map();
      verifiedMappings = new Set();
      knownIds = currentIds;
      emitChange();
      return;
    }

    // Sync schema from prop on first load
    if (knownIds.size === 0 && Object.keys(targetSchema).length > 0) {
      localSchema = { ...targetSchema };
    }

    // Process inflows, build updated maps
    const m = new Map(localMappings);
    const f = new Map(localFilters);
    let schemaChanged = false;
    for (const inflow of current) {
      if (!inflow.id) continue;
      const isNew = !knownIds.has(inflow.id);
      const existingRules = m.get(inflow.id);
      const hasEmptyLocal = !existingRules || existingRules.length === 0;

      // Skip known inflows that already have local mappings
      if (!isNew && !hasEmptyLocal) continue;

      // Re-process known inflows when prop data improves
      // (sourceSchema became available, or server now returns saved mappings)
      if (!isNew && hasEmptyLocal) {
        if (inflow.mappings.length === 0 && !inflow.sourceSchema) continue;
      }

      // First inflow with empty schema → seed from source
      if (inflow.mappings.length === 0 && inflow.sourceSchema && Object.keys(localSchema).length === 0) {
        localSchema = { ...inflow.sourceSchema };
        schemaChanged = true;
      }
      m.set(inflow.id, autoWireInflow(inflow));
      // Auto-resolve warnings for server-loaded inflows
      if (inflow.mappings.length > 0) {
        for (const p of Object.keys(localSchema)) verifiedMappings.add(mappingKey(inflow.id, p));
      }

      // Seed filters from props on first load (don't overwrite local edits)
      if (isNew && inflow.filters && inflow.filters.length > 0 && !f.has(inflow.id)) {
        f.set(inflow.id, [...inflow.filters]);
      }
    }
    // Remove departed inflows
    for (const id of knownIds) {
      if (!currentIds.has(id)) {
        m.delete(id);
        f.delete(id);
      }
    }

    localMappings = m;
    localFilters = f;
    knownIds = currentIds;
    if (schemaChanged) emitChange();
  }

  // Initialize synchronously so SSR and client initial render match.
  // Without this, $effect.pre only runs on the client, causing SSR to render
  // empty mapping rows while the client renders populated ones → hydration_mismatch.
  syncInflows(inflows);

  // Sync local state BEFORE the DOM updates so that Select components
  // render with the correct value on their very first paint.
  // Using $effect.pre (not $effect) is critical: $effect runs after DOM
  // updates, which means Selects would be created with value="" and then
  // bind:value locks that in. $effect.pre runs before the DOM update.
  // The second call to syncInflows (via $effect.pre on first render) is a
  // no-op because syncInflows checks !isNew && !hasEmptyLocal.
  $effect.pre(() => {
    const current = inflows;
    untrack(() => syncInflows(current));
  });

  const targetTypeOptions = [
    { value: String(PropertyType.STRING), label: "text" },
    { value: String(PropertyType.STRINGS), label: "texts" },
    { value: String(PropertyType.NUMBER), label: "number" },
    { value: String(PropertyType.NUMBERS), label: "numbers" },
    { value: String(PropertyType.BOOLEAN), label: "bool" },
    { value: String(PropertyType.REF), label: "ref" },
    { value: String(PropertyType.REFS), label: "refs" },
    { value: String(PropertyType.FILE), label: "file" },
    { value: String(PropertyType.FILES), label: "files" },
    { value: String(PropertyType.DATE), label: "date" },
  ];

  const targetProperties = $derived(Object.entries(localSchema));

  // Collect all source property names across inflows that aren't already target properties
  const unmappedSourceProps = $derived(() => {
    const targetNames = new Set(Object.keys(localSchema));
    const sourceNames = new Set<string>();
    for (const inflow of inflows) {
      if (inflow.sourceSchema) {
        for (const key of Object.keys(inflow.sourceSchema)) {
          if (!targetNames.has(key)) {
            sourceNames.add(key);
          }
        }
      }
    }
    return [...sourceNames].sort();
  });

  // Add property combobox state
  let addPropertyOpen = $state(false);
  let addPropertySearch = $state("");

  function getTypeName(bitmask: number): string {
    const names: string[] = [];
    if (bitmask & PropertyType.STRING) names.push("text");
    if (bitmask & PropertyType.STRINGS) names.push("texts");
    if (bitmask & PropertyType.NUMBER) names.push("number");
    if (bitmask & PropertyType.NUMBERS) names.push("numbers");
    if (bitmask & PropertyType.BOOLEAN) names.push("bool");
    if (bitmask & PropertyType.REF) names.push("ref");
    if (bitmask & PropertyType.REFS) names.push("refs");
    if (bitmask & PropertyType.FILE) names.push("file");
    if (bitmask & PropertyType.FILES) names.push("files");
    if (bitmask & PropertyType.DATE) names.push("date");
    if (bitmask & PropertyType.NULL) names.push("null");
    return names.length > 0 ? names.join(" | ") : "unknown";
  }

  function getMappingForProperty(
    inflowId: string,
    targetProp: string,
  ): MappingRule | undefined {
    let rules = localMappings.get(inflowId);
    // Fallback: if localMappings hasn't been populated yet (effect hasn't run),
    // use the inflow's own mappings prop so Selects render with correct values.
    if (!rules) {
      const inflow = inflows.find((i) => i.id === inflowId);
      rules = inflow?.mappings ?? [];
    }
    return rules.find((r) => (r.target ?? r.source) === targetProp);
  }

  function getSourcePropForInflow(
    inflowId: string,
    targetProp: string,
  ): string {
    const rule = getMappingForProperty(inflowId, targetProp);
    return rule?.source ?? "";
  }

  function getDefaultForInflow(inflowId: string, targetProp: string): string {
    const rule = getMappingForProperty(inflowId, targetProp);
    return rule?.default !== undefined ? String(rule.default) : "";
  }

  function isGuessed(inflowId: string, targetProp: string): boolean {
    return getMappingForProperty(inflowId, targetProp)?.guessed === true;
  }

  function isUnmapped(inflowId: string, targetProp: string): boolean {
    return getSourcePropForInflow(inflowId, targetProp) === "";
  }

  /** True if any inflow has no source mapping and no default for this property. */
  function isNullable(propName: string): boolean {
    if (inflows.length === 0) return false;
    return inflows.some(
      (inflow) =>
        isUnmapped(inflow.id, propName) &&
        getDefaultForInflow(inflow.id, propName) === "",
    );
  }

  function mappingKey(inflowId: string, propName: string): string {
    return `${inflowId}:${propName}`;
  }

  /** True if this specific inflow+property has a warning and hasn't been verified. */
  function hasMappingWarning(inflowId: string, propName: string): boolean {
    if (!initialized) return false;
    if (verifiedMappings.has(mappingKey(inflowId, propName))) return false;
    return isGuessed(inflowId, propName) || isUnmapped(inflowId, propName);
  }

  /** True if any inflow has an unverified warning for this property. */
  function hasWarnings(propName: string): boolean {
    return inflows.some((inflow) => hasMappingWarning(inflow.id, propName));
  }

  export function verifyMapping(inflowId: string, propName: string) {
    const rules = [...(localMappings.get(inflowId) ?? [])];
    const idx = rules.findIndex((r) => (r.target ?? r.source) === propName);
    if (idx >= 0 && rules[idx].guessed) {
      const { guessed: _, ...rest } = rules[idx];
      rules[idx] = rest as MappingRule;
      localMappings = new Map(localMappings).set(inflowId, rules);
      emitChange();
    }
    // Still add to verifiedMappings to clear any "no match found" warnings
    verifiedMappings = new Set([...verifiedMappings, mappingKey(inflowId, propName)]);
  }

  // ---------------------------------------------------------------------------
  // Default value validation
  // ---------------------------------------------------------------------------

  let validationErrors = $state<Map<string, string>>(new Map());

  function validationKey(inflowId: string, propName: string): string {
    return `${inflowId}:${propName}:default`;
  }

  function validateDefault(value: string, targetType: number): string | null {
    if (value === "") return null;
    if (targetType & PropertyType.NUMBER || targetType & PropertyType.NUMBERS) {
      if (Number.isNaN(Number(value))) return "Must be a valid number";
    }
    if (targetType === PropertyType.BOOLEAN) {
      if (!["true", "false", "1", "0"].includes(value)) return 'Must be "true" or "false"';
    }
    if (targetType === PropertyType.DATE) {
      if (Number.isNaN(new Date(value).getTime())) return "Must be a valid date";
    }
    return null;
  }

  function getValidationError(inflowId: string, propName: string): string | null {
    return validationErrors.get(validationKey(inflowId, propName)) ?? null;
  }

  function updateValidation(inflowId: string, propName: string, value: string) {
    const targetType = localSchema[propName] || 0;
    const error = validateDefault(value, targetType);
    const key = validationKey(inflowId, propName);
    const next = new Map(validationErrors);
    if (error) {
      next.set(key, error);
    } else {
      next.delete(key);
    }
    validationErrors = next;
  }

  /** Returns true if any default value has a validation error. */
  export function hasValidationErrors(): boolean {
    return validationErrors.size > 0;
  }

  function emitChange() {
    // Deep-clone to detach from reactive proxies so the snapshot
    // remains stable even if local state changes later.
    const snap = $state.snapshot(localMappings);
    const filterSnap = $state.snapshot(localFilters);
    onchange({
      targetSchema: { ...localSchema },
      inflowMappings: snap,
      inflowFilters: filterSnap,
      refTargets: { ...localRefTargets },
    });
  }

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------

  function getFiltersForInflow(inflowId: string): Filter[] {
    return localFilters.get(inflowId) ?? [];
  }

  function addFilter(inflowId: string) {
    const inflow = inflows.find((i) => i.id === inflowId);
    const firstProp = inflow?.sourceSchema ? Object.keys(inflow.sourceSchema)[0] : "";
    const propType = firstProp && inflow?.sourceSchema ? inflow.sourceSchema[firstProp] : 0;
    const ops = getOperatorsForType(propType);
    const filter: Filter = { property: firstProp, operator: ops[0] ?? FilterOperator.EQ };
    localFilters = new Map(localFilters).set(inflowId, [...getFiltersForInflow(inflowId), filter]);
    emitChange();
  }

  function updateFilter(inflowId: string, index: number, patch: Partial<Filter>) {
    const filters = [...getFiltersForInflow(inflowId)];
    filters[index] = { ...filters[index], ...patch };
    // Remove value when operator doesn't need it
    if (
      patch.operator === FilterOperator.IS_NULL ||
      patch.operator === FilterOperator.IS_NOT_NULL
    ) {
      delete filters[index].value;
    }
    localFilters = new Map(localFilters).set(inflowId, filters);
    emitChange();
  }

  function removeFilter(inflowId: string, index: number) {
    const filters = getFiltersForInflow(inflowId).filter((_, i) => i !== index);
    localFilters = new Map(localFilters).set(inflowId, filters);
    emitChange();
  }

  function operatorOptions(inflowId: string, propName: string) {
    const inflow = inflows.find((i) => i.id === inflowId);
    const propType = propName && inflow?.sourceSchema ? (inflow.sourceSchema[propName] ?? 0) : 0;
    return getOperatorsForType(propType).map((op) => ({ value: String(op), label: operatorLabels[op] ?? String(op) }));
  }

  function needsValue(operator: number): boolean {
    return operator !== FilterOperator.IS_NULL && operator !== FilterOperator.IS_NOT_NULL;
  }

  function setSourceProp(
    inflowId: string,
    targetProp: string,
    sourceProp: string,
  ) {
    const rules = [...(localMappings.get(inflowId) ?? [])];
    const idx = rules.findIndex((r) => (r.target ?? r.source) === targetProp);
    if (sourceProp === "") {
      // Remove mapping
      if (idx >= 0) rules.splice(idx, 1);
    } else {
      // User explicitly set source → auto-derive cast from types
      const inflow = inflows.find((i) => i.id === inflowId);
      const sourceType = inflow?.sourceSchema?.[sourceProp];
      const targetType = localSchema[targetProp];
      const cast =
        sourceType !== undefined && targetType !== undefined
          ? (safeCast(sourceType, targetType) ?? undefined)
          : undefined;
      const rule: MappingRule = {
        source: sourceProp,
        target: targetProp,
        cast,
      };
      if (idx >= 0) {
        rule.default = rules[idx].default;
        rules[idx] = rule;
      } else {
        rules.push(rule);
      }
    }
    localMappings = new Map(localMappings).set(inflowId, rules);
    emitChange();
  }

  export function setTargetType(propName: string, newType: number) {
    localSchema = { ...localSchema, [propName]: newType };
    // Clear ref targets when type is no longer REF/REFS
    if (!isRefType(newType) && propName in localRefTargets) {
      const { [propName]: _, ...rest } = localRefTargets;
      localRefTargets = rest;
    }
    // Auto-derive casts for all inflow mappings on this property
    for (const inflow of inflows) {
      const rules = [...(localMappings.get(inflow.id) ?? [])];
      const idx = rules.findIndex((r) => (r.target ?? r.source) === propName);
      if (idx >= 0 && inflow.sourceSchema) {
        const sourceType = inflow.sourceSchema[rules[idx].source];
        if (sourceType !== undefined) {
          const cast = safeCast(sourceType, newType);
          rules[idx] = { ...rules[idx], cast: cast ?? undefined };
          localMappings = new Map(localMappings).set(inflow.id, rules);
        }
      }
    }
    emitChange();
  }

  function getAutoCast(inflowId: string, targetProp: string): string | null {
    const rule = getMappingForProperty(inflowId, targetProp);
    if (!rule) return null;
    const inflow = inflows.find((i) => i.id === inflowId);
    if (!inflow?.sourceSchema) return null;
    const sourceType = inflow.sourceSchema[rule.source];
    if (sourceType === undefined) return null;
    const targetType = localSchema[targetProp];
    if (targetType === undefined) return null;
    return safeCast(sourceType, targetType);
  }

  function setDefault(
    inflowId: string,
    targetProp: string,
    defaultVal: string,
  ) {
    const rules = [...(localMappings.get(inflowId) ?? [])];
    const idx = rules.findIndex((r) => (r.target ?? r.source) === targetProp);
    if (idx >= 0) {
      rules[idx] = { ...rules[idx], default: defaultVal || undefined };
    } else {
      // Create a rule with no source mapping, just a default value
      rules.push({
        source: "",
        target: targetProp,
        default: defaultVal || undefined,
      });
    }
    localMappings = new Map(localMappings).set(inflowId, rules);
    updateValidation(inflowId, targetProp, defaultVal);
    emitChange();
  }

  export function addPropertyByName(name: string) {
    if (!name || name in localSchema) return;

    // Derive type from source schemas
    let type = 0;
    for (const inflow of inflows) {
      if (inflow.sourceSchema?.[name] !== undefined) {
        type |= inflow.sourceSchema[name];
      }
    }

    localSchema = { ...localSchema, [name]: type || PropertyType.STRING };

    // Auto-fill bindings for each inflow
    for (const inflow of inflows) {
      if (!inflow.sourceSchema) continue;
      const rules = [...(localMappings.get(inflow.id) ?? [])];
      // Check exact match
      if (name in inflow.sourceSchema) {
        rules.push({ source: name, target: name });
        localMappings = new Map(localMappings).set(inflow.id, rules);
      } else {
        // Try auto-wire for just this property
        const miniTarget: CollectionSchema = { [name]: localSchema[name] };
        const wired = autoWireMappings(miniTarget, inflow.sourceSchema);
        if (wired.length > 0) {
          rules.push(wired[0]);
          localMappings = new Map(localMappings).set(inflow.id, rules);
        }
      }
    }

    addPropertyOpen = false;
    addPropertySearch = "";
    emitChange();
  }

  function setRefTargets(propName: string, targets: string[]) {
    if (targets.length === 0) {
      const { [propName]: _, ...rest } = localRefTargets;
      localRefTargets = rest;
    } else {
      localRefTargets = { ...localRefTargets, [propName]: targets };
    }
    emitChange();
  }

  function isRefType(type: number): boolean {
    return type === PropertyType.REF || type === PropertyType.REFS;
  }

  export function removeProperty(name: string) {
    const { [name]: _, ...rest } = localSchema;
    localSchema = rest;
    const { [name]: _rt, ...restRt } = localRefTargets;
    localRefTargets = restRt;
    // Also remove from all inflow mappings
    for (const [inflowId, rules] of localMappings) {
      const filtered = rules.filter((r) => (r.target ?? r.source) !== name);
      localMappings = new Map(localMappings).set(inflowId, filtered);
    }
    emitChange();
  }

  export function renameProperty(oldName: string, newName: string) {
    if (newName === oldName || !newName || newName in localSchema) return;
    const entries = Object.entries(localSchema);
    const newSchema: CollectionSchema = {};
    for (const [k, v] of entries) {
      newSchema[k === oldName ? newName : k] = v;
    }
    localSchema = newSchema;
    if (oldName in localRefTargets) {
      const { [oldName]: targets, ...rest } = localRefTargets;
      localRefTargets = { ...rest, [newName]: targets };
    }
    // Update mappings target references
    for (const [inflowId, rules] of localMappings) {
      localMappings = new Map(localMappings).set(inflowId, rules.map((r) =>
        (r.target ?? r.source) === oldName ? { ...r, target: newName } : r,
      ));
    }
    // Carry over verified state
    for (const key of [...verifiedMappings]) {
      const [iid, prop] = key.split(":");
      if (prop === oldName) {
        verifiedMappings.delete(key);
        verifiedMappings.add(mappingKey(iid, newName));
      }
    }
    emitChange();
  }
</script>

<div class="space-y-3">
  <!-- Filters section per inflow -->
  {#if inflows.length > 0}
    <div class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Filters</p>
      {#each inflows as inflow (inflow.id)}
        {@const filters = getFiltersForInflow(inflow.id)}
        <div class="rounded-md border border-border p-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">{inflow.name}</span>
            {#if !readonly}
              <Button variant="ghost" size="sm" class="h-6 gap-1 px-2 text-xs" onclick={() => addFilter(inflow.id)}>
                <Plus class="h-3 w-3" />
                Add filter
              </Button>
            {/if}
          </div>
          {#if filters.length === 0}
            <p class="text-xs text-muted-foreground">No filters — all items pass through.</p>
          {:else}
            <div class="space-y-1.5">
              {#each filters as filter, idx}
                <div class="flex flex-wrap items-center gap-1.5">
                  <Select
                    size="sm"
                    class="min-w-[120px] flex-1 text-xs"
                    value={filter.property}
                    onchange={(e) => updateFilter(inflow.id, idx, { property: e.currentTarget.value })}
                    options={inflow.sourceSchema ? Object.keys(inflow.sourceSchema).map((k) => ({ value: k, label: k })) : []}
                    disabled={readonly}
                  />
                  <Select
                    size="sm"
                    class="min-w-[100px] text-xs"
                    value={String(filter.operator)}
                    onchange={(e) => updateFilter(inflow.id, idx, { operator: Number(e.currentTarget.value) })}
                    options={operatorOptions(inflow.id, filter.property)}
                    disabled={readonly}
                  />
                  {#if needsValue(filter.operator)}
                    <Input
                      type="text"
                      placeholder="value"
                      value={filter.value !== undefined ? String(filter.value) : ""}
                      oninput={(e) => updateFilter(inflow.id, idx, { value: e.currentTarget.value })}
                      class="h-7 min-w-[80px] flex-1 text-xs"
                      disabled={readonly}
                    />
                  {/if}
                  {#if !readonly}
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onclick={() => removeFilter(inflow.id, idx)}
                    >
                      <Trash2 class="h-3 w-3" />
                    </Button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if targetProperties.length === 0 && inflows.length === 0}
    <p class="text-sm text-muted-foreground">
      No properties defined yet.
    </p>
  {:else if targetProperties.length === 0 && inflows.length > 0}
    <p class="text-sm text-muted-foreground">Waiting for source schema...</p>
  {:else if targetProperties.length > 0}
    <Accordion.Root type="multiple" bind:value={openItems}>
      {#each targetProperties as [propName, propType], i (propName)}
        {@const targetType = localSchema[propName] || 0}
        {@const nullable = isNullable(propName)}
        {@const warnings = hasWarnings(propName)}
        <Accordion.Item value={propName}>
          <Accordion.Trigger class="flex w-full items-center gap-2 py-2">
            {#if warnings}
              <TriangleAlert
                class="h-4 w-4 shrink-0 text-amber-500 !rotate-0"
              />
            {/if}
            <span class="flex-1 text-left text-sm font-medium">{propName}</span>
            <Badge variant="secondary" class="text-xs"
              >{getTypeName(targetType)}{#if nullable}?{/if}</Badge
            >
          </Accordion.Trigger>
          <Accordion.Content>
            <div class="space-y-3 pb-4 pt-1">
              <!-- Property name editor -->
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <Label class="mb-1 text-xs text-muted-foreground"
                    >Property name</Label
                  >
                  <Input
                    type="text"
                    value={propName}
                    class="h-8 text-sm"
                    disabled={readonly}
                    onblur={(e) => {
                      if (!readonly) renameProperty(propName, e.currentTarget.value);
                    }}
                    onkeydown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                </div>
                <div class="min-w-[100px]">
                  <Label class="mb-1 text-xs text-muted-foreground"
                    >Target type</Label
                  >
                  <Select
                    size="sm"
                    class="w-full text-sm"
                    value={String(localSchema[propName] || 0)}
                    onchange={(e) =>
                      setTargetType(propName, Number(e.currentTarget.value))}
                    options={targetTypeOptions}
                    disabled={readonly}
                  />
                </div>
                {#if !readonly}
                  <div class="flex items-end gap-1 self-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onclick={() => removeProperty(propName)}
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                {/if}
              </div>

              <!-- Ref target selector for REF/REFS properties -->
              {#if isRefType(targetType) && availableCollections && availableCollections.length > 0}
                {@const currentTargets = localRefTargets[propName] ?? []}
                <div class="mb-1">
                  <Label class="mb-1 text-xs text-muted-foreground">Target collections</Label>
                  <div class="flex flex-wrap gap-1">
                    {#each availableCollections as col}
                      {@const isSelected = currentTargets.includes(col.name)}
                      <button
                        type="button"
                        disabled={readonly}
                        class="rounded-full border px-2 py-0.5 text-xs transition-colors {isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50'} {readonly ? 'cursor-default' : ''}"
                        onclick={() => {
                          if (readonly) return;
                          const next = isSelected
                            ? currentTargets.filter((n) => n !== col.name)
                            : [...currentTargets, col.name];
                          setRefTargets(propName, next);
                        }}
                      >
                        {col.displayName}
                      </button>
                    {/each}
                  </div>
                  {#if currentTargets.length === 0}
                    <p class="mt-1 text-[10px] text-muted-foreground">No target selected — generates <code>string</code></p>
                  {/if}
                </div>
              {/if}

              <!-- One row per inflow -->
              {#each inflows as inflow (inflow.id)}
                {@const guessed = isGuessed(inflow.id, propName)}
                {@const unmapped = isUnmapped(inflow.id, propName)}
                {@const mappingWarn = hasMappingWarning(inflow.id, propName)}
                {@const hasHint = guessed || unmapped}
                {@const autoCast = getAutoCast(inflow.id, propName)}
                <div
                  class="rounded-md border bg-muted/30 p-3 {mappingWarn
                    ? 'border-amber-400/60 dark:border-amber-500/50'
                    : 'border-border'}"
                >
                  <div class="mb-2 flex items-center gap-1.5">
                    <span class="text-xs font-medium text-muted-foreground"
                      >{inflow.name}</span
                    >
                    {#if mappingWarn && guessed}
                      <span
                        class="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      >
                        <AlertCircle class="h-2.5 w-2.5" />
                        guessed — please resolve
                      </span>
                    {:else if mappingWarn && unmapped}
                      <span
                        class="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                      >
                        <AlertCircle class="h-2.5 w-2.5" />
                        no match found
                      </span>
                    {/if}
                    {#if mappingWarn && !readonly}
                      <button
                        type="button"
                        class="ml-auto flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/40 dark:hover:text-green-400"
                        onclick={() => verifyMapping(inflow.id, propName)}
                        title="Resolve warning"
                      >
                        <CircleCheck class="h-2.5 w-2.5" />
                        resolve
                      </button>
                    {/if}
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="min-w-[140px] flex-1">
                      <Label class="mb-1 text-xs text-muted-foreground"
                        >Source property</Label
                      >
                      <Select
                        size="sm"
                        class="w-full text-sm"
                        value={getSourcePropForInflow(inflow.id, propName)}
                        onchange={(e) =>
                          setSourceProp(
                            inflow.id,
                            propName,
                            e.currentTarget.value,
                          )}
                        options={[
                          { value: "", label: "---" },
                          ...(inflow.sourceSchema
                            ? Object.entries(inflow.sourceSchema)
                                .filter(([, srcType]) => typeCompatibility(srcType, targetType).compatible)
                                .map(([k]) => ({
                                  value: k,
                                  label: k,
                                }))
                            : []),
                        ]}
                        disabled={readonly}
                      />
                    </div>
                    {#if autoCast}
                      <div class="flex items-end self-end pb-1">
                        <Badge
                          variant="outline"
                          class="text-xs text-muted-foreground"
                        >
                          &rarr; {autoCast}
                        </Badge>
                      </div>
                    {/if}
                    {#if getSourcePropForInflow(inflow.id, propName) === "" || targetType & PropertyType.NULL}
                      {@const defaultError = getValidationError(inflow.id, propName)}
                      <div class="min-w-[100px] flex-1">
                        <Label class="mb-1 text-xs text-muted-foreground"
                          >Default</Label
                        >
                        {#if targetType === PropertyType.BOOLEAN}
                          <Select
                            size="sm"
                            class="w-full text-sm"
                            value={getDefaultForInflow(inflow.id, propName)}
                            onchange={(e) =>
                              setDefault(inflow.id, propName, e.currentTarget.value)}
                            options={[
                              { value: "", label: "---" },
                              { value: "true", label: "true" },
                              { value: "false", label: "false" },
                            ]}
                            disabled={readonly}
                          />
                        {:else if targetType & PropertyType.NUMBER || targetType & PropertyType.NUMBERS}
                          <Input
                            type="number"
                            placeholder="Default value"
                            value={getDefaultForInflow(inflow.id, propName)}
                            oninput={(e) =>
                              setDefault(inflow.id, propName, e.currentTarget.value)}
                            class="h-8 text-sm {defaultError ? 'border-destructive' : ''}"
                            disabled={readonly}
                          />
                        {:else}
                          <Input
                            type="text"
                            placeholder="Default value"
                            value={getDefaultForInflow(inflow.id, propName)}
                            oninput={(e) =>
                              setDefault(inflow.id, propName, e.currentTarget.value)}
                            class="h-8 text-sm {defaultError ? 'border-destructive' : ''}"
                            disabled={readonly}
                          />
                        {/if}
                        {#if defaultError}
                          <span class="text-xs text-destructive">{defaultError}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      {/each}
    </Accordion.Root>
  {/if}

  <!-- Add property combobox -->
  {#if !readonly}
    <Popover.Root bind:open={addPropertyOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button {...props} variant="outline" size="sm" class="gap-1">
            <Plus class="h-4 w-4" />
            Add property
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-64 p-0" align="start">
        <Command.Root shouldFilter={false}>
          <Command.Input
            placeholder="Property name..."
            bind:value={addPropertySearch}
            onkeydown={(e) => {
              if (e.key === "Enter" && addPropertySearch.trim()) {
                addPropertyByName(addPropertySearch.trim());
              }
            }}
          />
          <Command.List class="max-h-[200px]">
            {@const suggestions = unmappedSourceProps()}
            {@const filter = addPropertySearch.trim().toLowerCase()}
            {@const filtered = filter
              ? suggestions.filter((s) => s.toLowerCase().includes(filter))
              : suggestions}
            {#if filtered.length === 0 && !addPropertySearch.trim()}
              <Command.Empty>Type a property name</Command.Empty>
            {:else if filtered.length === 0}
              <Command.Item
                value={addPropertySearch.trim()}
                onSelect={() => addPropertyByName(addPropertySearch.trim())}
              >
                <Plus class="h-4 w-4 text-muted-foreground" />
                Add "{addPropertySearch.trim()}"
              </Command.Item>
            {:else}
              <Command.Group>
                {#each filtered as suggestion}
                  <Command.Item
                    value={suggestion}
                    onSelect={() => addPropertyByName(suggestion)}
                  >
                    {suggestion}
                  </Command.Item>
                {/each}
                {#if addPropertySearch.trim() && !suggestions.includes(addPropertySearch.trim())}
                  <Command.Item
                    value={addPropertySearch.trim()}
                    onSelect={() => addPropertyByName(addPropertySearch.trim())}
                  >
                    <Plus class="h-4 w-4 text-muted-foreground" />
                    Add "{addPropertySearch.trim()}"
                  </Command.Item>
                {/if}
              </Command.Group>
            {/if}
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  {/if}
</div>
