#!/usr/bin/env node

import path from "path";
import yargs from "yargs";
import { __dirname, runGenerate, runScript } from "./utils.js";

const main = () => {
  const usage = "\nUsage: <command> [options]";
  const _opts = yargs(process.argv.slice(2))
    .usage(usage)
    .help()
    .command(
      "deploy",
      "deploy commands to Discord",
      () => {},
      () => {
        runScript(path.join(__dirname, "..", "scripts", "deploy-commands.js"));
      },
    )
    .command(
      "delete",
      "delete commands in Discord",
      () => {},
      () => {
        runScript(path.join(__dirname, "..", "scripts", "delete-commands.js"));
      },
    )
    .command(
      "generate <prompt>",
      "generate an image with DALL-E",
      () => {},
      (argv) => {
        runGenerate(argv.prompt);
      },
    ).argv;
};

main();
