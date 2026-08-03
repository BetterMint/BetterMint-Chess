# BetterMint Privacy Policy

**Last updated: August 2, 2026**

BetterMint is a browser extension that provides chess analysis by running local chess engines, opening books, and endgame tablebases. This policy describes what data the extension accesses and how it is used.

## Data We Do Not Collect

BetterMint does **not** collect, sell, rent, or share any personal data with third parties. Specifically, we do **not** collect:

- Your name, email, or any personally identifiable information
- Your browsing history or search queries
- Your keystrokes, mouse movements, or screen captures
- Financial or payment information
- Authentication credentials (passwords, tokens for other services)
- Personal communications (chat messages, emails)
- Your physical location

## Data the Extension Accesses Locally

### Chess Board State

The extension reads the current chess board position (FEN string) and move history from the DOM of chess websites you visit (e.g., lichess.org, chess.com). This data is used **only** to analyze the current position with local engines and display results as an on-page overlay. Board state is never transmitted to any external server.

### User Settings

Your configuration preferences (engine selection, search depth, display options, auto-play timing, etc.) are stored locally in `chrome.storage.sync` and persist across your devices via your Chrome profile. These settings contain no personal data — only your analysis preferences.

### Optional Auto-Play

If you enable the auto-play feature, the extension simulates mouse clicks on the chess board to make moves on your behalf. This is an opt-in feature, disabled by default, and operates entirely locally.

## Network Requests

The extension makes network requests in two scenarios:

1. **Local Engine Server (optional):** If you run the companion EngineWS application on your own machine, the extension connects to `ws://127.0.0.1:8000` (or a port you configure) to communicate with local chess engines. This connection stays on your local network and never touches external servers.

2. **Lichess Public APIs:** The extension may request opening book data from `explorer.lichess.ovh` and endgame tablebase data from `tablebase.lichess.ovh`. These requests send only the current board position (a FEN string) to retrieve publicly available opening statistics and tablebase evaluations. If you provide a personal Lichess API token, it is sent as a Bearer header to authenticate these requests. The token is stored in your local extension settings and is never transmitted anywhere except directly to Lichess's API.

No other outbound network requests are made. No page content, browsing data, or personal information is sent to any server.

## Data Storage

All data is stored locally:

- **chrome.storage.sync / chrome.storage.local:** User settings and cached opening book data
- **No external database:** We do not operate any server that stores your data

## Data Sharing

We do not share, sell, rent, or transfer user data to any third party. We do not use user data for advertising. We do not determine creditworthiness using user data.

## Children's Privacy

BetterMint does not knowingly collect any data from children under 13. The extension does not collect personal information from any user regardless of age.

## Changes to This Policy

If we make material changes to this privacy policy, we will update this page and revise the "Last updated" date at the top.

## Contact

For questions about this privacy policy, please open an issue at [https://github.com/BetterMint/BetterMint-Chess/issues](https://github.com/BetterMint/BetterMint-Chess/issues).
