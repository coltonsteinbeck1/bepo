import cp from "child_process";
import fs from "fs";
import path from "path";
import url from "url";

export const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const COMMAND_DIR_PATH = path.join(__dirname, "commands");

export const DALLE_DIR_PATH = path.join(__dirname, "dalle");

export const IMAGE_PATH = path.join(__dirname, "images/image.png");

export const loadJSON = (path: string) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

export const isJSFile = (file: string) => file.match(/^.*\.(cjs|mjs|js)$/);

export const runScript = (
  scriptPath: string,
  args?: cp.ForkOptions,
  exitCallback?: () => void,
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

export const runGenerate = (prompt: string, exitCallback?: () => void) => {
  runScript(
    path.join(DALLE_DIR_PATH, "generate.js"),
    [prompt] as cp.ForkOptions,
    exitCallback,
  );
};

export const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const loadConfig = () => {
  return loadJSON(path.join(__dirname, "..", "config.json"));
};
