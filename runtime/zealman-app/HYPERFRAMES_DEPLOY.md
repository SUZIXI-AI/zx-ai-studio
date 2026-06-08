# HyperFrames 一键成片部署说明

## 关键路径
- 模板：`/root/hyperframes-templates/<template-id>/template.html`
- 任务：`/root/autodl-tmp/hyperframes/jobs/<job-id>/`
- 输出：`/root/autodl-tmp/hyperframes/renders/<job-id>.mp4`
- API Key：`/root/autodl-tmp/hyperframes/config/api-keys.json`
- 日志：`/root/autodl-tmp/hyperframes/jobs/<job-id>/render.log`

## 常用排错
1. 模板列表：`curl http://127.0.0.1:6010/api/hyperframes/templates`
   - 通过主面板代理访问：`curl http://127.0.0.1:6008/wuli-api/api/hyperframes/templates`
2. 查看任务：`curl http://127.0.0.1:6010/api/hyperframes/jobs/<job-id>`
3. 查看日志：`curl http://127.0.0.1:6010/api/hyperframes/jobs/<job-id>/log`
4. HyperFrames 诊断：
   `PUPPETEER_CACHE_DIR=/opt/hyperframes-cache HYPERFRAMES_BROWSER_PATH=/opt/hyperframes-cache/manual-131.0.6778.85/chrome-headless-shell-linux64/chrome-headless-shell hyperframes doctor`
5. 初始化运行时：`/root/zealman-app/scripts/init-hyperframes.sh`

## 镜像保存检查清单
- [ ] HyperFrames 已安装：`hyperframes --version`
- [ ] Chrome 在 `/opt/hyperframes-cache`
- [ ] 模板在 `/root/hyperframes-templates`
- [ ] 后端 API 跑通：`curl http://127.0.0.1:6010/api/hyperframes/templates`
- [ ] 前端能打开“一键成片”
- [ ] 测试视频已渲染成功
- [ ] 删除测试任务：`rm -rf /root/autodl-tmp/hyperframes/jobs/*`
- [ ] 删除测试输出：`rm -rf /root/autodl-tmp/hyperframes/renders/*`
- [ ] 删除 npm 缓存：`rm -rf /root/.npm`
- [ ] 清理 bash_history：`cat /dev/null > ~/.bash_history`
- [ ] 在 AutoDL 控制台保存镜像

API Key 只保存在 `/root/autodl-tmp/hyperframes/config/api-keys.json`，不会进入镜像。客户开新实例后需要在前端设置页重新填写自己的 Key。
