import type { TemmeNode, HostElement } from '../parsers/parser.js';
import type { Engine } from './engine.js';
import type { LinkedCapture, LinkedNode, LinkedPlan } from './linked.js';
import { accumulate, applyLinkedCapture, createCaptureState, toResult } from './state.js';

/**
 * 驱动已 Link 的执行计划
 *
 * - 节点选取全权交给 `engine.select`：`fieldLookup` 的快路径与回退由引擎独家消费，驱动层不再分支
 * - 捕获为空的节点仍需下探子节点（纯作用域节点），只是不写状态
 * - 遍历采用显式栈替代函数递归，消除深层 DOM 下的调用栈溢出风险并降低 V8 调用开销
 *
 * @param plan - 已绑定闭包的链接计划
 * @param engine - 运行时引擎
 * @param doc - 待抽取的文档根节点
 * @param shape - 列表输出形状，默认 `'columns'`
 * @returns 用户可见的捕获结果对象
 */
export function drive<Element extends HostElement = unknown>(
  plan: LinkedPlan,
  engine: Engine<Element>,
  doc: TemmeNode<Element>,
  shape: 'columns' | 'rows' = 'columns',
): unknown {
  const state = createCaptureState();
  const { nodes, roots, whitespace } = plan;

  // 显式栈存储 [nodeId, scope]，用数组 push/pop 替代调用栈，避免溢出与递归开销
  const stack: Array<[number, TemmeNode<Element>]> = [];
  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push([roots[i]!, doc]);
  }

  while (stack.length > 0) {
    const [id, scope] = stack.pop()!;
    const node = nodes[id];
    if (node === undefined) {
      continue;
    }

    if (node.assignValue !== undefined) {
      writeAssignment(node);
      continue;
    }

    const resolvedList = Array.from(engine.select(node, scope));
    // 按文档序正序写捕获，保证数组捕获（append）累积为文档正序。
    for (const resolved of resolvedList) {
      writeCaptures(node, resolved);
    }
    // 逆序压栈子节点，配合 LIFO 出栈恢复文档正序的 DFS 遍历。
    for (let r = resolvedList.length - 1; r >= 0; r--) {
      const resolved = resolvedList[r]!;
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push([node.children[i]!, resolved]);
      }
    }
  }

  return toResult(state, shape);

  function writeAssignment(node: LinkedNode): void {
    for (const capture of node.captures) {
      accumulate(state, capture.name, node.assignValue, capture.append);
    }
  }

  function writeCaptures(node: LinkedNode, resolved: TemmeNode<Element>): void {
    for (const capture of node.captures) {
      applyLinkedCapture(state, capture, extractCaptureValue(capture, resolved), whitespace);
    }
  }
}

/**
 * 取单个捕获的原始值
 *
 * - 非内置过程先取 `text` 作为输入再交给绑定过程，与内置过程的适配器直取分流
 * - 过程未注册时 `boundProcedure` 缺省，返回 undefined 由写入层跳过（fail-safe）
 *
 * @param capture - 已 Link 的捕获定义
 * @param resolved - 已选中的节点
 * @returns 抽取到的原始值
 */
function extractCaptureValue<Element extends HostElement>(
  capture: LinkedCapture,
  resolved: TemmeNode<Element>,
): unknown {
  if (capture.hasNonBuiltinProcedure) {
    return capture.boundProcedure?.(resolved.extract('text', []), ...capture.procedureArgs);
  }
  return resolved.extract(capture.procedureName, capture.procedureArgs);
}
