import "dotenv/config";
import { readFile } from "fs/promises";
import numberToWords from "number-to-words";
import { send } from "./client.js";
import {
  introMessage,
  submissionsThreadMessage,
  votingThreadMessage,
} from "./messages.js";

const { toWords } = numberToWords;

let challengeNumber = 1;

async function run() {
  const challenges = await parseChallenges();

  if (process.argv.includes("--intro")) {
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
    .split(/\r?\n/g)
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
  const message = introMessage
    .replace("[[themes]]", toWords(numberOfSections))
    .replace("[[challenges]]", numberOfChallenges);
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

await run();
