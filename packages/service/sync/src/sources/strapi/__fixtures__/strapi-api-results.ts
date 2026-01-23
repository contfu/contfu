import type { StrapiEntry, StrapiResponse, StrapiContentTypeSchema } from "../strapi";

/** Sample article entry from Strapi API. */
export const articleEntry1: StrapiEntry = {
  id: 1,
  documentId: "abc123def456",
  title: "Getting Started with Strapi",
  slug: "getting-started-with-strapi",
  description: "A comprehensive guide to Strapi CMS",
  content: [
    {
      type: "paragraph",
      children: [
        { type: "text", text: "Welcome to " },
        { type: "text", text: "Strapi", bold: true },
        { type: "text", text: ", the leading open-source headless CMS." },
      ],
    },
    {
      type: "heading",
      level: 2,
      children: [{ type: "text", text: "Installation" }],
    },
    {
      type: "paragraph",
      children: [
        { type: "text", text: "You can install Strapi using " },
        { type: "text", text: "npm", code: true },
        { type: "text", text: " or " },
        { type: "text", text: "yarn", code: true },
        { type: "text", text: "." },
      ],
    },
    {
      type: "code",
      children: [{ type: "text", text: "npx create-strapi-app my-project" }],
    },
    {
      type: "list",
      format: "unordered",
      children: [
        { type: "list-item", children: [{ type: "text", text: "First item" }] },
        { type: "list-item", children: [{ type: "text", text: "Second item" }] },
      ],
    },
  ],
  publishedAt: "2024-01-15T10:30:00.000Z",
  createdAt: "2024-01-10T08:00:00.000Z",
  updatedAt: "2024-01-15T10:30:00.000Z",
};

/** Sample article entry with relations and media. */
export const articleEntry2: StrapiEntry = {
  id: 2,
  documentId: "xyz789uvw012",
  title: "Advanced Strapi Features",
  slug: "advanced-strapi-features",
  description: "Deep dive into Strapi's advanced capabilities",
  content: [
    {
      type: "paragraph",
      children: [
        { type: "text", text: "Learn about " },
        { type: "text", text: "relations", italic: true },
        { type: "text", text: " and " },
        {
          type: "link",
          url: "https://strapi.io/docs",
          children: [{ type: "text", text: "media handling" }],
        },
        { type: "text", text: "." },
      ],
    },
    {
      type: "quote",
      children: [{ type: "text", text: "Strapi makes content management a breeze." }],
    },
    {
      type: "image",
      image: {
        id: 1,
        documentId: "img001",
        name: "architecture.png",
        alternativeText: "Strapi architecture diagram",
        url: "/uploads/architecture_abc123.png",
        mime: "image/png",
        width: 1200,
        height: 800,
      },
    },
  ],
  author: {
    id: 1,
    documentId: "author001",
  },
  category: {
    id: 3,
    documentId: "cat003",
  },
  tags: [
    { id: 1, documentId: "tag001" },
    { id: 2, documentId: "tag002" },
  ],
  featuredImage: {
    id: 2,
    documentId: "img002",
    name: "featured.jpg",
    alternativeText: "Featured image",
    url: "https://cdn.example.com/images/featured.jpg",
    mime: "image/jpeg",
    width: 1920,
    height: 1080,
  },
  gallery: [
    {
      id: 3,
      documentId: "img003",
      name: "gallery1.jpg",
      url: "/uploads/gallery1.jpg",
      mime: "image/jpeg",
    },
    {
      id: 4,
      documentId: "img004",
      name: "gallery2.jpg",
      url: "/uploads/gallery2.jpg",
      mime: "image/jpeg",
    },
  ],
  publishedAt: "2024-02-20T14:00:00.000Z",
  createdAt: "2024-02-15T09:00:00.000Z",
  updatedAt: "2024-02-20T14:00:00.000Z",
};

/** Sample article entry with component. */
export const articleEntry3: StrapiEntry = {
  id: 3,
  documentId: "comp456abc",
  title: "Working with Components",
  slug: "working-with-components",
  description: "How to use Strapi components effectively",
  seo: {
    id: 1,
    __component: "shared.seo",
    metaTitle: "Components in Strapi",
    metaDescription: "Learn how to use components",
    keywords: "strapi, components, cms",
  },
  sections: [
    {
      id: 1,
      __component: "sections.hero",
      title: "Hero Section",
      subtitle: "Welcome to our site",
    },
    {
      id: 2,
      __component: "sections.features",
      heading: "Our Features",
    },
  ],
  publishedAt: undefined,
  createdAt: "2024-03-01T12:00:00.000Z",
  updatedAt: "2024-03-05T16:30:00.000Z",
};

/** Paginated response with page 1. */
export const entriesPage1: StrapiResponse<StrapiEntry[]> = {
  data: [articleEntry1, articleEntry2],
  meta: {
    pagination: {
      page: 1,
      pageSize: 25,
      pageCount: 2,
      total: 3,
    },
  },
};

/** Paginated response with page 2. */
export const entriesPage2: StrapiResponse<StrapiEntry[]> = {
  data: [articleEntry3],
  meta: {
    pagination: {
      page: 2,
      pageSize: 25,
      pageCount: 2,
      total: 3,
    },
  },
};

/** Empty paginated response. */
export const emptyResponse: StrapiResponse<StrapiEntry[]> = {
  data: [],
  meta: {
    pagination: {
      page: 1,
      pageSize: 25,
      pageCount: 0,
      total: 0,
    },
  },
};

/** Sample content type schema. */
export const articleSchema: StrapiContentTypeSchema = {
  uid: "api::article.article",
  apiID: "article",
  kind: "collectionType",
  info: {
    displayName: "Article",
    singularName: "article",
    pluralName: "articles",
    description: "Blog articles",
  },
  attributes: {
    title: {
      type: "string",
      required: true,
    },
    slug: {
      type: "uid",
      required: true,
    },
    description: {
      type: "text",
      required: false,
    },
    content: {
      type: "blocks",
      required: false,
    },
    author: {
      type: "relation",
      relation: "manyToOne",
      target: "api::author.author",
    },
    category: {
      type: "relation",
      relation: "manyToOne",
      target: "api::category.category",
    },
    tags: {
      type: "relation",
      relation: "manyToMany",
      target: "api::tag.tag",
    },
    featuredImage: {
      type: "media",
      multiple: false,
      required: false,
    },
    gallery: {
      type: "media",
      multiple: true,
      required: false,
    },
    views: {
      type: "integer",
      required: false,
    },
    rating: {
      type: "decimal",
      required: false,
    },
    isFeatured: {
      type: "boolean",
    },
    publishDate: {
      type: "datetime",
      required: false,
    },
    seo: {
      type: "component",
      component: "shared.seo",
      repeatable: false,
    },
    sections: {
      type: "dynamiczone",
    },
  },
};
