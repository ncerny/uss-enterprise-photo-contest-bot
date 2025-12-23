import { ChatInputCommandInteraction, ChannelType, TextChannel } from 'discord.js';
import { Contest } from '@uss-enterprise/shared';
import { CommandValidationError } from '../../commands/errors';
import { ContestRepository } from '../../repositories';
import { getFirestoreClient } from '../../config/firebaseAdmin';

const contestRepository = new ContestRepository(getFirestoreClient());

export interface ContestCommandContext {
  contest: Contest;
  channel: TextChannel;
}

export async function resolveContestCommandContext(
  interaction: ChatInputCommandInteraction,
  channelOptionName?: string
): Promise<ContestCommandContext> {
  if (!interaction.inGuild()) {
    throw new CommandValidationError('This command can only be used inside a server.');
  }

  const providedChannel = channelOptionName
    ? interaction.options.getChannel(channelOptionName, false)
    : null;
  const rawChannel = providedChannel ?? interaction.channel;

  if (!rawChannel || rawChannel.type !== ChannelType.GuildText) {
    throw new CommandValidationError('Please specify a contest text channel.');
  }

  const channel = rawChannel as TextChannel;
  const contest = await contestRepository.getByChannelId(channel.id);

  if (!contest) {
    throw new CommandValidationError(
      'No contest is associated with that channel. Make sure you selected a valid contest channel.'
    );
  }

  return { contest, channel };
}
