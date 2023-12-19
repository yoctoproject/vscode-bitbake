require inc/foo.inc
include inc/bar.inc
inherit baz  

APPEND = 'append bar'
APPEND:append = 'append bar'
FOO = '${APPEND}'
SYMBOL_IN_STRING = 'hover is a package ${FOO} \
        parentFolder/hover should also be seen as symbol \
        this hover too, other words should not. \
        '
# comment 1 for DESCRIPTION line 1
# comment 1 for DESCRIPTION line 2
DESCRIPTION = 'file://dummy.patch'
# comment 2 for DESCRIPTION
DESCRIPTION += 'file://dummy-2.patch'
# comment 1 for custom variable MYVAR
MYVAR = '123'
# comment 1 for do_build
do_build(){

}
# comment 1 for my_func
my_func(){

}