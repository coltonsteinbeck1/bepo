import dotenv from "dotenv";
import { writeFileSync } from "fs";
import fetch from "node-fetch";
import { OpenAI } from "openai";
import ora from "ora";
import path from "path";
import { __dirname, ensureDir } from "../utils/utils.js";

dotenv.config();

const openAI = new OpenAI({
  apiKey: process.env.xAI_KEY,
  baseURL: "https://api.x.ai/v1",
});

const prompt = process.argv[2];
const spinner = ora("Generating image").start();

try {
  const result = await openAI.images.generate({
    prompt,
    // size: "1792x1024",
    model: "grok-2-image"
  });
  console.log(result.data);
  spinner.text = "Processing results";
  const imgResult = await fetch(result.data[0].url);
  const buffer = await imgResult.buffer();

  ensureDir(path.join(__dirname, "images"));
  writeFileSync(path.join(__dirname, "images", "image.png"), buffer);

  spinner.stop();
  process.exitCode = 0;
} catch (error) {
  spinner.stop();
  if (error instanceof OpenAI.APIError) {
    console.error(error.status); // e.g. 401
    console.error(error.message); // e.g. The authentication token you passed was invalid...
    console.error(error.code); // e.g. 'invalid_api_key'
    console.error(error.type); // e.g. 'invalid_request_error'
  } else {
    console.log(error);
  }
  process.exitCode = 1;
}
// const { CommandInteraction, MessageEmbed } = require('discord.js');

//
