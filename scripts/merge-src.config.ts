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

export default config;
