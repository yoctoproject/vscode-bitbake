# SYNTAX TEST "source.bb" "operators"

>= 
#^ source.bb keyword.operator.bb
 
>??= 
#^^^ source.bb keyword.operator.bb
 
>?= 
#^^ source.bb keyword.operator.bb
 
>:=  
#^^ source.bb keyword.operator.bb
 
>.=
#^^ source.bb keyword.operator.bb
 
>=.
#^ source.bb keyword.operator.bb
# ^ source.bb keyword.operator.bb

>,
#^ source.bb keyword.operator.bb
 
>W ??= "x"
#  ^^^ source.bb keyword.operator.bb
 
>A := "${W}" # Immediate variable expansion
#  ^^ source.bb keyword.operator.bb
 
>C = "${W}"
#  ^ source.bb keyword.operator.bb
 
>W ?= "i"
#  ^^ source.bb keyword.operator.bb
 
>W = "i"
#  ^ source.bb keyword.operator.bb
 
>W += "y"
#  ^^ source.bb keyword.operator.bb
 
>W = " y"
#  ^ source.bb keyword.operator.bb
 
>B .= "additionaldata"
#  ^^ source.bb keyword.operator.bb
 
>C =. "test"
#  ^ source.bb keyword.operator.bb
#   ^ source.bb keyword.operator.bb
 
>FOO := "${@foo()}"
#    ^^ source.bb keyword.operator.bb
 
 