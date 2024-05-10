FOO = '123'
MYVAR = 'F${F}'
MYVAR:append = '123'
MYVAR[doc] = 'this is docs'
python (){
    myvar = [1,2,3]
    myvar[0] = 4
}
MYVAR = '${}'
MYVAR:append: = '123'
include i
require i
inherit co
inherit_defer co
def myFunc(param = [1,2,3]):
    pass

DVAR=''
python() {
    d.getVar("D")
}

D
python() {
}

do_foo() {
    "${D} D"
}

DESCRIPTION:
def dummy() {
}

# Show completion at the last line https://github.com/amaanq/tree-sitter-bitbake/issues/9
MYVAR:append: