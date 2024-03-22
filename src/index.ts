import { Client, Collection, GatewayIntentBits } from "discord.js";
import fs from "fs";
import path from "path";
import type { DiscordClient } from "./types/discordjs.js";
import { COMMAND_DIR_PATH, __dirname, isJSFile, loadConfig } from "./utils.js";

const { token } = loadConfig();

const client: DiscordClient = new Client({
  intents: [GatewayIntentBits.Guilds],
});
client.commands = new Collection();

const commandFolders = fs.readdirSync(COMMAND_DIR_PATH);

for (const folder of commandFolders) {
  const commandsPath = path.join(COMMAND_DIR_PATH, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => isJSFile(file));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => isJSFile(file));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = await import(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.commands = new Collection();

const functions = fs
  .readdirSync("./src/functions")
  .filter((file) => isJSFile(file));

(async () => {
  for (const file of functions) {
    ((await import(`./functions/${file}`)) as (client: DiscordClient) => void)(
      client,
    );
  }

  //  client.handleEvents(eventFiles, "./src/events");
  //  client.handleCommands(commandFolders, "./src/commands");
  client.login(token);
})();

client.login(token);
