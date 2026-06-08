# AutoDL.Art 发布填写建议

## 应用名称

```text
ZX AI Studio
```

不要使用这些容易被误判为搬运的名称：

```text
ZX-AI-Comfy-UI-v2
ComfyUI 镜像
ComfyUI 应用
ComfyUI 整合包
```

## 应用定位

自研 AI 创作工作台。

ComfyUI 只描述为本地工作流执行引擎，不作为应用主体宣传。

## 启动命令

```bash
bash /root/zealman-app/scripts/autodl-start.sh
```

## 主端口

```text
6008
```

## 其他服务端口

```text
6006 ComfyUI 执行引擎
6010 一键成片 API
```

## 简短介绍

```text
自研 AI 创作工作台，支持网页控制台、工作流管理、素材上传、API 设置、一键成片和作品管理。
```

## 详细介绍

```text
ZX AI Studio 是自研 AI 创作工作台。它提供网页控制台、工作流管理、素材上传、API 配置、一键成片、作品管理等能力。应用主界面运行在 6008 端口，本机工作流执行引擎运行在 6006 端口，一键成片 API 服务运行在 6010 端口。用户创建实例后在设置页填写自己的 API Key，镜像内不包含任何密钥。
```

## 审核前检查

- 使用 AutoDL 官方基础镜像重新制作，不从其他 AI 应用镜像二次发布。
- 名称和介绍突出 `ZX AI Studio`，不要把应用命名为 ComfyUI。
- 镜像内不要包含 API Key、测试作品、渲染视频和临时日志。
- `/root/zealman-app/scripts/autodl-start.sh` 能启动 6008、6006、6010。
- 打开 6008 后能进入你的网站首页。

