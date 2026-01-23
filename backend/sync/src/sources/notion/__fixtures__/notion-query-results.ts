import { ListBlockChildrenResponse } from "notion-client-web-fetch/build/src/api-endpoints";

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
} as ListBlockChildrenResponse;

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
        {
          type: "file",
          file: { url: "https://s3.amazonaws.com/file1.pdf" },
          name: "file1.pdf",
        },
        {
          type: "external",
          external: { url: "https://example.com/file2.pdf" },
          name: "file2.pdf",
        },
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

// Showcase page fixture - fetched from Notion page 2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17
// This page demonstrates various property types and block types

export const showcasePageResponse = {
  object: "page",
  id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
  created_time: "2026-01-11T13:04:00.000Z",
  last_edited_time: "2026-01-11T15:34:00.000Z",
  created_by: {
    object: "user",
    id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
  },
  last_edited_by: {
    object: "user",
    id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
  },
  cover: {
    type: "external",
    external: {
      url: "https://www.notion.so/images/page-cover/met_william_morris_1878.jpg",
    },
  },
  icon: null,
  parent: {
    type: "database_id",
    database_id: "2e5459d4-e3a9-808c-b9cf-eb1b03dc1f67",
  },
  archived: false,
  in_trash: false,
  is_locked: false,
  properties: {
    Description: {
      id: "%3Fi%5B%5B",
      type: "rich_text",
      rich_text: [
        {
          type: "text",
          text: {
            content: "Sample page used to demo different block types.",
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
          plain_text: "Sample page used to demo different block types.",
          href: null,
        },
      ],
    },
    "Reference URL": {
      id: "AiR%3C",
      type: "url",
      url: "https://www.notion.so",
    },
    Owner: {
      id: "Fk%3C%3E",
      type: "people",
      people: [
        {
          object: "user",
          id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
          name: "Sven Rogge",
          avatar_url:
            "https://s3-us-west-2.amazonaws.com/public.notion-static.com/47e7b45e-8b6a-4c84-bb05-f8c63a0231e0/Portrait-bg.webp",
          type: "person",
          person: {
            email: "sreglitzki@gmail.com",
          },
        },
      ],
    },
    "Estimate (hours)": {
      id: "XIi%5E",
      type: "number",
      number: 4,
    },
    Location: {
      id: "_CqR",
      type: "place",
      place: {
        lat: 52.52,
        lon: 13.405,
        name: "Berlin Office",
        address: "Berlin, Germany",
        aws_place_id: null,
        google_place_id: null,
      },
    },
    "Last edited time": {
      id: "fA%3EU",
      type: "last_edited_time",
      last_edited_time: "2026-01-11T15:34:00.000Z",
    },
    Priority: {
      id: "jI%5Cq",
      type: "select",
      select: {
        id: "cwOl",
        name: "High",
        color: "red",
      },
    },
    Attachments: {
      id: "lmTb",
      type: "files",
      files: [],
    },
    slug: {
      id: "oMV%5B",
      type: "rich_text",
      rich_text: [
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
            code: false,
            color: "default",
          },
          plain_text: "foo",
          href: null,
        },
      ],
    },
    Status: {
      id: "p%3EMd",
      type: "status",
      status: {
        id: "z{PJ",
        name: "In progress",
        color: "blue",
      },
    },
    Tags: {
      id: "vv%3BG",
      type: "multi_select",
      multi_select: [
        {
          id: "N;Ea",
          name: "Demo",
          color: "blue",
        },
        {
          id: "IxLa",
          name: "Frontend",
          color: "orange",
        },
        {
          id: "cW[c",
          name: "Idea",
          color: "purple",
        },
      ],
    },
    "Created by": {
      id: "xUOp",
      type: "created_by",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
        name: "Sven Rogge",
        avatar_url:
          "https://s3-us-west-2.amazonaws.com/public.notion-static.com/47e7b45e-8b6a-4c84-bb05-f8c63a0231e0/Portrait-bg.webp",
        type: "person",
        person: {
          email: "sreglitzki@gmail.com",
        },
      },
    },
    Completed: {
      id: "x%7DvF",
      type: "checkbox",
      checkbox: false,
    },
    "Due date": {
      id: "zJQj",
      type: "date",
      date: {
        start: "2026-01-18",
        end: null,
        time_zone: null,
      },
    },
    Name: {
      id: "title",
      type: "title",
      title: [
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
            code: false,
            color: "default",
          },
          plain_text: "foo",
          href: null,
        },
      ],
    },
  },
  url: "https://www.notion.so/foo-2e5459d4e3a980ee8dc6fa918c5f7f17",
  public_url: null,
  request_id: "7e733bca-312a-41b6-9603-beda293e6582",
};

