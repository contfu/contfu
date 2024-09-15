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

export const pagesQuery1 = {
  object: "list",
  results: [
    {
      object: "block",
      id: "8f19d366-a373-4461-8129-090ba83e204a",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-25T08:30:00.000Z",
      last_edited_time: "2024-05-25T08:56:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: true,
      archived: false,
      in_trash: false,
      type: "table",
      table: {
        table_width: 2,
        has_column_header: true,
        has_row_header: false,
      },
    },
    {
      object: "block",
      id: "15e26736-4959-4e51-86fe-1f3bcafc6321",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-25T10:19:00.000Z",
      last_edited_time: "2024-05-25T10:23:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: true,
      archived: false,
      in_trash: false,
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Test ",
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
            plain_text: "Test ",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "a37db067-f5bf-4d75-904d-5f96758858dc",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-25T10:19:00.000Z",
      last_edited_time: "2024-05-25T10:19:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: false,
      archived: false,
      in_trash: false,
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "nsdrtaei",
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
            plain_text: "nsdrtaei",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "b82f3894-5ad8-4808-92c4-905c9721ebe8",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-31T06:51:00.000Z",
      last_edited_time: "2024-05-31T07:02:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: false,
      archived: false,
      in_trash: false,
      type: "quote",
      quote: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Test ",
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
            plain_text: "Test ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "tsrf\nBlubb ",
              link: null,
            },
            annotations: {
              bold: true,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "tsrf\nBlubb ",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "95592c8d-35ff-4915-ab0f-73444448706a",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-31T07:03:00.000Z",
      last_edited_time: "2024-05-31T07:04:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: true,
      archived: false,
      in_trash: false,
      type: "quote",
      quote: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "foo\nneih",
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
            plain_text: "foo\nneih",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "01216028-65db-4f07-b940-91bc7d9eb196",
      parent: {
        type: "page_id",
        page_id: "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
      },
      created_time: "2024-05-31T07:00:00.000Z",
      last_edited_time: "2024-05-31T07:00:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      has_children: false,
      archived: false,
      in_trash: false,
      type: "paragraph",
      paragraph: {
        rich_text: [],
        color: "default",
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
  request_id: "9053bda1-915f-48aa-a461-b4fc552bc78a",
};
