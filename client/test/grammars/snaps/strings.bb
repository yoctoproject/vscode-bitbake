DESCRIPTION = "I am the first recipe"

DESCRIPTION = "I am the first recipe" # comments

FOO:append = "baz"

FOO[a] = "abc"

W ??= "z"

W += "y"

myfunc (var = '123', var2) {}

FOO2:remove = "\
    def \
    abc \
    ghi \
    "

BBLAYERS ?= " \
  /home/scott-lenovo/LayerA \
"

DATE = "${@time.strftime('%Y%m%d',time.gmtime())}"

PN = "${@bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"

export ENV_VARIABLE = "variable-value"

do_foo() {
  bbplain "$ENV_VARIABLE"
  ACLOCAL="aclocal"
  bbnote Executing ACLOCAL=\"$ACLOCAL\"
  bbnote Executing ACLOCAL=\'$ACLOCAL\'
}

KERNEL_FEATURES:append:qemux86-64=" cfg/sound.scc cfg/paravirt_kvm.scc" 

python () {
  if condition == value:
      d.setVar('VARIABLE', 'myclass')
  else:
      d.setVar('VARIABLE', '')
  }

inherit ${@ 'classname' if condition else ''}

INHERIT += "autotools pkgconfig"

MYVAR = "This string contains escaped double quote \" and it should not break the highlight"

MYVAR = 'This string contains escaped single quote \' and it should not break the highlight'

MYVAR = """
nested " quotes shoudn't change the highlighting
"""

TEST_TRIPLE_QUOTES = 'the highlighting for this line which follows the triple quotes should still work correctly'
