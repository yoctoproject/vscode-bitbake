# SYNTAX TEST "source.bb" "strings"

>DESCRIPTION = "I am the first recipe"
#              ^ source.bb string.quoted.double.bb
#               ^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                    ^ source.bb string.quoted.double.bb
 
>DESCRIPTION = "I am the first recipe" # comments
#              ^ source.bb string.quoted.double.bb
#               ^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                    ^ source.bb string.quoted.double.bb

>FOO:append = "baz"
#             ^ source.bb string.quoted.double.bb
#              ^^^ source.bb string.quoted.double.bb
#                 ^ source.bb string.quoted.double.bb
 
>FOO[a] = "abc"
#         ^ source.bb string.quoted.double.bb
#          ^^^ source.bb string.quoted.double.bb
#             ^ source.bb string.quoted.double.bb
 
>W ??= "z"
#      ^ source.bb string.quoted.double.bb
#       ^ source.bb string.quoted.double.bb
#        ^ source.bb string.quoted.double.bb
 
>W += "y"
#     ^ source.bb string.quoted.double.bb
#      ^ source.bb string.quoted.double.bb
#       ^ source.bb string.quoted.double.bb
 
>myfunc (var = '123', var2) {}
#              ^ source.bb string.quoted.single.bb
#               ^^^ source.bb string.quoted.single.bb
#                  ^ source.bb string.quoted.single.bb
 
>FOO2:remove = "\
#              ^ source.bb string.quoted.double.bb
#               ^^ source.bb string.quoted.double.bb
>    def \
#^^^^^^^^^^ source.bb string.quoted.double.bb
>    abc \
#^^^^^^^^^^ source.bb string.quoted.double.bb
>    ghi \
#^^^^^^^^^^ source.bb string.quoted.double.bb
>    "
#^^^^ source.bb string.quoted.double.bb
#    ^ source.bb string.quoted.double.bb
 
>BBLAYERS ?= " \
#            ^ source.bb string.quoted.double.bb
#             ^^^ source.bb string.quoted.double.bb
>  /home/scott-lenovo/LayerA \
#^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
>"
#^ source.bb string.quoted.double.bb
 
>DATE = "${@time.strftime('%Y%m%d',time.gmtime())}"
#       ^ source.bb string.quoted.double.bb
#                         ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                          ^^^^^^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                 ^ source.bb string.quoted.double.bb keyword.operator.bb
#                                                 ^ source.bb string.quoted.double.bb
 
>PN = "${@bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"
#     ^ source.bb string.quoted.double.bb
#                                          ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                           ^^^^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                               ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                  ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                   ^^^^^^^^^^^^^^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                                 ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                                   ^ source.bb string.quoted.double.bb
 
>export ENV_VARIABLE = "variable-value"
#                      ^ source.bb string.quoted.double.bb
#                       ^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                     ^ source.bb string.quoted.double.bb
 
>do_foo() {
>  bbplain "$ENV_VARIABLE"
#          ^ source.bb string.quoted.double.bb
#           ^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                        ^ source.bb string.quoted.double.bb
>}
 
>KERNEL_FEATURES:append:qemux86-64=" cfg/sound.scc cfg/paravirt_kvm.scc"
#                                  ^ source.bb string.quoted.double.bb
#                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                                                      ^ source.bb string.quoted.double.bb
 
>python () {
>  if condition == value:
#                       ^^ source.bb
>      d.setVar('VARIABLE', 'myclass')
#               ^ source.bb string.quoted.single.bb
#                ^^^^^^^^ source.bb string.quoted.single.bb
#                        ^ source.bb string.quoted.single.bb
#                           ^ source.bb string.quoted.single.bb
#                            ^^^^^^^ source.bb string.quoted.single.bb
#                                   ^ source.bb string.quoted.single.bb
>  else:
>      d.setVar('VARIABLE', '')
#               ^ source.bb string.quoted.single.bb
#                ^^^^^^^^ source.bb string.quoted.single.bb
#                        ^ source.bb string.quoted.single.bb
#                           ^ source.bb string.quoted.single.bb
#                            ^ source.bb string.quoted.single.bb
>}
#^ source.bb
 
>inherit ${@ 'classname' if condition else ''}
#            ^ source.bb string.quoted.single.bb
#             ^^^^^^^^^ source.bb string.quoted.single.bb
#                      ^ source.bb string.quoted.single.bb
#                                          ^ source.bb string.quoted.single.bb
#                                           ^ source.bb string.quoted.single.bb
 
>INHERIT += "autotools pkgconfig"
#           ^ source.bb string.quoted.double.bb
#            ^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                               ^ source.bb string.quoted.double.bb

>MYVAR = "This string contains escaped double quote \" and it should not break the highlight"
#        ^ source.bb string.quoted.double.bb
#         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                                   ^^ source.bb string.quoted.double.bb constant.character.escape.bb
#                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                                                                           ^ source.bb string.quoted.double.bb

>MYVAR = 'This string contains escaped single quote \' and it should not break the highlight'
#        ^ source.bb string.quoted.single.bb
#         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.single.bb
#                                                   ^^ source.bb string.quoted.single.bb constant.character.escape.bb
#                                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.single.bb
#                                                                                           ^ source.bb string.quoted.single.bb
