import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [
        tailwindcss(),
      ],
      server: {
        port: 6008,
        host: '0.0.0.0',
        strictPort: true,
        hmr: { overlay: false },
        // 允许任意外网域名通过反向代理访问（自定义服务的随机域名）
        allowedHosts: true,
        // 移除代理配置，因为API和前端现在都在同一端口
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), '.'),
        }
      },
      build: {
        // 启用代码混淆
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true, // 移除console.log
            drop_debugger: true, // 移除debugger
            pure_funcs: ['console.log', 'console.info', 'console.debug'], // 移除指定函数
          },
          mangle: {
            toplevel: true, // 混淆顶级作用域
            properties: {
              regex: /^_/, // 混淆以下划线开头的属性
            }
          }
        },
        // 代码分割配置 - 单文件合并方案
        rollupOptions: {
          output: {
            // 强制合并所有代码到单个文件
            manualChunks: () => 'app',
            // 自定义文件命名
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash].[ext]'
          }
        },
        // 设置chunk大小警告限制
        chunkSizeWarningLimit: 1000,
        // 启用source map（生产环境建议关闭）
        sourcemap: false,
        // 启用CSS代码分割
        cssCodeSplit: true
      }
    };
});