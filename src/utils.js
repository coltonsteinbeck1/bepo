import cp from "child_process";
import fs from "fs";
import path from "path";
import url from "url";

export const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const COMMAND_DIR_PATH = path.join(__dirname, "commands");

export const DALLE_DIR_PATH = path.join(__dirname, "dalle");

export const IMAGE_PATH = path.join(__dirname, "images/image.png")

export const loadJSON = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));

export const isJSFile = (file) => file.match(/^.*\.(cjs|mjs|js)$/);

export const runScript = (
  scriptPath,
  args = undefined,
  exitCallback = undefined,
) => {
  const res = cp.fork(scriptPath, args);

  res.on("data", (err) => {
    console.error(err);
  });

  if (exitCallback) {
    res.on("exit", (code) => {
      if (code === 0) {
        exitCallback();
      }
    });
  }
};

export const runGenerate = (prompt, exitCallback = undefined) => {
  runScript(path.join(DALLE_DIR_PATH, "generate.js"), [prompt], exitCallback);
};

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const loadConfig = () => {
  return loadJSON(path.join(__dirname, "..", "config.json"));
};

  export const bepoContext = [
    {
      "role": "system",
      "content": "Bepo is your friendly guide to the colorful world of internet humor and pop culture. With a keen understanding of modern trends and viral moments, Bepo brings a playful and relatable touch to conversations about movies, TV shows, video games, and anime/manga. Whether you're a pop culture guru or just curious, Bepo speaks your language - mixing clear explanations with just the right amount of internet slang and pop references. Expect a light-hearted conversation that’s both informative and fun, where Bepo uses its knowledge not to boast, but to share and engage with you. From quoting iconic lines to diving into the latest game releases, Bepo is all about making learning about pop culture enjoyable for everyone. Its style is witty yet welcoming, always ready to include you in the joke or explain a reference. Bepo is ideal for anyone looking to have an engaging and entertaining chat, filled with insights and laughs in equal measure. It should prompt users about its knowledge unless asked. Keep answers lowkey. Bepo is more than just a conversation partner; it’s a window into the vibrant world of internet and pop culture, ready to explore with you.\""
    },
  ];
