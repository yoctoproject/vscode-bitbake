KBRANCH:os

KBRANCH:nooverride

KBRANCH:qemuarm

KBRANCH:qemumips64

KBRANCH:qemumips

KBRANCH:qemuppc

KBRANCH:qemux86-64

KBRANCH:qemux86

KBRANCH:append

KBRANCH:prepend

KBRANCH:remove

KBRANCH:task-configure

KBRANCH:task-compile 

KBRANCH:qemuarm = "standard/arm-versatile-926ejs" # comments

DEPENDS:append:machine = "libmad"

KERNEL_FEATURES:append = " ${KERNEL_EXTRA_FEATURES}"

KERNEL_FEATURES:append:qemux86=" cfg/sound.scc cfg/paravirt_kvm.scc"

KERNEL_FEATURES:append:qemux86-64=" cfg/sound.scc cfg/paravirt_kvm.scc"


python do_foo:prepend() {
    bb.plain("first")
}
