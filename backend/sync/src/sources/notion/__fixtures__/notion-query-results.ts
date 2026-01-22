export const dbQueryResult1 = {
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
};
export const dbQueryResult2 = {
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
};
export const dbQueryPage1 = {
  object: "list",
  results: [dbQueryResult1, dbQueryResult2],
  next_cursor: null,
  has_more: false,
  type: "page_or_database",
  page_or_database: {},
  request_id: "41ec9116-6053-4944-aa31-7bd412a6ffe9",
};

export const page1 = {
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

export const tableContent = {
  object: "list",
  results: [
    {
      object: "block",
      id: "ee703f6c-dce1-4ba1-9c5b-bc057a47cb31",
      parent: {
        type: "block_id",
        block_id: "8f19d366-a373-4461-8129-090ba83e204a",
      },
      created_time: "2024-05-25T08:30:00.000Z",
      last_edited_time: "2024-05-25T08:30:00.000Z",
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
      type: "table_row",
      table_row: {
        cells: [
          [
            {
              type: "text",
              text: {
                content: "a",
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
              plain_text: "a",
              href: null,
            },
          ],
          [
            {
              type: "text",
              text: {
                content: "b",
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
              plain_text: "b",
              href: null,
            },
          ],
        ],
      },
    },
    {
      object: "block",
      id: "05cd9162-522f-4a89-bcd7-ab0c56456f6d",
      parent: {
        type: "block_id",
        block_id: "8f19d366-a373-4461-8129-090ba83e204a",
      },
      created_time: "2024-05-25T08:30:00.000Z",
      last_edited_time: "2024-05-25T10:09:00.000Z",
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
      type: "table_row",
      table_row: {
        cells: [
          [
            {
              type: "text",
              text: {
                content: "x ",
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
              plain_text: "x ",
              href: null,
            },
            {
              type: "text",
              text: {
                content: "foo",
                link: null,
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: true,
                color: "default",
              },
              plain_text: "foo",
              href: null,
            },
          ],
          [
            {
              type: "text",
              text: {
                content: "y",
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
              plain_text: "y",
              href: null,
            },
          ],
        ],
      },
    },
    {
      object: "block",
      id: "82d7a326-575e-49dc-83d6-6bc1e6150541",
      parent: {
        type: "block_id",
        block_id: "8f19d366-a373-4461-8129-090ba83e204a",
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
      has_children: false,
      archived: false,
      in_trash: false,
      type: "table_row",
      table_row: {
        cells: [[], []],
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
  request_id: "918187d2-56e3-462e-8651-fe6301b38b4a",
};

export const childList = {
  object: "list",
  results: [
    {
      object: "block",
      id: "5086768e-63d7-4d5c-8d6d-d02e8a06bd18",
      parent: {},
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
              content: "tmsreia",
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
            plain_text: "tmsreia",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "4919c1c3-54d0-4bd8-a1a7-87039be9beaf",
      parent: {
        type: "block_id",
        block_id: "15e26736-4959-4e51-86fe-1f3bcafc6321",
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
              content: "tsrenia",
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
            plain_text: "tsrenia",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "e0b85847-5f5d-417d-807e-7b61e11da8db",
      parent: {
        type: "block_id",
        block_id: "15e26736-4959-4e51-86fe-1f3bcafc6321",
      },
      created_time: "2024-05-25T10:21:00.000Z",
      last_edited_time: "2024-05-25T10:23:00.000Z",
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
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "bar",
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
            plain_text: "bar",
            href: null,
          },
        ],
        color: "default",
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
  request_id: "7438846a-c6e1-4607-84c2-01cc16e080dc",
};

export const callout = {
  object: "list",
  results: [
    {
      object: "block",
      id: "4f8ac536-86e0-449b-8562-fb9e29df6cd8",
      parent: {
        type: "block_id",
        block_id: "95592c8d-35ff-4915-ab0f-73444448706a",
      },
      created_time: "2024-05-31T07:02:00.000Z",
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
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "test\nfoo\n",
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
            plain_text: "test\nfoo\n",
            href: null,
          },
        ],
        icon: {
          type: "emoji",
          emoji: "⚙",
        },
        color: "gray_background",
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
  request_id: "a2f0456f-e0ea-462d-9a7b-3e062cf12364",
};

export const emptyList = {
  object: "list",
  results: [],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
  request_id: "a2952396-58bb-45bc-b769-25f9272f09d8",
};

// Database schema response fixture
export const databaseSchemaResponse = {
  object: "database",
  id: "9c746d11-1249-4dec-82b5-6f1eebd455a8",
  created_time: "2024-01-01T00:00:00.000Z",
  last_edited_time: "2024-06-01T00:00:00.000Z",
  title: [
    {
      type: "text",
      text: { content: "Test Database", link: null },
      plain_text: "Test Database",
    },
  ],
  properties: {
    Title: {
      id: "title",
      type: "title",
      name: "Title",
      title: {},
    },
    Description: {
      id: "%40ZYD",
      type: "rich_text",
      name: "Description",
      rich_text: {},
    },
    Status: {
      id: "status-id",
      type: "status",
      name: "Status",
      status: {
        options: [
          { id: "opt1", name: "Not Started", color: "default" },
          { id: "opt2", name: "In Progress", color: "blue" },
          { id: "opt3", name: "Done", color: "green" },
        ],
        groups: [],
      },
    },
    Priority: {
      id: "priority-id",
      type: "select",
      name: "Priority",
      select: {
        options: [
          { id: "p1", name: "High", color: "red" },
          { id: "p2", name: "Medium", color: "yellow" },
          { id: "p3", name: "Low", color: "gray" },
        ],
      },
    },
    Tags: {
      id: "tags-id",
      type: "multi_select",
      name: "Tags",
      multi_select: {
        options: [
          { id: "t1", name: "Frontend", color: "blue" },
          { id: "t2", name: "Backend", color: "green" },
        ],
      },
    },
    Count: {
      id: "count-id",
      type: "number",
      name: "Count",
      number: { format: "number" },
    },
    DueDate: {
      id: "due-id",
      type: "date",
      name: "DueDate",
      date: {},
    },
    Done: {
      id: "done-id",
      type: "checkbox",
      name: "Done",
      checkbox: {},
    },
    Attachments: {
      id: "files-id",
      type: "files",
      name: "Attachments",
      files: {},
    },
    Related: {
      id: "relation-id",
      type: "relation",
      name: "Related",
      relation: {
        database_id: "other-db-id",
        type: "dual_property",
        dual_property: {},
      },
    },
    Assignees: {
      id: "people-id",
      type: "people",
      name: "Assignees",
      people: {},
    },
    CreatedAt: {
      id: "created-id",
      type: "created_time",
      name: "CreatedAt",
      created_time: {},
    },
    UpdatedAt: {
      id: "updated-id",
      type: "last_edited_time",
      name: "UpdatedAt",
      last_edited_time: {},
    },
    Creator: {
      id: "creator-id",
      type: "created_by",
      name: "Creator",
      created_by: {},
    },
    Editor: {
      id: "editor-id",
      type: "last_edited_by",
      name: "Editor",
      last_edited_by: {},
    },
    Link: {
      id: "url-id",
      type: "url",
      name: "Link",
      url: {},
    },
    Email: {
      id: "email-id",
      type: "email",
      name: "Email",
      email: {},
    },
    Phone: {
      id: "phone-id",
      type: "phone_number",
      name: "Phone",
      phone_number: {},
    },
  },
  parent: { type: "workspace", workspace: true },
  url: "https://www.notion.so/Test-Database-9c746d111249dec82b56f1eebd455a8",
};

// Additional block fixtures for comprehensive testing
export const headingBlocks = {
  object: "list",
  results: [
    {
      object: "block",
      id: "h1-block-id",
      type: "heading_1",
      has_children: false,
      heading_1: {
        rich_text: [
          {
            type: "text",
            text: { content: "Main Title", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "Main Title",
            href: null,
          },
        ],
        color: "default",
        is_toggleable: false,
      },
    },
    {
      object: "block",
      id: "h2-block-id",
      type: "heading_2",
      has_children: false,
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: { content: "Section Title", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "Section Title",
            href: null,
          },
        ],
        color: "default",
        is_toggleable: false,
      },
    },
    {
      object: "block",
      id: "h3-block-id",
      type: "heading_3",
      has_children: false,
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: { content: "Sub Section", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "Sub Section",
            href: null,
          },
        ],
        color: "default",
        is_toggleable: false,
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
};

export const codeBlock = {
  object: "list",
  results: [
    {
      object: "block",
      id: "code-block-id",
      type: "code",
      has_children: false,
      code: {
        rich_text: [
          {
            type: "text",
            text: { content: "const x = 1;\nconsole.log(x);", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "const x = 1;\nconsole.log(x);",
            href: null,
          },
        ],
        language: "javascript",
        caption: [],
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
};

export const imageBlock = {
  object: "list",
  results: [
    {
      object: "block",
      id: "image-block-id",
      type: "image",
      has_children: false,
      image: {
        type: "external",
        external: { url: "https://example.com/image.png" },
        caption: [
          {
            type: "text",
            text: { content: "Image caption", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "Image caption",
            href: null,
          },
        ],
      },
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "block",
  block: {},
};

// Page with all property types for comprehensive testing
export const pageWithAllProperties = {
  object: "page",
  id: "all-props-page-id",
  created_time: "2024-01-15T10:00:00.000Z",
  last_edited_time: "2024-06-20T15:30:00.000Z",
  created_by: { object: "user", id: "user-creator-id" },
  last_edited_by: { object: "user", id: "user-editor-id" },
  cover: {
    type: "external",
    external: { url: "https://example.com/cover.jpg" },
  },
  icon: {
    type: "external",
    external: { url: "https://example.com/icon.png" },
  },
  parent: { type: "database_id", database_id: "db-id" },
  archived: false,
  in_trash: false,
  properties: {
    Title: {
      id: "title",
      type: "title",
      title: [
        {
          type: "text",
          text: { content: "Test Page", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "Test Page",
          href: null,
        },
      ],
    },
    Description: {
      id: "desc",
      type: "rich_text",
      rich_text: [
        {
          type: "text",
          text: { content: "A test description", link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
          plain_text: "A test description",
          href: null,
        },
      ],
    },
    Count: {
      id: "count",
      type: "number",
      number: 42,
    },
    DueDate: {
      id: "due",
      type: "date",
      date: { start: "2024-12-31", end: null, time_zone: null },
    },
    Done: {
      id: "done",
      type: "checkbox",
      checkbox: true,
    },
    Status: {
      id: "status",
      type: "status",
      status: { id: "s1", name: "In Progress", color: "blue" },
    },
    Priority: {
      id: "priority",
      type: "select",
      select: { id: "p1", name: "High", color: "red" },
    },
    Tags: {
      id: "tags",
      type: "multi_select",
      multi_select: [
        { id: "t1", name: "Frontend", color: "blue" },
        { id: "t2", name: "Backend", color: "green" },
      ],
    },
    Link: {
      id: "url",
      type: "url",
      url: "https://example.com",
    },
    Email: {
      id: "email",
      type: "email",
      email: "test@example.com",
    },
    Phone: {
      id: "phone",
      type: "phone_number",
      phone_number: "+1234567890",
    },
    Attachments: {
      id: "files",
      type: "files",
      files: [
        { type: "file", file: { url: "https://s3.amazonaws.com/file1.pdf" }, name: "file1.pdf" },
        { type: "external", external: { url: "https://example.com/file2.pdf" }, name: "file2.pdf" },
      ],
    },
    Related: {
      id: "relation",
      type: "relation",
      relation: [{ id: "related-page-1" }, { id: "related-page-2" }],
      has_more: false,
    },
    Assignees: {
      id: "people",
      type: "people",
      people: [
        { object: "user", id: "user-1" },
        { object: "user", id: "user-2" },
      ],
    },
    CreatedAt: {
      id: "created",
      type: "created_time",
      created_time: "2024-01-15T10:00:00.000Z",
    },
    UpdatedAt: {
      id: "updated",
      type: "last_edited_time",
      last_edited_time: "2024-06-20T15:30:00.000Z",
    },
    Creator: {
      id: "creator",
      type: "created_by",
      created_by: { object: "user", id: "user-creator-id" },
    },
    Editor: {
      id: "editor",
      type: "last_edited_by",
      last_edited_by: { object: "user", id: "user-editor-id" },
    },
    UniqueID: {
      id: "unique",
      type: "unique_id",
      unique_id: { prefix: "TASK", number: 123 },
    },
    Verified: {
      id: "verified",
      type: "verification",
      verification: { state: "verified", verified_by: null, date: null },
    },
  },
  url: "https://www.notion.so/Test-Page-allpropspageid",
};
