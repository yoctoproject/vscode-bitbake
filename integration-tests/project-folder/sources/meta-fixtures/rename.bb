foo='foo'

python() {
    foo='foo'
    print(foo)
    d.getVar('foo')
}

do_stuff() {
    echo "${foo}"
    local foo='foo'
    echo "$foo"
}
