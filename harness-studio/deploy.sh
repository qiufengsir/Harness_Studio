#!/bin/bash
# ============================================================
# Harness Studio — 阿里云服务器一键部署脚本
# 运行前确保服务器已安装 Docker 和 Docker Compose
# ============================================================

set -e

echo "🚀 Harness Studio 部署脚本"
echo "=========================="

# 1. 拉取代码
echo ""
echo "1️⃣ 拉取代码..."
if [ -d "harness-studio" ]; then
  cd harness-studio && git pull origin main
else
  git clone https://github.com/qiufengsir/Harness_Studio.git harness-studio
  cd harness-studio
fi

# 2. 构建 Docker 镜像
echo ""
echo "2️⃣ 构建 Docker 镜像..."
docker build -t harness-studio .

# 3. 创建数据目录
echo ""
echo "3️⃣ 创建数据目录..."
mkdir -p /data/harness-studio

# 4. 停止旧容器
echo ""
echo "4️⃣ 停止旧容器..."
docker stop harness-studio 2>/dev/null || true
docker rm harness-studio 2>/dev/null || true

# 5. 启动新容器
echo ""
echo "5️⃣ 启动容器..."
docker run -d \
  --name harness-studio \
  --restart=always \
  -p 3000:3000 \
  -v /data/harness-studio:/data \
  -e DATABASE_PATH=/data/dev.db \
  -e DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY \
  -e DEMO_MODE=true \
  -e RATE_LIMIT_PER_MINUTE=10 \
  harness-studio

echo ""
echo "✅ 部署完成！"
echo ""
echo "访问地址: http://你的服务器IP:3000"
echo "数据目录: /data/harness-studio"
echo ""
echo "查看日志: docker logs -f harness-studio"
echo "重启服务: docker restart harness-studio"
