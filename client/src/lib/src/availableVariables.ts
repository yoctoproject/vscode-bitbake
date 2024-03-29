/* --------------------------------------------------------------------------------------------
 * Copyright (c) 2023 Savoir-faire Linux. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

// Variables made available from /poky/plain/meta/conf/bitbake.conf
export const commonDirectoriesVariables = new Set([
  'base_prefix',
  'prefix',
  'exec_prefix',
  'base_bindir',
  'base_sbindir',
  'base_libdir',
  'datadir',
  'sysconfdir',
  'servicedir',
  'sharedstatedir',
  'localstatedir',
  'infodir',
  'mandir',
  'docdir',
  'bindir',
  'sbindir',
  'libexecdir',
  'libdir',
  'includedir',
  'oldincludedir',
  'base_bindir_native',
  'base_sbindir_native',
  'sysconfdir_native',
  'prefix_native',
  'bindir_native',
  'sbindir_native',
  'includedir_native',
  'libdir_native',
  'datadir_native',
  'bindir_cross',
  'target_datadir',
  'BUILD_ARCH',
  'BUILD_OS',
  'BUILD_VENDOR',
  'BUILD_SYS',
  'BUILD_PREFIX',
  'BUILD_CC_ARCH',
  'BUILD_EXEEXT',
  'HOST_ARCH',
  'HOST_OS',
  'HOST_VENDOR',
  'HOST_SYS',
  'HOST_PREFIX',
  'HOST_CC_ARCH',
  'HOST_EXEEXT',
  'TARGET_ARCH',
  'TARGET_OS',
  'TARGET_VENDOR',
  'TARGET_SYS',
  'TARGET_PREFIX',
  'TARGET_CC_ARCH',
  'SDK_ARCH',
  'SDK_OS',
  'SDK_VENDOR',
  'SDK_SYS',
  'SDK_PREFIX',
  'SDK_CC_ARCH',
  'BASE_PACKAGE_ARCH',
  'PACKAGE_ARCH',
  'MACHINE_ARCH',
  'PACKAGE_ARCHS',
  'MULTIMACH_ARCH',
  'MULTIMACH_TARGET_SYS',
  'MULTIMACH_HOST_SYS',
  'BASEPKG_HOST_SYS',
  'BASEPKG_TARGET_SYS',
  'QEMU_OPTIONS',
  'QEMU_OPTIONS_iwmmxt',
  'QEMU_OPTIONS_armv6',
  'QEMU_OPTIONS_armv7a',
  'DATE',
  'TIME',
  'DATETIME',
  'ASSUME_PROVIDED',
  'PN',
  'PV',
  'PR',
  'PF',
  'EXTENDPE',
  'EXTENDPEVER',
  'EXTENDPV',
  'P',
  'SPECIAL_PKGSUFFIX',
  'BPN',
  'BP',
  'SECTION',
  'PRIORITY',
  'DESCRIPTION',
  'LICENSE',
  'MAINTAINER',
  'HOMEPAGE',
  'DEPCHAIN_PRE',
  'DEPCHAIN_POST',
  'DEPENDS',
  'RDEPENDS',
  'PROVIDES',
  'PROVIDES_prepend',
  'RPROVIDES',
  'MULTI_PROVIDER_WHITELIST',
  'SOLIBS',
  'SOLIBS_darwin',
  'SOLIBS_darwin8',
  'SOLIBS_darwin9',
  'SOLIBSDEV',
  'SOLIBSDEV_darwin',
  'SOLIBSDEV_darwin8',
  'SOLIBSDEV_darwin9',
  'PACKAGES',
  'PACKAGES_DYNAMIC',
  'FILES',
  'FILE_DIRNAME',
  'FILESDIR',
  'TMPDIR',
  'CACHE',
  'PERSISTENT_DIR',
  'CO_DIR',
  'CVSDIR',
  'SVNDIR',
  'GITDIR',
  'BZRDIR',
  'HGDIR',
  'STAMP',
  'WORKDIR',
  'T',
  'D',
  'S',
  'B',
  'STAGING_DIR',
  'STAGING_DIR_NATIVE',
  'STAGING_BINDIR_NATIVE',
  'STAGING_BINDIR_CROSS',
  'STAGING_LIBDIR_NATIVE',
  'STAGING_INCDIR_NATIVE',
  'STAGING_ETCDIR_NATIVE',
  'STAGING_DATADIR_NATIVE',
  'STAGING_DIR_HOST',
  'STAGING_BINDIR',
  'STAGING_LIBDIR',
  'STAGING_INCDIR',
  'STAGING_DATADIR',
  'STAGING_EXECPREFIXDIR',
  'STAGING_LOADER_DIR',
  'STAGING_FIRMWARE_DIR',
  'STAGING_PYDIR',
  'STAGING_DIR_TARGET',
  'DEPLOY_DIR',
  'DEPLOY_DIR_TAR',
  'DEPLOY_DIR_IPK',
  'DEPLOY_DIR_RPM',
  'DEPLOY_DIR_DEB',
  'DEPLOY_DIR_IMAGE',
  'DEPLOY_DIR_TOOLS',
  'PKGDATA_DIR',
  'SDK_NAME',
  'SDKPATH',
  'OLDEST_KERNEL',
  'STAGING_KERNEL_DIR',
  'IMAGE_ROOTFS',
  'IMAGE_BASENAME',
  'IMAGE_NAME',
  'IMAGE_LINK_NAME',
  'IMAGE_EXTRA_SPACE',
  'IMAGE_CMD',
  'IMAGE_CMD_jffs2',
  'IMAGE_CMD_yaffs2',
  'IMAGE_CMD_cramfs',
  'IMAGE_CMD_ext2',
  'IMAGE_CMD_ext2.gz',
  'IMAGE_CMD_ext3',
  'IMAGE_CMD_ext3.gz',
  'IMAGE_CMD_squashfs',
  'IMAGE_CMD_squashfs-lzma',
  'IMAGE_CMD_tar',
  'IMAGE_CMD_tar.gz',
  'IMAGE_CMD_tar.bz2',
  'IMAGE_CMD_cpio',
  'IMAGE_CMD_cpio.gz',
  'IMAGE_CMD_ubi',
  'IMAGE_CMD_ubifs',
  'EXTRA_IMAGECMD',
  'EXTRA_IMAGECMD_jffs2',
  'EXTRA_IMAGECMD_yaffs2',
  'EXTRA_IMAGECMD_squashfs',
  'EXTRA_IMAGECMD_squashfs-lzma',
  'EXTRA_IMAGECMD_cpio',
  'EXTRA_IMAGECMD_cpio.gz',
  'EXTRA_IMAGECMD_ubi',
  'EXTRA_IMAGECMD_ubifs',
  'IMAGE_DEPENDS',
  'IMAGE_DEPENDS_jffs2',
  'IMAGE_DEPENDS_yaffs2',
  'IMAGE_DEPENDS_cramfs',
  'IMAGE_DEPENDS_ext2',
  'IMAGE_DEPENDS_ext2.gz',
  'IMAGE_DEPENDS_ext3',
  'IMAGE_DEPENDS_ext3.gz',
  'IMAGE_DEPENDS_squashfs',
  'IMAGE_DEPENDS_squashfs-lzma',
  'IMAGE_DEPENDS_ubi',
  'IMAGE_DEPENDS_ubifs',
  'EXTRA_IMAGEDEPENDS',
  'CROSS_DIR',
  'CROSS_DATADIR',
  'PATH_prepend',
  'PATH',
  'CCACHE',
  'TOOLCHAIN_OPTIONS',
  'CC',
  'CXX',
  'F77',
  'CPP',
  'LD',
  'CCLD',
  'AR',
  'AS',
  'RANLIB',
  'STRIP',
  'OBJCOPY',
  'OBJDUMP',
  'PYTHON',
  'BUILD_CC',
  'BUILD_CXX',
  'BUILD_F77',
  'BUILD_CPP',
  'BUILD_LD',
  'BUILD_CCLD',
  'BUILD_AR',
  'BUILD_RANLIB',
  'BUILD_STRIP',
  'MAKE',
  'EXTRA_OEMAKE',
  'PATCHTOOL',
  'PATCHRESOLVE',
  'BUILD_CPPFLAGS',
  'BUILDSDK_CPPFLAGS',
  'CPPFLAGS',
  'TARGET_CPPFLAGS',
  'BUILD_CFLAGS',
  'BUILDSDK_CFLAGS',
  'CFLAGS',
  'TARGET_CFLAGS',
  'BUILD_CXXFLAGS',
  'CXXFLAGS',
  'TARGET_CXXFLAGS',
  'BUILD_LDFLAGS',
  'BUILDSDK_LDFLAGS',
  'LDFLAGS',
  'TARGET_LDFLAGS',
  'ALLOWED_FLAGS',
  'EXTRA_OEMAKE_prepend_task-compile',
  'FULL_OPTIMIZATION',
  'DEBUG_OPTIMIZATION',
  'SELECTED_OPTIMIZATION',
  'BUILD_OPTIMIZATION',
  'BOOTSTRAP_EXTRA_RDEPENDS',
  'BOOTSTRAP_EXTRA_RRECOMMENDS',
  'QTDIR',
  'QPEDIR',
  'OPIEDIR',
  'palmtopdir',
  'palmqtdir',
  'ADOBE_MIRROR',
  'APACHE_MIRROR',
  'DEBIAN_MIRROR',
  'E_CVS',
  'E_URI',
  'FREEBSD_MIRROR',
  'FREEDESKTOP_CVS',
  'FREESMARTPHONE_GIT',
  'GENTOO_MIRROR',
  'GNOME_GIT',
  'GNOME_MIRROR',
  'GNU_MIRROR',
  'GPE_MIRROR',
  'GPE_EXTRA_SVN',
  'GPE_SVN',
  'GPEPHONE_MIRROR',
  'GPEPHONE_SVN',
  'HANDHELDS_CVS',
  'KERNELORG_MIRROR',
  'SOURCEFORGE_MIRROR',
  'XLIBS_MIRROR',
  'XORG_MIRROR',
  'FETCHCMD_svn',
  'FETCHCMD_cvs',
  'FETCHCMD_wget',
  'FETCHCMD_bzr',
  'FETCHCMD_hg',
  'FETCHCOMMAND',
  'FETCHCOMMAND_wget',
  'FETCHCOMMAND_cvs',
  'FETCHCOMMAND_svn',
  'CHECKCOMMAND_wget',
  'RESUMECOMMAND',
  'RESUMECOMMAND_wget',
  'UPDATECOMMAND',
  'UPDATECOMMAND_cvs',
  'UPDATECOMMAND_svn',
  'SRCDATE',
  'SRCREV',
  'AUTOREV',
  'SRCPV',
  'SRC_URI',
  'SHELLRCCMD',
  'SHELLCMDS',
  'GNOME_TERMCMD',
  'GNOME_TERMCMDRUN',
  'SCREEN_TERMCMD',
  'SCREEN_TERMCMDRUN',
  'XTERM_TERMCMD',
  'XTERM_TERMCMDRUN',
  'KONSOLE_TERMCMD',
  'KONSOLE_TERMCMDRUN',
  'TERMCMD',
  'TERMCMDRUN',
  'MKTEMPDIRCMD',
  'MKTEMPCMD',
  'PATCH_GET',
  'OPKGBUILDCMD',
  'SLOT',
  'PKG_CONFIG_DIR',
  'PKG_CONFIG_PATH',
  'PKG_CONFIG_SYSROOT_DIR',
  'PKG_CONFIG_DISABLE_UNINSTALLED',
  'QMAKE_MKSPEC_PATH',
  'STAGING_SIPDIR',
  'STAGING_IDLDIR',
  'AUTO_LIBNAME_PKGS',
  'OVERRIDES',
  'CPU_FEATURES',
  'CPU_FEATURES_arm',
  'DL_DIR',
  'IMAGE_FSTYPES',
  'PCMCIA_MANAGER',
  'DEFAULT_TASK_PROVIDER',
  'MACHINE_TASK_PROVIDER',
  'IMAGE_ROOTFS_SIZE',
  'IMAGE_ROOTFS_SIZE_ext2',
  'IMAGE_ROOTFS_SIZE_ext2.gz',
  'IMAGE_ROOTFS_SIZE_ext3',
  'IMAGE_ROOTFS_SIZE_ext3.gz',
  'CACHE',
  'PSTAGING_ACTIVE',
  'OES_BITBAKE_CONF',
  'MACHINE_FEATURES',
  'DISTRO_FEATURES',
  'ROOT_FLASH_SIZE',
  'MACHINE_GUI_CLASS',
  'GUI_MACHINE_CLASS',
  'MACHINE_DISPLAY_WIDTH_PIXELS',
  'MACHINE_DISPLAY_HEIGHT_PIXELS',
  'MACHINE_DISPLAY_ORIENTATION',
  'MACHINE_DISPLAY_BPP',
  'DISTRO_EXTRA_RDEPENDS',
  'DISTRO_EXTRA_RRECOMMENDS',
  'MACHINE_EXTRA_RDEPENDS',
  'MACHINE_EXTRA_RRECOMMENDS',
  'MACHINE_ESSENTIAL_EXTRA_RDEPENDS',
  'MACHINE_ESSENTIAL_EXTRA_RRECOMMENDS',
  'IMAGE_FEATURES',
  'COMBINED_FEATURES'
])
