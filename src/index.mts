import("dotenv").then(dotenv => dotenv.config());

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import gradient from "gradient-string";
import boxen from "boxen";
import path from 'path';
import url from 'url';
import fs from 'fs';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = process.env.CONFIG_FILE || 'config.json';

const config = JSON.parse(fs.readFileSync(
  path.join(__dirname, CONFIG_FILE.replace('.json', ''), CONFIG_FILE),
  'utf-8'
));

const client: AxiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Aurita Spammer'
  }
});

const BODY_SPAM: string = config['messages']['spam'];
const BODY_DIE: string = config['messages']['deleted'];

const WEBHOOK_REGEX = /https:\/\/(.*?)discord\.com\/api\/webhooks\//;

let spammed: number = 0;

const clear = () => {
  const cmd = process.platform === 'win32' ? 'cls' : 'clear';
  console.log('\x1Bc');
};

const c = (colors: string[], text: string) => {
  if (!Array.isArray(colors)) throw new Error('The "colors" parameter should be an array.');
  return gradient(colors)(text.toString());
};

const delay = async (retryAfter: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

const bannerMain = () => {
  clear();
  console.log(c(['purple', 'white'], `
    ░█▀▀█ █░░█ █▀▀█ ░▀░ ▀▀█▀▀ █▀▀█   ▒█▀▀▀█ █▀▀█ █▀▀█ █▀▄▀█ █▀▄▀█ █▀▀ █▀▀█ 
    ▒█▄▄█ █░░█ █▄▄▀ ▀█▀ ░░█░░ █▄▄█   ░▀▀▀▄▄ █░░█ █▄▄█ █░▀░█ █░▀░█ █▀▀ █▄▄▀ 
    ▒█░▒█ ░▀▀▀ ▀░▀▀ ▀▀▀ ░░▀░░ ▀░░▀   ▒█▄▄▄█ █▀▀▀ ▀░░▀ ▀░░░▀ ▀░░░▀ ▀▀▀ ▀░▀▀
  `))
}

const bannerOptions = (options: string) => {
  bannerMain();
  const table = boxen(options, {
    margin: 2,
    padding: 2,
    borderColor: 'magenta',
    backgroundColor: '#333333',
    borderStyle: {
      top: "─",
      left: "│",
      right: "│",
      bottom: "─",
      topLeft: "╭",
      topRight: "╮",
      vertical: "│",
      horizontal: "─",
      bottomLeft: "╰",
      bottomRight: "╯",
    }
  });
  console.log(table);
};

const verifyWebhook = async (webhook: string): Promise<boolean> => {
  try {
    const response: AxiosResponse = await client.get(webhook);
    return response.status === 200;
  } catch {
    return false;
  }
};

const getWebhook = async (webhook: string): Promise<any> => {
  if (!(await verifyWebhook(webhook))) throw new Error("Webhook doesn't exist");
  const response: AxiosResponse = await client.get(webhook);
  return response.data || {};
};

const sendWebhook = async (webhook: string, data: any): Promise<boolean> => {
  try {
    const response: AxiosResponse = await client.post(webhook, data);
    return response.status === 200 || response.status === 204;
  } catch (error: any) {
    if (error.response && error.response.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 5;
      console.log(`${c(['purple', 'white'], `[-] Rate limited, waiting ${retryAfter} seconds`)}`);
      await delay(retryAfter);
    }
    return false;
  }
};

const deleteWebhook = async (webhook: string): Promise<boolean> => {
  if (!(await verifyWebhook(webhook))) throw new Error("Webhook doesn't exist");
  const webhookData = await getWebhook(webhook);
  if (!(await sendWebhook(webhook, BODY_DIE))) throw new Error('There was an error while sending the delete message');
  const response: AxiosResponse = await client.delete(webhook);
  const now = new Date();
  fs.mkdirSync(path.join(__dirname, '../trash'), { recursive: true });
  fs.appendFileSync(
    path.join(__dirname, '../trash', `${now.toISOString().split('T')[0]}.log`),
    `[${now.toISOString()}] ${JSON.stringify(webhookData)}\n`
  );
  return response.status === 204 || response.status === 200;
};

const main = async () => {
  const webhook = process.argv[2];
  if (!webhook || !WEBHOOK_REGEX.test(webhook)) {
    console.log(`${c(['purple', 'white'], `[-] Please enter a valid webhook`)}`);
    process.exit(0);
  }
  console.log(`${c(['purple', 'white'], `Checking if ${webhook.split('/')[5]}/${webhook.split('/')[6]} is valid`)}`);
  if (await verifyWebhook(webhook)) {
    console.log(`${c(['purple', 'white'], `[+] Webhook is valid`)}`);
    const response = await client.get(webhook);
    const res = response.data;
    bannerOptions(`${c(['purple', 'white'], '[1] - Spam the webhook\n[2] - Delete the webhook')}`)
    process.stdout.write(`${c(['purple', 'white'], '[+] Please choose an option: ')}`);
    const choice = await new Promise<string | null>((resolve) => process.stdin.once('data', (data) => resolve(data.toString().trim())))
    switch (choice) {
      case '1':
        const messagesPerInterval = 5;
        const intervalDuration = 6000;
        const sendMessages = async () => {
          for (let i = 0; i < messagesPerInterval; i++) {
            const success = await sendWebhook(webhook, BODY_SPAM);
            if (success) {
              bannerOptions(`${c(['purple', 'white'], `Webhook ID       : ${res.id}\nWebhook Name     : ${res.name}\nWebhook Token    : ${res.token}\nWebhook Guild    : ${res.guild_id}\nWebhook Avatar   : ${res.avatar}\nWebhook Channel  : ${res.channel_id}\n\nMessages Spammed : ${spammed}`)}`);
              spammed++;
            } else {
              console.log(`${c(['purple', 'white'], `[-] Failed to send message`)}`);
            }
            await delay(1000);
          }
        };
        setInterval(sendMessages, intervalDuration);
        break;
      case '2':
        try {
          if (await deleteWebhook(webhook))
            console.log(`${c(['purple', 'white'], `[+] Webhook Successfully deleted`)}`);
          else
            console.log(`${c(['purple', 'white'], `[-] There was an error while trying to delete the webhook`)}`);
        } catch (error: any) {
          console.error(error.message);
        }
        process.exit(0);
        break;
      default:
        console.log(`${c(['purple', 'white'], `[-] Invalid choice`)}`);
        process.exit(0);
    }
  } else {
    console.log(`${c(['purple', 'white'], `[-] Webhook is invalid`)}`);
    process.exit(0);
  }
};

main();
