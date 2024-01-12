# When .vscode/tasks.json has the following entry:
# {
#     "tasks": [
#         {
#             "type":"bitbake",
#             "recipes": ["base-files"],
#         }
#     ]
# }

#ERROR: Task ([file-path]:do_install) failed with exit code '1'
do_install:append () {
    bbfatal should crash
}