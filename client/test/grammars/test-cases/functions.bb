# SYNTAX TEST "source.bb" "functions"

>do_build () {
#^^^^^^^^ source.bb entity.name.function.python.bb
>  echo "first: some shell script running as build"
>}
 
>python some_python_function () {
#       ^^^^^^^^^^^^^^^^^^^^ source.bb entity.name.function.python.bb
>    print d.getVar("TEXT")
#            ^^^^^^ source.bb entity.name.function.python.bb
>}
 
>python do_foo:prepend() {
#       ^^^^^^ source.bb entity.name.function.python.bb
#              ^^^^^^^ source.bb keyword.operator.bb keyword.other.bitbake-operator.bb - entity.name.function.python.bb
>    bb.plain("first")
#       ^^^^^ source.bb entity.name.function.python.bb
>}
 
>def get_depends(d):
#    ^^^^^^^^^^^ source.bb entity.name.function.python.bb
>    if d.getVar('SOMECONDITION'):
>        return "dependencywithcond"
>    else:
>        return "dependency"
 
>python () {
#^^^^^^ source.bb storage.type.function.python.bb - entity.name.function.python.bb
>    if d.getVar('SOMEVAR') == 'value':
#         ^^^^^^ source.bb entity.name.function.python.bb
>      d.setVar('ANOTHERVAR', 'value2')
#        ^^^^^^ source.bb entity.name.function.python.bb
>}
 
>PN = "${@bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"
#                  ^^^^^^^^^^^^^^ source.bb string.quoted.double.bb entity.name.function.python.bb
#                                   ^^^^^^ source.bb string.quoted.double.bb entity.name.function.python.bb
 
>fakeroot python base_do_build:append (var1 = '123', var2 = 123) {}  
#                ^^^^^^^^^^^^^ source.bb entity.name.function.python.bb

>fakeroot (){}
#^^^^^^^^ - entity.name.function.python.bb