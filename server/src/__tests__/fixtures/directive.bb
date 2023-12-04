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