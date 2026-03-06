import { WebClient } from "@slack/web-api";
import "dotenv/config";

const token = process.env.SLACK_TOKEN;

const client = new WebClient(token);
const channel = await findChannel(process.env.CHANNEL_NAME);

async function run() {
  const thread = await send("Ho, Ho, Ho, World!");
  await send("How are you?", thread);
}

async function send(message, thread = undefined) {
  const result = await client.chat.postMessage({
    channel: channel.id,
    text: message,
    thread_ts: thread,
  });

  return result.ts;
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

await run();
