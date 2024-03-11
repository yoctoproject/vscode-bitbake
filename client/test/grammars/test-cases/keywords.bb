# SYNTAX TEST "source.bb" "bitbake-keywords"

># require foo
#^ source.bb comment.line.bb comment.line.number-sign.bb
#  ^^^^^^^ - keyword.control.bb

>require foo1
#^^^^^^^ source.bb keyword.control.bb

>inherit foo2
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

>fakeroot python foo3() {}
#^^^^^^^^ source.bb keyword.control.bb
#         ^^^^^^ source.bb storage.type.function.python.bb

>python (){}
#^^^^^^ source.bb storage.type.function.python.bb

>inherit_defer foo2
#^^^^^^^^^^^^^ source.bb keyword.control.bb

>python(){}
#^^^^^^ source.bb storage.type.function.python.bb