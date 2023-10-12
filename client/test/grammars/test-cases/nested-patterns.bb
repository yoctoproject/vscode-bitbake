# SYNTAX TEST "source.bb" "nessted patterns"


>PN = "${@bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"
#^^ source.bb variable.other.names.bb
#   ^ source.bb keyword.operator.bb
#     ^ source.bb string.quoted.double.bb
#      ^^ source.bb string.quoted.double.bb punctuation.definition.template-expression.begin.bb
#        ^ source.bb string.quoted.double.bb entity.name.function.decorator.python.bb
#         ^^ source.bb string.quoted.double.bb support.class.built-in-object.bb
#           ^ source.bb string.quoted.double.bb keyword.operator.bb
#            ^^^^^ source.bb string.quoted.double.bb variable.other.names.bb
#                 ^ source.bb string.quoted.double.bb keyword.operator.bb
#                  ^^^^^^^^^^^^^^ source.bb string.quoted.double.bb entity.name.function.python.bb
#                                ^ source.bb string.quoted.double.bb meta.embedded.parenthesis.open.bb
#                                 ^ source.bb string.quoted.double.bb variable.other.names.bb
#                                  ^ source.bb string.quoted.double.bb keyword.operator.bb
#                                   ^^^^^^ source.bb string.quoted.double.bb entity.name.function.python.bb
#                                         ^ source.bb string.quoted.double.bb meta.embedded.parenthesis.open.bb
#                                          ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                           ^^^^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                               ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                ^ source.bb string.quoted.double.bb keyword.operator.bb
#                                                 ^ source.bb string.quoted.double.bb
#                                                  ^^^^^ source.bb string.quoted.double.bb constant.language.python.bb
#                                                       ^ source.bb string.quoted.double.bb meta.embedded.parenthesis.close.bb
#                                                        ^ source.bb string.quoted.double.bb keyword.operator.bb
#                                                         ^ source.bb string.quoted.double.bb variable.other.names.bb
#                                                          ^ source.bb string.quoted.double.bb meta.embedded.parenthesis.close.bb
#                                                           ^ source.bb string.quoted.double.bb meta.embedded.brackets.begin.bb
#                                                            ^ source.bb string.quoted.double.bb constant.numeric.bb
#                                                             ^ source.bb string.quoted.double.bb meta.embedded.brackets.end.bb
#                                                              ^ source.bb string.quoted.double.bb
#                                                               ^^ source.bb string.quoted.double.bb storage.type.function.python.bb
#                                                                 ^ source.bb string.quoted.double.bb
#                                                                  ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                   ^^^^^^^^^^^^^^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                                 ^ source.bb string.quoted.double.bb string.quoted.single.bb
#                                                                                  ^ source.bb string.quoted.double.bb punctuation.definition.template-expression.end.bb
#                                                                                   ^ source.bb string.quoted.double.bb
 
>bb.parse.vars_from_file(d.getVar('FILE', False),d)[0]
#^^ source.bb support.class.built-in-object.bb
#  ^ source.bb keyword.operator.bb
#   ^^^^^ source.bb variable.other.names.bb
#        ^ source.bb keyword.operator.bb
#         ^^^^^^^^^^^^^^ source.bb entity.name.function.python.bb
#                       ^ source.bb
#                        ^ source.bb variable.other.names.bb
#                         ^ source.bb keyword.operator.bb
#                          ^^^^^^ source.bb entity.name.function.python.bb
#                                ^ source.bb
#                                 ^ source.bb string.quoted.single.bb
#                                  ^^^^ source.bb string.quoted.single.bb
#                                      ^ source.bb string.quoted.single.bb
#                                       ^ source.bb keyword.operator.bb
#                                        ^ source.bb
#                                         ^^^^^ source.bb constant.language.python.bb
#                                              ^ source.bb
#                                               ^ source.bb keyword.operator.bb
#                                                ^ source.bb variable.other.names.bb
#                                                 ^^ source.bb
#                                                   ^ source.bb source.python
#                                                    ^^ source.bb
 
>python myclass_eventhandler() {
#^^^^^^ source.bb storage.type.function.python.bb
#      ^ source.bb
#       ^^^^^^^^^^^^^^^^^^^^ source.bb entity.name.function.python.bb
#                           ^^^^^ source.bb
>    from bb.event import getName
#^^^^ source.bb
#    ^^^^ source.bb keyword.control.bb
#        ^ source.bb
#         ^^ source.bb support.class.built-in-object.bb
#           ^ source.bb keyword.operator.bb
#            ^^^^^ source.bb variable.other.names.bb
#                 ^ source.bb
#                  ^^^^^^ source.bb keyword.control.bb
#                         ^^^^^^^ source.bb support.class.bb
>    print("The name of the Event is %s" % getName(e))
#^^^^ source.bb
#    ^^^^^ source.bb entity.name.function.python.bb
#         ^ source.bb
#          ^ source.bb string.quoted.double.bb
#           ^^^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                      ^ source.bb string.quoted.double.bb
#                                       ^^ source.bb
#                                         ^ source.bb
#                                          ^^^^^^^ source.bb entity.name.function.python.bb
#                                                 ^ source.bb
#                                                  ^ source.bb variable.other.names.bb
#                                                   ^^^ source.bb
>    print("The file we run for is %s" % d.getVar('FILE'))
#^^^^ source.bb
#    ^^^^^ source.bb entity.name.function.python.bb
#         ^ source.bb
#          ^ source.bb string.quoted.double.bb
#           ^^^^^^^^^^^^^^^^^^^^^^^^^ source.bb string.quoted.double.bb
#                                    ^ source.bb string.quoted.double.bb
#                                     ^^^ source.bb
#                                        ^ source.bb variable.other.names.bb
#                                         ^ source.bb keyword.operator.bb
#                                          ^^^^^^ source.bb entity.name.function.python.bb
#                                                ^ source.bb
#                                                 ^ source.bb string.quoted.single.bb
#                                                  ^^^^ source.bb string.quoted.single.bb
#                                                      ^ source.bb string.quoted.single.bb
#                                                       ^^^ source.bb
>}
#^^ source.bb