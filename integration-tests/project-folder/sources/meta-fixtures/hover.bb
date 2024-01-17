DESCRIPTION = 'FOO'

python do_foo(){
    print('123')
}

do_bar(){
    echo '123'
}

python do_build() {
}

do_build() {
    bbwarn
    oe_runmake
}
