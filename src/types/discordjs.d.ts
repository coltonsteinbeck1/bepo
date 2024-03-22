import { Client, Collection } from "discord.js";

interface DiscordClient extends Client {
  commands?: Collection<
    string,
    {
      name: string;
      description: string;
      execute: VoidFunction | (() => Promise<void>);
    }
  >;
}
