import { WebClient } from "@slack/web-api";
import "dotenv/config";
import { readFile } from "fs/promises";
import numberToWords from "number-to-words";

const { toWords } = numberToWords;

const args = process.argv.slice(2);
const { SLACK_TOKEN, TEAMS_SPREADSHEET } = process.env;

const year = parseInt(args[args.length - 1]);
if (isNaN(year)) {
  throw new Error("No year provided in final argument.");
}

const client = new WebClient(SLACK_TOKEN);

const channelName = `photo-hunt-${year}-challenges`;
const channel = await findChannel(channelName);

let challengeNumber = 1;

const submissionsThreadMessage =
  "*🧵 Submissions 📸*\n" +
  `Remember to include your <${TEAMS_SPREADSHEET}|team number> in your submission post.`;

const votingThreadMessage =
  "*🏆 Voting 🗳️*\n\n" +
  "This challenge has extra points for the best submission.\n" +
  "React with ➕ to vote for your favourite(s).\n" +
  "You cannot vote for your own team’s submission.";

async function run() {
  const challenges = await parseChallenges();

  if (args.includes("--intro")) {
    await sendIntroMessage(challenges);
    return;
  }

  for (const section of challenges) {
    await sendSectionHeader(section);
    for (const challenge of section.challenges) {
      const thread = await sendChallenge(challenge);
      await startChallengeThread(challenge, thread);
    }
  }
}

async function parseChallenges() {
  const file = await readFile("./challenges.txt");
  const lines = file
    .toString()
    .split("\n")
    .filter((line) => line !== "");

  const sections = [];
  let section;
  for (const line of lines) {
    const parts = line.split(/\s+\|\s+/g);
    if (line.startsWith("--")) {
      section = parseSection(parts);
      sections.push(section);
    } else {
      const challenge = parseChallenge(parts);
      section.challenges.push(challenge);
    }
  }

  return sections;
}

function parseSection(parts) {
  const name = parts[0].replaceAll(/--\s+/g, "");
  const emoji = parts[1];
  return { name, emoji, challenges: [] };
}

function parseChallenge(parts) {
  const prefixText = parts[0];
  const mainText = parts[1];
  const [basePoints, perText] = parts[2].split(/\s+\/\s+/g);
  const maxPoints = parts[3];
  return {
    prefixText,
    mainText,
    basePoints: parseInt(basePoints),
    perText,
    maxPoints: parseInt(maxPoints),
    hasWinner: maxPoints && !perText,
  };
}

async function sendIntroMessage(challenges) {
  const numberOfSections = challenges.length;
  const numberOfChallenges = challenges.flatMap(
    (section) => section.challenges,
  ).length;
  const message =
    "*=== 📸 CHALLENGES 📸 ===*\n\n" +
    `There are *${numberOfChallenges}* challenges across ${toWords(numberOfSections)} themes.\n\n` +
    "Submit photos or videos for as many as you can before 4:30pm.";
  return await send(message);
}

async function sendSectionHeader(section) {
  const { name, emoji } = section;
  const message =
    `*--- ${emoji} ${name.toUpperCase()} ${emoji} ---*\n\n` +
    "Submit a photo or video…";
  return await send(message);
}

async function sendChallenge(challenge) {
  const { prefixText, mainText, hasWinner } = challenge;
  const challengeText = `${challengeNumber++}. …${prefixText} *${mainText}*${hasWinner ? " 🏆" : ""}`;
  const pointsText = buildPointsText(challenge);
  return await send(`${challengeText}\n_(${pointsText})_`);
}

function buildPointsText(challenge) {
  const { basePoints, perText, maxPoints } = challenge;

  const basePointsText = formatPoints(basePoints);
  if (!maxPoints) {
    return basePointsText;
  }

  const maxPointsText = formatPoints(maxPoints);
  return perText
    ? `${basePointsText} per ${perText}; maximum ${maxPointsText}`
    : `${maxPointsText} for winner; ${basePointsText} for all other submissions`;
}

function formatPoints(number) {
  return `${number} point${number === 1 ? "" : "s"}`;
}

async function startChallengeThread(challenge, thread) {
  await send(submissionsThreadMessage, thread);
  if (challenge.hasWinner) {
    await send(votingThreadMessage, thread);
  }
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
