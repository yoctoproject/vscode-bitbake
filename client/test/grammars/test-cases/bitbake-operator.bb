# SYNTAX TEST "source.bb" "bitbake-operators"

>KBRANCH:append
#        ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:prepend
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:remove
#        ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 

>python do_foo:append() {
#              ^^^^^^ source.bb keyword.operator.bb keyword.other.bitbake-operator.bb
>    bb.plain("first")
>}

>python do_foo:prepend() {
#              ^^^^^^^ source.bb keyword.operator.bb keyword.other.bitbake-operator.bb
>    bb.plain("first")
>}

>python do_foo:remove() {
#              ^^^^^^ source.bb keyword.operator.bb keyword.other.bitbake-operator.bb
>    bb.plain("first")
>}
 