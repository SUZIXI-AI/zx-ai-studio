# ZX AI Studio

ZX AI Studio 是面向 AutoDL.Art 的自研 AI 创作工作台。它包含网页控制台、工作流管理、素材上传、API 配置、一键成片、作品管理等功能。

本项目可以连接本机工作流服务作为执行引擎，但发布应用本身是 ZX AI Studio，不是第三方 AI 应用的搬运或套壳。

## 启动端口

- 主网页：`http://127.0.0.1:6008`
- 本地工作流执行引擎：`http://127.0.0.1:6006`
- 一键成片 API：`http://127.0.0.1:6010`

AutoDL.Art 的主入口端口请选择 `6008`。

## AutoDL.Art 启动命令

```bash
bash /root/zealman-app/scripts/autodl-start.sh
```

## 运行目录

发布镜像中建议保留：

```text
/root/zealman-app
/root/zealman-app/dist
/root/zealman-app/Wuli-API
/root/zealman-app/scripts/autodl-start.sh
/root/hyperframes-templates
/root/ComfyUI
/opt/hyperframes-cache
```

本仓库的 `runtime/` 目录对应镜像里的 `/root` 运行内容：

```text
runtime/zealman-app -> /root/zealman-app
runtime/hyperframes-templates -> /root/hyperframes-templates
```

用户运行数据写入：

```text
/root/autodl-tmp/hyperframes
```

API Key 不写入镜像，用户创建实例后在设置页自行填写。

## 发布说明建议

```text
ZX AI Studio 是自研 AI 创作工作台，提供网页控制台、工作流管理、素材上传、API 配置、一键成片与作品管理。应用主界面运行在 6008 端口，本机工作流执行引擎运行在 6006 端口，一键成片服务运行在 6010 端口。用户创建实例后自行填写 API Key。
```
