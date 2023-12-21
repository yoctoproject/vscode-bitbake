inherit image

python () {
  d.getVar()
}

TEST = "${@e.data.getVar()}"

def test ():
  d = ''
  print(d)

test() {
  FOO=''
  FOO
}
