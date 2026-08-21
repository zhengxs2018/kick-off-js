// 选择器：全部节点形态，按序尝试
Selector
  = FilterDefine
  / ModifierDefine
  / ProcedureDefine
  / ParentRefSelector
  / NormalSelector
  / AssignmentSelector
  / SnippetDefine
  / SnippetExpand

// 自身选择器，以 `&` 开头，在父节点作用域内取值
ParentRefSelector
  = '&' __ section:Section? __ procedure:Procedure SelectorEnd? {
    return {
      type: 'parent-ref-selector',
      section: section || defaultSection,
      procedure,
    }
  }
  / '&' __ section:Section SelectorEnd {
    return {
      type: 'parent-ref-selector',
      section,
      procedure: null,
    }
  }

// 普通选择器：片段序列 + 可选数组捕获 + 可选子选择器
NormalSelector
  // 数组捕获可携带取值过程（attr/node 等），使列表模式能抽取属性值或保留 DOM 节点：
  // 例如 `a $url attr(href) { }` 累积每个 a 的 href；`div $node node { }` 累积 DOM 节点。
  // 该分支优先于下方「数组捕获无过程」分支尝试，二者对 `tr $row { }` 产出一致，不会歧义。
  = sections:SectionList
    __ arrayCapture:ArrayCapture
    __ procedure:Procedure?
    __ children:ChildrenSelectors?
    SelectorEnd? {
    // 仅当携带取值过程或子块时才视为数组捕获；裸 `$name`（无过程、无块）
    // 必须回落到下方标量过程分支，避免与标量捕获 `$name` 歧义。
    if (procedure === null && children === null) {
      return peg$FAILED;
    }
    return {
      type: 'normal-selector',
      sections,
      procedure: procedure || null,
      arrayCapture,
      children: children || [],
    }
  }
  / sections:SectionList
    __ arrayCapture:ArrayCapture?
    __ children:ChildrenSelectors
    SelectorEnd? {
    return {
      type: 'normal-selector',
      sections,
      procedure: null,
      arrayCapture: arrayCapture || null,
      children,
    }
  }
  / sections:SectionList __ procedure:Procedure SelectorEnd? {
    return {
      type: 'normal-selector',
      sections,
      procedure,
      arrayCapture: null,
      children: [],
    }
  }
  / sections:SectionList SelectorEnd? {
    return {
      type: 'normal-selector',
      sections,
      procedure: null,
      arrayCapture: null,
      children: [],
    }
  }

// 取值过程：裸捕获归约为默认 text 过程，或具名过程调用
Procedure
  = capture:ValueCapture {
    return buildDefaultProcedure(capture)
  }
  / name:IdentifierName __ args:ProcedureArgs {
    return { name, args }
  }

ProcedureArgs
  = '(' __ head:ProcedureArg tail:(__ ',' __ ProcedureArg)* __ ')' {
    return [head].concat(tail.map(t => t[3]))
  }
  / '(' __ ')' {
    return []
  }
  / '(' { error('Unbalanced parenthesis.') }

ProcedureArg
  = Literal
  / capture:ValueCapture { return capture }
  / name:IdentifierName { return name }

// 赋值选择器：把字面量绑定到捕获键，跳过 DOM 抽取
AssignmentSelector
  = assignment:Assignment SelectorEnd? {
    return {
      type: 'assignment',
      capture: assignment.capture,
      value: assignment.value,
    }
  }

Assignment
  = capture:ValueCapture __ '=' __ value:Literal {
    return { capture, value }
  }

// 片段定义：命名可复用选择器片段集合
SnippetDefine
  = '@' name:IdentifierName
    __ '='
    __ selectors:ChildrenSelectors
    SelectorEnd? {
    return {
      type: 'snippet-define',
      name,
      selectors,
    }
  }

// 片段展开：引用已定义的片段
SnippetExpand
  = '@' name:IdentifierName SelectorEnd {
    return {
      type: 'snippet-expand',
      name,
    }
  }

// 定义声明：filter / modifier / procedure 同形，code 与 argsPart 为纯文本且永不执行
FilterDefine
  = 'filter'
    __ name:IdentifierName
    __ argsPart:JSFunctionArgsPart
    __ code:CodeBlock
    SelectorEnd? {
    return {
      type: 'filter-define',
      name,
      argsPart,
      code,
    }
  }

ModifierDefine
  = 'modifier'
    __ name:IdentifierName
    __ argsPart:JSFunctionArgsPart
    __ code:CodeBlock
    SelectorEnd? {
    return {
      type: 'modifier-define',
      name,
      argsPart,
      code,
    }
  }

ProcedureDefine
  = 'procedure'
    __ name:IdentifierName
    __ argsPart:JSFunctionArgsPart
    __ code:CodeBlock
    SelectorEnd? {
    return {
      type: 'procedure-define',
      name,
      argsPart,
      code,
    }
  }

// 子选择器集合：`{ ... }`，可空
ChildrenSelectors
  = '{' __ '}' {
    return []
  }
  / '{' __ head:Selector tail:(__ Selector)* __ '}' {
    return buildList(head, tail, 1)
  }

Separator = ';'
SelectorEnd = __ ';'
OptionalExtraComma = (__ ',')?
OptionalExtraSeperator = (__ ';')?
