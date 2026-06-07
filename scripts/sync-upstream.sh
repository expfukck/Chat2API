#!/bin/bash
# Chat2API Docker - 上游同步 + 构建 + 推送
# 用法: bash scripts/sync-upstream.sh [--skip-build]
#
# 完整流程:
#   1. 拉取上游最新代码
#   2. Rebase docker 分支到上游 main
#   3. 推送到你的 Fork
#   4. 构建 Docker 镜像
#   5. 推送到 Docker Hub

set -e

DOCKER_USER="${DOCKER_USER:-movemama}"
DOCKER_REPO="${DOCKER_REPO:-chat2api}"
SKIP_BUILD=false

# 解析参数
if [ "$1" = "--skip-build" ]; then
  SKIP_BUILD=true
fi

# 生成版本号 (基于日期)
VERSION="1.$(date +%m).$(date +%d)"

echo "╔══════════════════════════════════════════╗"
echo "║   Chat2API Docker - 同步 + 构建 + 推送  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ==================== Step 1: 同步上游 ====================
echo "━━━ Step 1/4: 同步上游代码 ━━━"

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "docker" ]; then
  echo "  切换到 docker 分支..."
  git checkout docker
fi

if ! git remote | grep -q upstream; then
  echo "  添加 upstream remote..."
  git remote add upstream https://github.com/xiaoY233/Chat2API.git
fi

echo "  拉取上游最新代码..."
git fetch upstream

UPSTREAM_NEW=$(git log docker..upstream/main --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UPSTREAM_NEW" -eq 0 ]; then
  echo "  ✅ 已经是最新，无需同步"
else
  echo "  📋 上游有 $UPSTREAM_NEW 个新提交:"
  git log docker..upstream/main --oneline
  echo ""

  echo "  🔄 Rebase 到上游 main..."
  if git rebase upstream/main; then
    echo "  ✅ Rebase 成功"
  else
    echo ""
    echo "  ⚠ 有冲突需要手动解决:"
    git diff --name-only --diff-filter=U
    echo ""
    echo "  解决冲突后运行:"
    echo "    git add <文件>"
    echo "    git rebase --continue"
    echo "    bash scripts/sync-upstream.sh"
    exit 1
  fi

  echo "  📤 推送到 Fork..."
  git push --force-with-lease origin docker
  echo "  ✅ Fork 已更新"
fi

echo ""

# ==================== Step 2: 构建镜像 ====================
if [ "$SKIP_BUILD" = true ]; then
  echo "━━━ Step 2/4: 构建镜像 (跳过) ━━━"
  echo ""
  echo "━━━ Step 3/4: 推送镜像 (跳过) ━━━"
  echo ""
  echo "━━━ Step 4/4: 重启容器 (跳过) ━━━"
  echo ""
  echo "✅ 同步完成 (跳过构建)"
  exit 0
fi

echo "━━━ Step 2/4: 构建 Docker 镜像 ━━━"
echo "  版本: $DOCKER_USER/$DOCKER_REPO:$VERSION"
echo ""

docker build \
  -t $DOCKER_USER/$DOCKER_REPO:latest \
  -t $DOCKER_USER/$DOCKER_REPO:$VERSION \
  .

echo "  ✅ 镜像构建成功"
echo ""

# ==================== Step 3: 推送镜像 ====================
echo "━━━ Step 3/4: 推送到 Docker Hub ━━━"

docker push $DOCKER_USER/$DOCKER_REPO:latest
docker push $DOCKER_USER/$DOCKER_REPO:$VERSION

echo "  ✅ 镜像已推送"
echo ""

# ==================== Step 4: 重启容器 ====================
echo "━━━ Step 4/4: 重启容器 ━━━"

if [ -f docker-compose.yml ]; then
  docker compose up -d --force-recreate 2>/dev/null || docker-compose up -d --force-recreate 2>/dev/null || true
  echo "  ✅ 容器已重启"
else
  echo "  ⚠ 未找到 docker-compose.yml，跳过重启"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║            ✅ 全部完成！                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Fork:   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/tree/docker"
echo "  Docker: https://hub.docker.com/r/$DOCKER_USER/$DOCKER_REPO"
echo "  版本:   $VERSION"
echo "  管理:   http://localhost:18051"
echo "  API:    http://localhost:18050"
echo ""
