export const dbQueryPage1 = {
  object: "list",
  results: [
    {
      object: "page",
      id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      created_time: "2024-03-31T05:56:00.000Z",
      last_edited_time: "2024-05-22T04:56:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      cover: null,
      icon: null,
      parent: {
        type: "database_id",
        database_id: "9c746d11-1249-4dec-82b5-6f1eebd455a8",
      },
      archived: false,
      in_trash: false,
      properties: {
        Description: {
          id: "%40ZYD",
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: {
                content: "A",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "A",
              href: null,
            },
          ],
        },
        "Self Reference": {
          id: "CNUv",
          type: "relation",
          relation: [
            {
              id: "c5d5e80b-2896-46e0-a28e-e13fd48d1e5d",
            },
          ],
          has_more: false,
        },
        "Other Reference": {
          id: "e%5CqC",
          type: "relation",
          relation: [
            {
              id: "684c87fe-d1a2-4c21-a3de-8c55dace39cd",
            },
          ],
          has_more: false,
        },
        Color: {
          id: "k%3CjV",
          type: "select",
          select: {
            id: "eDZ~",
            name: "red",
            color: "red",
          },
        },
        Title: {
          id: "title",
          type: "title",
          title: [
            {
              type: "text",
              text: {
                content: "Foo",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "Foo",
              href: null,
            },
          ],
        },
      },
      url: "https://www.notion.so/Foo-1c9435246b15431d9a3b0f91f9ce34d2",
      public_url: null,
    },
    {
      object: "page",
      id: "c5d5e80b-2896-46e0-a28e-e13fd48d1e5d",
      created_time: "2024-03-31T05:56:00.000Z",
      last_edited_time: "2024-05-22T04:57:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      cover: null,
      icon: null,
      parent: {
        type: "database_id",
        database_id: "9c746d11-1249-4dec-82b5-6f1eebd455a8",
      },
      archived: false,
      in_trash: false,
      properties: {
        Description: {
          id: "%40ZYD",
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: {
                content: "B",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "B",
              href: null,
            },
          ],
        },
        Slug: {
          id: "%40ZYE",
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: {
                content: "/bar",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "/bar",
              href: null,
            },
          ],
        },
        "Self Reference": {
          id: "CNUv",
          type: "relation",
          relation: [
            {
              id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
            },
          ],
          has_more: false,
        },
        "Other Reference": {
          id: "e%5CqC",
          type: "relation",
          relation: [],
          has_more: false,
        },
        Color: {
          id: "k%3CjV",
          type: "select",
          select: {
            id: "fr>r",
            name: "blue",
            color: "blue",
          },
        },
        Title: {
          id: "title",
          type: "title",
          title: [
            {
              type: "text",
              text: {
                content: "Bar",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "Bar",
              href: null,
            },
          ],
        },
      },
      url: "https://www.notion.so/Bar-c5d5e80b289646e0a28ee13fd48d1e5d",
      public_url: null,
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "page_or_database",
  page_or_database: {},
  request_id: "41ec9116-6053-4944-aa31-7bd412a6ffe9",
};
