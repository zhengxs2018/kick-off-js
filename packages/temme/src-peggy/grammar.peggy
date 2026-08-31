{
  const DEFAULT_CAPTURE_KEY = '@@default-capture@@'
  const DEFAULT_PROCEDURE_NAME = 'text'
  const UNIVERSAL_SELECTOR = '*'

  const defaultSection = {
    combinator: ' ',
    element: UNIVERSAL_SELECTOR,
    qualifiers: [],
  }

  function flatten(array) {
    const result = []
    for (const item of array) {
      if (Array.isArray(item)) {
        result.push(...item)
      } else {
        result.push(item)
      }
    }
    return result
  }

  function extractList(list, index) {
    return list.map(element => element[index])
  }

  function buildList(head, tail, index) {
    return [head].concat(extractList(tail, index))
  }

  // 把过滤器链中相邻的 `{ isModifier, modifiers }` 条目合并为单个链，返回全新数组（不原地修改）
  function mergeModifierChains(filterList) {
    if (filterList === null || filterList.length === 0) {
      return filterList
    }
    const result = []
    for (const item of filterList) {
      if (item.isModifier) {
        const last = result[result.length - 1]
        if (last !== undefined && last.isModifier) {
          last.modifiers = last.modifiers.concat(item.modifiers)
        } else {
          result.push({ isModifier: true, modifiers: item.modifiers.slice() })
        }
      } else {
        result.push(item)
      }
    }
    return result
  }

  // 归约一个捕获：把捕获键、类型注解与过滤器链整理为当前 ast.ts 的 Capture 形态。
  // 修饰符链经 FilterList 以 { isModifier, modifiers } 表达，故 Capture.modifier 恒为 null。
  function buildCapture(captureKey, typeAnnotation, filterList) {
    const merged = mergeModifierChains(filterList)
    return {
      name: captureKey === null || captureKey === undefined ? DEFAULT_CAPTURE_KEY : captureKey,
      typeAnnotation: typeAnnotation === null || typeAnnotation === undefined ? null : typeAnnotation,
      filterList: merged === null || merged === undefined || merged.length === 0 ? null : merged,
      modifier: null,
    }
  }

  // 裸 `$name` 归约为默认 text 过程，参数即该捕获。
  function buildDefaultProcedure(capture) {
    return { name: DEFAULT_PROCEDURE_NAME, args: [capture] }
  }

  // 定义声明工厂：filter / modifier / procedure 三规则同形，仅 type 后缀不同。
  // peggy 5 不支持带参规则，故共享此 action 函数消除三份重复实现。
  function buildDefine(kind, name, argsPart, code) {
    return { type: kind + '-define', name, argsPart, code }
  }
}

// 起始规则：整条规则文本解析为一组选择器
Start
  = __ head:Selector tail:(__ Selector)* __ {
    return buildList(head, tail, 1)
  }
  / __ {
    return []
  }
