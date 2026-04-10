import { createInterface } from "node:readline";

export interface SelectOption {
  label: string;
  description?: string;
  value: string;
  disabled?: boolean;
}

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function select(options: SelectOption[]): Promise<string> {
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;

  if (!stdin.isTTY) {
    const answer = await prompt(`Choose (1-${options.length}): `);
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < options.length && !options[idx].disabled) return options[idx].value;
    throw new Error("Invalid choice.");
  }

  let selected = 0;

  function render() {
    for (const [i, opt] of options.entries()) {
      const indicator = i === selected ? "❯" : " ";
      const highlight = i === selected ? "\x1b[36m" : "\x1b[2m";
      const reset = "\x1b[0m";
      const suffix = opt.disabled ? " (disabled)" : "";
      process.stdout.write(`${highlight}  ${indicator} ${opt.label}${suffix}${reset}\n`);
      if (opt.description) process.stdout.write(`${highlight}    ${opt.description}${reset}\n`);
      if (i < options.length - 1) process.stdout.write("\n");
    }
  }

  function clear() {
    const lines = options.reduce((count, option) => count + (option.description ? 3 : 2), 0) - 1;
    for (let i = 0; i < lines; i++) {
      process.stdout.write("\x1b[A\x1b[2K");
    }
  }

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    render();

    const onData = (key: string) => {
      if (key === "\x03") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.exit(130);
      }

      if (key === "\r" || key === "\n") {
        const option = options[selected];
        if (option.disabled) return;
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        clear();
        process.stdout.write(`  ✓ ${option.label}\n`);
        resolve(option.value);
        return;
      }

      const num = parseInt(key, 10);
      if (num >= 1 && num <= options.length && !options[num - 1].disabled) {
        selected = num - 1;
        clear();
        render();
        return;
      }

      if (key === "\x1b[A" || key === "k") {
        selected = (selected - 1 + options.length) % options.length;
        clear();
        render();
        return;
      }

      if (key === "\x1b[B" || key === "j") {
        selected = (selected + 1) % options.length;
        clear();
        render();
      }
    };

    stdin.on("data", onData);
  });
}

export async function multiSelect(options: SelectOption[]): Promise<string[]> {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive selection requires a TTY");
  }

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  let selected = 0;
  let chosen = new Set(options.filter((option) => !option.disabled).map((option) => option.value));

  function render() {
    process.stdout.write("  Use ↑/↓ to move, space to toggle, enter to confirm.\n\n");
    for (const [i, opt] of options.entries()) {
      const indicator = i === selected ? "❯" : " ";
      const checked = chosen.has(opt.value) ? "●" : "○";
      const highlight = i === selected ? "\x1b[36m" : "\x1b[2m";
      const reset = "\x1b[0m";
      const suffix = opt.disabled ? " (already added)" : "";
      process.stdout.write(`${highlight}  ${indicator} ${checked} ${opt.label}${suffix}${reset}\n`);
      if (opt.description) process.stdout.write(`${highlight}    ${opt.description}${reset}\n`);
    }
  }

  function clear() {
    const lines = options.length + options.filter((option) => option.description).length + 1;
    for (let i = 0; i < lines; i++) {
      process.stdout.write("\x1b[A\x1b[2K");
    }
  }

  return new Promise((resolve) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    render();

    const onData = (key: string) => {
      if (key === "\x03") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.exit(130);
      }

      if (key === "\r" || key === "\n") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        clear();
        resolve(options.filter((option) => chosen.has(option.value)).map((option) => option.value));
        return;
      }

      if (key === " ") {
        const option = options[selected];
        if (!option.disabled) {
          const next = new Set(chosen);
          if (next.has(option.value)) next.delete(option.value);
          else next.add(option.value);
          chosen = next;
        }
        clear();
        render();
        return;
      }

      if (key === "\x1b[A" || key === "k") {
        selected = (selected - 1 + options.length) % options.length;
        clear();
        render();
        return;
      }

      if (key === "\x1b[B" || key === "j") {
        selected = (selected + 1) % options.length;
        clear();
        render();
      }
    };

    stdin.on("data", onData);
  });
}
