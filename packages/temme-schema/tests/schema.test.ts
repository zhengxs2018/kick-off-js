import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  ExecutionPlanSchema,
  FieldLookupSchema,
  ManifestSchema,
  PlanCaptureSchema,
  PlanFilterSchema,
  PlanModifierSchema,
  PlanNodeSchema,
  SerializableLiteralSchema,
  TypeAnnotationSchema,
  parseExecutionPlan,
} from '../src/schema.js';

/**
 * schema（边界校验）：经 `temme/schema` 子路径导出，仅消费方在加载远程规则时调用。
 *
 * 验证点：{$regex} 分支覆盖序列化往返风险点；合法 POJO 通过、非法结构抛 ZodError。
 */

describe('SerializableLiteralSchema {$regex} 分支', () => {
  it('正则字典形态通过校验', () => {
    expect(
      SerializableLiteralSchema.safeParse({ $regex: true, source: '\\d+', flags: 'g' }).success,
    ).toBe(true);
  });

  it('非正则基础字面量通过', () => {
    expect(SerializableLiteralSchema.safeParse('x').success).toBe(true);
    expect(SerializableLiteralSchema.safeParse(1).success).toBe(true);
    expect(SerializableLiteralSchema.safeParse(true).success).toBe(true);
    expect(SerializableLiteralSchema.safeParse(null).success).toBe(true);
  });

  it('缺 source 的伪正则字典失败', () => {
    expect(SerializableLiteralSchema.safeParse({ $regex: true }).success).toBe(false);
  });
});

describe('PlanCaptureSchema 结构化布尔', () => {
  it('合法捕获（含 append 布尔）通过', () => {
    const capture = {
      name: 'items',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: true,
    };
    expect(PlanCaptureSchema.safeParse(capture).success).toBe(true);
  });

  it('append 非布尔失败', () => {
    const capture = {
      name: 't',
      typeAnnotation: null,
      filterList: null,
      modifier: null,
      procedureName: 'text',
      procedureArgs: [],
      hasTypeModifier: false,
      hasFilter: false,
      hasModifier: false,
      hasNonBuiltinProcedure: false,
      append: 'yes',
    };
    expect(PlanCaptureSchema.safeParse(capture).success).toBe(false);
  });
});

describe('ManifestSchema', () => {
  it('三字段 string[] 通过', () => {
    expect(
      ManifestSchema.safeParse({ filters: ['trim'], modifiers: ['first'], procedures: ['text'] })
        .success,
    ).toBe(true);
  });

  it('procedures 非数组失败', () => {
    expect(
      ManifestSchema.safeParse({ filters: [], modifiers: [], procedures: 'text' }).success,
    ).toBe(false);
  });
});

