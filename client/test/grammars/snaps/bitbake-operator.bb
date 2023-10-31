KBRANCH:append
 
KBRANCH:prepend
 
KBRANCH:remove

python do_foo:append() {
    bb.plain("first")
}

python do_foo:prepend() {
    bb.plain("first")
}

python do_foo:remove() {
    bb.plain("first")
}
 