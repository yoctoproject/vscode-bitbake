SUMMARY = "i.MX M4 core Demo images"

python do_foo(){
    print '123'
}

SRC_URI = 'file://foo.inc'

# Hover definition should include the final values if they exist
FINAL_VALUE = 'this is the original value for FINAL_VALUE'
FINAL_VALUE:o1 = 'this is the original value for FINAL_VALUE with override o1'