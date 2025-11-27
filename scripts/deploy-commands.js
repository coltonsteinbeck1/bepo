import dotenv from "dotenv";
dotenv.config();

import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import ora from "ora";
import path from "path";
import { COMMAND_DIR_PATH, isJSFile, loadConfig } from "../src/utils/utils.js";
import { getAllGuilds } from "../src/supabase/supabase.js";

const commands = [];
const isValidCommand = (command) => "data" in command && "execute" in command;

const deploy = async (commands, rest, clientId, guildList) => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    for (const guild of guildList) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guild.guild_id),
        { body: commands },
      );
    }
    console.log(
      `Successfully reloaded ${commands.length} application (/) commands.`,
    );
  } catch (error) {
    console.error(error);
  }
};

const main = async () => {
  const spinner = ora("Loading commands").start();
  const guildList = await getAllGuilds();
  const rest = new REST().setToken(process.env.BOT_TOKEN);

  const commandFolders = readdirSync(COMMAND_DIR_PATH);
  for (const f of commandFolders) {
    const availCommands = readdirSync(path.join(COMMAND_DIR_PATH, f));
    const jsFiles = availCommands.filter((c) => isJSFile(c));
    for (const c of jsFiles) {
      const commandPath = path.join(COMMAND_DIR_PATH, f, c);
      try {
        const { default: parsedCommand } = await import(commandPath);
        if (isValidCommand(parsedCommand)) {
          commands.push(parsedCommand.data.toJSON());
        } else {
          console.error(
            `[WARNING] The command at ${commandPath} is missing a required "data" or "execute" property. Parsed command:`, parsedCommand,
          );
        }
      } catch (error) {
        console.error(`[ERROR] Failed to import command at ${commandPath}:`, error);
      }
    }
  }
  const clientId = process.env.CLIENT_ID;

  spinner.text = "Deploying to Discord";

  await deploy(commands, rest, clientId, guildList);
  spinner.stop();
};

main().catch(console.error.bind(console));
