require inc/foo.inc
include inc/bar.inc
inherit baz  

APPEND = 'append bar'
APPEND:append = 'append bar'
FOO = '${APPEND}