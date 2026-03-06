import { WebClient } from "@slack/web-api";

const client = new WebClient(process.env.SLACK_TOKEN);

const args = process.argv.slice(2);
const year = parseInt(args[args.length - 1]);
if (isNaN(year)) {
  throw new Error("No year provided in final argument.");
}

const channelName = `photo-hunt-${year}-challenges`;
const channel = await findChannel(channelName);

export function getYear() {
  return year;
}

export async function send(message, thread = undefined) {
  const result = await client.chat.postMessage({
    channel: channel.id,
    text: message,
    thread_ts: thread,
  });

  return result.ts;
}

export async function fetchMessages() {
  const result = await client.conversations.history({
    channel: channel.id,
    limit: 1000,
  });
  return result.messages;
}

export async function fetchThread(thread) {
  const result = await client.conversations.replies({
    channel: channel.id,
    ts: thread,
  });
  return result.messages;
}

async function findChannel(name) {
  let nextCursor = undefined;

  do {
    const result = await client.conversations.list({
      limit: 1000,
      cursor: nextCursor,
      types: "public_channel,private_channel",
    });

    const match = result.channels.find((channel) => channel.name === name);
    if (match) {
      return match;
    }

    nextCursor = result.response_metadata.next_cursor;
  } while (nextCursor);

  throw new Error(`Could not find channel named '${name}'.`);
}
