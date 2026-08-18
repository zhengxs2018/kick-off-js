import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import fg from 'fast-glob';
import { intro, outro } from '@clack/prompts';

/**
 * merge-src 集中配置：只需在此维护，脚本逻辑不随业务调整。
 *
 * - projects: 包扫描位置 glob，类似 pnpm workspaces，如 ['packages/*']。
 * - scopes:   每个作用域一组输入 glob（相对各包根解析）。
 * - extensions: 扩展名 -> 代码块 fence 语言。
 * - ignorePatterns: 强制忽略的路径片段（可含 glob，如 'dist-*'）。
 * - ignoreDotFiles: 忽略以 . 开头的文件与文件夹。
 * - outputDir: 输出 markdown 目录。
 */
const config: MergeSrcConfig = {
  projects: ['packages/*'],
  scopes: [
    {
      key: 'src',
      label: '源码',
      input: ['src/**/*.ts'],
    },
  ],
  extensions: {
    '.ts': 'ts',
    '.peggy': 'peggy',
  },
  ignorePatterns: ['node_modules', 'dist', 'dist-*', 'docs'],
  ignoreDotFiles: true,
  outputDir: 'output',
};

const ROOT = process.cwd();

interface FileNode {
  relativePath: string;
  absolutePath: string;
}

/** 取扩展名对应的代码块语言，未知扩展回退为 text。 */
export function fenceLanguage(relativePath: string, extensions: Record<string, string>): string {
  const ext = relativePath.slice(relativePath.lastIndexOf('.'));
  return extensions[ext] ?? 'text';
}

/** 扩展名是否被配置接受（用于校验扫描结果，glob 已保证，仅作兜底）。 */
function isSupportedExt(relativePath: string, extensions: Record<string, string>): boolean {
  return Object.keys(extensions).some(ext => relativePath.endsWith(ext));
}

/** 按配置 projects 展开包根目录。 */
export async function listProjectRoots(projects: string[]): Promise<string[]> {
  const matches = await fg(projects, {
    cwd: ROOT,
    onlyDirectories: true,
    deep: 1,
    unique: true,
  });
  return matches.sort();
}

/** 在某包根下按 input glob 扫描文件，应用 ignore 与 dotfile 过滤。 */
export async function collectFiles(
  projectRoot: string,
  scopeInput: string[],
  ignorePatterns: string[],
  ignoreDotFiles: boolean,
  extensions: Record<string, string>,
): Promise<FileNode[]> {
  const matches = await fg(scopeInput, {
    cwd: projectRoot,
    onlyFiles: true,
    unique: true,
    ignore: ignorePatterns,
    dot: !ignoreDotFiles,
  });

  const nodes: FileNode[] = [];
  for (const match of matches) {
    if (ignoreDotFiles && match.split('/').some(segment => segment.startsWith('.'))) {
      continue;
    }
    if (!isSupportedExt(match, extensions)) {
      continue;
    }
    nodes.push({ relativePath: match, absolutePath: join(projectRoot, match) });
  }

  nodes.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return nodes;
}

/** 将文件列表拼接为单个 markdown 文档。 */
export async function buildMarkdown(
  projectName: string,
  scopeLabel: string,
  files: FileNode[],
  extensions: Record<string, string>,
): Promise<string> {
  const sections: string[] = [`# ${projectName} · ${scopeLabel}`];
  for (const file of files) {
    const code = await readFile(file.absolutePath, 'utf-8');
    const fence = fenceLanguage(file.relativePath, extensions);
    sections.push(
      `## ${file.relativePath}`,
      '',
      '```' + fence,
      code.replace(/\n+$/, ''),
      '```',
      '',
    );
  }
  return sections.join('\n');
}

async function run(cfg: MergeSrcConfig): Promise<void> {
  intro('按配置合并 packages 源码');

  const projectRoots = await listProjectRoots(cfg.projects);
  if (projectRoots.length === 0) {
    outro(`未找到任何包 (${cfg.projects.join(', ')} 无匹配目录)`);
    return;
  }

  await mkdir(cfg.outputDir, { recursive: true });

  const summary: string[] = [];
  for (const root of projectRoots) {
    const projectName = relative(ROOT, root).split(sep).join('/');
    for (const scope of cfg.scopes) {
      const files = await collectFiles(
        root,
        scope.input,
        cfg.ignorePatterns,
        cfg.ignoreDotFiles,
        cfg.extensions,
      );
      if (files.length === 0) {
        continue;
      }
      const markdown = await buildMarkdown(projectName, scope.label, files, cfg.extensions);
      const outputPath = join(cfg.outputDir, `${projectName.replace(/\//g, '-')}-${scope.key}.md`);
      await writeFile(outputPath, markdown, 'utf-8');
      summary.push(
        `${projectName} · ${scope.label}: ${files.length} 个文件 -> ${relative(ROOT, outputPath)}`,
      );
    }
  }

  if (summary.length === 0) {
    outro('配置的 scopes 下未匹配到任何文件');
    return;
  }

  outro(summary.join('\n'));
}

if (import.meta.main) {
  run(config).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export interface ScopeConfig {
  key: string;
  label: string;
  input: string[];
}

export interface MergeSrcConfig {
  projects: string[];
  scopes: ScopeConfig[];
  extensions: Record<string, string>;
  ignorePatterns: string[];
  ignoreDotFiles: boolean;
  outputDir: string;
}
