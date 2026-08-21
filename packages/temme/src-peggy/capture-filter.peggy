// 捕获的类型注解与过滤器链
//
// 类型注解以 `:` 开头（如 `:number`），归约为 string[]。
// 过滤器链 `|name` / `||name` / `@modifier` 归约为 Filter 联合类型（见 src/compiler/ast.ts）：
// 普通过滤器 `{ isArrayFilter, name, args }`，修饰符链 `{ isModifier, modifiers }`。

ValueCapture
  = captureKey:CaptureKey __ typeAnnotation:TypeAnnotation? __ filterList:FilterList? {
    return buildCapture(captureKey, typeAnnotation, filterList)
  }

ArrayCapture
  = captureKey:CaptureKey __ typeAnnotation:TypeAnnotation? __ filterList:FilterList? {
    return buildCapture(captureKey, typeAnnotation, filterList)
  }

// 捕获键：`$name` 命名捕获，或裸 `$`（返回 null，由 buildCapture 归一为默认键）
CaptureKey
  = '$' name:IdentifierName { return name }
  / '$' {
    return null
  }

// 类型注解列表：`:` 起始，支持 `:number:int` 连续形式，累积为 string[]
TypeAnnotation
  = ":" head:ModifierName tail:(":" ModifierName)* {
    return [head].concat(tail.map(t => t[1]))
  }

ModifierName
  = name:IdentifierName {
    return name
  }

// 过滤器链：`|` 标量过滤、`||` 数组过滤、`@` 修饰符链，按序累积
FilterList
  = head:FilterPart tail:(__ FilterPart)* {
    return [head].concat(tail.map(t => t[1]))
  }

FilterPart
  = modifier:ModifierChain { return modifier }
  / array:ArrayFilter { return array }
  / filter:Filter { return filter }

// 修饰符：单个 `@name`，归约为 { isModifier, modifiers: [name] }
// 相邻多个 `@` 由 buildCapture 合并为单个 { isModifier, modifiers: string[] } 链
ModifierChain
  = '@' __ name:ModifierName {
    return { isModifier: true, modifiers: [name] }
  }

// 数组过滤：`||name(args)`，对整个捕获结果里的每个元素分别过滤
ArrayFilter
  = '||' __ name:IdentifierName args:FilterArgs? {
    return { isArrayFilter: true, name, args: args ?? [] }
  }

// 标量过滤：`|name(args)`，对整个捕获结果过滤
Filter
  = '|' __ name:IdentifierName args:FilterArgs? {
    return { isArrayFilter: false, name, args: args ?? [] }
  }

// 过滤器参数：`(a, b)` 或省略（无参数）
FilterArgs
  = '(' __ args:LiteralList __ ')' {
    return args
  }
