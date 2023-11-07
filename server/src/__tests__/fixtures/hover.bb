# Should show definiton on hover
DESCRIPTION = 'This is a description'

# Should not show definition on hover
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