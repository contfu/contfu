<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import SourceTypeIcon from "$lib/components/icons/SourceTypeIcon.svelte";
  import { SourceType } from "@contfu/core";
  import {
    FilterIcon,
    DatabaseIcon,
    ImageIcon,
    ArrowDownIcon,
    MonitorIcon,
    BookOpenIcon,
    CodeIcon,
    RadioIcon,
    DownloadIcon,
  } from "@lucide/svelte";
  import { onMount } from "svelte";

  let { data } = $props();

  const features = [
    { cmd: "connect", title: "Connect Any CMS", description: "Notion, Strapi, Contentful -- sync them all to one database." },
    { cmd: "sync", title: "Real-Time Updates", description: "Content changes stream instantly. No polling. Sub-second propagation." },
    { cmd: "query", title: "One Schema", description: "Query all your content with a single, predictable structure." },
    { cmd: "migrate", title: "Migrate Gradually", description: "Switch CMS platforms without rewriting apps. Run sources in parallel." },
  ];

  const cmsSources = [
    { name: "notion", type: SourceType.NOTION, mode: "webhook" as const },
    { name: "strapi", type: SourceType.STRAPI, mode: "webhook" as const },
    { name: "web/url", type: SourceType.WEB, mode: "poll" as const },
  ] as const;
  const pendingSources = [
    { name: "storyblok", type: SourceType.STRAPI },
    { name: "wordpress", type: SourceType.WEB },
  ] as const;
  const appConsumers = ["website", "docs", "api"] as const;
  const contentTypes = ["page", "post", "image", "block", "asset", "entry"] as const;

  // --- Pipeline simulation ---

  type EventStage =
    | "webhook"       // webhook received / poll triggered
    | "fetching"      // fetching full content from source API
    | "filtering"     // applying filter rules
    | "mapping"       // applying property mappings
    | "pushing"       // pushing to connected consumers
    | "storing"       // client stores in local SQLite
    | "media"         // client: download assets / optimize images
    | "complete";

  type PipelineEvent = {
    id: number;
    source: string;
    contentType: string;
    title: string;
    stage: EventStage;
    isImage: boolean;
    hasAssets: boolean;
    ts: number;
  };

  type QueryEvent = { id: number; consumer: string; collection: string; items: number; latency: string; ts: number };
  type Flash = { key: string; until: number };
  type WriteOp = { id: number; contentType: string; title: string; progress: number };
  type AssetOp = { id: number; title: string; size: string; step: number; isImage: boolean };

  let events: PipelineEvent[] = $state([]);
  let queries: QueryEvent[] = $state([]);
  let flashes: Flash[] = $state([]);
  let writeOps: WriteOp[] = $state([]);
  let assetOps: AssetOp[] = $state([]);
  let eventId = 0;
  let queryId = 0;
  let writeOpId = 0;
  let assetOpId = 0;
  let totalProcessed = $state(0);
  let totalQueries = $state(0);

  function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  function flash(key: string, durationMs = 500) {
    const until = Date.now() + durationMs;
    const existing = flashes.find((f) => f.key === key);
    if (existing) { existing.until = until; }
    else { flashes.push({ key, until }); }
    setTimeout(() => { flashes = flashes.filter((f) => f.until > Date.now()); }, durationMs + 50);
  }

  function isFlashing(key: string): boolean {
    return flashes.some((f) => f.key === key && f.until > Date.now());
  }

  const titles: Record<string, string[]> = {
    page: ["About Us", "Pricing", "Home", "Contact", "FAQ", "Careers"],
    post: ["Release Notes", "How To Guide", "Case Study", "Announcement"],
    image: ["hero.webp", "og-card.png", "team-photo.jpg", "banner.svg"],
    block: ["rich-text-14", "callout-7", "table-3", "embed-9"],
    asset: ["download.pdf", "schema.json", "report.csv", "slides.pptx"],
    entry: ["config-main", "nav-header", "footer-links", "seo-defaults"],
  };
  const imageSizes = ["2.4MB", "1.1MB", "856KB", "3.2MB", "412KB"];

  function createEvent(): PipelineEvent {
    const source = pick(cmsSources).name;
    const contentType = pick(contentTypes);
    const title = pick(titles[contentType]!);
    const isImage = contentType === "image";
    // Most content has associated assets (images in rich text, thumbnails, etc.)
    const hasAssets = isImage || contentType === "asset" || Math.random() < 0.5;
    return { id: eventId++, source, contentType, title, stage: "webhook", isImage, hasAssets, ts: Date.now() };
  }

  const stageOrder: EventStage[] = [
    "webhook", "fetching", "filtering", "mapping", "pushing", "storing", "media", "complete",
  ];

  // Key fix: look up event from reactive array by ID so mutations go through the proxy
  function advanceEvent(evId: number) {
    const ev = events.find((e) => e.id === evId);
    if (!ev) return;

    const idx = stageOrder.indexOf(ev.stage);
    if (idx >= stageOrder.length - 1) {
      totalProcessed++;
      setTimeout(() => { events = events.filter((e) => e.id !== evId); }, 800);
      return;
    }

    const next = stageOrder[idx + 1]!;

    // Skip media stage if no assets
    if (next === "media" && !ev.hasAssets) {
      ev.stage = "complete";
      ev.ts = Date.now();
      totalProcessed++;
      setTimeout(() => { events = events.filter((e) => e.id !== evId); }, 800);
      return;
    }

    const delays: Record<EventStage, number> = {
      "webhook": 300,
      "fetching": 600,
      "filtering": 600,    // long enough to be visible
      "mapping": 700,      // long enough to be visible
      "pushing": 300,
      "storing": 400,
      "media": 800,
      "complete": 0,
    };

    const delay = (delays[ev.stage] ?? 300) + Math.random() * 300;
    setTimeout(() => {
      // Re-lookup from reactive array
      const current = events.find((e) => e.id === evId);
      if (!current) return;

      current.stage = next;
      current.ts = Date.now();

      // Side effects
      if (current.stage === "pushing") {
        const consumer = pick(appConsumers);
        flash(`con:${consumer}`);
      }
      if (current.stage === "storing") {
        spawnWriteOp(current);
      }
      if (current.stage === "media") {
        spawnAssetOp(current);
      }

      advanceEvent(evId);
    }, delay);
  }

  function spawnWriteOp(ev: PipelineEvent) {
    const op: WriteOp = { id: writeOpId++, contentType: ev.contentType, title: ev.title, progress: 0 };
    writeOps = [...writeOps.slice(-1), op];
    const steps = 6;
    let step = 0;
    const iv = setInterval(() => {
      step++;
      writeOps = writeOps.map((w) => w.id === op.id ? { ...w, progress: step / steps } : w);
      if (step >= steps) { clearInterval(iv); setTimeout(() => { writeOps = writeOps.filter((w) => w.id !== op.id); }, 400); }
    }, 90);
  }

  function spawnAssetOp(ev: PipelineEvent) {
    const isImage = ev.isImage;
    const op: AssetOp = { id: assetOpId++, title: ev.title, size: pick(imageSizes), step: 0, isImage };
    assetOps = [...assetOps.slice(-1), op];

    if (!isImage) {
      // Non-image assets: just download
      setTimeout(() => {
        assetOps = assetOps.map((a) => a.id === op.id ? { ...a, step: 1 } : a);
        setTimeout(() => { assetOps = assetOps.filter((a) => a.id !== op.id); }, 500);
      }, 400 + Math.random() * 300);
      return;
    }
    // Images: download -> resize -> optimize -> store (4 steps)
    const stepDelays = [500, 400, 350, 250];
    let currentStep = 0;
    function nextStep() {
      currentStep++;
      assetOps = assetOps.map((a) => a.id === op.id ? { ...a, step: currentStep } : a);
      if (currentStep < 4) {
        setTimeout(nextStep, stepDelays[currentStep]! + Math.random() * 200);
      } else {
        setTimeout(() => { assetOps = assetOps.filter((a) => a.id !== op.id); }, 500);
      }
    }
    setTimeout(nextStep, stepDelays[0]! + Math.random() * 200);
  }

  function spawnQuery() {
    const consumer = pick(appConsumers);
    queries = [...queries.slice(-2), {
      id: queryId++, consumer,
      collection: pick(["blog-posts", "pages", "assets", "nav-items", "settings"]),
      items: Math.floor(Math.random() * 48) + 1,
      latency: `${(Math.random() * 4 + 0.2).toFixed(1)}ms`,
      ts: Date.now(),
    }];
    totalQueries++;
    flash(`con:${consumer}`);
  }

  const headings = [
    'Query Any CMS\nin Milliseconds',
    'One Typesafe API\nfor Every CMS',
    'Switch CMS Without\nRewriting Apps',
  ];

  let headingText = $state('');
  let headingIndex = $state(0);

  onMount(() => {
    let active = true;

    // Typewriter effect for hero headings
    let charIndex = 0;
    let typing = true;

    const typeNext = () => {
      if (!active) return;
      const target = headings[headingIndex];
      if (typing) {
        if (charIndex <= target.length) {
          headingText = target.slice(0, charIndex++);
          setTimeout(typeNext, 45);
        } else {
          setTimeout(() => { typing = false; charIndex = target.length; typeNext(); }, 1800);
        }
      } else {
        if (charIndex > 0) {
          headingText = target.slice(0, charIndex--);
          setTimeout(typeNext, 25);
        } else {
          headingIndex = (headingIndex + 1) % headings.length;
          typing = true;
          setTimeout(typeNext, 200);
        }
      }
    };
    typeNext();

    function scheduleEvent() {
      if (!active) return;
      setTimeout(() => {
        if (!active) return;
        const ev = createEvent();
        events.push(ev);
        flash(`src:${ev.source}`);
        advanceEvent(ev.id);
        scheduleEvent();
      }, 800 + Math.random() * 1200);
    }

    function scheduleQuery() {
      if (!active) return;
      setTimeout(() => {
        if (!active) return;
        spawnQuery();
        scheduleQuery();
      }, 1200 + Math.random() * 2000);
    }

    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (!active) return;
        const ev = createEvent();
        events.push(ev);
        flash(`src:${ev.source}`);
        advanceEvent(ev.id);
      }, i * 500);
    }
    spawnQuery();
    scheduleEvent();
    scheduleQuery();

    return () => { active = false; };
  });

  // Derived event groups
  const ingesting = $derived(events.filter((e) => e.stage === "webhook" || e.stage === "fetching"));
  const engineEvents = $derived(events.filter((e) => e.stage === "filtering" || e.stage === "mapping"));
  const pushing = $derived(events.filter((e) => e.stage === "pushing"));
  const clientEvents = $derived(events.filter((e) => e.stage === "storing" || e.stage === "media"));

  const consumerIcon = { website: MonitorIcon, docs: BookOpenIcon, api: CodeIcon };

  const engineStageLabel: Record<string, string> = { "filtering": "filter", "mapping": "map" };
  const engineStageDetail: Record<string, string> = { "filtering": "applying influx rules", "mapping": "rename + cast props" };
  const imageStepLabels = ["download", "resize", "optimize", "store"];
