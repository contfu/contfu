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
    PropertyType,
    safeCast,
    typeCompatibility,
    type CollectionSchema,
    type MappingRule,
  } from "@contfu/svc-core";
  import { Select } from "@contfu/ui";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { untrack } from "svelte";

  interface InfluxData {
    id: string;
    name: string;
    sourceSchema: CollectionSchema | null;
    mappings: MappingRule[];
  }

  interface Props {
    targetSchema: CollectionSchema;
    influxes: InfluxData[];
    onchange: (changes: {
      targetSchema: CollectionSchema;
      influxMappings: Map<string, MappingRule[]>;
    }) => void;
  }

  let { targetSchema, influxes, onchange }: Props = $props();

  // Local mutable state
  let localSchema = $state<CollectionSchema>({ ...targetSchema });
  let localMappings = $state<Map<string, MappingRule[]>>(new Map());
  let openItems = $state<string[]>([]);
  let verifiedMappings = $state<Set<string>>(new Set());

  // Effects don't run during SSR — suppress warnings until mount
  let initialized = $state(false);
  $effect(() => { initialized = true; });

  /** Reset internal state back to current props (used by cancel). */
  export function reset() {
    localSchema = { ...targetSchema };
    localMappings = new Map();
    verifiedMappings = new Set();
    knownIds = new Set();
    syncInfluxes(influxes);
    emitChange();
  }

  /** Called by parent after a successful save to clear all warnings. */
  export function resolveAll() {
    for (const [name] of targetProperties) {
      for (const influx of influxes) {
        verifiedMappings.add(mappingKey(influx.id, name));
      }
    }
  }

  /** Compute initial mappings for a new influx. */
  function autoWireInflux(influx: InfluxData): MappingRule[] {
    if (influx.mappings.length > 0) return [...influx.mappings];
    if (!influx.sourceSchema) return [];
    if (Object.keys(localSchema).length === 0) {
      return Object.keys(influx.sourceSchema).map((k) => ({ source: k, target: k }));
    }
    return autoWireMappings(localSchema, influx.sourceSchema);
  }

  // Shared sync logic — processes influxes and updates local state.
  // Called both synchronously (init) and from $effect (prop changes).
  let knownIds = new Set<string>();
  function syncInfluxes(current: InfluxData[]) {
    const currentIds = new Set(current.filter((i) => i.id).map((i) => i.id));

    // All removed → reset
    if (current.length === 0 && knownIds.size > 0) {
      localSchema = { ...targetSchema };
      localMappings = new Map();
      verifiedMappings = new Set();
      knownIds = currentIds;
      emitChange();
      return;
    }

    // Sync schema from prop on first load
    if (knownIds.size === 0 && Object.keys(targetSchema).length > 0) {
      localSchema = { ...targetSchema };
    }

    // Process influxes, build updated map
    const m = new Map(localMappings);
    let schemaChanged = false;
    for (const influx of current) {
      if (!influx.id) continue;
      const isNew = !knownIds.has(influx.id);
      const existingRules = m.get(influx.id);
      const hasEmptyLocal = !existingRules || existingRules.length === 0;

      // Skip known influxes that already have local mappings
      if (!isNew && !hasEmptyLocal) continue;

      // Re-process known influxes when prop data improves
      // (sourceSchema became available, or server now returns saved mappings)
      if (!isNew && hasEmptyLocal) {
        if (influx.mappings.length === 0 && !influx.sourceSchema) continue;
      }

      // First influx with empty schema → seed from source
      if (influx.mappings.length === 0 && influx.sourceSchema && Object.keys(localSchema).length === 0) {
        localSchema = { ...influx.sourceSchema };
        schemaChanged = true;
      }
      m.set(influx.id, autoWireInflux(influx));
      // Auto-resolve warnings for server-loaded influxes
      if (influx.mappings.length > 0) {
        for (const p of Object.keys(localSchema)) verifiedMappings.add(mappingKey(influx.id, p));
      }
    }
    // Remove departed influxes
    for (const id of knownIds) {
      if (!currentIds.has(id)) m.delete(id);
    }

    localMappings = m;
    knownIds = currentIds;
    if (schemaChanged) emitChange();
  }

  // Sync local state BEFORE the DOM updates so that Select components
  // render with the correct value on their very first paint.
  // Using $effect.pre (not $effect) is critical: $effect runs after DOM
  // updates, which means Selects would be created with value="" and then
  // bind:value locks that in. $effect.pre runs before the DOM update.
  $effect.pre(() => {
    const current = influxes;
    untrack(() => syncInfluxes(current));
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

  // Collect all source property names across influxes that aren't already target properties
  const unmappedSourceProps = $derived(() => {
    const targetNames = new Set(Object.keys(localSchema));
    const sourceNames = new Set<string>();
    for (const influx of influxes) {
      if (influx.sourceSchema) {
        for (const key of Object.keys(influx.sourceSchema)) {
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
    influxId: string,
    targetProp: string,
  ): MappingRule | undefined {
    let rules = localMappings.get(influxId);
    // Fallback: if localMappings hasn't been populated yet (effect hasn't run),
    // use the influx's own mappings prop so Selects render with correct values.
    if (!rules) {
      const influx = influxes.find((i) => i.id === influxId);
      rules = influx?.mappings ?? [];
    }
    return rules.find((r) => (r.target ?? r.source) === targetProp);
  }

  function getSourcePropForInflux(
    influxId: string,
    targetProp: string,
  ): string {
    const rule = getMappingForProperty(influxId, targetProp);
    return rule?.source ?? "";
  }

  function getDefaultForInflux(influxId: string, targetProp: string): string {
    const rule = getMappingForProperty(influxId, targetProp);
    return rule?.default !== undefined ? String(rule.default) : "";
  }

  function isGuessed(influxId: string, targetProp: string): boolean {
    return getMappingForProperty(influxId, targetProp)?.guessed === true;
  }

  function isUnmapped(influxId: string, targetProp: string): boolean {
    return getSourcePropForInflux(influxId, targetProp) === "";
  }

  /** True if any influx has no source mapping and no default for this property. */
  function isNullable(propName: string): boolean {
    if (influxes.length === 0) return false;
    return influxes.some(
      (influx) =>
        isUnmapped(influx.id, propName) &&
        getDefaultForInflux(influx.id, propName) === "",
    );
  }

  function mappingKey(influxId: string, propName: string): string {
    return `${influxId}:${propName}`;
  }

  /** True if this specific influx+property has a warning and hasn't been verified. */
  function hasMappingWarning(influxId: string, propName: string): boolean {
    if (!initialized) return false;
    if (verifiedMappings.has(mappingKey(influxId, propName))) return false;
    return isGuessed(influxId, propName) || isUnmapped(influxId, propName);
  }

  /** True if any influx has an unverified warning for this property. */
  function hasWarnings(propName: string): boolean {
    return influxes.some((influx) => hasMappingWarning(influx.id, propName));
  }

  export function verifyMapping(influxId: string, propName: string) {
    const rules = [...(localMappings.get(influxId) ?? [])];
    const idx = rules.findIndex((r) => (r.target ?? r.source) === propName);
    if (idx >= 0 && rules[idx].guessed) {
      const { guessed: _, ...rest } = rules[idx];
      rules[idx] = rest as MappingRule;
      localMappings = new Map(localMappings).set(influxId, rules);
      emitChange();
    }
    // Still add to verifiedMappings to clear any "no match found" warnings
    verifiedMappings = new Set([...verifiedMappings, mappingKey(influxId, propName)]);
  }

  // ---------------------------------------------------------------------------
  // Default value validation
  // ---------------------------------------------------------------------------

  let validationErrors = $state<Map<string, string>>(new Map());

  function validationKey(influxId: string, propName: string): string {
    return `${influxId}:${propName}:default`;
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

  function getValidationError(influxId: string, propName: string): string | null {
    return validationErrors.get(validationKey(influxId, propName)) ?? null;
  }

  function updateValidation(influxId: string, propName: string, value: string) {
    const targetType = localSchema[propName] || 0;
    const error = validateDefault(value, targetType);
    const key = validationKey(influxId, propName);
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
    const snap = $state.snapshot(localMappings)
    onchange({
      targetSchema: { ...localSchema },
      influxMappings: snap,
    });
  }

  function setSourceProp(
    influxId: string,
    targetProp: string,
    sourceProp: string,
  ) {
    const rules = [...(localMappings.get(influxId) ?? [])];
    const idx = rules.findIndex((r) => (r.target ?? r.source) === targetProp);
    if (sourceProp === "") {
      // Remove mapping
      if (idx >= 0) rules.splice(idx, 1);
    } else {
      // User explicitly set source → auto-derive cast from types
      const influx = influxes.find((i) => i.id === influxId);
      const sourceType = influx?.sourceSchema?.[sourceProp];
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
    localMappings = new Map(localMappings).set(influxId, rules);
    emitChange();
  }

  export function setTargetType(propName: string, newType: number) {
    localSchema = { ...localSchema, [propName]: newType };
    // Auto-derive casts for all influx mappings on this property
    for (const influx of influxes) {
      const rules = [...(localMappings.get(influx.id) ?? [])];
      const idx = rules.findIndex((r) => (r.target ?? r.source) === propName);
      if (idx >= 0 && influx.sourceSchema) {
        const sourceType = influx.sourceSchema[rules[idx].source];
        if (sourceType !== undefined) {
          const cast = safeCast(sourceType, newType);
          rules[idx] = { ...rules[idx], cast: cast ?? undefined };
          localMappings = new Map(localMappings).set(influx.id, rules);
        }
      }
    }
    emitChange();
  }

  function getAutoCast(influxId: string, targetProp: string): string | null {
    const rule = getMappingForProperty(influxId, targetProp);
    if (!rule) return null;
    const influx = influxes.find((i) => i.id === influxId);
    if (!influx?.sourceSchema) return null;
    const sourceType = influx.sourceSchema[rule.source];
    if (sourceType === undefined) return null;
    const targetType = localSchema[targetProp];
    if (targetType === undefined) return null;
    return safeCast(sourceType, targetType);
  }

  function setDefault(
    influxId: string,
    targetProp: string,
    defaultVal: string,
  ) {
    const rules = [...(localMappings.get(influxId) ?? [])];
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
    localMappings = new Map(localMappings).set(influxId, rules);
    updateValidation(influxId, targetProp, defaultVal);
    emitChange();
  }

  export function addPropertyByName(name: string) {
    if (!name || name in localSchema) return;

    // Derive type from source schemas
    let type = 0;
    for (const influx of influxes) {
      if (influx.sourceSchema?.[name] !== undefined) {
        type |= influx.sourceSchema[name];
      }
    }

    localSchema = { ...localSchema, [name]: type || PropertyType.STRING };

    // Auto-fill bindings for each influx
    for (const influx of influxes) {
      if (!influx.sourceSchema) continue;
      const rules = [...(localMappings.get(influx.id) ?? [])];
      // Check exact match
      if (name in influx.sourceSchema) {
        rules.push({ source: name, target: name });
        localMappings = new Map(localMappings).set(influx.id, rules);
      } else {
        // Try auto-wire for just this property
        const miniTarget: CollectionSchema = { [name]: localSchema[name] };
        const wired = autoWireMappings(miniTarget, influx.sourceSchema);
        if (wired.length > 0) {
          rules.push(wired[0]);
          localMappings = new Map(localMappings).set(influx.id, rules);
        }
      }
    }

    addPropertyOpen = false;
    addPropertySearch = "";
    emitChange();
  }

  export function removeProperty(name: string) {
    const { [name]: _, ...rest } = localSchema;
    localSchema = rest;
    // Also remove from all influx mappings
    for (const [influxId, rules] of localMappings) {
      const filtered = rules.filter((r) => (r.target ?? r.source) !== name);
      localMappings = new Map(localMappings).set(influxId, filtered);
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
    // Update mappings target references
    for (const [influxId, rules] of localMappings) {
      localMappings = new Map(localMappings).set(influxId, rules.map((r) =>
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
  {#if targetProperties.length === 0 && influxes.length === 0}
    <p class="text-sm text-muted-foreground">
      No target schema defined. Add an influx to auto-initialize.
    </p>
  {:else if targetProperties.length === 0 && influxes.length > 0}
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
                    onblur={(e) =>
                      renameProperty(propName, e.currentTarget.value)}
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
                  />
                </div>
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
              </div>

              <!-- One row per influx -->
              {#each influxes as influx (influx.id)}
                {@const guessed = isGuessed(influx.id, propName)}
                {@const unmapped = isUnmapped(influx.id, propName)}
                {@const mappingWarn = hasMappingWarning(influx.id, propName)}
                {@const hasHint = guessed || unmapped}
                {@const autoCast = getAutoCast(influx.id, propName)}
                <div
                  class="rounded-md border bg-muted/30 p-3 {mappingWarn
                    ? 'border-amber-400/60 dark:border-amber-500/50'
                    : 'border-border'}"
                >
                  <div class="mb-2 flex items-center gap-1.5">
                    <span class="text-xs font-medium text-muted-foreground"
                      >{influx.name}</span
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
                    {#if mappingWarn}
                      <button
                        type="button"
                        class="ml-auto flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/40 dark:hover:text-green-400"
                        onclick={() => verifyMapping(influx.id, propName)}
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
                        value={getSourcePropForInflux(influx.id, propName)}
                        onchange={(e) =>
                          setSourceProp(
                            influx.id,
                            propName,
                            e.currentTarget.value,
                          )}
                        options={[
                          { value: "", label: "---" },
                          ...(influx.sourceSchema
                            ? Object.entries(influx.sourceSchema)
                                .filter(([, srcType]) => typeCompatibility(srcType, targetType).compatible)
                                .map(([k]) => ({
                                  value: k,
                                  label: k,
                                }))
                            : []),
                        ]}
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
                    {#if getSourcePropForInflux(influx.id, propName) === "" || targetType & PropertyType.NULL}
                      {@const defaultError = getValidationError(influx.id, propName)}
                      <div class="min-w-[100px] flex-1">
                        <Label class="mb-1 text-xs text-muted-foreground"
                          >Default</Label
                        >
                        {#if targetType === PropertyType.BOOLEAN}
                          <Select
                            size="sm"
                            class="w-full text-sm"
                            value={getDefaultForInflux(influx.id, propName)}
                            onchange={(e) =>
                              setDefault(influx.id, propName, e.currentTarget.value)}
                            options={[
                              { value: "", label: "---" },
                              { value: "true", label: "true" },
                              { value: "false", label: "false" },
                            ]}
                          />
                        {:else if targetType & PropertyType.NUMBER || targetType & PropertyType.NUMBERS}
                          <Input
                            type="number"
                            placeholder="Default value"
                            value={getDefaultForInflux(influx.id, propName)}
                            oninput={(e) =>
                              setDefault(influx.id, propName, e.currentTarget.value)}
                            class="h-8 text-sm {defaultError ? 'border-destructive' : ''}"
                          />
                        {:else}
                          <Input
                            type="text"
                            placeholder="Default value"
                            value={getDefaultForInflux(influx.id, propName)}
                            oninput={(e) =>
                              setDefault(influx.id, propName, e.currentTarget.value)}
                            class="h-8 text-sm {defaultError ? 'border-destructive' : ''}"
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

  <!-- Add property combobox (only when influxes exist) -->
  {#if influxes.length > 0}
    <Popover.Root bind:open={addPropertyOpen}>
      <Popover.Trigger>
        <Button variant="outline" size="sm" class="gap-1">
          <Plus class="h-4 w-4" />
          Add property
        </Button>
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