export const showcasePageBlocks = {
  object: "list",
  results: [
    {
      object: "block",
      id: "4a858e9d-e894-402b-b555-8d0eb5f28d27",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "Demo page showing different Notion block types",
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
            plain_text: "Demo page showing different Notion block types",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "d55be760-830d-485f-a7c2-687fbf579799",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Headings",
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
            plain_text: "Headings",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "02ee45f7-4b25-4c3f-8a6c-bbdf7f1bdc9f",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_1",
      heading_1: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Heading 1",
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
            plain_text: "Heading 1",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "c080262f-5bcc-4dbc-bb6f-a7bbf4587636",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Heading 2",
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
            plain_text: "Heading 2",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "ce75a656-3cd6-43c1-acac-aa514158222b",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Heading 3",
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
            plain_text: "Heading 3",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "d75a52b6-0fec-46ef-ac4c-06e0b830b238",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "Regular paragraph text with some ",
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
            plain_text: "Regular paragraph text with some ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "bold",
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
            plain_text: "bold",
            href: null,
          },
          {
            type: "text",
            text: {
              content: ", ",
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
            plain_text: ", ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "italic",
              link: null,
            },
            annotations: {
              bold: false,
              italic: true,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "italic",
            href: null,
          },
          {
            type: "text",
            text: {
              content: ", ",
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
            plain_text: ", ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "strikethrough",
              link: null,
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: true,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "strikethrough",
            href: null,
          },
          {
            type: "text",
            text: {
              content: ", and ",
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
            plain_text: ", and ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "underlined",
              link: null,
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: true,
              code: false,
              color: "default",
            },
            plain_text: "underlined",
            href: null,
          },
          {
            type: "text",
            text: {
              content: " text. Here is a ",
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
            plain_text: " text. Here is a ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "link",
              link: {
                url: "https://www.notion.so/",
              },
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "link",
            href: "https://www.notion.so/",
          },
          {
            type: "text",
            text: {
              content: ".",
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
            plain_text: ".",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "ccd5a908-bca2-4cf5-bbe3-8a308a58f6d7",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "Inline code example: ",
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
            plain_text: "Inline code example: ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "const x = 42;",
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
            plain_text: "const x = 42;",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "3b372519-0398-4037-b501-5f508fd5c600",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "Inline math example: ",
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
            plain_text: "Inline math example: ",
            href: null,
          },
          {
            type: "equation",
            equation: {
              expression: "x^2 + y^2 = z^2",
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "x^2 + y^2 = z^2",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "a031f630-fd63-4c17-a9f3-78bffda83481",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "6a739244-55c2-4e77-9ce9-7b71a5f73caf",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Bulleted and numbered lists",
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
            plain_text: "Bulleted and numbered lists",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "1cc9f797-c3fb-4326-a160-f3ed80d68972",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "First bullet item",
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
            plain_text: "First bullet item",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "01249d98-1423-47d3-bbf2-a6d6917ee786",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "Second bullet item with ",
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
            plain_text: "Second bullet item with ",
            href: null,
          },
          {
            type: "text",
            text: {
              content: "bold",
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
            plain_text: "bold",
            href: null,
          },
          {
            type: "text",
            text: {
              content: " text",
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
            plain_text: " text",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "bcfd64bf-bded-4913-8515-43e9470f8b83",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "Third bullet item",
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
            plain_text: "Third bullet item",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "3c2c967a-7995-4903-b168-367efce249c3",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "First numbered item",
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
            plain_text: "First numbered item",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "d0359277-4f39-4cd5-b44f-9614e277ab73",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Second numbered item",
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
            plain_text: "Second numbered item",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "83a4e89c-d39d-4f46-a67d-79f882594422",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content: "Third numbered item",
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
            plain_text: "Third numbered item",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "b4b61bde-3238-454e-ad9d-0de674ff587e",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "f224bfb8-29e8-47ee-a921-c6ac0ee6f38c",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "To-do list",
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
            plain_text: "To-do list",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "ad8ea961-4e99-41f0-99e0-2e57032f26eb",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "to_do",
      to_do: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Unchecked task",
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
            plain_text: "Unchecked task",
            href: null,
          },
        ],
        checked: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "41b22d64-1f10-4752-8aa0-392c492bc97e",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "to_do",
      to_do: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Completed task",
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
            plain_text: "Completed task",
            href: null,
          },
        ],
        checked: true,
        color: "default",
      },
    },
    {
      object: "block",
      id: "2affe67b-baa1-4176-a21e-4ac165be12d7",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "d62f0804-bbd2-4386-be5a-8e7ccefbfb73",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Quote",
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
            plain_text: "Quote",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "beec1b4e-7c1f-4d7b-8674-1d546f9ae936",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
              content:
                "This is a quote block showing an inspirational sentence.\nSecond line of the same quote.",
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
            plain_text:
              "This is a quote block showing an inspirational sentence.\nSecond line of the same quote.",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "420eb48b-5a66-42ec-b2ec-300bf780f2ed",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "2f51ea3f-3aa2-4c5d-b5ff-678be24a0f27",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Toggle blocks",
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
            plain_text: "Toggle blocks",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "9f67fa3f-1cf2-4e7f-84b8-82aac915439d",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "toggle",
      toggle: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Click to open this toggle",
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
            plain_text: "Click to open this toggle",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "e2b3a375-2a63-4e2d-a2fa-05c31a54f263",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_1",
      heading_1: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Toggle heading 1",
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
            plain_text: "Toggle heading 1",
            href: null,
          },
        ],
        is_toggleable: true,
        color: "default",
      },
    },
    {
      object: "block",
      id: "2cf9ce44-64de-4837-aa20-4706861ff603",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Toggle heading 2",
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
            plain_text: "Toggle heading 2",
            href: null,
          },
        ],
        is_toggleable: true,
        color: "default",
      },
    },
    {
      object: "block",
      id: "b91aac3e-d833-4df5-9084-284e57b7e9c5",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Toggle heading 3",
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
            plain_text: "Toggle heading 3",
            href: null,
          },
        ],
        is_toggleable: true,
        color: "default",
      },
    },
    {
      object: "block",
      id: "78e1c84a-29d9-4644-8d5f-768dada69027",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "c49e17fd-e3f1-46d6-b798-fc1985c049e0",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Callout",
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
            plain_text: "Callout",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "0f12a595-eba7-4e91-a774-87cb19c753b5",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "callout",
      callout: {
        rich_text: [
          {
            type: "text",
            text: {
              content:
                "This is a callout block. Use it to highlight important information or tips.",
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
            plain_text:
              "This is a callout block. Use it to highlight important information or tips.",
            href: null,
          },
        ],
        icon: {
          type: "emoji",
          emoji: "💡",
        },
        color: "yellow_background",
      },
    },
    {
      object: "block",
      id: "54e2b0a5-1050-448d-8df6-c5455dadbc5e",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "5644a952-5f18-4d83-baee-62d7c8eba1bd",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Columns",
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
            plain_text: "Columns",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "96c11511-10a6-4761-b512-3512c61cddc7",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "column_list",
      column_list: {},
    },
    {
      object: "block",
      id: "dbd92fe6-527a-429a-b2a9-7b0360def469",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "562ac785-c7c6-44b6-8999-b6d86ef1c3a4",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Table",
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
            plain_text: "Table",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "d7d29a68-37c2-4589-aa32-ee3077f73973",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
      },
    },
    {
      object: "block",
      id: "7ff2ed12-661f-4356-a621-b09fc0c8b3b6",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "33d9f3c7-d9d4-41cd-9025-0209a9d1eaff",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Code block",
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
            plain_text: "Code block",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "4de2edf6-f1ea-466b-a4bb-2c70d1091366",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "code",
      code: {
        caption: [],
        rich_text: [
          {
            type: "text",
            text: {
              content:
                'function greet(name) {\n  console.log(`Hello, ${name}!`);\n}\n\ngreet("Notion user");',
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
            plain_text:
              'function greet(name) {\n  console.log(`Hello, ${name}!`);\n}\n\ngreet("Notion user");',
            href: null,
          },
        ],
        language: "javascript",
      },
    },
    {
      object: "block",
      id: "1e2e1ed2-928d-4bb9-85b3-aac8c57b3f78",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "2446b0a9-440e-4e2c-be31-7101350a63b5",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Media embeds",
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
            plain_text: "Media embeds",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "30c78f27-d9d6-47de-84f2-6ba406510829",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "image",
      image: {
        caption: [
          {
            type: "text",
            text: {
              content: "Example image",
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
            plain_text: "Example image",
            href: null,
          },
        ],
        type: "external",
        external: {
          url: "https://upload.wikimedia.org/wikipedia/commons/b/bf/Golden_Gate_Bridge_as_seen_from_Battery_East.jpg",
        },
      },
    },
    {
      object: "block",
      id: "13445e3f-54fb-485d-bd0b-e140c1c6f5b8",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "video",
      video: {
        caption: [
          {
            type: "text",
            text: {
              content: "Example video",
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
            plain_text: "Example video",
            href: null,
          },
        ],
        type: "external",
        external: {
          url: "https://www.youtube.com/watch?v=oTahLEX3NXo",
        },
      },
    },
    {
      object: "block",
      id: "4dbe64ec-ce57-467e-9f9d-168a971a2808",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "audio",
      audio: {
        caption: [
          {
            type: "text",
            text: {
              content: "Example audio",
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
            plain_text: "Example audio",
            href: null,
          },
        ],
        type: "external",
        external: {
          url: "https://upload.wikimedia.org/wikipedia/commons/0/04/Beach_sounds_South_Carolina.ogg",
        },
      },
    },
    {
      object: "block",
      id: "fc0dcb6d-57e4-499e-98f5-2e0571c62ab5",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "d50923a8-aa20-4c88-a0b3-66ad3eb7ed85",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Divider",
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
            plain_text: "Divider",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "9df2abd1-7f84-49f0-a5df-a2050ae3655f",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "Above is a divider line separating sections.",
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
            plain_text: "Above is a divider line separating sections.",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "f97ca75b-f89d-431c-b001-7e483d3d3fb6",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "ec63e727-7775-4f63-884f-400d86bd07d6",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Synced block example",
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
            plain_text: "Synced block example",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "1a46f9f6-794d-4911-b0e4-483fc0df8224",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "synced_block",
      synced_block: {
        synced_from: null,
      },
    },
    {
      object: "block",
      id: "fe178dfa-816a-4c30-90d2-d07be1769fa8",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "0573804e-81da-4bf8-b25c-68ea9f6ed665",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Inline database placeholder",
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
            plain_text: "Inline database placeholder",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "339bb5dc-75bf-4c76-a6f2-c290492c2e02",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:31:00.000Z",
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
      type: "child_database",
      child_database: {
        title: "Sample inline database",
      },
    },
    {
      object: "block",
      id: "8b8f9e83-c588-4f5e-a3e8-52b25fa6a4da",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "You can customize this database (properties, views, filters) as needed.",
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
            plain_text: "You can customize this database (properties, views, filters) as needed.",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "a84e2551-5319-481d-b5b5-0fa75ceeaf3a",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "6bca0bd9-2c20-4189-a6cf-845cbdd38518",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Meeting notes block",
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
            plain_text: "Meeting notes block",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "be27e25c-8087-4bd6-adfe-5b1cc22fabae",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "unsupported",
      unsupported: {},
    },
    {
      object: "block",
      id: "3890d106-71b3-4ab6-a6d9-64780fbf2e02",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "145204e9-6762-48b1-84bb-061b5214acd3",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Table of contents",
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
            plain_text: "Table of contents",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "55a9f4a4-241d-4356-b576-9f1bd6b2bbad",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content:
                "This is where a table of contents block would go (it works best on longer documents):",
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
            plain_text:
              "This is where a table of contents block would go (it works best on longer documents):",
            href: null,
          },
        ],
        color: "default",
      },
    },
    {
      object: "block",
      id: "e843f317-0c54-4b43-93fc-2a1b04941e1b",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "table_of_contents",
      table_of_contents: {
        color: "default",
      },
    },
    {
      object: "block",
      id: "da7d5799-7584-48c1-bfb6-4f0d312eb0bb",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "divider",
      divider: {},
    },
    {
      object: "block",
      id: "55ac7df7-0039-4a7f-a1da-581195bbf4d1",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
      type: "heading_3",
      heading_3: {
        rich_text: [
          {
            type: "text",
            text: {
              content: "Date and user mentions",
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
            plain_text: "Date and user mentions",
            href: null,
          },
        ],
        is_toggleable: false,
        color: "default",
      },
    },
    {
      object: "block",
      id: "d93995a6-4e9b-4ced-84fb-5e1a77a81d9c",
      parent: {
        type: "page_id",
        page_id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      },
      created_time: "2026-01-11T15:30:00.000Z",
      last_edited_time: "2026-01-11T15:30:00.000Z",
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
        rich_text: [
          {
            type: "text",
            text: {
              content: "Today is ",
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
            plain_text: "Today is ",
            href: null,
          },
          {
            type: "mention",
            mention: {
              type: "date",
              date: {
                start: "2026-01-11",
                end: null,
                time_zone: null,
              },
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "2026-01-11",
            href: null,
          },
          {
            type: "text",
            text: {
              content: " and this page was created for ",
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
            plain_text: " and this page was created for ",
            href: null,
          },
          {
            type: "mention",
            mention: {
              type: "user",
              user: {
                object: "user",
                id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
                name: "Sven Rogge",
                avatar_url:
                  "https://s3-us-west-2.amazonaws.com/public.notion-static.com/47e7b45e-8b6a-4c84-bb05-f8c63a0231e0/Portrait-bg.webp",
                type: "person",
                person: {
                  email: "sreglitzki@gmail.com",
                },
              },
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "@Sven Rogge",
            href: null,
          },
          {
            type: "text",
            text: {
              content: ".",
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
            plain_text: ".",
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
};

export const showcasePageChildBlocks: Record<string, ListBlockChildrenResponse> = {
  "01249d98-1423-47d3-bbf2-a6d6917ee786": {
    object: "list",
    results: [
      {
        object: "block",
        id: "3c00e1ab-5b93-4e70-b65e-6ca8c75ec2c6",
        parent: {
          type: "block_id",
          block_id: "01249d98-1423-47d3-bbf2-a6d6917ee786",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
                content: "Nested bullet item",
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
              plain_text: "Nested bullet item",
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
  },
  "d0359277-4f39-4cd5-b44f-9614e277ab73": {
    object: "list",
    results: [
      {
        object: "block",
        id: "ee3af2c6-5e09-4ace-8e4d-f66e2a3f8983",
        parent: {
          type: "block_id",
          block_id: "d0359277-4f39-4cd5-b44f-9614e277ab73",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
                content: "Nested numbered item",
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
              plain_text: "Nested numbered item",
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
  },
  "41b22d64-1f10-4752-8aa0-392c492bc97e": {
    object: "list",
    results: [
      {
        object: "block",
        id: "f4912bde-47bc-4d0e-995b-69c5b62c8be0",
        parent: {
          type: "block_id",
          block_id: "41b22d64-1f10-4752-8aa0-392c492bc97e",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
        type: "to_do",
        to_do: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Nested sub-task",
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
              plain_text: "Nested sub-task",
              href: null,
            },
          ],
          checked: false,
          color: "default",
        },
      },
    ],
    next_cursor: null,
    has_more: false,
    type: "block",
    block: {},
  },
  "9f67fa3f-1cf2-4e7f-84b8-82aac915439d": {
    object: "list",
    results: [
      {
        object: "block",
        id: "544b7126-713c-4932-b184-2ba1d70ee373",
        parent: {
          type: "block_id",
          block_id: "9f67fa3f-1cf2-4e7f-84b8-82aac915439d",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
          rich_text: [
            {
              type: "text",
              text: {
                content: "This is content inside a regular toggle.",
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
              plain_text: "This is content inside a regular toggle.",
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
  },
  "e2b3a375-2a63-4e2d-a2fa-05c31a54f263": {
    object: "list",
    results: [
      {
        object: "block",
        id: "a2145b31-0a9b-447d-b058-1bc9aefd05fe",
        parent: {
          type: "block_id",
          block_id: "e2b3a375-2a63-4e2d-a2fa-05c31a54f263",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
          rich_text: [
            {
              type: "text",
              text: {
                content: "Content under a heading 1 style toggle.",
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
              plain_text: "Content under a heading 1 style toggle.",
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
  },
  "2cf9ce44-64de-4837-aa20-4706861ff603": {
    object: "list",
    results: [
      {
        object: "block",
        id: "3829a8f2-191d-456a-bc5d-d7605938212f",
        parent: {
          type: "block_id",
          block_id: "2cf9ce44-64de-4837-aa20-4706861ff603",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
          rich_text: [
            {
              type: "text",
              text: {
                content: "Content under a heading 2 style toggle.",
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
              plain_text: "Content under a heading 2 style toggle.",
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
  },
  "b91aac3e-d833-4df5-9084-284e57b7e9c5": {
    object: "list",
    results: [
      {
        object: "block",
        id: "db1f27cc-8b38-4b1d-a4dd-a3186a3c4759",
        parent: {
          type: "block_id",
          block_id: "b91aac3e-d833-4df5-9084-284e57b7e9c5",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
          rich_text: [
            {
              type: "text",
              text: {
                content: "Content under a heading 3 style toggle.",
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
              plain_text: "Content under a heading 3 style toggle.",
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
  },
  "96c11511-10a6-4761-b512-3512c61cddc7": {
    object: "list",
    results: [
      {
        object: "block",
        id: "5d536afb-216b-4a14-b426-49444b62c6b5",
        parent: {
          type: "block_id",
          block_id: "96c11511-10a6-4761-b512-3512c61cddc7",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
        type: "column",
        column: {},
      },
      {
        object: "block",
        id: "86786c77-4b15-4a00-8114-3b1f97992a84",
        parent: {
          type: "block_id",
          block_id: "96c11511-10a6-4761-b512-3512c61cddc7",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
        type: "column",
        column: {},
      },
    ],
    next_cursor: null,
    has_more: false,
    type: "block",
    block: {},
  },
  "d7d29a68-37c2-4589-aa32-ee3077f73973": {
    object: "list",
    results: [
      {
        object: "block",
        id: "0c21b83b-94a6-4fa5-b81f-97f79655a048",
        parent: {
          type: "block_id",
          block_id: "d7d29a68-37c2-4589-aa32-ee3077f73973",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
                  content: "Feature",
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
                plain_text: "Feature",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Description",
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
                plain_text: "Description",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Enabled?",
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
                plain_text: "Enabled?",
                href: null,
              },
            ],
          ],
        },
      },
      {
        object: "block",
        id: "d4ff505d-8791-4fdd-863a-51577aff741a",
        parent: {
          type: "block_id",
          block_id: "d7d29a68-37c2-4589-aa32-ee3077f73973",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
                  content: "Headings",
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
                plain_text: "Headings",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Different levels of titles",
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
                plain_text: "Different levels of titles",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Yes",
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
                plain_text: "Yes",
                href: null,
              },
            ],
          ],
        },
      },
      {
        object: "block",
        id: "93117421-196a-42d4-b5f0-b2c1654e4512",
        parent: {
          type: "block_id",
          block_id: "d7d29a68-37c2-4589-aa32-ee3077f73973",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
                  content: "Lists",
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
                plain_text: "Lists",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Bulleted, numbered, and to-dos",
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
                plain_text: "Bulleted, numbered, and to-dos",
                href: null,
              },
            ],
            [
              {
                type: "text",
                text: {
                  content: "Yes",
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
                plain_text: "Yes",
                href: null,
              },
            ],
          ],
        },
      },
    ],
    next_cursor: null,
    has_more: false,
    type: "block",
    block: {},
  },
  "1a46f9f6-794d-4911-b0e4-483fc0df8224": {
    object: "list",
    results: [
      {
        object: "block",
        id: "65a728f3-09bd-49f6-80fd-f91ec3b9c589",
        parent: {
          type: "block_id",
          block_id: "1a46f9f6-794d-4911-b0e4-483fc0df8224",
        },
        created_time: "2026-01-11T15:30:00.000Z",
        last_edited_time: "2026-01-11T15:30:00.000Z",
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
          rich_text: [
            {
              type: "text",
              text: {
                content:
                  "This is the original synced block. You can copy and paste it elsewhere in this workspace to keep content in sync.",
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
              plain_text:
                "This is the original synced block. You can copy and paste it elsewhere in this workspace to keep content in sync.",
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
  },
};

export const showcasePageQueryResult = {
  object: "list",
  results: [
    {
      object: "page",
      id: "2e5459d4-e3a9-80ee-8dc6-fa918c5f7f17",
      created_time: "2026-01-11T13:04:00.000Z",
      last_edited_time: "2026-01-11T15:34:00.000Z",
      created_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      last_edited_by: {
        object: "user",
        id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
      },
      cover: {
        type: "external",
        external: {
          url: "https://www.notion.so/images/page-cover/met_william_morris_1878.jpg",
        },
      },
      icon: null,
      parent: {
        type: "database_id",
        database_id: "2e5459d4-e3a9-808c-b9cf-eb1b03dc1f67",
      },
      archived: false,
      in_trash: false,
      is_locked: false,
      properties: {
        Description: {
          id: "%3Fi%5B%5B",
          type: "rich_text",
          rich_text: [
            {
              type: "text",
              text: {
                content: "Sample page used to demo different block types.",
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
              plain_text: "Sample page used to demo different block types.",
              href: null,
            },
          ],
        },
        "Reference URL": {
          id: "AiR%3C",
          type: "url",
          url: "https://www.notion.so",
        },
        Owner: {
          id: "Fk%3C%3E",
          type: "people",
          people: [
            {
              object: "user",
              id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
              name: "Sven Rogge",
              avatar_url:
                "https://s3-us-west-2.amazonaws.com/public.notion-static.com/47e7b45e-8b6a-4c84-bb05-f8c63a0231e0/Portrait-bg.webp",
              type: "person",
              person: {
                email: "sreglitzki@gmail.com",
              },
            },
          ],
        },
        "Estimate (hours)": {
          id: "XIi%5E",
          type: "number",
          number: 4,
        },
        Location: {
          id: "_CqR",
          type: "place",
          place: {
            lat: 52.52,
            lon: 13.405,
            name: "Berlin Office",
            address: "Berlin, Germany",
            aws_place_id: null,
            google_place_id: null,
          },
        },
        "Last edited time": {
          id: "fA%3EU",
          type: "last_edited_time",
          last_edited_time: "2026-01-11T15:34:00.000Z",
        },
        Priority: {
          id: "jI%5Cq",
          type: "select",
          select: {
            id: "cwOl",
            name: "High",
            color: "red",
          },
        },
        Attachments: {
          id: "lmTb",
          type: "files",
          files: [],
        },
        slug: {
          id: "oMV%5B",
          type: "rich_text",
          rich_text: [
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
                code: false,
                color: "default",
              },
              plain_text: "foo",
              href: null,
            },
          ],
        },
        Status: {
          id: "p%3EMd",
          type: "status",
          status: {
            id: "z{PJ",
            name: "In progress",
            color: "blue",
          },
        },
        Tags: {
          id: "vv%3BG",
          type: "multi_select",
          multi_select: [
            {
              id: "N;Ea",
              name: "Demo",
              color: "blue",
            },
            {
              id: "IxLa",
              name: "Frontend",
              color: "orange",
            },
            {
              id: "cW[c",
              name: "Idea",
              color: "purple",
            },
          ],
        },
        "Created by": {
          id: "xUOp",
          type: "created_by",
          created_by: {
            object: "user",
            id: "c4a3bd41-1dcc-4b87-a45b-f7705fd7717f",
            name: "Sven Rogge",
            avatar_url:
              "https://s3-us-west-2.amazonaws.com/public.notion-static.com/47e7b45e-8b6a-4c84-bb05-f8c63a0231e0/Portrait-bg.webp",
            type: "person",
            person: {
              email: "sreglitzki@gmail.com",
            },
          },
        },
        Completed: {
          id: "x%7DvF",
          type: "checkbox",
          checkbox: false,
        },
        "Due date": {
          id: "zJQj",
          type: "date",
          date: {
            start: "2026-01-18",
            end: null,
            time_zone: null,
          },
        },
        Name: {
          id: "title",
          type: "title",
          title: [
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
                code: false,
                color: "default",
              },
              plain_text: "foo",
              href: null,
            },
          ],
        },
      },
      url: "https://www.notion.so/foo-2e5459d4e3a980ee8dc6fa918c5f7f17",
      public_url: null,
      request_id: "7e733bca-312a-41b6-9603-beda293e6582",
    },
  ],
  next_cursor: null,
  has_more: false,
  type: "page_or_database",
  page_or_database: {},
};
