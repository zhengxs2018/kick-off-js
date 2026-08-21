/**
 * db 过滤操作符。`isNull` 不参与 `value`。
 */
export type WhereOperator =
  | { readonly op: 'eq'; readonly value: unknown }
  | { readonly op: 'ne'; readonly value: unknown }
  | { readonly op: 'in'; readonly value: readonly unknown[] }
  | { readonly op: 'gt'; readonly value: unknown }
  | { readonly op: 'gte'; readonly value: unknown }
  | { readonly op: 'lt'; readonly value: unknown }
  | { readonly op: 'lte'; readonly value: unknown }
  | { readonly op: 'isNull' };

/**
 * 单条过滤条件：字段 + 操作符（缺省 eq）。
 */
export interface Where {
  readonly field: string;
  /** 等值目标；`isNull` 操作符忽略 */
  readonly value?: unknown;
  readonly operator?: WhereOperator;
}

/**
 * 查询选项：过滤 / 排序 / 截断（由存储层完成，不拉全量到内存）。
 */
export interface FindOptions {
  readonly where?: readonly Where[];
  readonly orderBy?: { readonly field: string; readonly dir: 'asc' | 'desc' };
  readonly limit?: number;
}

export type Data = Record<PropertyKey, unknown>;

/**
 * 完整数据库接口（精简 CRUD，对齐 better-auth DBAdapter）。`model` 即表名（queues/tasks 或业务自定义），
 * 无 join / select 转换。crawler/scheduler/spider 只经过数据，不感知底层实现（memory/sqlite/drizzle）。
 */
export interface DBAdapter {
  /**
   * 插入一条，返回生成的主键
   *
   * @param model - 表名
   * @param data - 整行（不含 id，可带 id）
   */
  create<T = Data>(model: string, data: Partial<Omit<T, 'id'>>): Promise<{ readonly id: string }>;

  /**
   * 按条件取一条
   *
   * @param model - 表名
   * @param where - 过滤条件
   */
  findOne<T = Data>(model: string, where: readonly Where[]): Promise<T | undefined>;
  /**
   * 按条件取多条
   *
   * @param model - 表名
   */
  findMany<T = Data>(model: string, opts?: FindOptions): Promise<Array<T>>;
  /**
   * 按条件计数
   *
   * @param model - 表名
   * @param where - 可选过滤条件
   */
  count(model: string, where?: readonly Where[]): Promise<number>;
  /**
   * 按条件更新，返回受影响行数
   *
   * @param model - 表名
   * @param where - 过滤条件
   */
  update<T = Data>(model: string, where: readonly Where[], patch: Partial<T>): Promise<number>;
  /**
   * 按条件删除，返回受影响行数
   *
   * @param model - 表名
   * @param where - 可选过滤条件；缺省清空该表
   */
  delete(model: string, where?: readonly Where[]): Promise<number>;
}
