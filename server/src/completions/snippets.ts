/**
 * Inspired by bash-language-sever
 * Repo: https://github.com/bash-lsp/bash-language-server
 */

import { InsertTextFormat, type CompletionItem, CompletionItemKind, MarkupKind } from 'vscode-languageserver'

/* eslint-disable no-template-curly-in-string */
export const SNIPPETS: CompletionItem[] = [
  {
    label: 'do_build',
    insertText: 'def do_build():\n\t# Your code here\n\t${1:pass}',
    documentation: 'The default task for all recipes. This task depends on all other normaltasks required to build a recipe.'
  },
  {
    label: 'do_compile',
    insertText: 'def do_compile():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Compiles the source code. This task runs with the current workingdirectory set to ${B}.'
  },
  {
    label: 'do_compile_ptest_base',
    insertText: 'def do_compile_ptest_base():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Compiles the runtime test suite included in the software being built.'
  },
  {
    label: 'do_configure',
    insertText: 'def do_configure():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Configures the source by enabling and disabling any build-time andconfiguration options for the software being built. The task runs withthe current working directory set to ${B}.'
  },
  {
    label: 'do_configure_ptest_base',
    insertText: 'def do_configure_ptest_base():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Configures the runtime test suite included in the software being built.'
  },
  {
    label: 'do_deploy',
    insertText: 'def do_deploy():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Writes output files that are to be deployed to ${DEPLOY_DIR_IMAGE}. Thetask runs with the current working directory set to ${B}.'
  },
  {
    label: 'do_fetch',
    insertText: 'def do_fetch():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Fetches the source code. This task uses the SRC_URI variable and theargument’s prefix to determine the correctfetchermodule.'
  },
  {
    label: 'do_image',
    insertText: 'def do_image():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Starts the image generation process. The do_image task runs afterthe OpenEmbedded build system has run thedo_rootfs taskduring which packages areidentified for installation into the image and the root filesystem iscreated, complete with post-processing.'
  },
  {
    label: 'do_image_complete',
    insertText: 'def do_image_complete():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Completes the image generation process. The do_image_complete taskruns after the OpenEmbedded build system has run thedo_image taskduring which imagepre-processing occurs and through dynamically generated do_image_*tasks the image is constructed.'
  },
  {
    label: 'do_install',
    insertText: 'def do_install():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Copies files that are to be packaged into the holding area ${D}. This task runs with the currentworking directory set to ${B},which is thecompilation directory. The do_install task, as well as other tasksthat either directly or indirectly depend on the installed files (e.g.do_package, do_package_write_*, anddo_rootfs), rununderfakeroot.'
  },
  {
    label: 'do_install_ptest_base',
    insertText: 'def do_install_ptest_base():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Copies the runtime test suite files from the compilation directory to aholding area.'
  },
  {
    label: 'do_package',
    insertText: 'def do_package():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Analyzes the content of the holding area ${D} and splits the content intosubsetsbased on available packages and files. This task makes use of thePACKAGES and FILESvariables.'
  },
  {
    label: 'do_package_qa',
    insertText: 'def do_package_qa():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Runs QA checks on packaged files. For more information on these checks,see the insane class.'
  },
  {
    label: 'do_package_write_deb',
    insertText: 'def do_package_write_deb():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates Debian packages (i.e. *.deb files) and places them in the ${DEPLOY_DIR_DEB} directory inthe package feeds area. For more information, see the“PackageFeeds” section inthe Yocto Project Overview and Concepts Manual.'
  },
  {
    label: 'do_package_write_ipk',
    insertText: 'def do_package_write_ipk():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates IPK packages (i.e. *.ipkfiles) and places them in the ${DEPLOY_DIR_IPK} directory inthe package feeds area. For more information, see the“PackageFeeds” section inthe Yocto Project Overview and Concepts Manual.'
  },
  {
    label: 'do_package_write_rpm',
    insertText: 'def do_package_write_rpm():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates RPM packages (i.e. *.rpmfiles) and places them in the ${DEPLOY_DIR_RPM} directory inthe package feeds area. For more information, see the“PackageFeeds” section inthe Yocto Project Overview and Concepts Manual.'
  },
  {
    label: 'do_packagedata',
    insertText: 'def do_packagedata():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Saves package metadata generated by thedo_package taskinPKGDATA_DIR to make it available globally.'
  },
  {
    label: 'do_patch',
    insertText: 'def do_patch():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Locates patch files and applies them to the source code.'
  },
  {
    label: 'do_populate_lic',
    insertText: 'def do_populate_lic():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Writes license information for the recipe that is collected later whenthe image is constructed.'
  },
  {
    label: 'do_populate_sdk',
    insertText: 'def do_populate_sdk():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates the file and directory structure for an installable SDK. See the“SDKGeneration”section in the Yocto Project Overview and Concepts Manual for moreinformation.'
  },
  {
    label: 'do_populate_sdk_ext',
    insertText: 'def do_populate_sdk_ext():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates the file and directory structure for an installable extensibleSDK (eSDK). See the “SDK Generation”section in the Yocto Project Overview and Concepts Manual for moreinformation.'
  },
  {
    label: 'do_populate_sysroot',
    insertText: 'def do_populate_sysroot():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Stages (copies) a subset of the files installed by thedo_install taskinto the appropriatesysroot. For information on how to access these files from otherrecipes, see the STAGING_DIR* variables.Directories that would typically not be needed by other recipes at buildtime (e.g. /etc) are not copiedby default.'
  },
  {
    label: 'do_prepare_recipe_sysroot',
    insertText: 'def do_prepare_recipe_sysroot():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Installs the files into the individual recipe specific sysroots (i.e.recipe-sysroot and recipe-sysroot-native under ${WORKDIR} based upon thedependencies specified by DEPENDS). See the“staging” class for more information.'
  },
  {
    label: 'do_rm_work',
    insertText: 'def do_rm_work():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Removes work files after the OpenEmbedded build system has finished withthem. You can learn more by looking at the“rm_work” section.'
  },
  {
    label: 'do_unpack',
    insertText: 'def do_unpack():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Unpacks the source code into a working directory pointed to by ${WORKDIR}. The Svariable also plays a role in where unpacked source files ultimatelyreside. For more information on how source files are unpacked, see the“SourceFetching”section in the Yocto Project Overview and Concepts Manual and also seethe WORKDIR and S variable descriptions.'
  },
  {
    label: 'do_checkuri',
    insertText: 'def do_checkuri():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Validates the SRC_URI value.'
  },
  {
    label: 'do_clean',
    insertText: 'def do_clean():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Removes all output files for a target from thedo_unpack taskforward (i.e. do_unpack,do_configure,do_compile,do_install, anddo_package).'
  },
  {
    label: 'do_cleanall',
    insertText: 'def do_cleanall():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Removes all output files, shared state(sstate) cache, anddownloaded source files for a target (i.e. the contents ofDL_DIR). Essentially, the do_cleanall task isidentical to the do_cleansstate taskwith the added removal of downloaded source files.'
  },
  {
    label: 'do_cleansstate',
    insertText: 'def do_cleansstate():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Removes all output files and shared state(sstate) cache for atarget. Essentially, the do_cleansstate task is identical to thedo_clean taskwith the added removal ofshared state (sstate)cache.'
  },
  {
    label: 'do_pydevshell',
    insertText: 'def do_pydevshell():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Starts a shell in which an interactive Python interpreter allows you tointeract with the BitBake build environment. From within this shell, youcan directly examine and set bits from the data store and executefunctions as if within the BitBake environment. See the “Using a PythonDevelopment Shell” section inthe Yocto Project Development Tasks Manual for more information aboutusing pydevshell.'
  },
  {
    label: 'do_devshell',
    insertText: 'def do_devshell():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Starts a shell whose environment is set up for development, debugging,or both. See the “Using a Development Shell” section in theYocto Project Development Tasks Manual for more information about usingdevshell.'
  },
  {
    label: 'do_listtasks',
    insertText: 'def do_listtasks():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Lists all defined tasks for a target.'
  },
  {
    label: 'do_package_index',
    insertText: 'def do_package_index():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates or updates the index in the Package Feeds area.'
  },
  {
    label: 'do_bootimg',
    insertText: 'def do_bootimg():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates a bootable live image. See the IMAGE_FSTYPES variable for additionalinformation on live image types.'
  },
  {
    label: 'do_bundle_initramfs',
    insertText: 'def do_bundle_initramfs():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Combines an Initramfs image and kernel together toform a single image.'
  },
  {
    label: 'do_rootfs',
    insertText: 'def do_rootfs():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Creates the root filesystem (file and directory structure) for an image.See the “Image Generation”section in the Yocto Project Overview and Concepts Manual for moreinformation on how the root filesystem is created.'
  },
  {
    label: 'do_testimage',
    insertText: 'def do_testimage():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Boots an image and performs runtime tests within the image. Forinformation on automatically testing images, see the“Performing Automated Runtime Testing”section in the Yocto Project Development Tasks Manual.'
  },
  {
    label: 'do_testimage_auto',
    insertText: 'def do_testimage_auto():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Boots an image and performs runtime tests within the image immediatelyafter it has been built. This task is enabled when you setTESTIMAGE_AUTO equal to “1”.'
  },
  {
    label: 'do_compile_kernelmodules',
    insertText: 'def do_compile_kernelmodules():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Runs the step that builds the kernel modules (if needed). Building akernel consists of two steps: 1) the kernel (vmlinux) is built, and2) the modules are built (i.e. make modules).'
  },
  {
    label: 'do_diffconfig',
    insertText: 'def do_diffconfig():\n\t# Your code here\n\t${1:pass}',
    documentation: 'When invoked by the user, this task creates a file containing thedifferences between the original config as produced bydo_kernel_configme task and thechanges made by the user with other methods (i.e. using(do_kernel_menuconfig). Once thefile of differences is created, it can be used to create a configfragment that only contains the differences. You can invoke this taskfrom the command line as follows:'
  },
  {
    label: 'do_kernel_checkout',
    insertText: 'def do_kernel_checkout():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Converts the newly unpacked kernel source into a form with which theOpenEmbedded build system can work. Because the kernel source can befetched in several different ways, the do_kernel_checkout task makessure that subsequent tasks are given a clean working tree copy of thekernel with the correct branches checked out.'
  },
  {
    label: 'do_kernel_configcheck',
    insertText: 'def do_kernel_configcheck():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Validates the configuration produced by thedo_kernel_menuconfig task. Thedo_kernel_configcheck task produces warnings when a requestedconfiguration does not appear in the final .config file or when youoverride a policy configuration in a hardware configuration fragment.You can run this task explicitly and view the output by using thefollowing command:'
  },
  {
    label: 'do_kernel_configme',
    insertText: 'def do_kernel_configme():\n\t# Your code here\n\t${1:pass}',
    documentation: 'After the kernel is patched by the do_patchtask, the do_kernel_configme task assembles and merges all thekernel config fragments into a merged configuration that can then bepassed to the kernel configuration phase proper. This is also the timeduring which user-specified defconfigs are applied if present, and whereconfiguration modes such as --allnoconfig are applied.'
  },
  {
    label: 'do_kernel_menuconfig',
    insertText: 'def do_kernel_menuconfig():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Invoked by the user to manipulate the .config file used to build alinux-yocto recipe. This task starts the Linux kernel configurationtool, which you then use to modify the kernel configuration.'
  },
  {
    label: 'do_kernel_metadata',
    insertText: 'def do_kernel_metadata():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Collects all the features required for a given kernel build, whether thefeatures come from SRC_URI or from Gitrepositories. After collection, the do_kernel_metadata taskprocesses the features into a series of config fragments and patches,which can then be applied by subsequent tasks such asdo_patch anddo_kernel_configme.'
  },
  {
    label: 'do_menuconfig',
    insertText: 'def do_menuconfig():\n\t# Your code here\n\t${1:pass}',
    documentation: 'Runs make menuconfigfor the kernel. For information onmenuconfig, see the“Usingmenuconfig”section in the Yocto Project Linux Kernel Development Manual.'
  },
  {
    label: 'do_savedefconfig',
    insertText: 'def do_savedefconfig():\n\t# Your code here\n\t${1:pass}',
    documentation: 'When invoked by the user, creates a defconfig file that can be usedinstead of the default defconfig. The saved defconfig contains thedifferences between the default defconfig and the changes made by theuser using other methods (i.e. thedo_kernel_menuconfig task. Youcan invoke the task using the following command:'
  },
  {
    label: 'do_shared_workdir',
    insertText: 'def do_shared_workdir():\n\t# Your code here\n\t${1:pass}',
    documentation: 'After the kernel has been compiled but before the kernel modules havebeen compiled, this task copies files required for module builds andwhich are generated from the kernel build into the shared workdirectory. With these copies successfully copied, thedo_compile_kernelmodules taskcan successfully build the kernel modules in the next step of the build.'
  },
  {
    label: 'do_sizecheck',
    insertText: 'def do_sizecheck():\n\t# Your code here\n\t${1:pass}',
    documentation: 'After the kernel has been built, this task checks the size of thestripped kernel image againstKERNEL_IMAGE_MAXSIZE. If thatvariable was set and the size of the stripped kernel exceeds that size,the kernel build produces a warning to that effect.'
  },
  {
    label: 'do_strip',
    insertText: 'def do_strip():\n\t# Your code here\n\t${1:pass}',
    documentation: 'If KERNEL_IMAGE_STRIP_EXTRA_SECTIONSis defined, this task stripsthe sections named in that variable from vmlinux. This stripping istypically used to remove nonessential sections such as .commentsections from a size-sensitive configuration.'
  },
  {
    label: 'do_validate_branches',
    insertText: 'def do_validate_branches():\n\t# Your code here\n\t${1:pass}',
    documentation: 'After the kernel is unpacked but before it is patched, this task makessure that the machine and metadata branches as specified by theSRCREV variables actually exist on the specifiedbranches. Otherwise, if AUTOREV is not being used, thedo_validate_branches task fails during the build.'
  }].map((item) => {
  return {
    ...item,
    insertTextFormat: InsertTextFormat.Snippet,
    documentation: {
      value: [
        markdownBlock(
          `${item.label} (bitbake-language-server)\n\n`,
          'man'
        ),
        markdownBlock(item.insertText, 'bitbake'),
        '---',
        `${item.documentation}\n`,
        `[Reference](https://docs.yoctoproject.org/singleindex.html#${item.label.replace(/_/, '-')})`
      ].join('\n'),
      kind: MarkupKind.Markdown
    },

    kind: CompletionItemKind.Snippet
  }
})

function markdownBlock (text: string, language: string): string {
  const tripleQuote = '```'
  return [tripleQuote + language, text, tripleQuote].join('\n')
}
