import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

const licenseStatus = {
  'A': 'Active',
  'C': 'Canceled',	
  'E': 'Expired',
  'L': 'Pending Legal Status',
  'P': 'Parent Station Canceled',
  'T': 'Terminated',
  'X': 'Term Pending',
};

const applicantType = {
  'B': 'Amateur Club',
  'C': 'Corporation',
  'D': 'General Partnership',
  'E': 'Limited Partnership',
  'F': 'Limited Liability Partnership',
  'G': 'Governmental Entity',
  'H': 'Other',
  'I': 'Individual',
  'J': 'Joint Venture',
  'L': 'Limited Liability Company',
  'M': 'Military Recreation',
  'O': 'Consortium',
  'P': 'Partnership',
  'R': 'RACES',
  'T': 'Trust',
  'U': 'Unincorporated Association'
};

function prettyCall(call) {
  return call.replace('0', '\u00d8')
}

export const name = 'fcc';

const cmd = new SlashCommandBuilder();

cmd.setName(name);
cmd.setDescription('Query the FCC ULS database for amateur-related records.');
cmd.addSubcommand(subcommand => 
  subcommand.setName('call')
  .setDescription('Perform a quick lookup for basic info on a callsign.')
  .addStringOption(option => 
    option.setName('callsign').setDescription('The callsign to look up').setRequired(true)
  )
)

export const json = cmd.toJSON();

/*
    grant_date, expired_date, cancellation_date, effective_date, last_action_date,
    entity_type, applicant_type_code 

*/

export async function execute(interaction, ctx) {
  const raw_call = interaction.options.getString('callsign').trim();
  const call = raw_call.toUpperCase();

  try {
    const result = await ctx.fcculs.query(`SELECT unique_system_identifier, license_status,
    grant_date, expired_date, cancellation_date, effective_date, last_action_date,
    entity_type, entity_name, first_name, mi, last_name, suffix,
    street_address, city, state, zip_code, po_box, attention_line, frn, applicant_type_code 
    from l_HD JOIN l_EN USING(unique_system_identifier) where l_HD.call_sign = $1::text LIMIT 1;`, [call]);

    const [ record ] = result.rows;
    
    const built_name = [ record.first_name, record.mi, record.last_name, record.suffix ].filter(e => e && e.length).join(' ');

    const embed = new EmbedBuilder();

    embed.setTitle(`${prettyCall(call)} (${licenseStatus[record.license_status]} ${applicantType[record.applicant_type_code]})`);
    embed.setDescription(
      [
        built_name || record.entity_name,
        record.attention_line && `ATTN: ${record.attention_line}`,
        record.po_box,
        record.street_address,
        `${record.city}, ${record.state} ${record.zip_code}`
      ].filter(s => s && s.length > 0).join('\n')
    );
    embed.setColor({
      'A': 0x007f00,
      'C': 0xff0000,
      'E': 0xff0000,
      'T': 0xff0000,
      'X': 0xff7f00
    }[record.license_status] || 0x7f7f7f);
    embed.setFields([
      record.grant_date && { name: 'Granted:', value: record.grant_date, inline: true },
      record.effective_date && { name: 'Effective:', value: record.effective_date, inline: true },
      record.expired_date && { name: new Date(record.expired_date).valueOf() < Date.now() ? 'Expired:' : 'Expires:', value: record.expired_date, inline: true },
      record.cancellation_date && { name: 'Canceled:', value: record.cancellation_date, inline: true },
      record.last_action_date && { name: 'Last Action:', value: record.last_action_date, inline: true }
    ].filter(e => e));
    embed.setFooter({ text: `FCC Record #${record.unique_system_identifier}`});

    await interaction.reply({ embeds: [ embed ] });
  } catch (err) {
    console.error(err);
    await interaction.reply('Sorry, an occurred and the lookup failed.');
  }
}

