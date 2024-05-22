FOO = 'FOO'

MYVAR:append:myoverride = '${FOO}'

do_build () {
    FOO="$FOO ${FOO} FOO"
    do_stuff
}

python hello(){
    print('hello')
}

def getDay():
    print('Woo, it\'s Friday!')
