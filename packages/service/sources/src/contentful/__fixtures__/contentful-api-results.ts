import type { ContentfulContentType, ContentfulEntry, ContentfulResponse } from "../contentful";

export const blogPostEntry1: ContentfulEntry = {
  sys: {
    id: "abc123def456",
    type: "Entry",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T12:00:00.000Z",
    contentType: {
      sys: {
        id: "blogPost",
      },
    },
  },
  fields: {
    title: {
      "en-US": "Getting Started with Contentful",
    },
    slug: {
      "en-US": "getting-started-contentful",
    },
    body: {
      "en-US": {
        nodeType: "document",
        data: {},
        content: [
          {
            nodeType: "paragraph",
            data: {},
            content: [
              {
                nodeType: "text",
                value: "This is the first paragraph of the blog post.",
                marks: [],
              },
            ],
          },
          {
            nodeType: "heading-2",
            data: {},
            content: [
              {
                nodeType: "text",
                value: "Introduction",
                marks: [{ type: "bold" }],
              },
            ],
          },
        ],
      },
    },
  },
};

export const blogPostEntry2: ContentfulEntry = {
  sys: {
    id: "ghi789jkl012",
    type: "Entry",
    createdAt: "2024-01-20T08:00:00.000Z",
    updatedAt: "2024-01-20T09:00:00.000Z",
    contentType: {
      sys: {
        id: "blogPost",
      },
    },
  },
  fields: {
    title: {
      "en-US": "Advanced Contentful Features",
    },
    slug: {
      "en-US": "advanced-contentful",
    },
    published: {
      "en-US": true,
    },
    views: {
      "en-US": 1500,
    },
  },
};

export const blogPostSchema: ContentfulContentType = {
  sys: {
    id: "blogPost",
    type: "ContentType",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  name: "Blog Post",
  description: "A blog post entry",
  displayField: "title",
  fields: [
    {
      id: "title",
      name: "Title",
      type: "Symbol",
      required: true,
    },
    {
      id: "slug",
      name: "Slug",
      type: "Symbol",
      required: true,
    },
    {
      id: "body",
      name: "Body",
      type: "RichText",
      required: false,
    },
    {
      id: "published",
      name: "Published",
      type: "Boolean",
      required: false,
    },
    {
      id: "views",
      name: "Views",
      type: "Integer",
      required: false,
    },
    {
      id: "publishDate",
      name: "Publish Date",
      type: "Date",
      required: false,
    },
    {
      id: "author",
      name: "Author",
      type: "Link",
      validations: [{ linkContentType: ["author"] }],
    },
    {
      id: "tags",
      name: "Tags",
      type: "Array",
      validations: [{ linkContentType: ["tag"] }],
    },
  ],
};

export const entriesPage1: ContentfulResponse<ContentfulEntry> = {
  sys: {
    type: "Array",
    total: 3,
    limit: 2,
    skip: 0,
  },
  items: [blogPostEntry1, blogPostEntry2],
};

export const blogPostEntry3: ContentfulEntry = {
  sys: {
    id: "mno345pqr678",
    type: "Entry",
    createdAt: "2024-01-25T14:00:00.000Z",
    updatedAt: "2024-01-25T15:00:00.000Z",
    contentType: {
      sys: {
        id: "blogPost",
      },
    },
  },
  fields: {
    title: {
      "en-US": "Contentful Best Practices",
    },
    slug: {
      "en-US": "contentful-best-practices",
    },
  },
};

export const entriesPage2: ContentfulResponse<ContentfulEntry> = {
  sys: {
    type: "Array",
    total: 3,
    limit: 2,
    skip: 2,
  },
  items: [blogPostEntry3],
};
