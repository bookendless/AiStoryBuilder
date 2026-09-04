#!/usr/bin/env node

/**
 * バージョン同時更新スクリプト
 *
 * バージョン番号は package.json / tauri.conf.json / Cargo.toml / Cargo.lock に
 * 散在している。updater 導入後は tauri.conf.json の更新漏れがそのまま
 * 「誰にも更新が配信されない」に直結するため、まとめて更新・検証する。
 *
 * Cargo.lock は .gitignore 対象でリポジトリに含まれないため、CI では存在しない。
 * 無い場合はスキップし、残りの整合だけを見る。
 *
 *   npm run version:check              → 照合するだけ（不一致なら終了コード1）
 *   npm run version:set -- 2.4.0       → まとめて 2.4.0 に更新
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * それぞれ「1ファイルにつき1箇所だけ」一致する正規表現を用意する。
 * 依存パッケージ側の version と取り違えないよう、対象を厳密に絞り込んでいる。
 */
const TARGETS = [
    {
        label: 'package.json',
        file: 'package.json',
        // トップレベルの "version" キー（依存パッケージ名は "version" ではないため衝突しない）
        pattern: /^(\s*"version":\s*")([^"]+)(")/m,
    },
    {
        label: 'src-tauri/tauri.conf.json',
        file: 'src-tauri/tauri.conf.json',
        pattern: /^(\s*"version":\s*")([^"]+)(")/m,
    },
    {
        label: 'src-tauri/Cargo.toml',
        file: 'src-tauri/Cargo.toml',
        // [package] ブロック直下の version のみ。依存クレートの version は対象外
        pattern: /(\[package\][\s\S]*?\r?\nversion = ")([^"]+)(")/,
    },
    {
        label: 'src-tauri/Cargo.lock',
        file: 'src-tauri/Cargo.lock',
        // Cargo.lock は .gitignore 対象でリポジトリに含まれない。
        // CIのチェックアウト直後には存在しないため、無い場合はスキップする
        optional: true,
        // 自アプリのパッケージエントリのみ
        pattern: /(name = "ai-story-builder"\r?\nversion = ")([^"]+)(")/,
    },
];

const SEMVER = /^\d+\.\d+\.\d+$/;

/** 対象箇所が「ちょうど1つ」一致することを保証したうえで、現在値を返す */
function readTarget(target) {
    const filePath = path.join(ROOT, target.file);

    if (!fs.existsSync(filePath)) {
        if (target.optional) return null;
        throw new Error(`${target.label} が見つかりません: ${filePath}`);
    }

    const text = fs.readFileSync(filePath, 'utf8');
    const globalPattern = new RegExp(target.pattern.source, `${target.pattern.flags}g`);
    const matches = [...text.matchAll(globalPattern)];

    if (matches.length !== 1) {
        throw new Error(
            `${target.label} でバージョン記述が ${matches.length} 箇所一致しました（1箇所である必要があります）。` +
            'ファイル構造が変わった可能性があるため、scripts/bump-version.js の正規表現を見直してください。'
        );
    }

    return { filePath, text, version: matches[0][2] };
}

function check() {
    console.log('🔍 バージョン記述を照合します...\n');

    const results = [];
    const skipped = [];
    for (const target of TARGETS) {
        const read = readTarget(target);
        if (read) results.push({ target, ...read });
        else skipped.push(target);
    }

    const versions = [...new Set(results.map((r) => r.version))];
    const consistent = versions.length === 1;

    for (const r of results) {
        const mark = consistent || r.version === results[0].version ? '  ' : '❌';
        console.log(`${mark} ${r.target.label.padEnd(26)} ${r.version}`);
    }
    for (const t of skipped) {
        console.log(`   ${t.label.padEnd(26)} （このリポジトリには無いためスキップ）`);
    }

    console.log('');

    if (!consistent) {
        console.log(`❌ バージョンが一致していません: ${versions.join(' / ')}`);
        console.log('   npm run version:set -- <バージョン> で揃えてください');
        return 1;
    }

    console.log(`✅ 対象 ${results.length} 箇所すべて ${versions[0]} で一致しています`);
    return 0;
}

function set(nextVersion) {
    if (!SEMVER.test(nextVersion)) {
        console.log(`❌ バージョン指定が不正です: ${nextVersion}`);
        console.log('   x.y.z の形式で指定してください（例: 2.4.0）');
        return 1;
    }

    console.log(`📝 バージョンを ${nextVersion} に更新します...\n`);

    // 1ファイルでも書き換えに失敗したら中途半端な状態にしないよう、
    // 全ファイルを読んで検証してから、まとめて書き込む
    const results = [];
    for (const target of TARGETS) {
        const read = readTarget(target);
        if (read) results.push({ target, ...read });
        else console.log(`   ${target.label.padEnd(26)} （このリポジトリには無いためスキップ）`);
    }

    const updates = results.map((r) => ({
        ...r,
        nextText: r.text.replace(r.target.pattern, (_m, before, _current, after) => `${before}${nextVersion}${after}`),
    }));

    for (const u of updates) {
        fs.writeFileSync(u.filePath, u.nextText, 'utf8');
        const changed = u.version === nextVersion ? '変更なし' : `${u.version} → ${nextVersion}`;
        console.log(`✅ ${u.target.label.padEnd(26)} ${changed}`);
    }

    console.log('\n次の作業:');
    console.log('  1. git diff で4ファイルの差分を確認');
    console.log('  2. コミットしてタグ v' + nextVersion + ' を打つとリリースワークフローが動きます');
    return 0;
}

function main() {
    const args = process.argv.slice(2);
    // npm run version:set が --set を渡す。バージョンの指定漏れを
    // 「照合だけして成功」で見逃すと、更新が配信されない事故に直結する
    const isSetMode = args[0] === '--set';
    const requested = isSetMode ? args[1] : args[0];

    if (isSetMode && !requested) {
        console.log('❌ バージョンが指定されていません');
        console.log('   npm run version:set -- 2.4.0 のように指定してください');
        process.exitCode = 1;
        return;
    }

    try {
        process.exitCode = requested ? set(requested) : check();
    } catch (error) {
        console.log(`❌ ${error.message}`);
        process.exitCode = 1;
    }
}

main();
