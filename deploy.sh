#!/bin/bash
set -e

echo "🌙 Midnight Diary - 部署准备"
echo "=============================="

# 1. Git 初始化
if [ ! -d .git ]; then
  git init
  echo "✓ Git 仓库已初始化"
else
  echo "✓ Git 仓库已存在"
fi

# 2. 暂存所有文件
git add -A

# 3. 提交
git commit -m "feat: midnight-diary initial release

- 5-step guided diary writing with causal hooks
- DeepSeek AI multi-turn conversation
- Supabase auth + cloud storage
- Deep night companion UI theme
- Responsive mobile-first layout"

echo "✓ 代码已提交"

# 4. 检查是否安装了 Vercel CLI
if command -v vercel &> /dev/null; then
  echo ""
  echo "检测到 Vercel CLI，是否立即部署？(y/n)"
  read -r answer
  if [ "$answer" = "y" ]; then
    vercel --prod
  fi
else
  echo ""
  echo "下一步："
  echo "  1. 在 GitHub 创建仓库并推送代码"
  echo "  2. 前往 vercel.com 导入该仓库"
  echo "  3. 在 Vercel 后台配置环境变量（见下方清单）"
fi

echo ""
echo "=============================="
echo "Vercel 环境变量配置清单："
echo "  DEEPSEEK_API_KEY=sk-xxxxx"
echo "  NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co"
echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx"
echo "=============================="
