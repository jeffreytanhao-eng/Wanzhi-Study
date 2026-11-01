#!/bin/bash
# 启动本地生产服务器（端口 3000）
cd "$(dirname "$0")"
export PATH=$HOME/node22/bin:$PATH
exec npx next start -p 3000 -H 0.0.0.0
