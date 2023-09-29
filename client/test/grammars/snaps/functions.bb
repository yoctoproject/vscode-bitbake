do_build () {
  echo "first: some shell script running as build"
}

python some_python_function () {
    print d.getVar("TEXT")
}

python do_foo:prepend() {
    bb.plain("first")
}

def get_depends(d):
    if d.getVar('SOMECONDITION'):
        return "dependencywithcond"
    else:
        return "dependency"

python () {
    if d.getVar('SOMEVAR') == 'value':
      d.setVar('ANOTHERVAR', 'value2')
}

PN = "${@bb.parse.vars_from_file(d.getVar('FILE', False),d)[0] or 'defaultpkgname'}"

fakeroot python base_do_build:append (var1 = '123', var2 = 123) {}  

# Incorrect cases

fakeroot (){}
