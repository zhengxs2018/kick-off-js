Combinator = [ >+~]
AttributeOperator = '=' / '~=' / '|=' / '*=' / '^=' / '$='

// 普通 CSS 选择器，包含多个片段
SectionList 'normal css selector'
  = head:Section tail:(SectionSep Section)* {
    return buildList(head, tail, 1)
  }

SectionSep 'css-selector-section-seperator'
  = __ &Combinator
  / (WhiteSpace / LineTerminatorSequence / Comment) __

Section 'section'
  = combinator:(c:Combinator __ { return c })?
    element:(CSSIdentifierName / '*') !(__ '(')
    qualifiers:Qualifier* {
    return {
      combinator: combinator || ' ',
      element,
      qualifiers: flatten(qualifiers),
    }
  }
  / combinator:(c:Combinator __ { return c })?
    /* no element */
    qualifiers:Qualifier+ {
    return {
      combinator: combinator || ' ',
      element: '*',
      qualifiers: flatten(qualifiers),
    }
  }

Qualifier 'css-selector-qualifier' = IdQualifier / ClassQualifier / AttributeQualifier / PseudoQualifier

IdQualifier 'css-selector-id-qualifier'
  = '#' id:$CSSIdentifierNameChar+ {
    return {
      type: 'id-qualifier',
      id,
    }
  }

ClassQualifier 'css-selector-class-qualifier'
  = '.' className:CSSIdentifierName {
    return {
      type: 'class-qualifier',
      className,
    }
  }

AttributeQualifier 'css-selector-attribute-qualifier'
  = '['
    __ head:AttributeQualifierPart
    tail:(__ part:AttributeQualifierPart { return part })*
    __ ']' {
    return [head].concat(tail)
  }

AttributeQualifierPart 'css-selector-attribute-qualifier-part'
  = attribute:CSSIdentifierName
    __ operator:AttributeOperator
    __ value:(CSSIdentifierName / StringLiteral / ValueCapture) {
    return {
      type: 'attribute-qualifier',
      attribute,
      operator,
      value,
    }
  }
  / attribute:CSSIdentifierName {
    return {
      type: 'attribute-qualifier',
      attribute,
      operator: null,
      value: null,
    }
  }

PseudoQualifier 'css-selector-pseudo-qualifier'
  = ':' name:CSSIdentifierName '(' content:$([^)]*) ')' {
    return {
      type: 'pseudo-qualifier',
      name,
      content,
    }
  }
  / ':' name:CSSIdentifierName {
    return {
      type: 'pseudo-qualifier',
      name,
      content: null,
    }
  }

CSSIdentifierName = $('-'? CSSIdentifierNameStart CSSIdentifierNameChar*)

CSSIdentifierNameStart
  = [_a-z]i
  / NonAscii

CSSIdentifierNameChar
  = [_a-z0-9-]i
  / NonAscii

NonAscii = [\x80-\uFFFF]
