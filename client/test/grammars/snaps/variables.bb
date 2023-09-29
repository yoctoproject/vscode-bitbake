VARIABLE = "value"

VARIABLE = 'I have a " in my value'

FOO = "bar \
baz \
qaz"

B = "pre${A}post"

FOO:remove = "${FOOREMOVE}"

FOO[a] = "abc"

myfunc (var = '123', var2 = 123) {}

B:append = " additional data"

FOO:remove = "${FOOREMOVE}"

export ENV_VARIABLE = "variable-value"

KBRANCH:qemuarm = "standard/arm-versatile-926ejs"

DEPENDS:append:machine = "libmad"