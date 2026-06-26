import { describe, expect, it } from "bun:test";
import {
  IntegrationCapability,
  IntegrationRole,
  IntegrationType,
  integrationHasCapability,
  TargetSchemaDeliveryMode,
  integrationHasRole,
  integrationSupportsContentReceive,
  integrationSupportsTargetSchemaDelivery,
  integrationTargetSchemaDeliveryMode,
} from "./integrations";

describe("integration capabilities", () => {
  it.each([
    [
      IntegrationType.APP,
      [
        IntegrationCapability.ComponentContract,
        IntegrationCapability.ManualLocalizationLayer,
        IntegrationCapability.ContentReceive,
        IntegrationCapability.TargetDeliveryCapability,
        IntegrationCapability.TargetSchemaDelivery,
      ],
    ],
    [
      IntegrationType.NOTION,
      [
        IntegrationCapability.ManualLocalizationLayer,
        IntegrationCapability.ContentProvide,
        IntegrationCapability.ContentReceive,
        IntegrationCapability.TargetDeliveryCapability,
      ],
    ],
    [
      IntegrationType.STRAPI,
      [
        IntegrationCapability.ComponentDiscovery,
        IntegrationCapability.ManualLocalizationLayer,
        IntegrationCapability.ContentProvide,
        IntegrationCapability.ContentReceive,
        IntegrationCapability.TargetDeliveryCapability,
      ],
    ],
    [
      IntegrationType.CONTENTFUL,
      [
        IntegrationCapability.ComponentDiscovery,
        IntegrationCapability.ManualLocalizationLayer,
        IntegrationCapability.ContentProvide,
      ],
    ],
    [
      IntegrationType.WORDPRESS,
      [IntegrationCapability.ManualLocalizationLayer, IntegrationCapability.ContentProvide],
    ],
    [
      IntegrationType.SANITY,
      [
        IntegrationCapability.ComponentDiscovery,
        IntegrationCapability.ManualLocalizationLayer,
        IntegrationCapability.ContentProvide,
      ],
    ],
    [IntegrationType.STORYBLOK, [IntegrationCapability.ContentProvide]],
    [IntegrationType.DIRECTUS, [IntegrationCapability.ContentProvide]],
    [IntegrationType.PRISMIC, [IntegrationCapability.ContentProvide]],
    [
      IntegrationType.WEB,
      [IntegrationCapability.ManualLocalizationLayer, IntegrationCapability.ContentProvide],
    ],
    [
      IntegrationType.WEBHOOK,
      [IntegrationCapability.ContentReceive, IntegrationCapability.TargetDeliveryCapability],
    ],
  ] as const)("maps capabilities for integration type %p", (type, expected) => {
    const expectedCapabilities: readonly IntegrationCapability[] = expected;
    for (const capability of Object.values(IntegrationCapability)) {
      expect(integrationHasCapability(type, capability)).toBe(
        expectedCapabilities.includes(capability),
      );
    }
  });

  it("models target role, content receive, and schema delivery separately from app assumptions", () => {
    expect(integrationHasRole(IntegrationType.APP, IntegrationRole.TargetRole)).toBe(true);
    expect(integrationHasRole(IntegrationType.NOTION, IntegrationRole.SourceRole)).toBe(true);
    expect(integrationHasRole(IntegrationType.NOTION, IntegrationRole.TargetRole)).toBe(true);
    expect(integrationHasRole(IntegrationType.STRAPI, IntegrationRole.TargetRole)).toBe(true);
    expect(integrationHasRole(IntegrationType.WEBHOOK, IntegrationRole.TargetRole)).toBe(true);
    expect(integrationSupportsContentReceive(IntegrationType.APP)).toBe(true);
    expect(integrationSupportsContentReceive(IntegrationType.STRAPI)).toBe(true);
    expect(integrationSupportsContentReceive(IntegrationType.NOTION)).toBe(true);
    expect(integrationSupportsTargetSchemaDelivery(IntegrationType.APP)).toBe(true);
    expect(integrationSupportsTargetSchemaDelivery(IntegrationType.NOTION)).toBe(false);
  });

  it("distinguishes mutating application schema delivery from notification-only delivery", () => {
    expect(integrationTargetSchemaDeliveryMode(IntegrationType.APP)).toBe(
      TargetSchemaDeliveryMode.MUTATING,
    );
    expect(integrationTargetSchemaDeliveryMode(IntegrationType.NOTION)).toBeNull();
  });
});
