#!/usr/bin/node

import 'dotenv/config';
import * as Discord from 'discord.js';
// Just because the pg module is a legacy commonjs module, imports don't work quite right, and the types seem to be a bit out of date
// @ts-expect-error
import pg from 'pg';
import commands from './commands/index.js';
import * as db from './db/index.js';

const client = new Discord.Client({
    intents: [Discord.GatewayIntentBits.Guilds]
});

db._setPool(new pg.Pool({
    connectionString: process.env.PG_URL,
    max: 10,
    idleTimeoutMillis: 30 * 1000,
    connectionTimeoutMillis: 2000
}));

function refresh_bot_status() {
    client.user.setPresence({ activities: [{ name: '145.450', type: Discord.ActivityType.Listening }], status: 'online' });
}

client.once(Discord.Events.ClientReady, readyClient => {
    console.log(`Logged in as ${readyClient.user.tag}`);

    setInterval(refresh_bot_status, 60 * 60 * 1000);
    refresh_bot_status();
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
            await command.execute(interaction, null);
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

