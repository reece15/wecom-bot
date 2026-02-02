# OpenClaw WeCom Bot Plugin

[English](#english) | [中文](#chinese)

<a name="english"></a>

## 🦞 OpenClaw WeCom (Enterprise WeChat) Plugin

This is a standalone plugin for [OpenClaw](https://github.com/openclaw/openclaw) that adds support for **WeCom (Enterprise WeChat)** as a messaging channel. It allows you to deploy a powerful AI assistant on WeCom.

### Features

- **WeCom Webhook Integration**: Receive messages from WeCom via callback.
- **Enterprise Verification**: Supports CorpID, Secret, AgentID, and Token/AES Key verification.
- **AI Agent Capabilities**: Connects WeCom users to OpenClaw's AI agents.
- **Outbound Messaging**: Send messages back to WeCom users.
- **Onboarding Support**: Integrated with OpenClaw's onboarding wizard.

### Installation

Navigate to your OpenClaw installation and install this plugin:

```bash
# If installing from a local folder (development)
openclaw plugin add /path/to/wecom-bot

# If published to npm (future)
# openclaw plugin add wecom-bot
```

Or add it to your `openclaw.json` config manually if you are managing extensions via config.

### Configuration

You can configure the plugin via the OpenClaw onboarding wizard (`openclaw onboard`) or manually in your configuration file.

#### Environment Variables

- `WECOM_CORPID`: Your WeCom Corporation ID.
- `WECOM_CORPSECRET`: Your Application Secret.
- `WECOM_AGENTID`: The Agent ID of your WeCom app.

#### Manual Configuration

In your OpenClaw config:

```yaml
channels:
  wecom:
    corpid: "ww..."
    corpsecret: "..."
    agentid: "1000001"
    token: "..." # Optional, for webhook callback
    encodingAESKey: "..." # Optional, for webhook callback
```

---

<a name="chinese"></a>

## 🦞 OpenClaw 企业微信 (WeCom) 插件

这是一个 [OpenClaw](https://github.com/openclaw/openclaw) 的独立插件，为您的 AI 助手添加 **企业微信 (WeCom)** 渠道支持。

### 功能特性

- **企业微信 Webhook 集成**：通过回调接收企业微信消息。
- **企业验证**：支持 CorpID、Secret、AgentID 以及 Token/AES Key 验证。
- **AI 智能体能力**：将企业微信用户连接到 OpenClaw 的 AI 智能体。
- **消息发送**：支持向企业微信用户发送回复消息。
- **向导支持**：集成 OpenClaw 的 onboarding 向导，配置更简单。

### 安装

进入您的 OpenClaw 安装目录并安装此插件：

```bash
# 如果从本地目录安装 (开发模式)
openclaw plugin add /path/to/wecom-bot

# 如果已发布到 npm (未来)
# openclaw plugin add wecom-bot
```

或者手动添加到 `openclaw.json` 配置文件中。

### 配置

您可以通过 OpenClaw 的配置向导 (`openclaw onboard`) 进行配置，或者手动修改配置文件。

#### 环境变量

- `WECOM_CORPID`: 您的企业微信 CorpID。
- `WECOM_CORPSECRET`: 您的应用 Secret。
- `WECOM_AGENTID`: 您企业微信应用的 Agent ID。

#### 手动配置

在您的 OpenClaw 配置文件中：

```yaml
channels:
  wecom:
    corpid: "ww..."
    corpsecret: "..."
    agentid: "1000001"
    token: "..." # 可选，用于回调验证
    encodingAESKey: "..." # 可选，用于回调加密
```

## License

MIT
