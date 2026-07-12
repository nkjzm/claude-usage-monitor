# Claude Usage Monitor

A browser extension that monitors Claude usage limits with visual charts and periodic updates.

![Screen shot](screenshot.png)  
![Screen shot](screenshot2.png)

## Installation

https://chromewebstore.google.com/detail/claude-usage-monitor/jaadjbgpijajmhponmgggflfgmboknge
https://addons.mozilla.org/ja/firefox/addon/claude-usage-monitor/
https://microsoftedge.microsoft.com/addons/detail/ceongioipmlalfampnnbookfdphmeoej

## Usage

### Initial Setup

1. Click the extension icon to open the monitor window
2. Click the settings icon (⚙️) to open settings
3. Enter your Organization ID
  - See "How to Find Organization ID" section below for instructions
4. Click "Save"

### Monitor Interface

#### View Controls

- **View selector (Donut/Bar)**: Switch between chart display types
- **Column selector (1 Col/2 Cols/4 Cols)**: Change grid column count

#### Pace Indicator

- **Pace toggle**: When enabled, displays expected usage rate (purple) based on time elapsed
- If actual usage exceeds expected usage, it indicates you're consuming credits faster than average

### Codex (ChatGPT) Usage (optional)

1. Open the settings icon (⚙️) and turn on "Enable Codex monitoring"
2. Make sure you're logged into chatgpt.com in this browser — Codex usage is read from that session, no token entry needed
3. If you belong to multiple ChatGPT workspaces, you can enter your ChatGPT Account ID to select the right one (leaving it blank works for most personal accounts; setting it may not work for all accounts due to browser CORS restrictions on this undocumented API)

Codex usage is displayed in its own section below Claude's. Since it relies on an undocumented ChatGPT API, it may occasionally break if OpenAI changes it.

## Troubleshooting

### How to Find Organization ID
1. Log into Claude.ai
2. Go to https://claude.ai/settings/account
3. Find the "Organization ID" field in the Account section
4. Click the copy button next to your Organization ID
5. Paste it into the extension settings

## Disclaimer

This is an unofficial tool. Please use it in accordance with Anthropic's Terms of Service.

## Contributors

- [nkjzm](https://github.com/nkjzm) - Added request interval setting
