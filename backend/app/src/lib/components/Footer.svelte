<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
  <div class="container mx-auto px-4 py-8">
    <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
      <div>
        <a href="/" class="inline-block">
          <img
            src="/logo.svg"
            alt="Contfu"
            height={48}
            width={134}
            class="h-10 hidden md:block"
          />
          <img
            src="/favicon.svg"
            alt="Contfu"
            height={48}
            width={48}
            class="h-10 block md:hidden"
          />
        </a>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">
          &copy; {currentYear} Contfu. All rights reserved.
        </p>
      </div>

      <div>
        <h3 class="font-semibold text-gray-900 dark:text-white">Navigation</h3>
        <ul class="mt-4 space-y-2">
          <li>
            <a
              href="/"
              class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="/#pricing"
              class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Pricing
            </a>
          </li>
          <li>
            <a
              href="/dashboard"
              class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Dashboard
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="font-semibold text-gray-900 dark:text-white">Legal</h3>
        <ul class="mt-4 space-y-2">
          <li>
            <a
              href="/privacy"
              class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <a
              href="/legal"
              class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Legal Notice
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</footer>
