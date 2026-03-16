// CLI splash banner — compact colorized block title

const RESET = "\x1b[0m";

const rgb = (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`;

const C = {
  deepTeal: rgb(17, 70, 78),
  teal: rgb(33, 102, 112),
  lightTeal: rgb(77, 146, 154),
  silver: rgb(186, 194, 198),
  lightSilver: rgb(222, 227, 230),
  shadow: rgb(90, 100, 105),
};

const titleLines = [
  "██   ██  ██████  ██      ███████ ██   ██ ███████ ██   ██",
  "██  ██  ██    ██ ██      ██      ██   ██ ██      ██  ██ ",
  "█████   ██    ██ ██      ███████ ███████ █████   █████  ",
  "██  ██  ██    ██ ██           ██ ██   ██ ██      ██  ██ ",
  "██   ██  ██████  ███████ ███████ ██   ██ ███████ ██   ██",
];

const titleColors = [C.lightSilver, C.silver, C.lightTeal, C.teal, C.deepTeal];

// Build the full splash banner as a single string
export function getSplashBanner(color = true): string {
  if (!color) {
    const plain = titleLines.map((l) => "  " + l).join("\n");
    return (
      "\n" + plain + "\n  Your Israeli finances, locally, on your terms.\n"
    );
  }

  const title = titleLines
    .map((t, i) => "  " + titleColors[i] + t + RESET)
    .join("\n");

  const subtitle =
    "  " + C.shadow + "Your Israeli finances, locally, on your terms." + RESET;

  return "\n" + title + "\n" + "\n" + subtitle + "\n";
}
