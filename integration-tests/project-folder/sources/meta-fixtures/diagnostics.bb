foo () {
    echo "${@"" if True else False}"
    echo "${@d.getVar('PV').split('.')[0]}"
}

def test ():
    error('looooooooooooooooooooooooooooooooooooooooooooooooooooooooooong line')

python __anonymous() {
    import os
}
