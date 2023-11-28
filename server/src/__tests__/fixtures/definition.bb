inherit dummy

require dummy.inc

include dummy.inc

inherit baz # This is a real file in fixture folder

include inc/foo.inc

DESCRIPTION = 'Go to definition for this variable should point to its included files'