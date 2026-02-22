interface BaseSourcePullConfig {
    type: string;
    userId: number;
    sourceId: number;
    collectionId: number;
    since?: number;
}
export interface NotionPullConfig extends BaseSourcePullConfig {
    type: "notion";
    apiKey: Buffer;
    dbId: Buffer;
}
export interface StrapiPullConfig extends BaseSourcePullConfig {
    type: "strapi";
    apiToken: Buffer;
    url: string;
    contentType: Buffer;
}
export type PullConfig = NotionPullConfig | StrapiPullConfig;
/** Authentication types for web sources. */
export declare const WebAuthType: {
    readonly NONE: 0;
    readonly BEARER: 1;
    readonly BASIC: 2;
};
/** Type representing valid WebAuthType values. */
export type WebAuthType = (typeof WebAuthType)[keyof typeof WebAuthType];
/**
 * Extract the web auth type from credentials buffer.
 * For web sources, the first byte is the auth type: 0=None, 1=Bearer, 2=Basic
 */
export declare function extractWebAuthType(credentials: Buffer | null): WebAuthType;
export {};
