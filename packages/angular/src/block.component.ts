import { Component, Inject, Input, Optional, type OnChanges } from "@angular/core";
import { renderBlock, type Block, type FileUrlOptions } from "@contfu/core";
import { CONTFU_FILE_URL } from "./tokens";

@Component({
  selector: "contfu-block",
  standalone: true,
  template: `<div [innerHTML]="html"></div>`,
})
export class BlockComponent implements OnChanges {
  @Input({ required: true }) block!: Block;
  @Input() file?: FileUrlOptions;

  html = "";

  constructor(
    @Optional() @Inject(CONTFU_FILE_URL) private readonly injectedFile: FileUrlOptions | null,
  ) {}

  ngOnChanges(): void {
    const file = this.file ?? this.injectedFile ?? undefined;
    this.html = renderBlock(this.block, file ? { file } : undefined);
  }
}
