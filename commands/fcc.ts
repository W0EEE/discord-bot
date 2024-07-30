import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from "discord.js";

import db from '../db/index.js';

export const name = 'fcc';

function formatDate(d: Date): string {
    return [
        d.getFullYear().toString().padStart(4, '0'),
        (d.getMonth() + 1).toString().padStart(2, '0'),
        d.getDate().toString().padStart(2, '0')
    ].join('-');
}

function formatTime(d: Date): string {
    return [
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
    ].map(c => c.toString().padStart(2, '0')).join(':');
}

const cmd = new SlashCommandBuilder();

cmd.setName(name);
cmd.setDescription('Query the FCC ULS database for amateur-related records.');
cmd.addSubcommand(subcommand =>
    subcommand.setName('call')
        .setDescription('Perform a quick lookup for basic info on a callsign.')
        .addStringOption(option =>
            option.setName('callsign').setDescription('The callsign to look up').setRequired(true)
        )
);
cmd.addSubcommand(subcommand => 
    subcommand.setName('status')
        .setDescription('Get the status of the FCC replica database.')
);

export const json = cmd.toJSON();

async function call(interaction: ChatInputCommandInteraction, ctx) {
    const callsign = interaction.options.getString('callsign');
    try {
        const license = await db.licenseByCallsign(callsign);

        if (!license)
            return interaction.reply(`No results found for ${callsign}`);

        const embed = new EmbedBuilder();

        embed.setTitle(`${license.callsign} (${license.status} ${license.applicantType})`);
        embed.setDescription(
            [
                license.name,
                license.attentionLine,
                license.poBox ? `P.O. Box ${license.poBox}` : null,
                license.streetAddress,
                `${license.city}, ${license.state} ${license.zip}`
            ].filter(s => s && s.length > 0).join('\n')
        );
        embed.setColor({
            'A': 0x007f00,
            'C': 0xff0000,
            'E': 0xff0000,
            'T': 0xff0000,
            'X': 0xff7f00
        }[license.statusCode] || 0x7f7f7f);
        embed.setFields([
            license.trusteeCallsign && license.trusteeName && { name: 'Trustee:', value: `${license.trusteeName} (${license.trusteeCallsign.trim()})` },
            license.operatorClassCode && { name: 'Operator class:', value: license.operatorClass },
            license.grantDateRaw && { name: 'Granted:', value: formatDate(license.grantDate), inline: true },
            license.effectiveDateRaw && { name: 'Effective:', value: formatDate(license.effectiveDate), inline: true },
            license.expireDateRaw && { name: license.expireDate.valueOf() < Date.now() ? 'Expired:' : 'Expires:', value: formatDate(license.expireDate), inline: true },
            license.cancelDateRaw && { name: 'Canceled:', value: formatDate(license.cancelDate), inline: true },
            license.lastActionDateRaw && { name: 'Last Action:', value: formatDate(license.lastActionDate), inline: true }
        ].filter(e => e));
        embed.setFooter({ text: `FCC Record #${license.id}` });

        const action_row = new ActionRowBuilder<ButtonBuilder>();
        action_row.addComponents(
            new ButtonBuilder().setURL(`https://qrz.com/db/${license.callsignAscii}`).setLabel("QRZ").setStyle(ButtonStyle.Link),
            new ButtonBuilder().setURL(`https://wireless2.fcc.gov/UlsApp/UlsSearch/license.jsp?licKey=${license.id}`).setLabel("ULS").setStyle(ButtonStyle.Link)
        );

        await interaction.reply({ embeds: [embed], components: [action_row] });
    } catch (err) {
        console.error(err);
        await interaction.reply('Sorry, an occurred and the lookup failed.');
    }
}

async function status(interaction: ChatInputCommandInteraction, ctx) {
    try {
        const status = await db.status();

        const embed = new EmbedBuilder();

        embed.setTitle("W\u00d8EEE FCC Replica Status Report");

        for (const record of status.fetchStatus) {
            const { name } = record;

            const text = [`${formatDate(record.lastFullUpdate)} ${formatTime(record.lastFullUpdate)}: Complete`];

            for (const inc of record.incrementalUpdatesApplied)
                text.push(`${formatDate(inc.timestamp)} ${formatTime(inc.timestamp)}: Differential (${inc.day})`);

            const value = text.join('\n');

            embed.addFields({ name, value });
        }

        embed.setFooter({ text: `${status.latency}ms W0EEEBot ${process.env['W0EEEBOT_VERSION']} OK :)` });

        await interaction.reply({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        await interaction.reply('Sorry, an occurred.');
    }
}

const subcommands = { call, status };

export async function execute(interaction, ctx) {
    const subcommand = interaction.options.getSubcommand();

    if (!subcommands[subcommand])
        return interaction.reply(`No subcommand matches ${subcommand}`);

    return subcommands[subcommand](interaction, ctx);
}
