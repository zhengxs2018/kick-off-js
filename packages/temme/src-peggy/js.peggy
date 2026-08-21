JSFunctionArgsPart
  = '(' str:JSFunctionArgsString ')' { return str }
  / '(' { error('Unbalanced parenthesis.') }

JSFunctionArgsString
  = $((![()] SourceCharacter)+ / '(' JSFunctionArgsString ')')*

CodeBlock "code block"
  = "{" code:Code "}" { return code }
  / "{" { error("Unbalanced brace.") }

Code
  = $((![{}] SourceCharacter)+ / "{" Code "}")*
