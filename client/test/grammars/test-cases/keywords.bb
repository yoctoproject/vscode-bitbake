# SYNTAX TEST "source.bb" "keywords"

>from foo import bar
#^^^^ source.bb keyword.control.bb
#         ^^^^^^ source.bb keyword.control.bb
 
>require foo
#^^^^^^^ source.bb keyword.control.bb
 
>inherit foo
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
 
>fakeroot python foo() {}
#^^^^^^^^ source.bb keyword.control.bb

>bbplain
#^^^^^^^ source.bb support.class.built-in-object.bb
 
>bb
#^^ source.bb support.class.built-in-object.bb
 
>self
#^^^^ source.bb support.class.built-in-object.bb
 
>def bar3():
#^^^ source.bb storage.type.function.python.bb
>  pass

>python bar4(){}
#^^^^^^ source.bb storage.type.function.python.bb
 
>True
#^^^^ source.bb constant.language.python.bb
 
>False
#^^^^^ source.bb constant.language.python.bb

>def bar2(var1 = True):
#                ^^^^ source.bb constant.language.python.bb
>  pass
 