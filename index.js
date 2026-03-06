import { WebClient } from "@slack/web-api";
import "dotenv/config";

const token = process.env.SLACK_TOKEN;
const channelName = process.env.CHANNEL_NAME;

const client = new WebClient(token);

async function findConversation(name) {
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

const channel = await findConversation(channelName);
console.log(channel);
