FOO="FOO"
BAR="${FOO}"
python() {
    FOO = 'FOO'
    d.getVar("FOO")
}
FOO() {
    "${@d.getVar('FOO')}"
    FOO="$FOO ${FOO} FOO"
    FOO
}
