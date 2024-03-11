# Keywords (Should target bitbake keywords only and exclude python and shell keywords)

# require foo

require foo1

inherit foo2

addtask printdate after do_fetch before do_build

deltask printdate

export BB_ENV_PASSTHROUGH_ADDITIONS="$BB_ENV_PASSTHROUGH_ADDITIONS CCACHE_DIR" 

unset DATE

EXPORT_FUNCTIONS functionname

INHERIT += "autotools pkgconfig"

fakeroot python foo3() {}

python (){}

inherit_defer foo2

python(){}

