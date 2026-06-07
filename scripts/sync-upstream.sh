#!/bin/bash
# Chat2API Docker - 上游同步脚本
# 用法: bash scripts/sync-upstream.sh
#
# 工作流程:
#   1. 拉取上游最新代码
#   2. 将上游 main 分支 rebase 到 docker 分支
#   3. 解决冲突（如有）
#   4. 推送到你的 fork

set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Chat2API Docker - 上游同步            ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 确保在 docker 分支
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "docker" ]; then
  echo "⚠ 当前在 $CURRENT_BRANCH 分支，切换到 docker..."
  git checkout docker
fi

# 检查 upstream remote
if ! git remote | grep -q upstream; then
  echo "添加 upstream remote..."
  git remote add upstream https://github.com/xiaoY233/Chat2API.git
fi

# 拉取上游最新代码
echo "📥 拉取上游最新代码..."
git fetch upstream

# 查看上游有多少新提交
UPSTREAM_NEW=$(git log docker..upstream/main --oneline 2>/dev/null | wc -l)
if [ "$UPSTREAM_NEW" -eq 0 ]; then
  echo "✅ 已经是最新，无需同步"
  exit 0
fi

echo "📋 上游有 $UPSTREAM_NEW 个新提交:"
git log docker..upstream/main --oneline
echo ""

# Rebase docker 分支到上游 main
echo "🔄 正在 rebase 到上游 main..."
if git rebase upstream/main; then
  echo "✅ Rebase 成功，无冲突"
else
  echo ""
  echo "⚠ 有冲突需要手动解决:"
  echo "  1. 编辑冲突文件解决冲突"
  echo "  2. git add <已解决的文件>"
  echo "  3. git rebase --continue"
  echo ""
  echo "冲突文件:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "解决完冲突后，运行: git push --force-with-lease origin docker"
  exit 1
fi

# 推送更新到 fork
echo "📤 推送到 fork..."
git push --force-with-lease origin docker

echo ""
echo "✅ 同步完成！"
echo ""
echo "下一步: 重新构建 Docker 镜像"
echo "  docker build -t movemama/chat2api:latest ."
echo "  docker-compose up -d --force-recreate"
