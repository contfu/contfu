import { renderComponent, renderSnippet } from "$lib/components/ui/data-table/index.js";
import type { BackendUserSummary } from "@contfu/svc-backend/domain/types";
import { UserRole } from "@contfu/svc-backend/domain/types";
import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import DataTableActions from "./data-table-actions.svelte";
import DataTableRoleBadge from "./data-table-role-badge.svelte";
import DataTableStatusBadge from "./data-table-status-badge.svelte";

export const columns: ColumnDef<BackendUserSummary>[] = [
  {
    accessorKey: "name",
    header: "User",
    enableSorting: true,
    enableGlobalFilter: true,
    cell: ({ row }) => {
      const userCellSnippet = createRawSnippet<[{ name: string; email: string }]>((getUser) => {
        const { name, email } = getUser();
        return {
          render: () => `
            <div>
              <p class="font-medium">${name}</p>
              <p class="text-sm text-muted-foreground">${email}</p>
            </div>
          `,
        };
      });
      return renderSnippet(userCellSnippet, { name: row.original.name, email: row.original.email });
    },
    filterFn: (row, _columnId, filterValue: string) => {
      const name = row.original.name.toLowerCase();
      const email = row.original.email.toLowerCase();
      const search = filterValue.toLowerCase();
      return name.includes(search) || email.includes(search);
    },
  },
  {
    accessorKey: "approved",
    header: "Status",
    enableSorting: true,
    cell: ({ row }) => {
      return renderComponent(DataTableStatusBadge, { approved: row.original.approved });
    },
    filterFn: (row, _columnId, filterValue: string | undefined) => {
      if (!filterValue || filterValue === "all") return true;
      if (filterValue === "approved") return row.original.approved === true;
      if (filterValue === "pending") return row.original.approved === false;
      return true;
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    enableSorting: true,
    cell: ({ row }) => {
      return renderComponent(DataTableRoleBadge, { role: row.original.role });
    },
    filterFn: (row, _columnId, filterValue: string | undefined) => {
      if (!filterValue || filterValue === "all") return true;
      if (filterValue === "admin") return row.original.role === UserRole.ADMIN;
      if (filterValue === "user") return row.original.role === UserRole.USER;
      return true;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Joined",
    enableSorting: true,
    cell: ({ row }) => {
      const dateSnippet = createRawSnippet<[{ date: string }]>((getData) => {
        const { date } = getData();
        return {
          render: () => `<span class="text-sm text-muted-foreground">${date}</span>`,
        };
      });
      const formatted = new Date(row.original.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return renderSnippet(dateSnippet, { date: formatted });
    },
    sortingFn: (rowA, rowB) => {
      return (
        new Date(rowA.original.createdAt).getTime() - new Date(rowB.original.createdAt).getTime()
      );
    },
  },
  {
    id: "actions",
    header: () => {
      const headerSnippet = createRawSnippet(() => ({
        render: () => `<span class="sr-only">Actions</span>`,
      }));
      return renderSnippet(headerSnippet);
    },
    cell: ({ row }) => {
      return renderComponent(DataTableActions, { user: row.original });
    },
  },
];
