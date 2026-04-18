import { Component, Inject, Input, Optional, type OnChanges } from "@angular/core";
import { renderBlocks, type Block, type FileUrlOptions } from "@contfu/core";
import { CONTFU_FILE_URL } from "./tokens";

@Component({
  selector: "contfu-blocks",
  standalone: true,
  template: `<div [innerHTML]="html"></div>`,
})
export class BlocksComponent implements OnChanges {
  @Input() blocks: Block[] = [];
  @Input() file?: FileUrlOptions;

  html = "";

  constructor(
    @Optional() @Inject(CONTFU_FILE_URL) private readonly injectedFile: FileUrlOptions | null,
  ) {}

  ngOnChanges(): void {
    const file = this.file ?? this.injectedFile ?? undefined;
    this.html = renderBlocks(this.blocks, file ? { file } : undefined);
  }
}
