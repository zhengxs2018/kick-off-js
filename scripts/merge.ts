import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, relative, basename, extname, sep } from 'node:path';
import fg from 'fast-glob';
import { intro, outro, cancel, isCancel, select, confirm, multiselect, log } from '@clack/prompts';

export interface ScopeConfig {
  key: string;
  label: string;
  input: string[];
}

export interface MergeSrcConfig {
  /** 工作根目录，缺省回退到 process.cwd()。 */
  root?: string;
  /** 包扫描位置 glob。单工程时为空数组，或匹配不到任何目录时自动降级为 root。 */
  projects: string[];
  scopes: ScopeConfig[];
  extensions: Record<string, string>;
  ignorePatterns: string[];
  ignoreDotFiles: boolean;
  ignoreIndexFiles: boolean;
  ignoreDtsFiles: boolean;
  outputDir: string;
}

/** 默认配置，供外部命令工具传参覆盖（defineConfig / mergeConfig 的基础）。 */
export const defaultConfig: MergeSrcConfig = {
  root: process.cwd(),
  projects: ['packages/*'],
  scopes: [
    {
      key: 'src',
      label: 'JS/TS 源码',
      input: ['src/**/*.{ts,js,tsx,jsx}'],
    },
    {
      key: 'peggy',
      label: 'Peggy 源码',
      input: ['src-peggy/**/*.peggy'],
    },
  ],
  extensions: {
    '.ts': 'ts',
    '.js': 'js',
    '.tsx': 'tsx',
    '.jsx': 'jsx',
    '.peggy': 'peggy',
  },
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/dist-*/**', '**/docs/**'],
  ignoreDotFiles: true,
  ignoreIndexFiles: true,
  ignoreDtsFiles: false,
  outputDir: '.output',
};

interface FileNode {
  relativePath: string;
  absolutePath: string;
}

/** 取扩展名对应的代码块语言，未知扩展回退为 text。 */
export function fenceLanguage(relativePath: string, extensions: Record<string, string>): string {
  return extensions[extname(relativePath)] ?? 'text';
}

/** 解析实际工作根目录，缺省回退到 process.cwd()。 */
export function resolveRoot(cfg: Pick<MergeSrcConfig, 'root'>): string {
  return cfg.root ?? process.cwd();
}

/**
 * 展开包根目录（绝对路径）。
 *
 * - projects 为空数组时视为单工程，直接返回 root。
 * - 按 projects 匹配不到任何目录时同样降级为 root（非 monorepo 场景）。
 */
export async function listProjectRoots(root: string, projects: string[]): Promise<string[]> {
  if (projects.length === 0) {
    return [root];
  }
  const matches = await fg(projects, {
    cwd: root,
    absolute: true,
    onlyDirectories: true,
    deep: 1,
    unique: true,
  });
  return matches.length > 0 ? matches.sort() : [root];
}

/**
 * 在某包根下按 input glob 扫描文件。
 *
 * index 与 dts 的剔除规则动态拼入 ignorePatterns，交由 fast-glob 一次性过滤；
 * dotfile 由 `dot` 选项处理，不再手写逐路径判断。
 */
export async function collectFiles(
  projectRoot: string,
  scopeInput: string[],
  config: MergeSrcConfig,
  ignoreIndexFiles: boolean,
  ignoreDtsFiles: boolean,
): Promise<FileNode[]> {
  const dynamicIgnores = [...config.ignorePatterns];
  if (ignoreIndexFiles) {
    dynamicIgnores.push('**/index.{ts,js,mts,mjs,cts,cjs}');
  }
  if (ignoreDtsFiles) {
    dynamicIgnores.push('**/*.d.ts');
  }

  const matches = await fg(scopeInput, {
    cwd: projectRoot,
    onlyFiles: true,
    unique: true,
    ignore: dynamicIgnores,
    dot: !config.ignoreDotFiles,
  });

  const supportedExts = new Set(Object.keys(config.extensions));
  const nodes: FileNode[] = [];
  for (const match of matches) {
    if (!supportedExts.has(extname(match))) {
      continue;
    }
    nodes.push({ relativePath: match, absolutePath: join(projectRoot, match) });
  }

  nodes.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return nodes;
}

/**
 * 探测各 scope 下是否存在源码文件（任务前置）。
 *
 * 只判断 scope 是否可用（用完整列表，不忽略 index/dts），不收集内容，
 * 供后续决定是否/如何展示 scope 选择界面。
 */
export async function probeScopes(
  projectRoot: string,
  scopes: ScopeConfig[],
  config: MergeSrcConfig,
): Promise<ScopeConfig[]> {
  const available: ScopeConfig[] = [];
  for (const scope of scopes) {
    const files = await collectFiles(projectRoot, scope.input, config, false, false);
    if (files.length > 0) {
      available.push(scope);
    }
  }
  return available;
}

/** 单个文件读为代码块片段。 */
async function renderFileBlock(
  file: FileNode,
  extensions: Record<string, string>,
): Promise<string[]> {
  const code = await readFile(file.absolutePath, 'utf-8');
  const fence = fenceLanguage(file.relativePath, extensions);
  return [`## ${file.relativePath}`, '', '```' + fence, code.replace(/\n+$/, ''), '```', ''];
}

/** 将单个模块（包）下多个 scope 的文件合并为一个 markdown 文档，按 scope 分段。 */
export async function buildMarkdown(
  projectName: string,
  scopes: { label: string; files: FileNode[] }[],
  extensions: Record<string, string>,
): Promise<string> {
  const sections: string[] = [`# ${projectName}`];
  for (const scope of scopes) {
    sections.push(`## ${scope.label}`, '');
    if (scope.files.length === 0) {
      sections.push('_未匹配到任何文件_', '');
      continue;
    }
    for (const file of scope.files) {
      sections.push(...(await renderFileBlock(file, extensions)));
    }
  }
  return sections.join('\n');
}

/** 取模块的精简 package.json：仅 name 与依赖声明。 */
export function buildPackageJson(projectRoot: string): Record<string, unknown> | null {
  const pkgPath = join(projectRoot, 'package.json');
  let raw: string;
  try {
    raw = readFileSync(pkgPath, 'utf-8');
  } catch {
    return null;
  }
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  const clean: Record<string, unknown> = { name: pkg.name };
  if (pkg.dependencies) {
    clean.dependencies = pkg.dependencies;
  }
  if (pkg.devDependencies) {
    clean.devDependencies = pkg.devDependencies;
  }
  return clean;
}

/** 用户按 Esc/Ctrl+C 取消时统一收尾。 */
function handleCancel(): never {
  cancel('已取消');
  process.exit(0);
}

/** 单选一个包；单包（非 monorepo）时跳过选择直接返回。 */
async function pickPackage(root: string, projectRoots: string[]): Promise<string> {
  if (projectRoots.length === 1) {
    return projectRoots[0]!;
  }
  const selected = await select({
    message: '选择要合并的包',
    options: projectRoots.map(projectRoot => {
      const name = relative(root, projectRoot).split(sep).join('/');
      return { value: projectRoot, label: name };
    }),
    initialValue: projectRoots[0]!,
  });
  if (isCancel(selected)) {
    handleCancel();
  }
  return selected;
}

/** 勾选要处理的 scope（checkbox，默认全选，可取消）。 */
async function askScopes(scopes: ScopeConfig[]): Promise<ScopeConfig[]> {
  const selected = await multiselect({
    message: '选择要合并的 scope（默认全选，空格切换，回车确认）',
    options: scopes.map(scope => ({ value: scope.key, label: scope.label })),
    initialValues: scopes.map(scope => scope.key),
    required: false,
    maxItems: 10,
  });
  if (isCancel(selected)) {
    handleCancel();
  }
  const selectedSet = new Set(selected);
  return scopes.filter(scope => selectedSet.has(scope.key));
}

/** 确认合并方式：全部文件还是手动挑选。 */
async function askMergeMode(): Promise<'all' | 'manual'> {
  const mergeAll = await confirm({
    message: '合并该包的全部文件？',
    initialValue: true,
  });
  if (isCancel(mergeAll)) {
    handleCancel();
  }
  return mergeAll ? 'all' : 'manual';
}

/** 手动挑选时确认是否剔除 index 入口文件。 */
async function askIgnoreIndexFiles(): Promise<boolean> {
  const ignoreIndex = await confirm({
    message: '剔除 index 文件？',
    initialValue: defaultConfig.ignoreIndexFiles,
  });
  if (isCancel(ignoreIndex)) {
    handleCancel();
  }
  return ignoreIndex;
}

/** 手动挑选时确认是否剔除 *.d.ts 声明文件。 */
async function askIgnoreDtsFiles(): Promise<boolean> {
  const ignoreDts = await confirm({
    message: '剔除 *.d.ts 声明文件？',
    initialValue: defaultConfig.ignoreDtsFiles,
  });
  if (isCancel(ignoreDts)) {
    handleCancel();
  }
  return ignoreDts;
}

/** 手动挑选文件：默认全选，用户可取消。 */
async function pickFiles(files: FileNode[]): Promise<FileNode[]> {
  const allPaths = files.map(file => file.relativePath);
  const selected = await multiselect({
    message: '选择要合并的文件（默认全选，空格切换，回车确认）',
    options: allPaths.map(path => ({ value: path, label: path })),
    initialValues: allPaths,
    required: false,
    maxItems: 10,
  });
  if (isCancel(selected)) {
    handleCancel();
  }
  const selectedSet = new Set(selected);
  return files.filter(file => selectedSet.has(file.relativePath));
}

/** 导出文件的临时名，用于识别单工程根目录（root 自身作为唯一 project）。 */
function deriveProjectName(root: string, projectRoot: string): string {
  if (projectRoot === root) {
    return basename(root) || 'root-project';
  }
  return relative(root, projectRoot).split(sep).join('/');
}

/** 合并入口，接受外部命令工具注入的部分配置，与默认配置合并。 */
export async function run(cfg: Partial<MergeSrcConfig> = {}): Promise<void> {
  const config = { ...defaultConfig, ...cfg };
  intro('按配置合并源码');

  const root = resolveRoot(config);
  const projectRoots = await listProjectRoots(root, config.projects);

  const projectRoot = await pickPackage(root, projectRoots);
  await mkdir(config.outputDir, { recursive: true });

  const projectName = deriveProjectName(root, projectRoot);

  // 任务前置：先探测各 scope 是否存在源码文件，据此决定是否/如何展示 scope 选择
  const availableScopes = await probeScopes(projectRoot, config.scopes, config);
  if (availableScopes.length === 0) {
    outro('未探测到任何 scope 的源码文件，已退出');
    return;
  }
  const scopes = availableScopes.length === 1 ? availableScopes : await askScopes(availableScopes);
  if (scopes.length === 0) {
    outro('未选择任何 scope');
    return;
  }

  const mergeAll = await askMergeMode();
  const ignoreIndexFiles = mergeAll === 'manual' ? await askIgnoreIndexFiles() : false;
  const ignoreDtsFiles = mergeAll === 'manual' ? await askIgnoreDtsFiles() : false;

  const scopedFiles: { label: string; files: FileNode[] }[] = [];
  for (const scope of scopes) {
    const files = await collectFiles(
      projectRoot,
      scope.input,
      config,
      ignoreIndexFiles,
      ignoreDtsFiles,
    );
    const picked = mergeAll === 'all' ? files : await pickFiles(files);
    if (picked.length === 0) {
      log.warn(`${projectName} · ${scope.label}: 未选择任何文件`);
    }
    scopedFiles.push({ label: scope.label, files: picked });
  }

  const baseName = projectName.replace(/\//g, '-');
  const mdPath = join(config.outputDir, `${baseName}.md`);
  const jsonPath = join(config.outputDir, `${baseName}.package.json`);

  const markdown = await buildMarkdown(projectName, scopedFiles, config.extensions);
  await writeFile(mdPath, markdown, 'utf-8');

  const pkg = buildPackageJson(projectRoot);
  if (pkg) {
    await writeFile(jsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } else {
    log.warn(`${projectName}: 未找到 package.json，跳过精简依赖输出`);
  }

  const totalFiles = scopedFiles.reduce((sum, s) => sum + s.files.length, 0);
  outro(`${projectName}: ${totalFiles} 个文件 -> ${relative(root, mdPath)}`);
}

if (import.meta.main) {
  run().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
