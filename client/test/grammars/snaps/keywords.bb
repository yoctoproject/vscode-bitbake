# Keywords (Should target bitbake keywords only and exclude python and shell keywords)

python do_foo(){
  from foo1 import bar1

  if

  whatif

  ifnot

  elif

  else

  for

  while

  break

  continue

  return

  yield

  try

  except

  finally

  raise

  assert

  import

  from

  as

  pass

  del

  with

  async

  await

  def

  class

  global

  nonlocal

  and

  or

  not

  in

  is

  lambda

  self

  True

  False
}

require foo2

inherit fo3

addtask printdate after do_fetch before do_build

deltask printdate

export BB_ENV_PASSTHROUGH_ADDITIONS="$BB_ENV_PASSTHROUGH_ADDITIONS CCACHE_DIR" 

unset DATE

EXPORT_FUNCTIONS functionname

INHERIT += "autotools pkgconfig"

bbplain

bb

fakeroot python foo() {}

def bar3():
  pass

python (){}

