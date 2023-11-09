# SYNTAX TEST "source.bb" "variables"

### Variable declarations and references

>VARIABLE = "value"
#^^^^^^^^ source.bb variable.other.names.bb

>VARIABLE = 'I have a " in my value'
#^^^^^^^^ source.bb variable.other.names.bb

>VARIABLE = 'I have a " in my value'
#^^^^^^^^ source.bb variable.other.names.bb

>FOO = "bar \
#^^^ source.bb variable.other.names.bb
>baz \
#^^^^^^ source.bb string.quoted.double.bb
>qaz"
#^^^ source.bb string.quoted.double.bb
#   ^ source.bb string.quoted.double.bb

>B = "pre${A}post"
#^ source.bb variable.other.names.bb
#        ^^ source.bb string.quoted.double.bb punctuation.definition.template-expression.begin.bb
#          ^ source.bb string.quoted.double.bb variable.other.names.bb
#           ^ source.bb string.quoted.double.bb punctuation.definition.template-expression.end.bb

>FOO:remove = "${FOOREMOVE}"
#^^^ source.bb variable.other.names.bb
#                ^^^^^^^^^ source.bb string.quoted.double.bb variable.other.names.bb
#    ^^^^^^ source.bb keyword.other.bitbake-operator.bb - variable.other.names.bb

>myfunc (var = '123', var2 = 123) {}
#        ^^^ source.bb variable.other.names.bb
#                     ^^^^ source.bb variable.other.names.bb

>B:append = " additional data"
#^ source.bb variable.other.names.bb

>FOO:remove = "${FOOREMOVE}"
#^^^ source.bb variable.other.names.bb
#                ^^^^^^^^^ source.bb string.quoted.double.bb variable.other.names.bb

>export ENV_VARIABLE = "variable-value"
#       ^^^^^^^^^^^^ source.bb variable.other.names.bb

>KBRANCH:qemuarm = "standard/arm-versatile-926ejs"
#^^^^^^^ source.bb variable.other.names.bb

>DEPENDS:append:machine = "libmad"
#^^^^^^^ source.bb variable.other.names.bb

># This expression is not referencing a variable nor an inline python statement
>PN = "${bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"
#      ^^ source.bb string.quoted.double.bb variable.other.names.bb punctuation.definition.template-expression.begin.bb
#        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb variable.other.names.bb
#                                                                                 ^ source.bb string.quoted.double.bb variable.other.names.bb punctuation.definition.template-expression.end.bb