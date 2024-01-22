#!/usr/bin/node

import 'dotenv/config';
import * as Discord from 'discord.js';
import pg from 'pg';
import commands from './commands/index.js';

const client = new Discord.Client({
  intents: [ Discord.GatewayIntentBits.Guilds ]
});

const context = {
  fcculs: new pg.Pool({
    host: '/var/run/postgresql',
    database: 'fcculs',
    max: 10,
    idleTimeoutMillis: 30 * 1000,
    connectionTimeoutMillis: 2000
  })
};

client.once(Discord.Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Discord.Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    // this is a slash command
    
    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command found for '${interaction.commandName}'.`);

      await interaction.reply(`No such command found: ${interaction.commandName}`);

      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error(interaction, error);

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    }
  }

});

async function installCommands() {
  const rest = new Discord.REST().setToken(process.env.DISCORD_BOT_TOKEN);

  const commandmetadata = [];

  for (const command of commands.values()) {
    commandmetadata.push(command.json);
  }

  const res = await rest.put(Discord.Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commandmetadata });

  console.log(`Refreshed ${(res as Array<object>).length} slash commmands.`);
}

await installCommands();

client.login(process.env.DISCORD_BOT_TOKEN);

