import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { dirname, parse, resolve } from "path";
import { fetchMessages, fetchThread, getYear } from "./client.js";

const year = getYear();

async function run() {
  const messages = await fetchMessages();
  messages.sort((a, b) => Number(a.ts) - Number(b.ts));

  const downloads = [];

  for (const message of messages) {
    const challengeMatch = /^(\d+)\. ….* \*(.*)\*/.exec(message.text);
    if (!challengeMatch) {
      continue;
    }

    const challengeNumber = challengeMatch[1];
    const challengeText =
      challengeMatch[2][0].toUpperCase() + challengeMatch[2].substring(1);

    const dir = getDir(challengeNumber, challengeText);
    console.log(`${challengeNumber}. ${challengeText}`);

    const thread = await fetchThread(message.ts);
    const replies = thread.filter(
      (msg) => msg.ts !== message.ts && msg.files !== undefined,
    );

    const groupedReplies = Object.groupBy(replies, (reply) => {
      const teamNumberMatch = reply.text.match(/\d+/);
      return teamNumberMatch ? teamNumberMatch[0] : "none";
    });

    for (const [teamNumber, teamReplies] of Object.entries(groupedReplies)) {
      if (teamNumber === "none") {
        continue;
      }

      for (let i = 0; i < teamReplies.length; i++) {
        const reply = teamReplies[i];
        const index =
          teamReplies.length > 1
            ? ` - ${(i + 1).toString().padStart(2, "0")}`
            : "";

        const file = reply.files[0];
        const url = file.url_private_download || file.url_private;
        const ext = parse(url).ext;

        console.log(`Team ${teamNumber}${index}`);

        const filename = `Team ${teamNumber.padStart(2, "0")}${index}${ext}`;
        const path = resolve(dir, filename);

        downloads.push(downloadFile(url, path));
      }
    }
  }

  await Promise.all(downloads);
}

function getDir(number, text) {
  const formattedNumber = number.toString().padStart(2, "0");
  const formattedText = text.replaceAll(/[^A-Za-z0-9 ]/g, "");
  return resolve(
    "archive",
    year.toString(),
    `${formattedNumber} ${formattedText}`,
  );
}

async function downloadFile(url, path) {
  await mkdir(dirname(path), { recursive: true });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SLACK_TOKEN}` },
  });

  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(path, bytes);
}

await run();
