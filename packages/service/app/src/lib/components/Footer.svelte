<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-border">
  <div class="page-shell px-4 sm:px-6">
    <div class="flex items-center justify-between py-4 text-xs text-muted-foreground">
      <span>contfu &copy; {currentYear}</span>
      <nav class="flex items-center gap-4">
        <a href="/privacy" class="hover:text-foreground transition-colors duration-150">privacy</a>
        <a href="/legal" class="hover:text-foreground transition-colors duration-150">legal</a>
      </nav>
    </div>
  </div>
</footer>
