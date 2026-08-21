Literal
  = NullLiteral
  / BooleanLiteral
  / NumericLiteral
  / StringLiteral
  / RegularExpressionLiteral

// 字面量列表：逗号分隔；可空 `()`，作为过滤器/过程参数
LiteralList
  = head:Literal tail:(__ ',' __ Literal)* {
    return [head].concat(tail.map(t => t[3]))
  }
  / '' {
    return []
  }

NullLiteral
  = NullToken { return null }

BooleanLiteral
  = TrueToken  { return true }
  / FalseToken { return false }

NumericLiteral "number"
  = sign:[+-]? __
    literal:(HexIntegerLiteral / BinaryIntegerLiteral / DecimalLiteral)
    !(IdentifierStart / DecimalDigit) {
    if (sign === '-') {
      return -literal
    } else {
      return literal
    }
  }

HexIntegerLiteral
  = "0x"i digits:$HexDigit+ {
    return Number(text())
  }

BinaryIntegerLiteral
  = "0b"i digits:$[01]+ {
    return Number(text())
  }

DecimalLiteral
  = DecimalIntegerLiteral "." DecimalDigit* {
    return Number(text())
  }
  / "." DecimalDigit+ {
    return Number(text())
  }
  / DecimalIntegerLiteral {
    return Number(text())
  }

DecimalIntegerLiteral
  = "0"
  / NonZeroDigit DecimalDigit*

RegularExpressionLiteral "regular expression"
  = "/" pattern:$RegularExpressionBody "/" flags:$RegularExpressionFlags {
    try {
      return new RegExp(pattern, flags)
    } catch (e) {
      error(e.message)
    }
  }

RegularExpressionBody
  = RegularExpressionFirstChar RegularExpressionChar*

RegularExpressionFirstChar
  = ![*\\/[] RegularExpressionNonTerminator
  / RegularExpressionBackslashSequence
  / RegularExpressionClass

RegularExpressionChar
  = ![\\/[] RegularExpressionNonTerminator
  / RegularExpressionBackslashSequence
  / RegularExpressionClass

RegularExpressionBackslashSequence
  = "\\" RegularExpressionNonTerminator

RegularExpressionNonTerminator
  = !LineTerminator SourceCharacter

RegularExpressionClass
  = "[" RegularExpressionClassChar* "]"

RegularExpressionClassChar
  = ![\]\\] RegularExpressionNonTerminator
  / RegularExpressionBackslashSequence

RegularExpressionFlags
  = IdentifierPart*

LineTerminator
  = [\n\r\u2028\u2029]

LineTerminatorSequence 'end of line'
  = '\n'
  / '\r\n'
  / '\r'
  / '\u2028'
  / '\u2029'

DecimalDigit
  = [0-9]

NonZeroDigit
  = [1-9]

HexDigit
  = [0-9a-f]i

StringLiteral "string"
  = '"' str:$DoubleStringCharacter* '"' { return str }
  / "'" str:$SingleStringCharacter* "'" { return str }

DoubleStringCharacter
  = !('"' / "\\" / LineTerminator) SourceCharacter { return text(); }
  / "\\" sequence:EscapeSequence { return sequence }

SingleStringCharacter
  = !("'" / "\\" / LineTerminator) SourceCharacter { return text(); }
  / "\\" sequence:EscapeSequence { return sequence }

EscapeSequence
  = CharacterEscapeSequence
  / "0" !DecimalDigit { return "\0"; }

CharacterEscapeSequence
  = SingleEscapeCharacter
  / NonEscapeCharacter

SingleEscapeCharacter
  = "'"
  / '"'
  / "\\"
  / "b"  { return "\b"; }
  / "f"  { return "\f"; }
  / "n"  { return "\n"; }
  / "r"  { return "\r"; }
  / "t"  { return "\t"; }
  / "v"  { return "\v"; }

NonEscapeCharacter
  = !(EscapeCharacter / LineTerminator) SourceCharacter { return text(); }

EscapeCharacter
  = SingleEscapeCharacter
  / DecimalDigit
  / "x"
  / "u"
