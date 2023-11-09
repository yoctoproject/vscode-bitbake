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
# This expression is not referencing a variable nor an inline python statement
PN = "${bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"