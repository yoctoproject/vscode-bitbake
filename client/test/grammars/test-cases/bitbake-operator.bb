# SYNTAX TEST "source.bb" "bitbake-operators"

>KBRANCH:os
#        ^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:nooverride
#        ^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemuarm
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemumips64
#        ^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemumips
#        ^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemuppc
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemux86-64
#        ^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemux86
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:append
#        ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:prepend
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:remove
#        ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:task-configure
#        ^^^^^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:task-compile 
#        ^^^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KBRANCH:qemuarm = "standard/arm-versatile-926ejs" # comments
#        ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>DEPENDS:append:machine = "libmad"
#        ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KERNEL_FEATURES:append = " ${KERNEL_EXTRA_FEATURES}"
#                ^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KERNEL_FEATURES:append:qemux86=" cfg/sound.scc cfg/paravirt_kvm.scc"
#                ^^^^^^ source.bb keyword.other.bitbake-operator.bb
#                       ^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>KERNEL_FEATURES:append:qemux86-64=" cfg/sound.scc cfg/paravirt_kvm.scc"
#                ^^^^^^ source.bb keyword.other.bitbake-operator.bb
#                       ^^^^^^^^^^ source.bb keyword.other.bitbake-operator.bb
 
>python do_foo:prepend() {
#              ^^^^^^^ source.bb keyword.operator.bb keyword.other.bitbake-operator.bb
>    bb.plain("first")
>}
 