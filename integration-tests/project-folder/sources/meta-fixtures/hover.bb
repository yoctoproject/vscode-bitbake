DESCRIPTION = 'FOO'

python do_foo(){
    print('123')
}

do_bar(){
    ## HA ah
    A='123'
    echo '123'
}

python do_build() {
}

do_build() {
    bbwarn
    oe_runmake
    do_bar
}

