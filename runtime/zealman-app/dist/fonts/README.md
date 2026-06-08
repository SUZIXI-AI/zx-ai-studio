# 字体文件说明

本项目使用本地字体文件以支持离线/局域网环境。

## 需要的字体文件

### 1. Material Symbols Outlined (图标字体)

**下载地址:**
- GitHub: https://github.com/google/material-design-icons/tree/master/variablefont
- 直接下载: https://github.com/google/material-design-icons/raw/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.woff2

**保存位置:**
```
public/fonts/material-symbols/MaterialSymbolsOutlined.woff2
```

### 2. Inter 字体

**下载地址:**
- GitHub: https://github.com/rsms/inter
- 官网: https://rsms.me/inter/

**需要下载的文件:**

1. **Inter-Light.woff2** (字重 300)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Light.woff2
   - 保存到: `public/fonts/inter/Inter-Light.woff2`

2. **Inter-Regular.woff2** (字重 400)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.woff2
   - 保存到: `public/fonts/inter/Inter-Regular.woff2`

3. **Inter-Medium.woff2** (字重 500)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Medium.woff2
   - 保存到: `public/fonts/inter/Inter-Medium.woff2`

4. **Inter-SemiBold.woff2** (字重 600)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-SemiBold.woff2
   - 保存到: `public/fonts/inter/Inter-SemiBold.woff2`

5. **Inter-Bold.woff2** (字重 700)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.woff2
   - 保存到: `public/fonts/inter/Inter-Bold.woff2`

6. **Inter-ExtraBold.woff2** (字重 800)
   - https://github.com/rsms/inter/raw/master/docs/font-files/Inter-ExtraBold.woff2
   - 保存到: `public/fonts/inter/Inter-ExtraBold.woff2`

## 自动下载脚本

### Linux/Mac:
```bash
bash scripts/download-fonts.sh
```

### Windows (PowerShell):
```powershell
.\scripts\download-fonts.ps1
```

### 使用 wget (Linux):
```bash
# 创建目录
mkdir -p public/fonts/material-symbols
mkdir -p public/fonts/inter

# 下载 Material Symbols
wget -O public/fonts/material-symbols/MaterialSymbolsOutlined.woff2 \
  "https://github.com/google/material-design-icons/raw/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.woff2"

# 下载 Inter 字体
wget -O public/fonts/inter/Inter-Light.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Light.woff2"
wget -O public/fonts/inter/Inter-Regular.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.woff2"
wget -O public/fonts/inter/Inter-Medium.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Medium.woff2"
wget -O public/fonts/inter/Inter-SemiBold.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-SemiBold.woff2"
wget -O public/fonts/inter/Inter-Bold.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.woff2"
wget -O public/fonts/inter/Inter-ExtraBold.woff2 \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-ExtraBold.woff2"
```

## 目录结构

下载完成后,目录结构应该如下:

```
public/fonts/
├── fonts.css                           # 字体CSS定义
├── material-symbols/
│   └── MaterialSymbolsOutlined.woff2   # Material Symbols 图标字体
└── inter/
    ├── Inter-Light.woff2               # Inter 300
    ├── Inter-Regular.woff2             # Inter 400
    ├── Inter-Medium.woff2              # Inter 500
    ├── Inter-SemiBold.woff2            # Inter 600
    ├── Inter-Bold.woff2                # Inter 700
    └── Inter-ExtraBold.woff2           # Inter 800
```

## 验证

下载完成后,可以检查文件是否存在:

### Linux/Mac:
```bash
ls -lh public/fonts/material-symbols/
ls -lh public/fonts/inter/
```

### Windows (PowerShell):
```powershell
Get-ChildItem public\fonts\material-symbols\
Get-ChildItem public\fonts\inter\
```

## 文件大小参考

- MaterialSymbolsOutlined.woff2: ~500KB
- Inter-Light.woff2: ~100KB
- Inter-Regular.woff2: ~100KB
- Inter-Medium.woff2: ~100KB
- Inter-SemiBold.woff2: ~100KB
- Inter-Bold.woff2: ~100KB
- Inter-ExtraBold.woff2: ~100KB

总计约: ~1.1MB

## 故障排除

如果字体无法加载:

1. 检查文件路径是否正确
2. 检查文件是否完整下载(查看文件大小)
3. 检查浏览器控制台是否有错误
4. 清除浏览器缓存后重试

