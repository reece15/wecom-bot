# OpenClaw WeCom (Enterprise WeChat) Plugin

[English](README_EN.md) | [中文](README.md)

This is a standalone plugin for [OpenClaw](https://github.com/openclaw/openclaw) that adds support for **WeCom (Enterprise WeChat)** as a messaging channel. It allows you to deploy a powerful AI assistant on WeCom.

## Features

- **WeCom Webhook Integration**: Receive messages from WeCom via callback.
- **Enterprise Verification**: Supports CorpID, Secret, AgentID, and Token/AES Key verification.
- **AI Agent Capabilities**: Connects WeCom users to OpenClaw's AI agents.
- **Outbound Messaging**: Send messages back to WeCom users.
- **Onboarding Support**: Integrated with OpenClaw's onboarding wizard.

## Installation

Run the following in the plugin directory:

```bash
git clone https://github.com/openclaw/wecom-bot.git && cd wecom-bot
openclaw plugins install . 
# Or using npx: npx openclaw plugins install .
```

> Note: The installation process may require downloading dependencies, please wait patiently.

## Configuration

### 1. Get WeCom Credentials

1. Log in to the [WeCom Admin Console](https://work.weixin.qq.com/wework_admin/frame).
2. Go to **My Enterprise** -> **Enterprise Info** to get `CorpID`.
3. Go to **Apps Management** -> **Create App** (or select an existing one).
4. Get the App's `AgentId` and `Secret`.
5. In App Details -> **Receive Messages** -> **Set API Receive**:
   - Get `Token` and `EncodingAESKey`.
   - **URL** should be the public address of your OpenClaw gateway, usually `http://YOUR_SERVER_IP:PORT/wecom-app/webhook`.

### 2. Add Configuration

#### Method 1: Interactive Configuration (Recommended)

```bash
openclaw onboard
# Select wecom-app for interactive configuration
```

#### Method 2: Command Line

```bash
openclaw channels add --channel wecom-app
```

#### Method 3: Manual Configuration

Edit your OpenClaw config file (usually at `~/.openclaw/openclaw.json`):

```json
{
  "channels": {
    "wecom-app": {
      "default": {
        "enabled": true,
        "corpid": "ww...",
        "corpsecret": "...",
        "agentid": "1000001",
        "token": "...",
        "encodingAESKey": "..."
      }
    }
  }
}
```

## Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `corpid` | Yes | Enterprise ID (CorpID) |
| `corpsecret` | Yes | App Secret |
| `agentid` | Yes | App AgentID |
| `token` | No | Webhook Callback Token (Required for receiving messages) |
| `encodingAESKey` | No | Webhook Encryption Key (Required for receiving messages) |

## Usage

### Start

Restart the gateway in the background:
```bash
openclaw gateway restart
```

Start in foreground (for logs):
```bash
openclaw gateway --verbose
```

## Troubleshooting

### 1. Unable to Send Messages / Error 60020

**Symptoms**:
- User messages are received successfully in the logs.
- Bot fails to reply, error log shows `Error: WeCom API error 60020: not allow to access from your ip`.

**Cause**:
The server IP is not added to the "Trusted IP" whitelist in the WeCom application settings. Sending messages (API calls) requires IP whitelisting, even if the webhook callback is working.

**Solution**:
1. Log in to the [WeCom Admin Console](https://work.weixin.qq.com/wework_admin/frame).
2. Go to **Apps Management** -> Select your App (Agent).
3. Find **Enterprise Trusted IP** setting and click "Configure".
4. Add your server's public IP to the list and save.

### 2. Unable to Receive Messages

**Steps**:
1. Check if `openclaw gateway` is running and listening on the port.
2. Verify the URL in WeCom Admin Console -> "Receive Messages" is correct and accessible from the internet.
3. Ensure `Token` and `EncodingAESKey` match the console settings.

## Upgrade

```bash
cd wecom-bot
git pull
npm install
npm run build
openclaw plugins install . --force
openclaw gateway restart
```

## License

MIT
