#!/bin/bash
export PATH=$PATH:/root/.nvm/versions/node/v22.22.0/bin
export OPENAI_API_KEY=sk-PADRQGigGYIfFd0XPKWiNsBfPn0KZ0orjEL5PTGgTkykElD0
export WECOM_CORP_ID=ww4e810a2d03b6d128
export WECOM_AGENT_ID=1000005
export WECOM_SECRET=tHmyUJiiBLwEZqP4xf2z2ccJHVftucYUcDt5sPy0SKc
export WECOM_TOKEN=lTQjZ6H
export WECOM_AES_KEY=ryLuda9SB6DCbYxzVkCWj0tDNH4DAmejBbFpWIG3zVT

pkill -f openclaw
sleep 2
nohup openclaw gateway > /root/openclaw.log 2>&1 &
echo "Started OpenClaw"
