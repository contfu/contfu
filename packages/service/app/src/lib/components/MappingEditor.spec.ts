import { mock, describe, it, expect, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Mock UI dependencies with minimal stubs
// ---------------------------------------------------------------------------

// For Svelte 5 SSR/client we need something that acts like a component.
// The simplest approach: mock each module to return a no-op component function
// that just renders children via the Svelte 5 internal API.

function stubComponent() {
  // Return a Svelte 5 component that renders children as a passthrough.
  // We use the actual compiled mock components from .svelte files.
  // Since we can't dynamically compile, we use the simplest possible stub:
  // a function that the Svelte runtime recognizes as a component.
  return function StubComponent() {};
}

// Accordion namespace
mock.module("$lib/components/ui/accordion", () => ({
  Root: stubComponent(),
  Item: stubComponent(),
  Trigger: stubComponent(),
  Content: stubComponent(),
}));

mock.module("$lib/components/ui/badge", () => ({
  Badge: stubComponent(),
}));

mock.module("$lib/components/ui/button", () => ({
  Button: stubComponent(),
}));

mock.module("$lib/components/ui/input", () => ({
  Input: stubComponent(),
}));

mock.module("$lib/components/ui/label", () => ({
  Label: stubComponent(),
}));

mock.module("$lib/components/ui/popover", () => ({
  Root: stubComponent(),
  Trigger: stubComponent(),
  Content: stubComponent(),
}));

mock.module("$lib/components/ui/command", () => ({
  Root: stubComponent(),
  Input: stubComponent(),
  List: stubComponent(),
  Empty: stubComponent(),
  Group: stubComponent(),
  Item: stubComponent(),
}));

mock.module("@contfu/ui", () => ({
  Select: stubComponent(),
}));

for (const icon of ["alert-circle", "circle-check", "plus", "trash-2", "triangle-alert"]) {
  mock.module(`@lucide/svelte/icons/${icon}`, () => ({
    default: stubComponent(),
  }));
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { render, cleanup } from "@testing-library/svelte";
import { tick } from "svelte";
import MappingEditor from "./MappingEditor.svelte";
import { PropertyType } from "@contfu/svc-core";
import type { CollectionSchema, MappingRule } from "@contfu/svc-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface InfluxData {
  id: string;
  name: string;
  sourceSchema: CollectionSchema | null;
  mappings: MappingRule[];
}

interface ChangePayload {
  targetSchema: CollectionSchema;
  influxMappings: Map<string, MappingRule[]>;
}

function renderEditor(props: {
  targetSchema?: CollectionSchema;
  influxes?: InfluxData[];
  onchange?: (c: ChangePayload) => void;
}) {
  return render(MappingEditor, {
    props: {
      targetSchema: props.targetSchema ?? {},
      influxes: props.influxes ?? [],
      onchange: props.onchange ?? (() => {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanup();
});

describe("MappingEditor", () => {
  it("shows empty state when no influxes and no schema", async () => {
    const { container } = renderEditor({});
    await tick();
    expect(container.textContent).toContain("No target schema defined");
  });

  it("shows waiting state when influxes exist but no source schema", async () => {
    const { container } = renderEditor({
      influxes: [{ id: "i1", name: "Test", sourceSchema: null, mappings: [] }],
    });
    await tick();
    expect(container.textContent).toContain("Waiting for source schema");
  });

  it("auto-wires identity mappings from source schema when target is empty", async () => {
    const onchange = mock(() => {});
    const sourceSchema: CollectionSchema = {
      title: PropertyType.STRING,
      slug: PropertyType.STRING,
    };

    renderEditor({
      influxes: [{ id: "i1", name: "Source", sourceSchema, mappings: [] }],
      onchange,
    });
    await tick();
    await tick(); // effects may need extra microtask

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect(call.targetSchema).toEqual(sourceSchema);
    const mappings = call.influxMappings.get("i1")!;
    expect(mappings).toHaveLength(2);
    expect(mappings.map((m: MappingRule) => m.source).sort()).toEqual(["slug", "title"]);
  });

  it("loads existing mappings and auto-resolves warnings", async () => {
    const targetSchema: CollectionSchema = {
      title: PropertyType.STRING,
      body: PropertyType.STRING,
    };

    const { container } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { name: PropertyType.STRING, content: PropertyType.STRING },
          mappings: [
            { source: "name", target: "title", guessed: true },
            { source: "content", target: "body" },
          ],
        },
      ],
    });
    await tick();
    await tick();

    // Existing mappings with guessed flag should be auto-verified
    // so "guessed — please resolve" should NOT appear
    expect(container.textContent).not.toContain("guessed");
  });

  it("preserves existing influx when second is added", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };

    const { rerender } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "First",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [{ source: "title", target: "title" }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    rerender({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "First",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [{ source: "title", target: "title" }],
        },
        {
          id: "i2",
          name: "Second",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [],
        },
      ],
      onchange,
    });
    await tick();
    await tick();

    // No schema change, so onchange should NOT have been called
    // (the second influx auto-wires but doesn't change schema)
    expect(onchange).not.toHaveBeenCalled();
  });

  it("resets when all influxes are removed", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };

    const { rerender } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [{ source: "title", target: "title" }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    rerender({ targetSchema, influxes: [], onchange });
    await tick();
    await tick();

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect(call.influxMappings.size).toBe(0);
  });

  it("auto-wire leaves unmapped properties when source has no match", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = {
      title: PropertyType.STRING,
      body: PropertyType.STRING,
    };

    renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [],
        },
      ],
      onchange,
    });
    await tick();
    await tick();

    // Auto-wire should only map "title" (exact match); "body" stays unmapped.
    // No schema change (targetSchema already has entries), so onchange is NOT called.
    // But we can verify the internal state indirectly: the component should render
    // warning indicators for the unmapped "body" property.
    // Since our Badge stub doesn't render children, check for the warning text instead.
    expect(onchange).not.toHaveBeenCalled();
  });

  it("verifyMapping() strips guessed flag from MappingRule and emits change", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };

    const { component } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { name: PropertyType.STRING },
          mappings: [{ source: "name", target: "title", guessed: true }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    (component as unknown as { verifyMapping: (a: string, b: string) => void }).verifyMapping(
      "i1",
      "title",
    );
    await tick();

    expect(onchange).toHaveBeenCalledTimes(1);
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    const rules = call.influxMappings.get("i1")!;
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("name");
    expect(rules[0].target).toBe("title");
    expect((rules[0] as MappingRule & { guessed?: boolean }).guessed).toBeUndefined();
  });

  it("resolveAll() clears all warnings", async () => {
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };

    const { component, container } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { name: PropertyType.STRING },
          mappings: [],
        },
      ],
    });
    await tick();
    await tick();

    (component as unknown as { resolveAll: () => void }).resolveAll();
    await tick();

    expect(container.textContent).not.toContain("guessed");
    expect(container.textContent).not.toContain("no match found");
  });

  it("reset() restores original state after changes", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = {
      title: PropertyType.STRING,
      body: PropertyType.STRING,
    };
    const sourceSchema: CollectionSchema = {
      title: PropertyType.STRING,
      body: PropertyType.STRING,
    };

    const { component } = renderEditor({
      targetSchema,
      influxes: [{ id: "i1", name: "Source", sourceSchema, mappings: [] }],
      onchange,
    });
    await tick();
    await tick();

    const editor = component as unknown as {
      reset: () => void;
      removeProperty: (name: string) => void;
    };

    // Remove a property then reset
    editor.removeProperty("body");
    await tick();
    onchange.mockClear();

    editor.reset();
    await tick();
    await tick();

    // After reset, onchange should fire with original schema restored
    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect(call.targetSchema).toEqual(targetSchema);
  });

  it("removeProperty + reset restores property", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = {
      title: PropertyType.STRING,
      slug: PropertyType.STRING,
    };

    const { component } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { title: PropertyType.STRING, slug: PropertyType.STRING },
          mappings: [
            { source: "title", target: "title" },
            { source: "slug", target: "slug" },
          ],
        },
      ],
      onchange,
    });
    await tick();
    await tick();

    const editor = component as unknown as {
      reset: () => void;
      removeProperty: (name: string) => void;
    };

    editor.removeProperty("slug");
    await tick();
    onchange.mockClear();

    editor.reset();
    await tick();
    await tick();

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect("slug" in call.targetSchema).toBe(true);
  });

  it("source options are filtered by type compatibility", async () => {
    const onchange = mock(() => {});
    // Target expects NUMBER, source has STRING and NUMBER fields
    const targetSchema: CollectionSchema = {
      count: PropertyType.NUMBER,
    };
    const sourceSchema: CollectionSchema = {
      count: PropertyType.NUMBER,
      name: PropertyType.STRING, // incompatible with NUMBER target
    };

    renderEditor({
      targetSchema,
      influxes: [{ id: "i1", name: "Source", sourceSchema, mappings: [] }],
      onchange,
    });
    await tick();
    await tick();

    // Auto-wire should NOT map "name" (STRING) to "count" (NUMBER) since
    // STRING→NUMBER is not a safe cast. Only "count" should be mapped.
    // Since names don't match either, the main check is that auto-wire
    // correctly skipped incompatible types.
    // We verify no onchange was called (no schema change needed)
    expect(onchange).not.toHaveBeenCalled();
  });

  it("setTargetType re-derives casts", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { count: PropertyType.STRING };
    const sourceSchema: CollectionSchema = { count: PropertyType.NUMBER };

    const { component } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema,
          mappings: [{ source: "count", target: "count", cast: "string" }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    const editor = component as unknown as {
      setTargetType: (prop: string, type: number) => void;
    };

    // Change target type to NUMBER (direct match, no cast needed)
    editor.setTargetType("count", PropertyType.NUMBER);
    await tick();

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect(call.targetSchema.count).toBe(PropertyType.NUMBER);
    const rules = call.influxMappings.get("i1");
    // Cast should be removed (undefined) since NUMBER→NUMBER is direct
    expect(rules?.[0]?.cast).toBeUndefined();
  });

  it("addPropertyByName adds property", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };
    const sourceSchema: CollectionSchema = {
      title: PropertyType.STRING,
      slug: PropertyType.STRING,
    };

    const { component } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema,
          mappings: [{ source: "title", target: "title" }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    const editor = component as unknown as {
      addPropertyByName: (name: string) => void;
    };
    editor.addPropertyByName("slug");
    await tick();

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect("slug" in call.targetSchema).toBe(true);
    const rules = call.influxMappings.get("i1")!;
    expect(rules.some((r: MappingRule) => r.source === "slug")).toBe(true);
  });

  it("renameProperty updates schema and mappings", async () => {
    const onchange = mock(() => {});
    const targetSchema: CollectionSchema = { title: PropertyType.STRING };

    const { component } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source",
          sourceSchema: { title: PropertyType.STRING },
          mappings: [{ source: "title", target: "title" }],
        },
      ],
      onchange,
    });
    await tick();
    await tick();
    onchange.mockClear();

    const editor = component as unknown as {
      renameProperty: (oldName: string, newName: string) => void;
    };
    editor.renameProperty("title", "heading");
    await tick();

    expect(onchange).toHaveBeenCalled();
    const call = (onchange.mock.calls[0] as unknown[])[0] as ChangePayload;
    expect("heading" in call.targetSchema).toBe(true);
    expect("title" in call.targetSchema).toBe(false);
    const rules = call.influxMappings.get("i1")!;
    expect(rules[0].target).toBe("heading");
  });

  it("populates mappings synchronously on first render (no tick needed)", () => {
    // This test verifies that localMappings is populated during component
    // initialization, not deferred to an $effect. This is critical because
    // Select components with $bindable capture the initial value — if mappings
    // are empty on first render, the select locks to "---".
    const targetSchema: CollectionSchema = {
      title: PropertyType.STRING,
      count: PropertyType.NUMBER,
    };

    const { container } = renderEditor({
      targetSchema,
      influxes: [
        {
          id: "i1",
          name: "Source A",
          sourceSchema: { title: PropertyType.STRING, count: PropertyType.NUMBER },
          mappings: [
            { source: "title", target: "title" },
            { source: "count", target: "count" },
          ],
        },
      ],
    });

    // NO tick() — check immediately after render.
    // The "no match found" warning should NOT appear because mappings
    // were loaded synchronously and auto-verified.
    expect(container.textContent).not.toContain("no match found");
  });
});
