# SYNTAX TEST "source.bb" "bitbake-keywords"

># BitBake Keywords
#^ source.bb comment.line.bb comment.line.number-sign.bb
# ^^^^^^^^^^^^^^^^^ source.bb comment.line.bb comment.line.text.bb

>python do_foo(){
#^^^^^^ source.bb storage.type.function.python.bb
>  from foo1 import bar1
#  ^^^^ source.bb keyword.control.bb
#            ^^^^^^ source.bb keyword.control.bb

>  if
#  ^^ source.bb keyword.control.bb

>  whatif
#      ^^ - keyword.control.bb

>  ifnot
#  ^^ - keyword.control.bb

>  elif
#  ^^^^ source.bb keyword.control.bb

>  else
#  ^^^^ source.bb keyword.control.bb

>  for
#  ^^^ source.bb keyword.control.bb

>  while
#  ^^^^^ source.bb keyword.control.bb

>  break
#  ^^^^^ source.bb keyword.control.bb

>  continue
#  ^^^^^^^^ source.bb keyword.control.bb

>  return
#  ^^^^^^ source.bb keyword.control.bb

>  yield
#  ^^^^^ source.bb keyword.control.bb

>  try
#  ^^^ source.bb keyword.control.bb

>  except
#  ^^^^^^ source.bb keyword.control.bb

>  finally
#  ^^^^^^^ source.bb keyword.control.bb

>  raise
#  ^^^^^ source.bb keyword.control.bb

>  assert
#  ^^^^^^ source.bb keyword.control.bb

>  import
#  ^^^^^^ source.bb keyword.control.bb

>  from
#  ^^^^ source.bb keyword.control.bb

>  as
#  ^^ source.bb keyword.control.bb

>  pass
#  ^^^^ source.bb keyword.control.bb

>  del
#  ^^^ source.bb keyword.control.bb

>  with
#  ^^^^ source.bb keyword.control.bb

>  async
#  ^^^^^ source.bb keyword.control.bb

>  await
#  ^^^^^ source.bb keyword.control.bb

>  def
#  ^^^ source.bb storage.type.function.python.bb

>  class
#  ^^^^^ source.bb storage.type.function.python.bb

>  global
#  ^^^^^^ source.bb storage.type.function.python.bb

>  nonlocal
#  ^^^^^^^^ source.bb storage.type.function.python.bb

>  and
#  ^^^ source.bb storage.type.function.python.bb

>  or
#  ^^ source.bb storage.type.function.python.bb

>  not
#  ^^^ source.bb storage.type.function.python.bb

>  in
#  ^^ source.bb storage.type.function.python.bb

>  is
#  ^^ source.bb storage.type.function.python.bb

>  lambda
#  ^^^^^^ source.bb storage.type.function.python.bb

>  self
#  ^^^^ source.bb support.class.built-in-object.bb

>  True
#  ^^^^ source.bb constant.language.python.bb

>  False
#  ^^^^^ source.bb constant.language.python.bb
>}

>require foo2
#^^^^^^^ source.bb keyword.control.bb

>inherit fo3
#^^^^^^^ source.bb keyword.control.bb

>addtask printdate after do_fetch before do_build
#^^^^^^^ source.bb keyword.control.bb
#                  ^^^^^ source.bb keyword.control.bb
#                                 ^^^^^^ source.bb keyword.control.bb

>deltask printdate
#^^^^^^^ source.bb keyword.control.bb

>export BB_ENV_PASSTHROUGH_ADDITIONS="$BB_ENV_PASSTHROUGH_ADDITIONS CCACHE_DIR" 
#^^^^^^ source.bb keyword.control.bb

>unset DATE
#^^^^^ source.bb keyword.control.bb

>EXPORT_FUNCTIONS functionname
#^^^^^^^^^^^^^^^^ source.bb keyword.control.bb

>INHERIT += "autotools pkgconfig"
#^^^^^^^ source.bb keyword.control.bb

>bbplain
#^^^^^^^ source.bb support.class.built-in-object.bb

>bb 
#^^ support.class.built-in-object.bb

>fakeroot python foo() {}
#^^^^^^^^ source.bb keyword.control.bb
#         ^^^^^^ source.bb storage.type.function.python.bb

>def bar3():
#^^^ source.bb storage.type.function.python.bb
>  pass
#  ^^^^ source.bb keyword.control.bb

>python (){}
#^^^^^^ source.bb storage.type.function.python.bb

