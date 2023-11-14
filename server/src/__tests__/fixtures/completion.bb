FOO = '123'
MYVAR = 'F${F}'
MYVAR:append = '123'
MYVAR[doc] 'this is docs'
python (){
    myvar = [1,2,3]
    myvar[0] = 4
}
MYVAR = '${}'
MYVAR:append: = '123'
include i
require i
inherit co

def myFunc(param = [1,2,3]):
    pass

# Show completion at the last line https://github.com/amaanq/tree-sitter-bitbake/issues/9
MYVAR:append: