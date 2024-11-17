import { component$ } from "@builder.io/qwik";

interface Source {
  id: string;
  name: string;
  type: "notion" | "strapi" | "pocketbase";
  status: "active" | "error" | "pending";
  lastSync?: string;
  collections: number;
}

const mockSources: Source[] = [
  {
    id: "1",
    name: "Company Blog",
    type: "notion",
    status: "active",
    lastSync: "2024-03-25T10:30:00Z",
    collections: 3,
  },
  {
    id: "2",
    name: "Marketing Site",
    type: "strapi",
    status: "error",
    lastSync: "2024-03-24T15:45:00Z",
    collections: 5,
  },
  {
    id: "3",
    name: "Documentation",
    type: "pocketbase",
    status: "pending",
    collections: 2,
  },
];

export default component$(() => {
  return (
    <div class="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Sources
        </h1>
        <button class="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">
          Add Source
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockSources.map((source) => (
          <div
            key={source.id}
            class="flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {source.name}
              </h3>
              <span
                class={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium
                  ${
                    source.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                      : source.status === "error"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                  }`}
              >
                {source.status}
              </span>
            </div>

            <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div class="flex items-center">
                <span class="mr-2">Type:</span>
                <span class="font-medium">{source.type}</span>
              </div>
              <div class="flex items-center">
                <span class="mr-2">Collections:</span>
                <span class="font-medium">{source.collections}</span>
              </div>
              {source.lastSync && (
                <div class="flex items-center">
                  <span class="mr-2">Last sync:</span>
                  <span class="font-medium">
                    {new Date(source.lastSync).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div class="mt-auto flex space-x-2 pt-4">
              <button class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Sync
              </button>
              <button class="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Settings
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
