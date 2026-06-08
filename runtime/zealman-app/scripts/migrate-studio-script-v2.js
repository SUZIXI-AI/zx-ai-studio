/**
 * 将历史项目的剧本从仅 script.json / script.txt 迁移为 script/index.json + script/chapters/*.json
 *
 * 用法（在 zealman-app 根目录）：
 *   node scripts/migrate-studio-script-v2.js
 *   node scripts/migrate-studio-script-v2.js --force   # 含已有 v2 的项目也重写一遍
 *
 * 环境：MYMOVIE_DIR 未设置时使用 config/paths.js 默认（Windows: 与 zealman-app 同级的 MyMovie）
 */
import fs from 'fs';
import path from 'path';
import { MYMOVIE_DIR } from '../config/paths.js';
import {
    readScriptPayload,
    writeScriptPayload,
    hasLegacyScriptFiles,
    hasScriptV2Index,
} from '../lib/studioScriptStore.js';

const PROJECTS_DIR = path.join(MYMOVIE_DIR, 'projects');
const force = process.argv.includes('--force');

function listProjectIds() {
    if (!fs.existsSync(PROJECTS_DIR)) {
        console.error('[migrate] projects 目录不存在:', PROJECTS_DIR);
        return [];
    }
    return fs
        .readdirSync(PROJECTS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
}

function shouldMigrate(pDir) {
    if (force) return true;
    if (hasScriptV2Index(pDir)) return false;
    return hasLegacyScriptFiles(pDir);
}

let ok = 0;
let skip = 0;
let err = 0;

for (const id of listProjectIds()) {
    const pDir = path.join(PROJECTS_DIR, id);
    const projectJson = path.join(pDir, 'project.json');
    if (!fs.existsSync(projectJson)) {
        console.log(`[migrate] 跳过（无 project.json） ${id}`);
        skip++;
        continue;
    }
    if (!shouldMigrate(pDir)) {
        console.log(`[migrate] 跳过 ${id}`);
        skip++;
        continue;
    }
    try {
        const payload = readScriptPayload(pDir);
        writeScriptPayload(pDir, payload);
        console.log(`[migrate] 完成 ${id}（${payload.chapters.length} 章）`);
        ok++;
    } catch (e) {
        console.error(`[migrate] 失败 ${id}:`, e.message);
        err++;
    }
}

console.log(`[migrate] 结束：成功 ${ok}，跳过 ${skip}，失败 ${err}。MYMOVIE_DIR=${MYMOVIE_DIR}`);
process.exit(err > 0 ? 1 : 0);
