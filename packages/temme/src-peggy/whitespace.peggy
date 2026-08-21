WhiteSpace 'whitespace'
  = '\t'
  / '\v'
  / '\f'
  / ' '
  / '\u00A0'
  / '\uFEFF'
  / Zs

__
  = (WhiteSpace / LineTerminatorSequence / Comment)*

_
  = (WhiteSpace / MultiLineCommentNoLineTerminator)*

Comment 'comment'
  = MultiLineComment
  / SingleLineComment

MultiLineComment
  = '/*' (!'*/' SourceCharacter)* '*/'

MultiLineCommentNoLineTerminator
  = '/*' (!('*/' / LineTerminator) SourceCharacter)* '*/'

SingleLineComment
  = '//' (!LineTerminator SourceCharacter)*

SourceCharacter
  = .