</script>

<main>
  <!-- Hero -->
  <section class="border-b border-border py-20 sm:py-28">
    <div class="landing-shell px-4 sm:px-6 scroll-stagger">
      <div class="mb-8">
        <img src="/favicon.svg" alt="contfu" class="h-12 sm:h-14 w-auto" />
      </div>
      <div class="text-xs text-muted-foreground mb-4">
        <span class="text-primary">$</span> contfu --version 0.1.0-beta
      </div>
      <h1 class="text-3xl font-semibold sm:text-4xl min-h-[4rem] sm:min-h-[5rem] whitespace-pre-line">
        {headingText}<span class="cursor-blink"></span>
      </h1>
      <p class="mt-4 max-w-xl text-sm text-muted-foreground leading-relaxed">
        Sync content from Notion, Strapi, and more into a local SQLite database.
        Build faster apps with instant content access and zero API limits.
      </p>
      <div class="mt-8 flex gap-3">
        <Button href="#beta" size="lg">join --beta</Button>
        <Button href="#how-it-works" variant="outline" size="lg">--help</Button>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section id="how-it-works" class="border-b border-border py-16 sm:py-24">
    <div class="landing-shell px-4 sm:px-6">
      <div class="scroll-reveal text-xs text-muted-foreground mb-6">
        <span class="text-primary">$</span> contfu explain --how-it-works
      </div>
      <h2 class="scroll-reveal text-xl font-semibold sm:text-2xl mb-2">
        Your Content. One Database. Zero Latency.
      </h2>
      <p class="scroll-reveal text-sm text-muted-foreground mb-10">
        Stop juggling multiple CMS APIs. Contfu syncs your content sources
        into a single, lightning-fast local database.
      </p>

      <!-- Live system diagram -->
      <div class="scroll-reveal border border-border bg-card text-xs overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <span class="text-muted-foreground uppercase tracking-widest text-[10px]">system overview</span>
          <div class="flex items-center gap-4">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 rounded-full bg-success pulse-dot"></span>
              <span class="text-muted-foreground">{totalProcessed} synced</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 rounded-full bg-primary pulse-dot"></span>
              <span class="text-muted-foreground">{totalQueries} queries</span>
            </span>
          </div>
        </div>

        <div class="p-4">
          <!-- INGEST -->
          <div class="sys-row">
            <div class="sys-label">ingest</div>
            <div class="sys-body">
              <div class="flex flex-wrap items-center gap-2">
                {#each cmsSources as src}
                  <span class="sys-node {isFlashing(`src:${src.name}`) ? 'sys-node-flash' : ''}">
                    <SourceTypeIcon type={src.type} class="size-3 {isFlashing(`src:${src.name}`) ? '' : 'opacity-40'}" />
                    <span>{src.name}</span>
                    <span class="text-[9px] text-muted-foreground">{src.mode === 'poll' ? 'poll' : 'hook'}</span>
                  </span>
                {/each}
              </div>
              <div class="sys-slot h-[3.25rem]">
                {#each ingesting.slice(-3) as ev (ev.id)}
                  <div class="sys-event event-enter">
                    {#if ev.stage === "webhook"}
                      <span class="text-primary">{ev.source}</span>
                      <span class="text-muted-foreground">→</span>
                      <span class="text-muted-foreground">{ev.contentType} changed</span>
                      <span class="text-muted-foreground truncate">"{ev.title}"</span>
                    {:else}
                      <span class="text-warning">fetching</span>
                      <span>{ev.source}/{ev.contentType}</span>
                      <span class="text-muted-foreground truncate">"{ev.title}"</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="sys-connector"><ArrowDownIcon class="size-3 {ingesting.length > 0 ? 'text-primary' : 'text-border'}" /></div>

          <!-- ENGINE -->
          <div class="sys-row">
            <div class="sys-label">engine</div>
            <div class="sys-body">
              <div class="flex items-center gap-2">
                <FilterIcon class="size-3 {engineEvents.length > 0 ? 'text-warning icon-blink' : 'text-muted-foreground'}" />
                <span class="text-primary font-semibold">contfu</span>
                <span class="text-muted-foreground">::</span>
                <span class="text-muted-foreground">filter + map + validate</span>
              </div>
              <div class="sys-slot h-[3.25rem]">
                {#each engineEvents.slice(-3) as ev (ev.id)}
                  <div class="sys-event event-enter">
                    <span class="text-warning">{engineStageLabel[ev.stage] ?? ev.stage}</span>
                    <span>{ev.source}/{ev.contentType}</span>
                    <span class="text-muted-foreground truncate">"{ev.title}"</span>
                    <span class="text-muted-foreground text-[10px]">({engineStageDetail[ev.stage]})</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="sys-connector"><ArrowDownIcon class="size-3 {pushing.length > 0 ? 'text-success' : 'text-border'}" /></div>

          <!-- PUSH: stream to consumers -->
          <div class="sys-row">
            <div class="sys-label">push</div>
            <div class="sys-body">
              <div class="flex items-center gap-2 mb-1">
                <RadioIcon class="size-3 {pushing.length > 0 ? 'text-success icon-blink' : 'text-muted-foreground'}" />
                <span class="font-semibold {pushing.length > 0 ? 'text-success' : 'text-muted-foreground'}">real-time stream</span>
              </div>
              <div class="sys-slot h-[2.5rem]">
                {#each pushing.slice(-2) as ev (ev.id)}
                  <div class="sys-event event-enter">
                    <span class="text-success">PUSH</span>
                    <span>{ev.contentType}</span>
                    <span class="text-muted-foreground truncate">"{ev.title}"</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="sys-connector"><DownloadIcon class="size-3 {clientEvents.length > 0 ? 'text-primary' : 'text-border'}" /></div>

          <!-- STORE: local SQLite + media -->
          <div class="sys-row">
            <div class="sys-label">store</div>
            <div class="sys-body">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <!-- SQLite -->
                <div class="border border-border p-2">
                  <div class="flex items-center gap-2 mb-1">
                    <DatabaseIcon class="size-3 {writeOps.length > 0 ? 'text-success icon-blink' : 'text-muted-foreground'}" />
                    <span class="font-semibold {writeOps.length > 0 ? 'text-success' : 'text-muted-foreground'}">sqlite</span>
                  </div>
                  <div class="sys-slot h-[3.5rem]">
                    {#each writeOps as op (op.id)}
                      <div class="write-op event-enter">
                        <div class="flex items-center gap-2">
                          <span class="text-success text-[10px]">INSERT</span>
                          <span class="text-[10px]">{op.contentType}</span>
                          <span class="text-muted-foreground text-[10px] truncate">"{op.title}"</span>
                        </div>
                        <div class="write-bar">
                          <div class="write-fill" style="width: {op.progress * 100}%"></div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Media -->
                <div class="border border-border p-2">
                  <div class="flex items-center gap-2 mb-1">
                    <ImageIcon class="size-3 {assetOps.length > 0 ? 'text-primary icon-blink' : 'text-muted-foreground'}" />
                    <span class="font-semibold {assetOps.length > 0 ? 'text-primary' : 'text-muted-foreground'}">media</span>
                  </div>
                  <div class="sys-slot h-[3.5rem]">
                    {#each assetOps as op (op.id)}
                      <div class="asset-op event-enter">
                        <div class="flex items-center gap-2">
                          {#if op.isImage}
                            <span class="text-[10px] {op.step >= 4 ? 'text-success' : 'text-primary'}">{imageStepLabels[Math.min(op.step, 3)]}</span>
                          {:else}
                            <span class="text-[10px] {op.step >= 1 ? 'text-success' : 'text-primary'}">download</span>
                          {/if}
                          <span class="text-[10px] truncate">{op.title}</span>
                          {#if op.step === 0}
                            <span class="text-muted-foreground text-[10px]">{op.size}</span>
                          {/if}
                        </div>
                        {#if op.isImage}
                          <div class="asset-steps">
                            {#each imageStepLabels as _, i}
                              <span class="asset-dot {op.step > i ? 'asset-dot-done' : op.step === i ? 'asset-dot-active' : ''}"></span>
                              {#if i < 3}
                                <span class="asset-line {op.step > i ? 'asset-line-done' : ''}"></span>
                              {/if}
                            {/each}
                            <span class="text-[9px] text-muted-foreground ml-1">{Math.min(op.step + 1, 4)}/4</span>
                          </div>
                        {:else}
                          <div class="write-bar" style="margin-top: 3px">
                            <div class="write-fill {op.step >= 1 ? '' : 'downloading'}" style="width: {op.step >= 1 ? 100 : 60}%"></div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sys-connector"><ArrowDownIcon class="size-3 {queries.length > 0 ? 'text-primary' : 'text-border'}" /></div>

          <!-- CONSUMERS -->
          <div class="sys-row">
            <div class="sys-label">apps</div>
            <div class="sys-body">
              <div class="flex flex-wrap items-center gap-3">
                {#each appConsumers as app}
                  {@const Icon = consumerIcon[app]}
                  <span class="sys-node {isFlashing(`con:${app}`) ? 'sys-node-flash' : ''}">
                    <Icon class="size-3 {isFlashing(`con:${app}`) ? '' : 'opacity-40'}" />
                    <span>{app}</span>
                  </span>
                {/each}
              </div>
              <div class="sys-slot h-[2.5rem]">
                {#each queries.slice(-2) as q (q.id)}
                  <div class="sys-event event-enter">
                    <span class="text-primary text-[10px]">QUERY</span>
                    <span class="text-[10px]">{q.consumer}</span>
                    <span class="text-muted-foreground text-[10px]">→ {q.collection}</span>
                    <span class="text-muted-foreground text-[10px]">{q.items} rows</span>
                    <span class="text-success text-[10px]">{q.latency}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <div class="px-4 py-2 border-t border-border bg-muted/30">
          <div class="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>in flight: {events.length}</span>
            <span>&middot;</span>
            <span>content streams in real-time, images are optimized locally</span>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3 text-xs scroll-reveal">
        <span class="text-success">--local-first</span>
        <span class="text-primary">--unified-api</span>
        <span class="text-warning">--always-available</span>
      </div>
    </div>
  </section>

  <!-- CMS Integrations -->
  <section class="border-b border-border py-12">
    <div class="landing-shell px-4 sm:px-6">
      <div class="scroll-reveal text-xs text-muted-foreground mb-6">
        <span class="text-primary">$</span> contfu sources list
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5 scroll-stagger">
        {#each cmsSources as source}
          <div class="border border-border p-3 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/5">
            <SourceTypeIcon type={source.type} class="size-4 mx-auto mb-1.5 text-foreground" />
            <div class="text-xs font-medium">{source.name}</div>
            <div class="text-[10px] text-success mt-1">ready</div>
          </div>
        {/each}
        {#each pendingSources as source}
          <div class="border border-dashed border-muted-foreground p-3 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/5">
            <SourceTypeIcon type={source.type} class="size-4 mx-auto mb-1.5 text-muted-foreground" />
            <div class="text-xs text-muted-foreground">{source.name}</div>
            <div class="text-[10px] text-warning mt-1">soon</div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="features" class="border-b border-border py-16 sm:py-24">
    <div class="landing-shell px-4 sm:px-6">
      <div class="scroll-reveal text-xs text-muted-foreground mb-6">
        <span class="text-primary">$</span> contfu --features
      </div>
      <div class="space-y-6 scroll-stagger">
        {#each features as feature}
          <div class="border-l-2 border-border pl-4 transition-all duration-200 hover:border-primary hover:pl-5">
            <div class="text-xs text-primary mb-1">$ contfu {feature.cmd}</div>
            <h3 class="text-sm font-semibold">{feature.title}</h3>
            <p class="mt-1 text-xs text-muted-foreground">{feature.description}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Beta -->
  <section id="beta" class="py-16 sm:py-24">
    <div class="landing-shell px-4 sm:px-6">
      <div class="scroll-reveal border border-primary/30 bg-primary/5 p-8">
        <div class="text-xs text-muted-foreground mb-4">
          <span class="text-primary">$</span> contfu beta --info
        </div>
        <h2 class="text-xl font-semibold sm:text-2xl">Beta Program</h2>
        <p class="mt-2 text-sm text-muted-foreground">
          Contfu is currently in closed beta. Sign up to get early access and shape the future of content synchronization.
        </p>
        <div class="mt-8 grid gap-4 sm:grid-cols-3">
          <div class="border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5">
            <div class="text-xs text-primary mb-2">--early-access</div>
            <h3 class="text-sm font-medium">Early Access</h3>
            <p class="mt-1 text-xs text-muted-foreground">Be among the first to try new features</p>
          </div>
          <div class="border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5">
            <div class="text-xs text-primary mb-2">--feedback</div>
            <h3 class="text-sm font-medium">Direct Feedback</h3>
            <p class="mt-1 text-xs text-muted-foreground">Your input shapes the product</p>
          </div>
          <div class="border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5">
            <div class="text-xs text-primary mb-2">--reward</div>
            <h3 class="text-sm font-medium">Lifetime Pro</h3>
            <p class="mt-1 text-xs text-muted-foreground">Testimonial = free Pro forever</p>
          </div>
        </div>
        <div class="mt-8">
          <Button href="/register" size="lg">register --beta</Button>
          <p class="mt-3 text-xs text-muted-foreground">
            Already registered? <a href="/login" class="text-primary hover:underline">login</a>
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="border-t border-border py-16 sm:py-24">
    <div class="scroll-reveal landing-shell px-4 sm:px-6 text-center">
      <div class="text-xs text-muted-foreground mb-4">
        <span class="text-primary">$</span> contfu init<span class="cursor-blink"></span>
      </div>
      <h2 class="text-xl font-semibold sm:text-2xl">Ship Faster. Query Instantly.</h2>
      <div class="mt-4"><Button href="/register" size="lg">get-started</Button></div>
    </div>
  </section>
</main>

<style>
  .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

  :global(.icon-blink) { animation: icon-blink 1.2s ease-in-out infinite; }

  @keyframes icon-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

  .sys-row { display: flex; }
  .sys-label {
    width: 3.25rem; flex-shrink: 0; padding-top: 0.375rem;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--muted-foreground); text-align: right; padding-right: 0.625rem;
  }
  .sys-body { flex: 1; padding: 0.25rem 0; min-width: 0; }

  .sys-slot {
    display: flex; flex-direction: column; justify-content: flex-start;
    gap: 2px; margin-top: 0.25rem; overflow: hidden;
  }

  .sys-node {
    display: inline-flex; align-items: center; gap: 0.375rem;
    border: 1px solid var(--border); padding: 0.1875rem 0.5rem;
    transition: all 200ms ease-out;
  }
  .sys-node-flash {
    border-color: oklch(0.658 0.106 199 / 0.7);
    background: oklch(0.658 0.106 199 / 0.08);
    box-shadow: 0 0 8px oklch(0.658 0.106 199 / 0.15);
  }

  .sys-event {
    display: flex; flex-wrap: nowrap; gap: 0.375rem;
    white-space: nowrap; overflow: hidden; line-height: 1.4;
  }
  .event-enter { animation: event-in 0.25s ease-out; }
  @keyframes event-in {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .sys-connector {
    display: flex; align-items: center; justify-content: center;
    padding-left: 3.25rem; height: 1rem;
  }

  .write-op { margin-bottom: 2px; }
  .write-bar {
    height: 3px; background: var(--border); margin-top: 2px;
    overflow: hidden; border-radius: 1px;
  }
  .write-fill {
    height: 100%; background: var(--success);
    box-shadow: 0 0 6px var(--success);
    transition: width 90ms linear; border-radius: 1px;
  }
  .write-fill.downloading {
    background: var(--primary); box-shadow: 0 0 6px var(--primary);
    animation: download-pulse 0.8s ease-in-out infinite;
  }
  @keyframes download-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

  .asset-op { margin-bottom: 2px; }
  .asset-steps { display: flex; align-items: center; gap: 0; margin-top: 3px; }
  .asset-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--border); flex-shrink: 0; transition: all 200ms;
  }
  .asset-dot-active {
    background: var(--primary); box-shadow: 0 0 6px var(--primary);
    animation: step-pulse 0.8s ease-in-out infinite;
  }
  .asset-dot-done { background: var(--success); box-shadow: 0 0 3px var(--success); }
  .asset-line {
    width: 16px; height: 1px; background: var(--border);
    flex-shrink: 0; transition: background 200ms;
  }
  .asset-line-done { background: var(--success); }
  @keyframes step-pulse {
    0%, 100% { box-shadow: 0 0 4px var(--primary); }
    50% { box-shadow: 0 0 10px var(--primary); }
  }
</style>
