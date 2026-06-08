# 发布包清单

最终发布到 GitHub 和 AutoDL 镜像时，应包含这些内容：

```text
/root/zealman-app
  dist/
  Wuli-API/
  scripts/autodl-start.sh
  server.js
  package.json
  package-lock.json

/root/hyperframes-templates
  no-template/
  social-clip/
  product-intro/
  caption-card/

/root/ComfyUI
  main.py
  custom_nodes/
  models/        # 如需开箱即用，模型可保留在镜像里；如果太大，可改为首次运行下载。

/opt/hyperframes-cache
  manual-*/chrome-headless-shell-*
```

不要提交或打进公开镜像：

```text
.env
*.db
/root/autodl-tmp/hyperframes/config/api-keys.json 中的真实 key
/root/autodl-tmp/hyperframes/jobs/*
/root/autodl-tmp/hyperframes/renders/*
/root/autodl-tmp/hyperframes/logs/*
node_modules/
__pycache__/
*.bak-*
*.log
```

当前本地临时目录、截图和历史调试文件不要提交到 GitHub。

