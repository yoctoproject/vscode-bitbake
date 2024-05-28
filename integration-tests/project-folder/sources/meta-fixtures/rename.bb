foo='foo'

python() {
    foo='foo'
    print(foo)
    d.getVar('foo') # should be included in global variables, but it does not work in integration tests for unknown reasons
}

do_stuff() {
    echo "${foo}"
    local foo='foo'
    echo "$foo"
}