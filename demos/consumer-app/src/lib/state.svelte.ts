/**
 * Article state management using Svelte 5 runes.
 * This module manages server-side state for synchronized articles.
 */

import type { ChangedEvent, DeletedEvent, Item } from "@contfu/core";
import type { Article } from "./types.js";

/** Article storage - keyed by ID hex string */
const articles = new Map<string, Article>();

/**
 * Convert an Item from the sync service to an Article.
 */
function itemToArticle(item: Item): Article {
  const props = item.props as Record<string, unknown>;
  return {
    id: item.id.toString("hex"),
    title: (props.title as string) || "Untitled",
    slug: (props.slug as string) || item.id.toString("hex"),
    description: (props.description as string) || "",
    createdAt: new Date(item.createdAt),
    changedAt: new Date(item.changedAt),
    content: item.content || [],
  };
}

/**
 * Handle a CHANGED event - add or update an article.
 */
export function handleChangedEvent(event: ChangedEvent): void {
  const article = itemToArticle(event.item);
  articles.set(article.id, article);
}

/**
 * Handle a DELETED event - remove an article.
 */
export function handleDeletedEvent(event: DeletedEvent): void {
  const id = event.item.toString("hex");
  articles.delete(id);
}

/**
 * Get all articles sorted by change date (newest first).
 */
export function getAllArticles(): Article[] {
  return Array.from(articles.values()).sort(
    (a, b) => b.changedAt.getTime() - a.changedAt.getTime()
  );
}

/**
 * Find an article by slug.
 */
export function getArticleBySlug(slug: string): Article | undefined {
  return Array.from(articles.values()).find((a) => a.slug === slug);
}

/**
 * Get the current article count.
 */
export function getArticleCount(): number {
  return articles.size;
}
