<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-border bg-background">
  <div class="mx-auto max-w-6xl px-4 sm:px-6">
    <div class="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
      <div class="flex items-center gap-4">
        <a href="/" class="flex items-center gap-2">
          <img
            src="/favicon.svg"
            alt=""
            height={20}
            width={20}
            class="h-5 w-5"
          />
          <span class="text-sm font-medium text-foreground">contfu</span>
        </a>
        <span class="text-sm text-muted-foreground">
          © {currentYear}
        </span>
      </div>

      <nav class="flex items-center gap-4 text-sm">
        <a href="/privacy" class="text-muted-foreground hover:text-foreground">
          Privacy
        </a>
        <a href="/legal" class="text-muted-foreground hover:text-foreground">
          Legal
        </a>
      </nav>
    </div>
  </div>
</footer>
