import { REST, Routes } from "discord.js";
import ora from "ora";
import { loadConfig } from "../src/utils.js";

const { clientId, guildId, token } = loadConfig();
const rest = new REST().setToken(token);
const spinner = ora("Deleting guild-based commands").start();

// for guild-based commands
rest
  .put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
  .then(() => console.log("Successfully deleted all guild commands."))
  .catch(console.error);

spinner.text = "Deleting global commands";
// for global commands
rest
  .put(Routes.applicationCommands(clientId), { body: [] })
  .then(() => console.log("Successfully deleted all application commands."))
  .catch(console.error);
spinner.stop();
