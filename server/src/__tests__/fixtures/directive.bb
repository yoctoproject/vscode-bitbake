require inc/foo.inc
include inc/bar.inc
inherit baz  

APPEND = 'append bar'
APPEND:append = 'append bar'
FOO = '${APPEND}'
SYMBOL_IN_STRING = 'hover is a package ${FOO} \
        parentFolder/hover should also be seen as symbol \
        this hover too, other words should not. \
        '
# comment 1 for DESCRIPTION line 1
DESCRIPTION = 'file://dummy.patch'
# comment 1 for custom variable MYVAR
MYVAR = '123'
# comment 2 for custom variable MYVAR
MYVAR:append = '456'
# comment 1 for do_build
do_build(){

}
# comment 1 for my_func
my_func(){

}
# package names that contain hyphen; some numbers with dots
RDEPENDS:${PN} += 'some-package some-package-2.0'
# package names that follow '--enable-' or '--disable-', and when + is part of the name
PACKAGECONFIG[some-package3] = "--enable-some-package,--disable-some-package,some-package+1"