# SYNTAX TEST "source.bb" "numeric"


>123
#^^^ source.bb constant.numeric.bb
 
>VAR = 123
#      ^^^ source.bb constant.numeric.bb
 
>myfunc (var = '123',var2 = 123) {} #123
#               ^^^ source.bb string.quoted.single.bb - constant.numeric.bb
#                           ^^^ source.bb constant.numeric.bb
#                                    ^^^ source.bb comment.line.bb comment.line.text.bb - constant.numeric.bb
 
 