
DESCRIPTION = 'This is a description'
MYVAR = "${DESCRIPTION}"
MYVAR:${DESCRIPTION} = 'foo'
python DESCRIPTION(){
    print('123')
}

MYVAR = 'Nothing should show on hovering this DESCRIPTION'

MYDESCRIPTION = 'Definition for DESCRIPTION should not show on MYDESCRIPTION'

MYVAR[cleandirs] = 'Definition for flag cleandirs should show'
MYVAR[mycleandirs] = 'Definition for flag cleandirs should not show'

do_build(){

}

python do_build(){

}

def do_build():
    pass

my_do_build(){
    VAR = 'do_build'
}

inherit dummy
include dummy.inc
require dummy.inc

python (){
    d.getVar("DESCRIPTION", "DESCRIPTION")
    d.setVar('DESCRIPTION', 'value')
    d.renameVar("DESCRIPTION", "DESCRIPTION")
    b.getVar('DESCRIPTION')
    d.test('DESCRIPTION')
    d.getVar("FOO")
    e.data.getVar('DESCRIPTION')
}

def test ():
    d.setVar('DESCRIPTION')

VAR = "${@d.getVar("DESCRIPTION")}"

do_foo() {
    "${DESCRIPTION} DESCRIPTION"
    $DESCRIPTION
}

d.getVar("DESCRIPTION")
