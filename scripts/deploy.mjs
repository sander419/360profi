// Публикация содержимого dist/ в ветку gh-pages.
//
// Работает через git-плюмбинг (отдельный индекс + commit-tree), а не через
// клон во временную папку: пакет gh-pages падает на Windows, когда путь к
// проекту длинный ("Filename too long"). Коммит всегда получает родителем
// текущий origin/gh-pages, поэтому push обычный, без --force.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BRANCH = 'gh-pages';
const DIST = 'dist';

const git = (args, opts = {}) => {
  const out = execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...opts
  });
  return out ? out.trim() : '';
};

const root = git(['rev-parse', '--show-toplevel']);
process.chdir(root);

if (!fs.existsSync(path.join(root, DIST, 'index.html'))) {
  console.error(`Нет ${DIST}/index.html — сначала соберите проект: npm run build:pages`);
  process.exit(1);
}

const gitDir = git(['rev-parse', '--absolute-git-dir']);
const indexFile = path.join(gitDir, 'gh-pages-index');
fs.rmSync(indexFile, { force: true });
const env = { ...process.env, GIT_INDEX_FILE: indexFile };

// Vite копирует index.html байт в байт, поэтому на Windows он уезжает в ветку
// с CRLF, а с другой машины — с LF, и деплой каждый раз переписывает файл целиком.
// git на таком добавлении конверсию не применяет, приводим к LF сами.
const TEXT_FILE = /\.(html|css|js|mjs|json|svg|txt|map|webmanifest)$/i;

const toLf = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      toLf(full);
    } else if (TEXT_FILE.test(entry.name)) {
      const buf = fs.readFileSync(full);
      if (buf.includes(0x0d)) {
        fs.writeFileSync(full, buf.toString('utf8').split('\r\n').join('\n'));
      }
    }
  }
};

toLf(path.join(root, DIST));

git(['--work-tree', DIST, 'add', '--all', '--force', '.'], { env });
const tree = git(['write-tree'], { env });
fs.rmSync(indexFile, { force: true });

let parent = null;
try {
  git(['fetch', '--quiet', 'origin', `${BRANCH}:refs/remotes/origin/${BRANCH}`]);
} catch {
  // ветки ещё нет — первый деплой
}
try {
  parent = git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${BRANCH}`]);
} catch {
  parent = null;
}

if (parent) {
  const parentTree = git(['rev-parse', `${parent}^{tree}`]);
  if (parentTree === tree) {
    console.log('Собранный результат не изменился — публиковать нечего.');
    process.exit(0);
  }
}

const source = git(['rev-parse', '--short', 'HEAD']);
const message = `deploy: ${source}`;
const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message]);

git(['push', 'origin', `${commit}:refs/heads/${BRANCH}`], { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(`Опубликовано в ${BRANCH}: ${commit.slice(0, 7)} (из ${source})`);
