from foo1 import bar1

require foo2

inherit fo3

addtask printdate after do_fetch before do_build

deltask printdate

export BB_ENV_PASSTHROUGH_ADDITIONS="$BB_ENV_PASSTHROUGH_ADDITIONS CCACHE_DIR" 

unset DATE

EXPORT_FUNCTIONS functionname

INHERIT += "autotools pkgconfig"

fakeroot python foo() {}

bbplain

bb

self

def bar3():
  pass

python bar4(){}
  

True

False

def bar2(var1 = True):
  pass