describe('ExecutionPlanSchema', () => {
  it('roots/nodes 合法、manifest 可选通过', () => {
    const plan = {
      roots: [0],
      nodes: [
        {
          parentId: null,
          css: 'div',
          captures: [
            {
              name: 't',
              typeAnnotation: null,
              filterList: null,
              modifier: null,
              procedureName: 'text',
              procedureArgs: [],
              hasTypeModifier: false,
              hasFilter: false,
              hasModifier: false,
              hasNonBuiltinProcedure: false,
              append: false,
            },
          ],
          children: [],
        },
      ],
    };
    expect(ExecutionPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('roots 元素非数字失败', () => {
    expect(ExecutionPlanSchema.safeParse({ roots: ['x'], nodes: [] }).success).toBe(false);
  });

  it('含正则字典的计划通过校验（H1 往返风险点）', () => {
    const plan = {
      roots: [0],
      nodes: [
        {
          parentId: null,
          css: 'div',
          captures: [
            {
              name: 'p',
              typeAnnotation: null,
              filterList: [
                {
                  isArrayFilter: false,
                  name: 'match',
                  args: [{ $regex: true, source: '\\d+', flags: 'g' }],
                },
              ],
              modifier: null,
              procedureName: 'find',
              procedureArgs: [],
              hasTypeModifier: false,
              hasFilter: true,
              hasModifier: false,
              hasNonBuiltinProcedure: true,
              append: false,
            },
          ],
          children: [],
        },
      ],
      manifest: { filters: ['match'], modifiers: [], procedures: ['find'] },
    };
    expect(ExecutionPlanSchema.safeParse(plan).success).toBe(true);
  });
});

describe('TypeAnnotationSchema', () => {
  it('string[] 或 null 通过', () => {
    expect(TypeAnnotationSchema.safeParse(['number']).success).toBe(true);
    expect(TypeAnnotationSchema.safeParse(null).success).toBe(true);
  });

  it('非字符串数组失败', () => {
    expect(TypeAnnotationSchema.safeParse([1]).success).toBe(false);
    expect(TypeAnnotationSchema.safeParse('number').success).toBe(false);
  });
});

describe('FieldLookupSchema', () => {
  it('relation=self 通过', () => {
    expect(FieldLookupSchema.safeParse({ relation: 'self' }).success).toBe(true);
  });

  it('relation=child 带原生策略通过', () => {
    expect(
      FieldLookupSchema.safeParse({
        relation: 'child',
        strategy: { kind: 'class', className: 'lead' },
      }).success,
    ).toBe(true);
  });

  it('relation=parent 带非负 steps 通过', () => {
    expect(
      FieldLookupSchema.safeParse({
        relation: 'parent',
        strategy: { kind: 'tag', tagName: 'section' },
        steps: 2,
      }).success,
    ).toBe(true);
  });

  it('relation=fallback 带 css 通过', () => {
    expect(FieldLookupSchema.safeParse({ relation: 'fallback', css: 'div .x' }).success).toBe(true);
  });

  it('relation=parent 的 steps 为负失败', () => {
    expect(
      FieldLookupSchema.safeParse({
        relation: 'parent',
        strategy: { kind: 'tag', tagName: 'section' },
        steps: -1,
      }).success,
    ).toBe(false);
  });

  it('未知 relation 失败', () => {
    expect(FieldLookupSchema.safeParse({ relation: 'unknown' }).success).toBe(false);
  });
});

describe('PlanFilterSchema / PlanModifierSchema', () => {
  it('合法 filter 通过', () => {
    expect(
      PlanFilterSchema.safeParse({ isArrayFilter: false, name: 'trim', args: [] }).success,
    ).toBe(true);
  });

  it('filter 缺 isArrayFilter 失败', () => {
    expect(PlanFilterSchema.safeParse({ name: 'trim', args: [] }).success).toBe(false);
  });

  it('合法 modifier 通过', () => {
    expect(PlanModifierSchema.safeParse({ name: 'first', args: [] }).success).toBe(true);
  });

  it('modifier args 含伪正则字典通过、含任意对象失败', () => {
    expect(
      PlanModifierSchema.safeParse({
        name: 'first',
        args: [{ $regex: true, source: '\\d+', flags: 'g' }],
      }).success,
    ).toBe(true);
    expect(PlanModifierSchema.safeParse({ name: 'first', args: [{ foo: 1 }] }).success).toBe(false);
  });
});

describe('PlanNodeSchema', () => {
  it('合法节点通过', () => {
    expect(
      PlanNodeSchema.safeParse({
        parentId: null,
        css: 'div',
        captures: [],
        children: [],
      }).success,
    ).toBe(true);
  });

  it('含 fieldLookup 与 assignValue 的节点通过', () => {
    expect(
      PlanNodeSchema.safeParse({
        parentId: 0,
        css: 'div .lead',
        captures: [],
        children: [1],
        assignValue: 'fixed',
        fieldLookup: { relation: 'self' },
      }).success,
    ).toBe(true);
  });

  it('缺 captures 失败', () => {
    expect(PlanNodeSchema.safeParse({ parentId: null, css: 'div', children: [] }).success).toBe(
      false,
    );
  });
});

describe('parseExecutionPlan 边界校验', () => {
  it('合法计划返回原对象', () => {
    const plan = { roots: [], nodes: [] };
    expect(parseExecutionPlan(plan)).toEqual(plan);
  });

  it('非法结构抛 ZodError', () => {
    expect(() => parseExecutionPlan({ roots: 'bad', nodes: [] })).toThrow(z.ZodError);
  });
});
