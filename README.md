# OpenClaw 企业微信 (WeCom) 插件

[English](README_EN.md) | [中文](README.md)

这是一个 [OpenClaw](https://github.com/openclaw/openclaw) 的独立插件，为您的 AI 助手添加 **企业微信 (WeCom)** 渠道支持。它允许您将 OpenClaw 强大的 AI 智能体能力接入到企业微信应用中。

## 功能特性

- **企业微信 Webhook 集成**：通过回调接收企业微信消息。
- **企业验证**：支持 CorpID、Secret、AgentID 以及 Token/AES Key 验证。
- **AI 智能体能力**：将企业微信用户连接到 OpenClaw 的 AI 智能体。
- **消息发送**：支持向企业微信用户发送回复消息。
- **向导支持**：集成 OpenClaw 的 onboarding 向导，配置更简单。

## 安装

在插件目录下执行：

```bash
git clone https://github.com/openclaw/wecom-bot.git && cd wecom-bot
openclaw plugins install . 
# 或者使用 npx: npx openclaw plugins install .
```

> 注意：安装过程可能需要下载依赖，请耐心等待。

## 配置

### 1. 获取企业微信凭证

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)。
2. 进入 **我的企业** -> **企业信息**，获取 `CorpID`。
3. 进入 **应用管理** -> **创建应用**（或选择现有应用）。
4. 获取应用的 `AgentId` 和 `Secret`。
5. 在应用详情页 -> **接收消息** -> **设置 API 接收**：
   - 获取 `Token` 和 `EncodingAESKey`。
   - **URL** 需要填入 OpenClaw 网关的公网地址，格式通常为 `http://YOUR_SERVER_IP:PORT/wecom-app/webhook`。

### 2. 添加配置

#### 方式一：交互式配置 (推荐)

```bash
openclaw onboard
# 选择 wecom-app 进行交互式配置
```

#### 方式二：命令行配置

```bash
openclaw channels add --channel wecom-app
```

#### 方式三：手动编辑配置

编辑您的 OpenClaw 配置文件（通常位于 `~/.openclaw/openclaw.json`）：

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

## 配置项说明

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `corpid` | 是 | 企业 ID (CorpID) |
| `corpsecret` | 是 | 应用 Secret |
| `agentid` | 是 | 应用 AgentID |
| `token` | 否 | Webhook 回调 Token (接收消息必填) |
| `encodingAESKey` | 否 | Webhook 加密 Key (接收消息必填) |

## 使用

### 启动

后台启动网关：
```bash
openclaw gateway restart
```

前台启动（方便查看日志）：
```bash
openclaw gateway --verbose
```

## 常见问题与排查

### 1. 无法发送消息 / Error 60020

**现象**：
- 用户发送消息后，后台日志显示接收正常。
- 机器人回复失败，日志报错 `Error: WeCom API error 60020: not allow to access from your ip`。

**原因**：
服务器 IP 未被添加到企业微信应用的“企业可信 IP”白名单中。即使配置了接收消息的回调，发送消息（调用 API）仍需校验 IP 白名单。

**解决方案**：
1. 登录 [企业微信管理后台](https://work.weixin.qq.com/wework_admin/frame)。
2. 进入 **应用管理** -> 选择您的应用（Agent）。
3. 找到 **企业可信IP** 配置项，点击“配置”。
4. 将您的服务器公网 IP 添加到列表中并保存。

### 2. 无法接收消息

**排查步骤**：
1. 检查 `openclaw gateway` 是否正常启动并监听端口。
2. 检查企业微信后台“接收消息”配置中的 URL 是否正确，能否通过公网访问。
3. 确保 `Token` 和 `EncodingAESKey` 配置与后台一致。

## 升级

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
